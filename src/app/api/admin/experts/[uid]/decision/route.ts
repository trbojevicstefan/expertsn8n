import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { getSession } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { notifyUser } from "@/lib/notifications";
import { ownerUidFor, postMessage } from "@/lib/expert-messages";

const schema = z.object({
  decision: z.enum(["VERIFIED", "NEEDS_CHANGES", "REJECTED", "SUSPENDED"]),
  reason: z.string().min(3).max(1000),
});

function profilePatch(decision: z.infer<typeof schema>["decision"], reason: string, actorUid: string, nowIso: string) {
  switch (decision) {
    case "VERIFIED":
      // Verification is trust state, not directory publication. Publish is a
      // separate checklist-gated action.
      return {
        verified: true,
        status: "VERIFIED",
        suspensionReason: null,
        suspendedAt: null,
      };
    case "NEEDS_CHANGES":
      return { verified: false, status: "NEEDS_CHANGES" };
    case "REJECTED":
      return { verified: false, status: "REJECTED" };
    case "SUSPENDED":
      return {
        verified: false,
        status: "SUSPENDED",
        suspensionReason: reason,
        suspendedAt: nowIso,
        suspensionHistory: FieldValue.arrayUnion({ reason, suspendedAt: nowIso, suspendedByUid: actorUid }),
      };
  }
}

const DECISION_LABEL: Record<z.infer<typeof schema>["decision"], string> = {
  VERIFIED: "verified — ready for publication checks",
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
    batch.set(profileRef, { ...profilePatch(input.decision, input.reason, session.uid, nowIso), updatedAt: nowIso }, { merge: true });

    const legacyAudit = db.collection("adminAuditLogs").doc();
    batch.create(legacyAudit, {
      actorId: session.uid,
      actorEmail: session.email,
      action: `EXPERT_${input.decision}`,
      targetType: "expert",
      targetId: uid,
      reason: input.reason,
      createdAt: nowIso,
    });
    const auditEvent = db.collection("auditEvents").doc();
    batch.create(auditEvent, {
      actorUid: session.uid,
      actorEmail: session.email,
      actorRole: session.role,
      action: `EXPERT_${input.decision}`,
      targetType: "expertProfile",
      targetId: uid,
      reason: input.reason,
      metadata: { decision: input.decision },
      createdAt: nowIso,
      immutable: true,
    });

    await batch.commit();

    const ownerUid = await ownerUidFor(uid);
    if (ownerUid) {
      await postMessage({
        expertId: uid,
        authorUid: session.uid,
        authorRole: "admin",
        authorName: session.name || "Marketplace review",
        body: `Decision: ${DECISION_LABEL[input.decision]}.\n\n${input.reason}`,
      });
      await notifyUser(ownerUid, {
        type: "REVIEW_DECISION",
        title: `Your profile was reviewed: ${DECISION_LABEL[input.decision]}`,
        body: input.reason.slice(0, 160),
        href: "/dashboard/expert/profile",
        expertId: uid,
      });
    }

    return NextResponse.json({ ok: true, decision: input.decision });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid decision" }, { status: 400 });
  }
}
