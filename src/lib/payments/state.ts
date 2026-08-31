export type PaymentStatus =
  | "UNFUNDED"
  | "PENDING"
  | "FUNDED"
  | "RELEASE_PENDING"
  | "RELEASED"
  | "REFUND_PENDING"
  | "REFUNDED"
  | "FAILED";

export type ConfirmedPaymentEventKind =
  | "FUNDING_CONFIRMED"
  | "RELEASE_CONFIRMED"
  | "REFUND_CONFIRMED";

export interface PaymentTransition {
  paymentStatus: PaymentStatus;
  milestoneStatus: "FUNDED" | "RELEASED" | "REFUNDED";
}

/** Backwards-compatible mapping for contracts created before paymentStatus was
 * persisted explicitly. New writes should always set paymentStatus. */
export function effectivePaymentStatus(milestone: {
  status: string;
  paymentStatus?: PaymentStatus;
}): PaymentStatus {
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
 * Money state changes only when the provider confirms them. Starting a checkout
 * or requesting a transfer is not confirmation that money moved.
 */
export function confirmedPaymentTransition(
  current: PaymentStatus,
  event: ConfirmedPaymentEventKind,
): PaymentTransition {
  if (event === "FUNDING_CONFIRMED") {
    if (!["UNFUNDED", "PENDING"].includes(current)) {
      throw new Error(`Cannot confirm funding from ${current}.`);
    }
    return { paymentStatus: "FUNDED", milestoneStatus: "FUNDED" };
  }

  if (event === "RELEASE_CONFIRMED") {
    if (current !== "RELEASE_PENDING") {
      throw new Error(`Cannot confirm release from ${current}.`);
    }
    return { paymentStatus: "RELEASED", milestoneStatus: "RELEASED" };
  }

  if (current !== "REFUND_PENDING") {
    throw new Error(`Cannot confirm refund from ${current}.`);
  }
  return { paymentStatus: "REFUNDED", milestoneStatus: "REFUNDED" };
}

export function beginPaymentAction(
  current: PaymentStatus,
  action: "fund" | "release" | "refund",
): PaymentStatus {
  if (action === "fund") {
    if (current !== "UNFUNDED") throw new Error(`Cannot start funding from ${current}.`);
    return "PENDING";
  }
  if (action === "release") {
    if (current !== "FUNDED") throw new Error(`Cannot start release from ${current}.`);
    return "RELEASE_PENDING";
  }
  if (current !== "FUNDED") throw new Error(`Cannot start refund from ${current}.`);
  return "REFUND_PENDING";
}
