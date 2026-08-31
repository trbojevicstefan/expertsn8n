import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { adminDb, adminStorage, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { assertNoOffPlatformContact } from "@/lib/contact-guard";
import { notifyAdmins } from "@/lib/notifications";

const schema = z.object({
  title: z.string().min(5).max(120),
  summary: z.string().min(40).max(2000),
  outcome: z.string().min(3).max(200),
  integrations: z.array(z.string().min(1).max(48)).max(12).default([]),
  complexity: z.enum(["Intermediate", "Advanced", "Expert"]),
});

async function expertIdFor(uid: string): Promise<string | null> {
  const snap = await adminDb().collection("users").doc(uid).get();
  const expertId = (snap.data() || {}).expertId;
  return typeof expertId === "string" && expertId ? expertId : null;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "expert") {
    return NextResponse.json({ error: "Expert account required." }, { status: 401 });
  }
  if (!firebaseAdminConfigured) {
    return NextResponse.json({ error: "Showcases are not available right now." }, { status: 503 });
  }

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "Give the showcase a title, at least a short paragraph of detail, and an outcome." },
      { status: 400 },
    );
  }

  try {
    assertNoOffPlatformContact(`${input.summary} ${input.outcome}`);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid content." }, { status: 400 });
  }

  const expertId = await expertIdFor(session.uid);
  if (!expertId) {
    return NextResponse.json({ error: "No expert profile is linked to this account." }, { status: 404 });
  }

  const nowIso = new Date().toISOString();
  const ref = adminDb().collection("expertShowcases").doc();
  await ref.set({
    expertId,
    ownerUid: session.uid,
    title: input.title,
    summary: input.summary,
    outcome: input.outcome,
    integrations: input.integrations,
    complexity: input.complexity,
    // Showcases are what the directory treats as evidence, so they are only
    // publicly visible once a reviewer has approved them.
    reviewState: "PENDING",
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  const profile = await adminDb().collection("expertProfiles").doc(expertId).get();
  await notifyAdmins({
    type: "SHOWCASE_SUBMITTED",
    title: `${(profile.data() || {}).name || "An expert"} submitted a showcase`,
    body: input.title,
    href: `/admin/experts/${expertId}`,
    expertId,
  });

  return NextResponse.json({ id: ref.id, ok: true }, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "expert") {
    return NextResponse.json({ error: "Expert account required." }, { status: 401 });
  }
  if (!firebaseAdminConfigured) {
    return NextResponse.json({ error: "Showcases are not available right now." }, { status: 503 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing showcase id." }, { status: 400 });

  const ref = adminDb().collection("expertShowcases").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: "Showcase not found." }, { status: 404 });
  if ((snap.data() || {}).ownerUid !== session.uid) {
    return NextResponse.json({ error: "Not your showcase." }, { status: 403 });
  }

  // Remove the uploaded files too, or they linger in Storage with nothing
  // pointing at them and no way for the expert to reach them again.
  const attachments = ((snap.data() || {}).attachments || []) as { storagePath?: string }[];
  await Promise.all(
    attachments
      .filter((a) => a.storagePath)
      .map(async (a) => {
        try {
          await adminStorage().bucket().file(a.storagePath!).delete();
        } catch {
          /* already gone */
        }
      }),
  );

  await ref.delete();
  return NextResponse.json({ ok: true, removedFiles: attachments.length });
}
