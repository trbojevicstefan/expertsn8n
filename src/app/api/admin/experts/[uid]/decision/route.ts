import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { notifyUser } from "@/lib/notifications";
import { ownerUidFor, postMessage } from "@/lib/expert-messages";
import { syncMarketplaceUser } from "@/lib/customerio";

const schema = z.object({
  decision: z.enum(["VERIFIED", "NEEDS_CHANGES", "REJECTED", "SUSPENDED", "PUBLISHED"]),
  reason: z.string().min(3).max(1000),
});

/**
 * Verification and publication are separate axes, and conflating them was a
 * bug: writing the decision straight into `status` meant verifying a live
 * profile set status to VERIFIED, which drops it out of the directory query.
 *
 * `verified` drives the badge. `status` drives visibility.
 */
function profilePatch(decision: z.infer<typeof schema>["decision"]) {
  switch (decision) {
    case "VERIFIED":
      // Reviewed and trusted — badge on, stays listed.
      return { verified: true, status: "PUBLISHED" };
    case "PUBLISHED":
      // Back into the directory without asserting it passed review.
      return { status: "PUBLISHED" };
    case "NEEDS_CHANGES":
      return { verified: false, status: "NEEDS_CHANGES" };
    case "REJECTED":
      return { verified: false, status: "REJECTED" };
    case "SUSPENDED":
      return { verified: false, status: "SUSPENDED" };
  }
}

const DECISION_LABEL: Record<z.infer<typeof schema>["decision"], string> = {
  VERIFIED: "verified",
  PUBLISHED: "listed in the directory",
  NEEDS_CHANGES: "changes requested",
  REJECTED: "rejected",
  SUSPENDED: "suspended",
};

export async function POST(req: Request, { params }: { params: Promise<{ uid: string }> }) {
  const session = await getSession();
  if (!session?.admin) return NextResponse.json({ error: "Admin required" }, { status: 403 });

  try {
    const { uid } = await params;
    const input = schema.parse(await req.json());
    if (!firebaseAdminConfigured) throw new Error("Firebase Admin is not configured.");

    const db = adminDb();
    const profileRef = db.collection("expertProfiles").doc(uid);
    if (!(await profileRef.get()).exists) {
      return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    }

    const nowIso = new Date().toISOString();
    const batch = db.batch();

    batch.set(
      db.collection("expertVerifications").doc(uid),
      { state: input.decision, reviewedBy: session.uid, reviewNotes: input.reason, reviewedAt: nowIso },
      { merge: true },
    );

    batch.set(profileRef, { ...profilePatch(input.decision), updatedAt: nowIso }, { merge: true });

    batch.create(db.collection("adminAuditLogs").doc(), {
      actorId: session.uid,
      actorEmail: session.email,
      action: `EXPERT_${input.decision}`,
      targetType: "expert",
      targetId: uid,
      reason: input.reason,
      createdAt: nowIso,
    });

    await batch.commit();

    // The reason is the useful part of a decision, so it lands in the expert's
    // thread as well as in the notification.
    const ownerUid = await ownerUidFor(uid);
    if (ownerUid) {
      await postMessage({
        expertId: uid,
        authorUid: session.uid,
        authorRole: "admin",
        authorName: session.name || "Marketplace review",
        body: `Decision: ${DECISION_LABEL[input.decision]}.

${input.reason}`,
      });
      await notifyUser(ownerUid, {
        type: "REVIEW_DECISION",
        title: `Your profile was reviewed: ${DECISION_LABEL[input.decision]}`,
        body: input.reason.slice(0, 160),
        href: "/dashboard/expert/profile",
        expertId: uid,
      });
    }
    if (ownerUid) await syncMarketplaceUser(ownerUid, `expert_${input.decision.toLowerCase()}`);

    return NextResponse.json({ ok: true, decision: input.decision });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid decision" },
      { status: 400 },
    );
  }
}
