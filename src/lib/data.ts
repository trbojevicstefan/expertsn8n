import { experts as demoExperts, jobs as demoJobs, showcases as demoShowcases } from "@/lib/demo-data";
import type { ExpertProfile, MarketplaceJob, Showcase } from "@/lib/types";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";

const demo = process.env.DEMO_MODE === "true" || !firebaseAdminConfigured;

export async function listPublishedExperts(): Promise<ExpertProfile[]> {
  if (demo) return demoExperts;
  const snap = await adminDb().collection("expertProfiles").where("status", "==", "PUBLISHED").limit(50).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ExpertProfile));
}

export async function findExpertBySlug(slug: string) {
  const all = await listPublishedExperts();
  return all.find(e => e.slug === slug) || null;
}

export async function listShowcasesForExpert(expertId: string): Promise<Showcase[]> {
  if (demo) return demoShowcases.filter(s => s.expertId === expertId);
  const snap = await adminDb().collection("expertShowcases").where("expertId", "==", expertId).where("reviewState", "==", "APPROVED").get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Showcase));
}

export async function listPublicJobs(): Promise<MarketplaceJob[]> {
  if (demo) return demoJobs;
  const snap = await adminDb().collection("jobs").where("visibility", "==", "PUBLIC").where("status", "==", "OPEN").limit(50).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as MarketplaceJob));
}

export async function findJob(id: string) {
  const jobs = await listPublicJobs();
  return jobs.find(j => j.id === id) || null;
}
