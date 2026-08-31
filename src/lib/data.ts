import type { ExpertProfile, MarketplaceJob, SessionUser, Showcase } from "@/lib/types";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { privateJobInviteAccess } from "@/lib/marketplace-policy";

/**
 * Every read here is live Firestore. There is no fixture fallback: an
 * unconfigured environment returns nothing rather than inventing experts,
 * jobs or contract history that does not exist.
 */

function empty<T>(): T[] {
  return [];
}

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

/** Public/SEO lookup deliberately never returns private jobs. */
export async function findJob(id: string) {
  if (!firebaseAdminConfigured) return null;
  const doc = await adminDb().collection("jobs").doc(id).get();
  if (!doc.exists) return null;
  const job = { id: doc.id, ...doc.data() } as MarketplaceJob;
  return job.visibility === "PUBLIC" && job.status === "OPEN" ? job : null;
}

export interface JobViewerAccess {
  job: MarketplaceJob;
  inviteStatus: string | null;
  canApply: boolean;
}

/**
 * Private jobs never become generally discoverable. The owner/admin may inspect
 * them; an expert may view only while a non-expired SENT/ACCEPTED invitation
 * exists, and may apply only after accepting it.
 */
export async function findJobForViewer(id: string, session: SessionUser | null): Promise<JobViewerAccess | null> {
  if (!firebaseAdminConfigured) return null;
  const db = adminDb();
  const doc = await db.collection("jobs").doc(id).get();
  if (!doc.exists) return null;
  const job = { id: doc.id, ...doc.data() } as MarketplaceJob;

  if (job.visibility === "PUBLIC") {
    if (job.status !== "OPEN") return null;
    return { job, inviteStatus: null, canApply: session?.role === "expert" };
  }

  if (!session) return null;
  if (session.admin || job.clientId === session.uid) {
    return { job, inviteStatus: null, canApply: false };
  }
  if (session.role !== "expert") return null;

  const invites = await db
    .collection("jobInvites")
    .where("jobId", "==", id)
    .where("expertUid", "==", session.uid)
    .limit(10)
    .get();
  const nowMs = Date.now();
  for (const inviteDoc of invites.docs) {
    const invite = inviteDoc.data() || {};
    const access = privateJobInviteAccess({
      inviteStatus: String(invite.status || "SENT"),
      expiresAt: typeof invite.expiresAt === "string" ? invite.expiresAt : null,
      jobStatus: job.status,
      nowMs,
    });
    if (access.canView) {
      return { job, inviteStatus: String(invite.status || "SENT"), canApply: access.canApply };
    }
  }
  return null;
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
