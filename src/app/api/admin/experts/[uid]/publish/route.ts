import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { loadExpertVerificationChecklist } from "@/lib/verification-checklist";

export async function POST(_: Request, { params }: { params: Promise<{ uid: string }> }) {
  const session = await getSession();
  if (!session?.admin) return NextResponse.json({ error: "Admin required" }, { status: 403 });
  try {
    const { uid } = await params;
    if (!firebaseAdminConfigured) throw new Error("Firebase Admin is not configured.");
    const db = adminDb();
    const [profileSnap, verification, checklist] = await Promise.all([
      db.collection("expertProfiles").doc(uid).get(),
      db.collection("expertVerifications").doc(uid).get(),
      loadExpertVerificationChecklist(uid),
    ]);
    if (!profileSnap.exists) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    if (verification.data()?.state !== "VERIFIED") {
      return NextResponse.json({ error: "Expert must be VERIFIED before publication." }, { status: 409 });
    }
    if (!checklist?.readyToPublish) {
      return NextResponse.json(
        { error: `Publication checklist is incomplete: ${(checklist?.missing || []).join(", ")}.`, checklist },
        { status: 409 },
      );
    }

    const nowIso = new Date().toISOString();
    const batch = db.batch();
    batch.set(
      db.collection("expertProfiles").doc(uid),
      {
        status: "PUBLISHED",
        verified: true,
        publishedAt: nowIso,
        suspensionReason: null,
        suspendedAt: null,
        updatedAt: nowIso,
      },
      { merge: true },
    );
    batch.set(
      db.collection("expertVerifications").doc(uid),
      { state: "PUBLISHED", publishedAt: nowIso, publishedBy: session.uid },
      { merge: true },
    );
    batch.create(db.collection("adminAuditLogs").doc(), {
      actorId: session.uid,
      actorEmail: session.email,
      action: "EXPERT_PUBLISHED",
      targetType: "expert",
      targetId: uid,
      reason: "Verification checklist complete",
      createdAt: nowIso,
    });
    batch.create(db.collection("auditEvents").doc(), {
      actorUid: session.uid,
      actorEmail: session.email,
      actorRole: session.role,
      action: "EXPERT_PUBLISHED",
      targetType: "expertProfile",
      targetId: uid,
      reason: "Verification checklist complete",
      metadata: { checklist: checklist.items.map((item) => ({ key: item.key, complete: item.complete })) },
      createdAt: nowIso,
      immutable: true,
    });
    await batch.commit();
    return NextResponse.json({ ok: true, state: "PUBLISHED", checklist });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Publish failed" }, { status: 400 });
  }
}
