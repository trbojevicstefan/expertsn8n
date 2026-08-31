import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { beginPaymentAction, effectivePaymentStatus, type PaymentStatus } from "./state";
import type { Contract, ContractMilestone } from "@/lib/types";

export interface PendingProviderActionInput {
  contractId: string;
  milestoneId: string;
  action: "fund" | "release" | "refund";
  provider: string;
  providerActionId: string;
}

export function paymentIdempotencyKey(
  contractId: string,
  milestoneId: string,
  action: "fund" | "release" | "refund",
): string {
  return `contract:${contractId}:milestone:${milestoneId}:${action}:v1`;
}

export async function markProviderActionPending(
  input: PendingProviderActionInput,
): Promise<{ paymentStatus: PaymentStatus; idempotent: boolean }> {
  if (!firebaseAdminConfigured) throw new Error("Firebase Admin is not configured.");
  if (!input.provider.trim() || !input.providerActionId.trim()) throw new Error("Provider action identity is required.");

  const db = adminDb();
  const ref = db.collection("contracts").doc(input.contractId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("Contract not found.");

    const contract = { id: snap.id, ...snap.data() } as Contract;
    const milestones = [...(contract.milestones || [])];
    const idx = milestones.findIndex((m) => m.id === input.milestoneId);
    if (idx < 0) throw new Error("Milestone not found.");

    const milestone = milestones[idx]!;
    const existingActionId =
      input.action === "fund"
        ? milestone.providerFundingId
        : input.action === "release"
          ? milestone.providerReleaseId
          : milestone.providerRefundId;

    const expectedPending: PaymentStatus =
      input.action === "fund" ? "PENDING" : input.action === "release" ? "RELEASE_PENDING" : "REFUND_PENDING";

    if (
      existingActionId === input.providerActionId &&
      milestone.paymentProvider === input.provider &&
      effectivePaymentStatus(milestone) === expectedPending
    ) {
      return { paymentStatus: expectedPending, idempotent: true };
    }

    const paymentStatus = beginPaymentAction(effectivePaymentStatus(milestone), input.action);
    const next: ContractMilestone = {
      ...milestone,
      paymentStatus,
      paymentProvider: input.provider,
    };

    if (input.action === "fund") next.providerFundingId = input.providerActionId;
    if (input.action === "release") {
      next.status = "RELEASE_PENDING";
      next.providerReleaseId = input.providerActionId;
    }
    if (input.action === "refund") {
      next.status = "REFUND_PENDING";
      next.providerRefundId = input.providerActionId;
    }

    milestones[idx] = next;
    tx.set(ref, { milestones, updatedAt: new Date().toISOString() }, { merge: true });
    return { paymentStatus, idempotent: false };
  });
}
