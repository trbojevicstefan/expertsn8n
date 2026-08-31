import type { FundingInput, MarketplacePaymentProvider, ReleaseInput } from "./provider";

export const mockPaymentProvider: MarketplacePaymentProvider = {
  async createFundingSession(input: FundingInput) {
    return {
      providerActionId: `mock_funding_${input.milestoneId}`,
      provider: "mock",
      status: "CONFIRMED" as const,
    };
  },
  async releaseFunds(input: ReleaseInput) {
    return {
      providerActionId: `mock_release_${input.milestoneId}`,
      provider: "mock",
      status: "CONFIRMED" as const,
    };
  },
  async refundFunds(input: ReleaseInput) {
    return {
      providerActionId: `mock_refund_${input.milestoneId}`,
      provider: "mock",
      status: "CONFIRMED" as const,
    };
  },
};
