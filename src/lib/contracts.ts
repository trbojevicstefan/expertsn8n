import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import type { Contract, ContractMessage, ContractReview, SessionUser } from "@/lib/types";

/** Contracts are only ever visible to their two parties, or to staff. */
export function canSeeContract(contract: Contract, session: SessionUser): boolean {
  return contract.clientId === session.uid || contract.expertUid === session.uid || Boolean(session.admin);
}

export async function loadContract(id: string): Promise<Contract | null> {
  if (!firebaseAdminConfigured) return null;
  const snap = await adminDb().collection("contracts").doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as Contract;
}

export async function contractsFor(session: SessionUser): Promise<Contract[]> {
  if (!firebaseAdminConfigured) return [];
  const db = adminDb();
  const [asClient, asExpert] = await Promise.all([
    db.collection("contracts").where("clientId", "==", session.uid).limit(100).get(),
    db.collection("contracts").where("expertUid", "==", session.uid).limit(100).get(),
  ]);

  const seen = new Set<string>();
  const all: Contract[] = [];
  for (const snap of [asClient, asExpert]) {
    for (const d of snap.docs) {
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      all.push({ id: d.id, ...d.data() } as Contract);
    }
  }
  return all.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export async function contractMessages(contractId: string): Promise<ContractMessage[]> {
  if (!firebaseAdminConfigured) return [];
  const snap = await adminDb()
    .collection("contractMessages")
    .where("contractId", "==", contractId)
    .limit(300)
    .get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as ContractMessage)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

export async function contractReviews(contractId: string): Promise<ContractReview[]> {
  if (!firebaseAdminConfigured) return [];
  const snap = await adminDb()
    .collection("reviews")
    .where("contractId", "==", contractId)
    .limit(10)
    .get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as ContractReview)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

export function fundedTotal(contract: Contract): number {
  return (contract.milestones || [])
    .filter((m) => ["FUNDED", "IN_PROGRESS", "SUBMITTED", "CHANGES_REQUESTED", "DISPUTED", "RELEASE_PENDING", "RELEASED"].includes(m.status))
    .reduce((sum, m) => sum + (m.amount || 0), 0);
}

export function releasedTotal(contract: Contract): number {
  return (contract.milestones || [])
    .filter((m) => m.status === "RELEASED")
    .reduce((sum, m) => sum + (m.amount || 0), 0);
}
