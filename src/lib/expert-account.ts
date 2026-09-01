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
 * Completeness is deliberately two-tier.
 *
 * `pct` counts only the fields a profile needs to be usable in the directory,
 * so adding richer optional fields later never knocks an existing expert's
 * percentage down. `extras` are the things that make a profile stand out and
 * are reported separately as suggestions.
 */
export function completenessDetail(profile: ExpertProfile): {
  pct: number;
  gaps: string[];
  extras: { label: string; done: boolean }[];
} {
  const core: [string, boolean][] = [
    ["Your name", Boolean(profile.name && profile.name.trim().length > 1)],
    ["A headline", Boolean(profile.title)],
    ["Profile photo", Boolean(profile.photoUrl)],
    ["A bio of at least a short paragraph", Boolean(profile.bio && profile.bio.length > 80)],
    ["Location", Boolean(profile.location)],
    ["Reference hourly rate", Boolean(profile.hourlyRate && profile.hourlyRate > 0)],
    ["Availability", Boolean(profile.availability)],
    ["Skills", Boolean(profile.skills?.length)],
    ["At least one link", Boolean(profile.links?.length)],
  ];

  const extras = [
    { label: "Languages you work in", done: Boolean(profile.languages?.length) },
    { label: "Years of experience", done: Boolean(profile.yearsExperience) },
    { label: "Hours available per week", done: Boolean(profile.hoursPerWeek) },
    { label: "Minimum engagement size", done: Boolean(profile.minEngagement) },
    { label: "Where your n8n experience sits", done: Boolean(profile.n8nExperience?.length) },
    { label: "Integrations you work with", done: Boolean(profile.integrations?.length) },
  ];

  const done = core.filter(([, ok]) => ok).length;
  return {
    pct: Math.round((done / core.length) * 100),
    gaps: core.filter(([, ok]) => !ok).map(([label]) => label),
    extras,
  };
}

/**
 * Everything that has to be true before a profile is worth a reviewer's time,
 * named once.
 *
 * Customer.io mirrors this list into `expert_missing_properties` and its
 * campaigns read it back verbatim, the sign-up page promises "photo + CV +
 * portfolio", and the submit button enforces it. All three now come from here,
 * so an expert is never chased for something the gate does not ask for -- or
 * let through without something it does.
 */
export function expertProfileGaps(
  profile: ExpertProfile,
  evidence: { hasCv: boolean; showcaseCount: number },
): string[] {
  return [
    ...completenessDetail(profile).gaps,
    ...(!evidence.hasCv ? ["CV"] : []),
    // A showcase awaiting review still counts: requiring an approved one would
    // be circular, since showcases are reviewed alongside the profile.
    ...(evidence.showcaseCount === 0 ? ["Showcase"] : []),
  ];
}

/** Percentage of the required public-facing fields that are filled in. */
export function completeness(profile: ExpertProfile): number {
  return completenessDetail(profile).pct;
}
