import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { ownerUidFor, postMessage } from "@/lib/expert-messages";
import { notifyUser } from "@/lib/notifications";

const schema = z.object({
  body: z.string().min(1).max(4000),
  /** Optional: send the note and send the profile back for changes in one step. */
  requestChanges: z.boolean().default(false),
});

export async function POST(req: Request, { params }: { params: Promise<{ uid: string }> }) {
  const session = await getSession();
  if (!session?.admin) return NextResponse.json({ error: "Admin required" }, { status: 403 });
  if (!firebaseAdminConfigured) {
    return NextResponse.json({ error: "Messaging is not available right now." }, { status: 503 });
  }

  const { uid: expertId } = await params;

  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Write a message first." }, { status: 400 });
  }

  const db = adminDb();
  const profileRef = db.collection("expertProfiles").doc(expertId);
  const profileSnap = await profileRef.get();
  if (!profileSnap.exists) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

  const nowIso = new Date().toISOString();
  const body = input.body.trim();

  const message = await postMessage({
    expertId,
    authorUid: session.uid,
    authorRole: "admin",
    authorName: session.name || "Marketplace review",
    body,
  });

  if (input.requestChanges) {
    await profileRef.set(
      { status: "NEEDS_CHANGES", verified: false, updatedAt: nowIso },
      { merge: true },
    );
    await db.collection("expertVerifications").doc(expertId).set(
      { state: "NEEDS_CHANGES", reviewedBy: session.uid, reviewNotes: body, reviewedAt: nowIso },
      { merge: true },
    );
    await db.collection("adminAuditLogs").add({
      actorId: session.uid,
      actorEmail: session.email,
      action: "EXPERT_NEEDS_CHANGES",
      targetType: "expert",
      targetId: expertId,
      reason: body,
      createdAt: nowIso,
    });
  }

  const ownerUid = await ownerUidFor(expertId);
  if (ownerUid) {
    await notifyUser(ownerUid, {
      type: input.requestChanges ? "REVIEW_DECISION" : "MESSAGE",
      title: input.requestChanges ? "Changes requested on your profile" : "Message from the review team",
      body: body.slice(0, 160),
      href: "/dashboard/expert/profile",
      expertId,
    });
  }

  return NextResponse.json({ ok: true, message, notified: Boolean(ownerUid) }, { status: 201 });
}
