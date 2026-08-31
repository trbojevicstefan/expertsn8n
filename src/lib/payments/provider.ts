import type { MilestoneStatus } from "@/lib/types";

export interface FundingInput {
  milestoneId: string;
  contractId: string;
  clientId: string;
  amount: number;
  currency: string;
  idempotencyKey: string;
}

export interface ReleaseInput {
  milestoneId: string;
  contractId: string;
  amount: number;
  currency: string;
  expertId: string;
  idempotencyKey: string;
}

export interface ProviderActionResult {
  providerActionId: string;
  provider: string;
  status: "PENDING" | "CONFIRMED";
  checkoutUrl?: string;
}

export interface MarketplacePaymentProvider {
  createFundingSession(input: FundingInput): Promise<ProviderActionResult>;
  releaseFunds(input: ReleaseInput): Promise<ProviderActionResult>;
  refundFunds(input: ReleaseInput): Promise<ProviderActionResult>;
}

export interface MilestoneRecord {
  id: string;
  contractId: string;
  clientId: string;
  expertId: string;
  amount: number;
  currency: string;
  status: MilestoneStatus;
}
