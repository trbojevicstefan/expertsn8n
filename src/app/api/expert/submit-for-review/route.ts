import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { completenessDetail } from "@/lib/expert-account";
import { notifyAdmins } from "@/lib/notifications";
import type { ExpertProfile } from "@/lib/types";

/** The subset a reviewer needs in order to have anything to judge. */
function blockingGaps(profile: ExpertProfile): string[] {
  const required: [string, boolean][] = [
    ["your name", Boolean(profile.name && profile.name.trim().length > 1)],
    ["a headline", Boolean(profile.title)],
    ["a bio of at least a short paragraph", Boolean(profile.bio && profile.bio.length > 80)],
    ["your location", Boolean(profile.location)],
    ["at least one skill", Boolean(profile.skills?.length)],
  ];
  return required.filter(([, ok]) => !ok).map(([label]) => label);
}

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

  const gaps = blockingGaps(profile);
  if (gaps.length > 0) {
    return NextResponse.json(
      { error: `Before review we need ${gaps.join(", ")}.`, gaps },
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

  const { pct } = completenessDetail(profile);
  return NextResponse.json({ ok: true, state: "SUBMITTED", completeness: pct });
}
