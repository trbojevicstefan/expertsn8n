import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import type { ContractActivity, ContractActivityType } from "@/lib/types";

export interface ContractActivityInput {
  contractId: string;
  type: ContractActivityType;
  actorUid?: string | null;
  actorName?: string;
  milestoneId?: string | null;
  title: string;
  detail?: string;
  createdAt?: string;
}

export async function recordContractActivity(input: ContractActivityInput): Promise<string | null> {
  if (!firebaseAdminConfigured) return null;
  const ref = adminDb().collection("contractActivities").doc();
  await ref.set({
    contractId: input.contractId,
    type: input.type,
    actorUid: input.actorUid || null,
    actorName: input.actorName || "Marketplace",
    milestoneId: input.milestoneId || null,
    title: input.title,
    detail: input.detail || "",
    createdAt: input.createdAt || new Date().toISOString(),
  });
  return ref.id;
}

export async function contractActivities(contractId: string): Promise<ContractActivity[]> {
  if (!firebaseAdminConfigured) return [];
  const snap = await adminDb()
    .collection("contractActivities")
    .where("contractId", "==", contractId)
    .limit(200)
    .get();

  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as ContractActivity)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}
