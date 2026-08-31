import { createHash } from "node:crypto";
import { adminDb, firebaseAdminConfigured } from "@/lib/firebase/admin";
import { confirmedPaymentTransition, type ConfirmedPaymentEventKind, type PaymentStatus } from "./state";
import type { Contract, ContractMilestone } from "@/lib/types";

export interface ConfirmedProviderPaymentEvent {
  provider: string;
  eventId: string;
  actionId: string;
  kind: ConfirmedPaymentEventKind;
  contractId: string;
  milestoneId: string;
  amount: number;
  currency: string;
  occurredAt: string;
}

export interface ProcessPaymentEventResult {
  applied: boolean;
  idempotent: boolean;
  contractId: string;
  milestoneId: string;
  paymentStatus: PaymentStatus;
}

function docKey(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function currentPaymentStatus(milestone: ContractMilestone): PaymentStatus {
  if (milestone.paymentStatus) return milestone.paymentStatus;
  if (milestone.status === "RELEASED") return "RELEASED";
  if (milestone.status === "REFUNDED") return "REFUNDED";
  if (milestone.status === "RELEASE_PENDING") return "RELEASE_PENDING";
  if (milestone.status === "REFUND_PENDING") return "REFUND_PENDING";
  if (["FUNDED", "IN_PROGRESS", "SUBMITTED", "CHANGES_REQUESTED", "DISPUTED"].includes(milestone.status)) {
    return "FUNDED";
  }
  return "UNFUNDED";
}

/**
 * The single entry point for provider-confirmed money movement.
 *
 * Two deterministic receipts make retries safe:
 * - provider event id prevents webhook redelivery from applying twice;
 * - provider action id + event kind prevents two different webhook envelopes for
 *   the same underlying payment/transfer/refund from creating duplicate ledger entries.
 *
 * A ledger entry is created in the same Firestore transaction as the contract
 * update, so there is no state where money truth moved without an audit record.
 */
export async function processConfirmedProviderPaymentEvent(
  event: ConfirmedProviderPaymentEvent,
): Promise<ProcessPaymentEventResult> {
  if (!firebaseAdminConfigured) throw new Error("Firebase Admin is not configured.");
  if (!event.provider.trim() || !event.eventId.trim() || !event.actionId.trim()) {
    throw new Error("Provider, event id and action id are required.");
  }
  if (!Number.isFinite(event.amount) || event.amount <= 0) throw new Error("Payment event amount must be positive.");
  if (!event.currency.trim()) throw new Error("Payment event currency is required.");

  const db = adminDb();
  const eventRef = db.collection("paymentProviderEvents").doc(docKey(`${event.provider}:${event.eventId}`));
  const actionRef = db
    .collection("paymentProviderActions")
    .doc(docKey(`${event.provider}:${event.kind}:${event.actionId}`));
  const ledgerRef = db.collection("ledgerEntries").doc(docKey(`${event.provider}:${event.kind}:${event.actionId}`));
  const contractRef = db.collection("contracts").doc(event.contractId);

  return db.runTransaction(async (tx) => {
    const [eventSnap, actionSnap, contractSnap] = await Promise.all([
      tx.get(eventRef),
      tx.get(actionRef),
      tx.get(contractRef),
    ]);

    if (eventSnap.exists || actionSnap.exists) {
      const receipt = (eventSnap.exists ? eventSnap.data() : actionSnap.data()) || {};
      return {
        applied: false,
        idempotent: true,
        contractId: event.contractId,
        milestoneId: event.milestoneId,
        paymentStatus: String(receipt.paymentStatus || "UNFUNDED") as PaymentStatus,
      };
    }

    if (!contractSnap.exists) throw new Error("Contract not found for provider payment event.");
    const contract = { id: contractSnap.id, ...contractSnap.data() } as Contract;
    if (contract.currency !== event.currency) throw new Error("Provider event currency does not match contract currency.");

    const milestones = [...(contract.milestones || [])];
    const idx = milestones.findIndex((m) => m.id === event.milestoneId);
    if (idx < 0) throw new Error("Milestone not found for provider payment event.");

    const milestone = milestones[idx]!;
    if (milestone.amount !== event.amount) throw new Error("Provider event amount does not match milestone amount.");

    const transition = confirmedPaymentTransition(currentPaymentStatus(milestone), event.kind);
    const nowIso = new Date().toISOString();
    const occurredAt = Number.isNaN(Date.parse(event.occurredAt)) ? nowIso : new Date(event.occurredAt).toISOString();

    const next: ContractMilestone = {
      ...milestone,
      status: transition.milestoneStatus,
      paymentStatus: transition.paymentStatus,
      paymentProvider: event.provider,
    };

    if (event.kind === "FUNDING_CONFIRMED") {
      next.fundedAt = occurredAt;
      next.providerFundingId = event.actionId;
    }
    if (event.kind === "RELEASE_CONFIRMED") {
      next.releasedAt = occurredAt;
      next.providerReleaseId = event.actionId;
    }
    if (event.kind === "REFUND_CONFIRMED") {
      next.refundedAt = occurredAt;
      next.providerRefundId = event.actionId;
    }
    milestones[idx] = next;

    const contractPatch: Record<string, unknown> = { milestones, updatedAt: nowIso };
    if (event.kind === "FUNDING_CONFIRMED" && !contract.messagingUnlockedAt) {
      contractPatch.messagingUnlockedAt = occurredAt;
    }
    if (event.kind === "RELEASE_CONFIRMED") {
      const following = milestones[idx + 1];
      if (following && following.status === "DRAFT") {
        milestones[idx + 1] = { ...following, status: "AWAITING_FUNDING", paymentStatus: following.paymentStatus || "UNFUNDED" };
      }
      if (milestones.every((m) => m.status === "RELEASED")) contractPatch.status = "COMPLETED";
    }

    const receipt = {
      provider: event.provider,
      providerEventId: event.eventId,
      providerActionId: event.actionId,
      kind: event.kind,
      contractId: event.contractId,
      milestoneId: event.milestoneId,
      amount: event.amount,
      currency: event.currency,
      paymentStatus: transition.paymentStatus,
      occurredAt,
      processedAt: nowIso,
    };

    tx.create(eventRef, receipt);
    tx.create(actionRef, receipt);
    tx.create(ledgerRef, {
      ...receipt,
      entryType:
        event.kind === "FUNDING_CONFIRMED" ? "FUNDING" : event.kind === "RELEASE_CONFIRMED" ? "RELEASE" : "REFUND",
      immutable: true,
    });
    tx.set(contractRef, contractPatch, { merge: true });

    return {
      applied: true,
      idempotent: false,
      contractId: event.contractId,
      milestoneId: event.milestoneId,
      paymentStatus: transition.paymentStatus,
    };
  });
}
