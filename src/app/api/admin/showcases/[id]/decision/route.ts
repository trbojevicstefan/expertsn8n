import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { notifyUser } from "@/lib/notifications";
import { ownerUidFor } from "@/lib/expert-messages";

const schema = z.object({
  reviewState: z.enum(["APPROVED", "REJECTED", "PENDING"]),
  reason: z.string().max(1000).default(""),
});

/**
 * A showcase is the evidence a profile is judged on, so it stays hidden from
 * the public profile until someone approves it. Without this endpoint a
 * submitted showcase had no route out of PENDING.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.admin) return NextResponse.json({ error: "Admin required" }, { status: 403 });
  if (!firebaseAdminConfigured) {
    return NextResponse.json({ error: "Reviews are not available right now." }, { status: 503 });
  }

  const { id } = await params;

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid decision." }, { status: 400 });
  }

  const db = adminDb();
  const ref = db.collection("expertShowcases").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: "Showcase not found." }, { status: 404 });

  const showcase = snap.data() || {};
  const nowIso = new Date().toISOString();

  await ref.set(
    {
      reviewState: input.reviewState,
      reviewedBy: session.uid,
      reviewedAt: nowIso,
      reviewNotes: input.reason,
      updatedAt: nowIso,
    },
    { merge: true },
  );

  await db.collection("adminAuditLogs").add({
    actorId: session.uid,
    actorEmail: session.email,
    action: `SHOWCASE_${input.reviewState}`,
    targetType: "showcase",
    targetId: id,
    reason: input.reason,
    createdAt: nowIso,
  });

  const expertId = typeof showcase.expertId === "string" ? showcase.expertId : "";
  const ownerUid = expertId ? await ownerUidFor(expertId) : null;
  if (ownerUid) {
    await notifyUser(ownerUid, {
      type: "REVIEW_DECISION",
      title:
        input.reviewState === "APPROVED"
          ? "A showcase was approved"
          : input.reviewState === "REJECTED"
            ? "A showcase needs changes"
            : "A showcase was returned to pending",
      body: `${showcase.title || "Your showcase"}${input.reason ? ` — ${input.reason}` : ""}`.slice(0, 160),
      href: "/dashboard/expert/showcases",
      expertId,
    });
  }

  return NextResponse.json({ ok: true, reviewState: input.reviewState });
}
