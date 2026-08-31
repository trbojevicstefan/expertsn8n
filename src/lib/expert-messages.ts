import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import type { ExpertMessage } from "@/lib/types";

const COLLECTION = "expertMessages";

/** One review thread per expert profile, shared by the expert and staff. */
export async function threadFor(expertId: string, limit = 200): Promise<ExpertMessage[]> {
  if (!firebaseAdminConfigured || !expertId) return [];
  const snap = await adminDb().collection(COLLECTION).where("expertId", "==", expertId).limit(limit).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as ExpertMessage)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

export async function postMessage(msg: Omit<ExpertMessage, "id" | "createdAt">): Promise<ExpertMessage> {
  const createdAt = new Date().toISOString();
  const ref = await adminDb().collection(COLLECTION).add({ ...msg, createdAt });
  return { id: ref.id, createdAt, ...msg };
}

/** The account that owns a profile, so a reply can be addressed to them. */
export async function ownerUidFor(expertId: string): Promise<string | null> {
  if (!firebaseAdminConfigured) return null;
  const snap = await adminDb().collection("expertProfiles").doc(expertId).get();
  const uid = (snap.data() || {}).claimedByUid;
  return typeof uid === "string" && uid ? uid : null;
}
