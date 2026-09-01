import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { ownerUidFor } from "@/lib/expert-messages";
import { syncMarketplaceUser } from "@/lib/customerio";

export async function POST(_: Request, { params }: { params: Promise<{ uid: string }> }) {
  const session = await getSession();
  if (!session?.admin) return NextResponse.json({ error: "Admin required" }, { status: 403 });
  try {
    const { uid } = await params;
    if (!firebaseAdminConfigured) throw new Error("Firebase Admin is not configured.");
    const db = adminDb();
    const verification = await db.collection("expertVerifications").doc(uid).get();
    if (verification.data()?.state !== "VERIFIED") throw new Error("Expert must be VERIFIED before publication.");
    const batch = db.batch();
    batch.set(db.collection("expertProfiles").doc(uid), { status: "PUBLISHED", verified: true, publishedAt: new Date().toISOString() }, { merge: true });
    batch.set(db.collection("expertVerifications").doc(uid), { state: "PUBLISHED", publishedAt: new Date().toISOString(), publishedBy: session.uid }, { merge: true });
    batch.create(db.collection("adminAuditLogs").doc(), { actorId: session.uid, action: "EXPERT_PUBLISHED", targetType: "expert", targetId: uid, createdAt: new Date().toISOString() });
    await batch.commit();
    const ownerUid = await ownerUidFor(uid);
    if (ownerUid) await syncMarketplaceUser(ownerUid, "expert_published");
    return NextResponse.json({ ok: true, state: "PUBLISHED" });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Publish failed" }, { status: 400 });
  }
}
