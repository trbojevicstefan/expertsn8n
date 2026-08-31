export type SupportedPaymentProviderName = "mock";

/**
 * Mock payments are a local/dev convenience only. Production must fail closed
 * until an explicitly implemented marketplace provider is selected.
 */
export function selectedPaymentProviderName(
  configured: string | undefined,
  nodeEnv: string | undefined,
): SupportedPaymentProviderName {
  const selected = (configured || "mock").trim().toLowerCase();

  if (selected === "mock") {
    if (nodeEnv === "production") {
      throw new Error("Mock payments are disabled in production. Configure an approved marketplace payment provider.");
    }
    return "mock";
  }

  throw new Error(`${selected} payment adapter is not implemented in this repository.`);
}
