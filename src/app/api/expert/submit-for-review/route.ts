import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { completenessDetail } from "@/lib/expert-account";
import { notifyAdmins } from "@/lib/notifications";
import type { ExpertProfile } from "@/lib/types";
import { syncMarketplaceUser } from "@/lib/customerio";

export async function POST() {
  const session = await getSession();
  if (!session || session.role !== "expert") {
    return NextResponse.json({ error: "Expert account required." }, { status: 401 });
  }
  if (!firebaseAdminConfigured) {
    return NextResponse.json({ error: "Reviews are not available right now." }, { status: 503 });
  }

  const db = adminDb();
  const userSnap = await db.collection("users").doc(session.uid).get();
  const expertId = (userSnap.data() || {}).expertId;
  if (typeof expertId !== "string" || !expertId) {
    return NextResponse.json({ error: "No expert profile is linked to this account." }, { status: 404 });
  }

  const profileRef = db.collection("expertProfiles").doc(expertId);
  const snap = await profileRef.get();
  if (!snap.exists) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

  const profile = { id: snap.id, ...snap.data() } as ExpertProfile;
  if (profile.claimedByUid !== session.uid) {
    return NextResponse.json({ error: "This profile belongs to another account." }, { status: 403 });
  }
  if (profile.status === "SUBMITTED") {
    return NextResponse.json({ error: "This profile is already waiting for review." }, { status: 409 });
  }
  if (profile.status === "PUBLISHED" && profile.verified) {
    return NextResponse.json({ error: "This profile is already verified." }, { status: 409 });
  }

  // The same list the expert's own completeness card shows, so the button
  // never refuses something the page did not already ask for. A CV and a
  // showcase are chased separately: gating on them would block every expert in
  // the marketplace, not just the unfinished ones.
  const { pct, gaps } = completenessDetail(profile);
  if (gaps.length > 0) {
    return NextResponse.json(
      { error: `Your profile is not ready for review yet. Still missing: ${gaps.join(", ")}.`, gaps },
      { status: 400 },
    );
  }

  const nowIso = new Date().toISOString();
  await profileRef.set({ status: "SUBMITTED", updatedAt: nowIso }, { merge: true });
  await db.collection("expertVerifications").doc(expertId).set(
    { state: "SUBMITTED", submittedAt: nowIso },
    { merge: true },
  );

  await notifyAdmins({
    type: "PROFILE_SUBMITTED",
    title: `${profile.name} submitted a profile for review`,
    body: profile.title || "No headline yet",
    href: `/admin/experts/${expertId}`,
    expertId,
  });
  await syncMarketplaceUser(session.uid, "expert_profile_submitted");

  return NextResponse.json({ ok: true, state: "SUBMITTED", completeness: pct });
}
