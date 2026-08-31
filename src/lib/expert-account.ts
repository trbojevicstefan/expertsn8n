import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import type { ExpertDocument, ExpertProfile } from "@/lib/types";

/** Human labels for the `missingFields` slugs the seed writes. */
export const MISSING_FIELD_LABELS: Record<string, string> = {
  photo: "Profile photo",
  bio: "About you",
  location: "Location and timezone",
  hourlyRate: "Reference hourly rate",
  availability: "Availability",
  skills: "Skills and integrations",
};

export async function expertProfileForUid(uid: string): Promise<ExpertProfile | null> {
  if (!firebaseAdminConfigured) return null;
  const db = adminDb();
  const userSnap = await db.collection("users").doc(uid).get();
  const expertId = (userSnap.data() || {}).expertId;
  if (typeof expertId !== "string" || !expertId) return null;
  const profileSnap = await db.collection("expertProfiles").doc(expertId).get();
  if (!profileSnap.exists) return null;
  return { id: profileSnap.id, ...profileSnap.data() } as ExpertProfile;
}

export async function documentsForUid(uid: string): Promise<ExpertDocument[]> {
  if (!firebaseAdminConfigured) return [];
  const snap = await adminDb().collection("expertDocuments").where("ownerUid", "==", uid).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as ExpertDocument)
    .sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)));
}

/**
 * Which public-facing fields are filled in, and which are not.
 *
 * Returns the gaps by name rather than just a number: a bare percentage that
 * will not move leaves people guessing which field is holding it back.
 */
export function completenessDetail(profile: ExpertProfile): { pct: number; gaps: string[] } {
  const checks: [string, boolean][] = [
    ["Profile photo", Boolean(profile.photoUrl)],
    ["A bio of at least a short paragraph", Boolean(profile.bio && profile.bio.length > 80)],
    ["Location", Boolean(profile.location)],
    ["Reference hourly rate", Boolean(profile.hourlyRate && profile.hourlyRate > 0)],
    ["Availability", Boolean(profile.availability)],
    ["Skills", Boolean(profile.skills?.length)],
    ["At least one link", Boolean(profile.links?.length)],
  ];
  const done = checks.filter(([, ok]) => ok).length;
  return {
    pct: Math.round((done / checks.length) * 100),
    gaps: checks.filter(([, ok]) => !ok).map(([label]) => label),
  };
}

/** Percentage of the public-facing fields that are actually filled in. */
export function completeness(profile: ExpertProfile): number {
  return completenessDetail(profile).pct;
}
