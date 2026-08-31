import type { MarketplacePaymentProvider } from "./provider";
import { mockPaymentProvider } from "./mock";
import { selectedPaymentProviderName } from "./provider-selection";

export function paymentProvider(): MarketplacePaymentProvider {
  const selected = selectedPaymentProviderName(process.env.PAYMENT_PROVIDER, process.env.NODE_ENV);
  if (selected === "mock") return mockPaymentProvider;
  throw new Error("Configured payment provider is not available.");
}
