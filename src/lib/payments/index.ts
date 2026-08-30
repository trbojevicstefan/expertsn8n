import type { MarketplacePaymentProvider } from "./provider";
import { mockPaymentProvider } from "./mock";
export function paymentProvider(): MarketplacePaymentProvider {const selected=process.env.PAYMENT_PROVIDER||"mock";if(selected!=="mock")throw new Error(`${selected} adapter is not enabled in this repository yet. Keep PAYMENT_PROVIDER=mock until provider credentials and legal entity are approved.`);return mockPaymentProvider;}
