export type PolicyResult =
  | { ok: true; idempotent?: boolean }
  | { ok: false; status: 403 | 409; message: string };

export interface ProposalAwardPolicyInput {
  viewerUid: string;
  viewerAdmin: boolean;
  proposalClientId: string;
  proposalStatus: string;
  proposalJobId: string;
  proposalPrice: number;
  jobClientId: string;
  jobStatus: string;
}

export function evaluateProposalAward(input: ProposalAwardPolicyInput): PolicyResult {
  if (input.proposalClientId !== input.viewerUid && !input.viewerAdmin) {
    return { ok: false, status: 403, message: "This proposal is not on your job." };
  }

  if (input.proposalStatus === "ACCEPTED") return { ok: true, idempotent: true };

  if (["DECLINED", "WITHDRAWN"].includes(input.proposalStatus)) {
    return { ok: false, status: 409, message: "This proposal is no longer actionable." };
  }

  if (!input.proposalJobId) {
    return { ok: false, status: 409, message: "Proposal has no job." };
  }

  if (input.jobClientId && input.jobClientId !== input.proposalClientId) {
    return { ok: false, status: 409, message: "Proposal and job ownership do not match." };
  }

  if (input.jobStatus === "FILLED") {
    return { ok: false, status: 409, message: "This job already has an accepted proposal." };
  }

  if (!input.viewerAdmin && input.jobClientId !== input.viewerUid) {
    return { ok: false, status: 403, message: "This job is not yours." };
  }

  if (!["OPEN", "MATCHING"].includes(input.jobStatus)) {
    return { ok: false, status: 409, message: "This job is not accepting an award." };
  }

  if (!Number.isFinite(input.proposalPrice) || input.proposalPrice <= 0) {
    return { ok: false, status: 409, message: "Proposal price is invalid." };
  }

  return { ok: true };
}

export type MilestoneAction = "fund" | "submit" | "request_changes" | "release";

export interface MilestoneActionPolicyInput {
  action: MilestoneAction;
  milestoneStatus: string;
  isClient: boolean;
  isExpert: boolean;
  isAdmin: boolean;
}

export function evaluateMilestoneAction(input: MilestoneActionPolicyInput): PolicyResult {
  if (!input.isClient && !input.isExpert && !input.isAdmin) {
    return { ok: false, status: 403, message: "This contract is not yours." };
  }

  if (input.action === "fund") {
    if (!input.isClient && !input.isAdmin) {
      return { ok: false, status: 403, message: "Only the client funds a milestone." };
    }
    if (!["DRAFT", "AWAITING_FUNDING"].includes(input.milestoneStatus)) {
      return { ok: false, status: 409, message: "This milestone is not awaiting funding." };
    }
    return { ok: true };
  }

  if (input.action === "submit") {
    if (!input.isExpert && !input.isAdmin) {
      return { ok: false, status: 403, message: "Only the expert submits work." };
    }
    if (!["FUNDED", "IN_PROGRESS", "CHANGES_REQUESTED"].includes(input.milestoneStatus)) {
      return { ok: false, status: 409, message: "This milestone is not funded yet." };
    }
    return { ok: true };
  }

  if (input.action === "request_changes") {
    if (!input.isClient && !input.isAdmin) {
      return { ok: false, status: 403, message: "Only the client requests changes." };
    }
    if (input.milestoneStatus !== "SUBMITTED") {
      return { ok: false, status: 409, message: "Changes can only be requested on submitted work." };
    }
    return { ok: true };
  }

  if (!input.isClient && !input.isAdmin) {
    return { ok: false, status: 403, message: "Only the client releases funds." };
  }
  if (input.milestoneStatus !== "SUBMITTED") {
    return { ok: false, status: 409, message: "Nothing has been submitted for this milestone." };
  }
  return { ok: true };
}

export interface ContractCancellationPolicyInput {
  contractStatus: string;
  isClient: boolean;
  isExpert: boolean;
  isAdmin: boolean;
  paymentStatuses: string[];
}

export function evaluateContractCancellation(input: ContractCancellationPolicyInput): PolicyResult {
  if (!input.isClient && !input.isExpert && !input.isAdmin) {
    return { ok: false, status: 403, message: "This contract is not yours." };
  }
  if (input.contractStatus === "CANCELLED") return { ok: true, idempotent: true };
  if (input.contractStatus === "COMPLETED") {
    return { ok: false, status: 409, message: "A completed contract cannot be cancelled." };
  }

  const moneyAtRisk = input.paymentStatuses.some((status) =>
    ["PENDING", "FUNDED", "RELEASE_PENDING", "REFUND_PENDING"].includes(status),
  );
  if (moneyAtRisk) {
    return {
      ok: false,
      status: 409,
      message: "This contract has money at risk. Open a support dispute instead of cancelling it directly.",
    };
  }

  return { ok: true };
}
