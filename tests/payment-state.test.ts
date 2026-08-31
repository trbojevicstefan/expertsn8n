import assert from "node:assert/strict";
import test from "node:test";
import { beginPaymentAction, confirmedPaymentTransition } from "../src/lib/payments/state.ts";
import { selectedPaymentProviderName } from "../src/lib/payments/provider-selection.ts";

test("funding is pending until provider confirmation", () => {
  assert.equal(beginPaymentAction("UNFUNDED", "fund"), "PENDING");
  assert.deepEqual(confirmedPaymentTransition("PENDING", "FUNDING_CONFIRMED"), {
    paymentStatus: "FUNDED",
    milestoneStatus: "FUNDED",
  });
});

test("release and refund require an explicit pending state", () => {
  assert.equal(beginPaymentAction("FUNDED", "release"), "RELEASE_PENDING");
  assert.deepEqual(confirmedPaymentTransition("RELEASE_PENDING", "RELEASE_CONFIRMED"), {
    paymentStatus: "RELEASED",
    milestoneStatus: "RELEASED",
  });

  assert.equal(beginPaymentAction("FUNDED", "refund"), "REFUND_PENDING");
  assert.deepEqual(confirmedPaymentTransition("REFUND_PENDING", "REFUND_CONFIRMED"), {
    paymentStatus: "REFUNDED",
    milestoneStatus: "REFUNDED",
  });
});

test("provider confirmations reject impossible money transitions", () => {
  assert.throws(() => confirmedPaymentTransition("UNFUNDED", "RELEASE_CONFIRMED"), /Cannot confirm release/);
  assert.throws(() => confirmedPaymentTransition("FUNDED", "FUNDING_CONFIRMED"), /Cannot confirm funding/);
  assert.throws(() => confirmedPaymentTransition("RELEASED", "REFUND_CONFIRMED"), /Cannot confirm refund/);
});

test("mock payments are forbidden in production", () => {
  assert.equal(selectedPaymentProviderName(undefined, "development"), "mock");
  assert.equal(selectedPaymentProviderName("mock", "test"), "mock");
  assert.throws(
    () => selectedPaymentProviderName("mock", "production"),
    /Mock payments are disabled in production/,
  );
});

test("unknown providers fail closed instead of silently using mock", () => {
  assert.throws(() => selectedPaymentProviderName("stripe", "development"), /not implemented/);
});
