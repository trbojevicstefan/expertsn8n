import type { ExpertProfile, MarketplaceJob, Showcase } from "@/lib/types";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";

/**
 * Every read here is live Firestore. There is no fixture fallback: an
 * unconfigured environment returns nothing rather than inventing experts,
 * jobs or contract history that does not exist.
 */

function empty<T>(): T[] {
  return [];
}

/** Complete, claimed profiles surface first; everything else stays visible but
 *  ranks below. Sorted in memory so no composite index is needed. */
function directoryRank(e: ExpertProfile): number {
  return (e.photoUrl ? 4 : 0) + (e.claimState === "CLAIMED" ? 2 : 0) + (e.hourlyRate > 0 ? 1 : 0);
}

export async function listPublishedExperts(): Promise<ExpertProfile[]> {
  if (!firebaseAdminConfigured) return empty<ExpertProfile>();
  const snap = await adminDb().collection("expertProfiles").where("status", "==", "PUBLISHED").limit(200).get();
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as ExpertProfile))
    .sort((a, b) => directoryRank(b) - directoryRank(a) || a.name.localeCompare(b.name));
}

export async function findExpertBySlug(slug: string) {
  if (!firebaseAdminConfigured) return null;
  const snap = await adminDb().collection("expertProfiles").where("slug", "==", slug).limit(1).get();
  const doc = snap.docs[0];
  if (!doc) return null;
  const profile = { id: doc.id, ...doc.data() } as ExpertProfile;
  return profile.status === "PUBLISHED" ? profile : null;
}

/**
 * The directory shows PUBLISHED profiles only, but an expert has to be able to
 * see what theirs will look like before it gets there -- and a reviewer has to
 * see the same thing. Ownership is resolved here so the public page can serve
 * the preview rather than a second, drifting copy of it.
 */
export async function findExpertBySlugForViewer(
  slug: string,
  viewer?: { uid: string; admin?: boolean } | null,
): Promise<{ profile: ExpertProfile; preview: boolean } | null> {
  if (!firebaseAdminConfigured) return null;
  const snap = await adminDb().collection("expertProfiles").where("slug", "==", slug).limit(1).get();
  const doc = snap.docs[0];
  if (!doc) return null;

  const profile = { id: doc.id, ...doc.data() } as ExpertProfile;
  if (profile.status === "PUBLISHED") return { profile, preview: false };
  if (!viewer) return null;
  if (viewer.admin) return { profile, preview: true };

  // Someone who claimed a seeded profile is linked through `users/{uid}`, so
  // the document id alone would miss them.
  const linkedId = (await adminDb().collection("users").doc(viewer.uid).get()).data()?.expertId;
  const owns = profile.claimedByUid === viewer.uid || linkedId === profile.id;
  return owns ? { profile, preview: true } : null;
}

export async function listShowcasesForExpert(expertId: string): Promise<Showcase[]> {
  if (!firebaseAdminConfigured) return empty<Showcase>();
  const snap = await adminDb()
    .collection("expertShowcases")
    .where("expertId", "==", expertId)
    .where("reviewState", "==", "APPROVED")
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Showcase));
}

export async function listPublicJobs(): Promise<MarketplaceJob[]> {
  if (!firebaseAdminConfigured) return empty<MarketplaceJob>();
  const snap = await adminDb()
    .collection("jobs")
    .where("visibility", "==", "PUBLIC")
    .where("status", "==", "OPEN")
    .limit(100)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as MarketplaceJob));
}

export async function findJob(id: string) {
  if (!firebaseAdminConfigured) return null;
  const doc = await adminDb().collection("jobs").doc(id).get();
  if (!doc.exists) return null;
  const job = { id: doc.id, ...doc.data() } as MarketplaceJob;
  return job.visibility === "PUBLIC" && job.status === "OPEN" ? job : null;
}

/** Every job regardless of status or visibility. Admin surfaces only. */
export async function listAllJobs(): Promise<MarketplaceJob[]> {
  if (!firebaseAdminConfigured) return empty<MarketplaceJob>();
  const snap = await adminDb().collection("jobs").limit(300).get();
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as MarketplaceJob))
    .sort((a, b) => String(b.postedAt || "").localeCompare(String(a.postedAt || "")));
}

export async function listJobsForClient(clientId: string): Promise<MarketplaceJob[]> {
  if (!firebaseAdminConfigured) return empty<MarketplaceJob>();
  const snap = await adminDb().collection("jobs").where("clientId", "==", clientId).limit(100).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as MarketplaceJob));
}

export interface MarketplaceStats {
  experts: number;
  claimed: number;
  countries: number;
  openJobs: number;
  specialisms: number;
}

/** Real counts for the public site. Anything the marketplace has not actually
 *  done yet reads as zero rather than being filled in with a plausible number. */
export async function marketplaceStats(): Promise<MarketplaceStats> {
  if (!firebaseAdminConfigured) {
    return { experts: 0, claimed: 0, countries: 0, openJobs: 0, specialisms: 0 };
  }
  const [experts, jobs] = await Promise.all([listPublishedExperts(), listPublicJobs()]);
  const countries = new Set(experts.map(e => e.country).filter(Boolean));
  const specialisms = new Set(experts.flatMap(e => e.skills || []));
  return {
    experts: experts.length,
    claimed: experts.filter(e => e.claimState === "CLAIMED").length,
    countries: countries.size,
    openJobs: jobs.length,
    specialisms: specialisms.size,
  };
}
