# Marketplace payment provider decision

Last reviewed: 2026-08-31
Status: **provider selection blocked on platform legal-entity jurisdiction**

This marketplace needs a regulated platform/marketplace payment product, not a normal card checkout account. The product requirement is: collect client funds, keep messaging gated until funding is confirmed, retain money until a milestone decision, take a platform fee, release to an onboarded expert, refund when required, and reconcile every movement from provider-confirmed events.

Do not describe this as legal "escrow" unless the selected provider contract and counsel explicitly permit that wording. Product copy should use terms such as **funded milestone**, **payment protection**, and **release after approval** until that review is complete.

## Current shortlist

### 1. Stripe Connect

Best developer experience if the platform legal entity is in a Stripe-supported country and the connected-account geography supports the intended flow.

Useful capabilities:
- marketplace/platform connected accounts and hosted/embedded onboarding
- flexible payment routing
- platform fees
- controllable payout timing
- refunds/disputes/reporting
- destination charges and separate-charges-and-transfers patterns

Important eligibility note: Stripe's current global availability list does **not** list Serbia as a country in which a normal Stripe business account can be opened. A platform incorporated elsewhere still needs its actual legal entity, tax ID, address and banking setup to satisfy Stripe's country requirements. Connected-account and cross-border capability must then be checked separately.

Primary sources:
- https://stripe.com/global
- https://stripe.com/connect
- https://stripe.com/connect/features
- https://stripe.com/connect/pricing
- https://support.stripe.com/questions/requirements-to-open-a-stripe-account-in-another-country

### 2. Mangopay

Strong functional fit for a European services marketplace because its platform product is built around wallets, KYC/KYB, pay-ins, transfers, holding balances and payouts.

Useful eligibility fact: Mangopay's current country-restriction documentation lists Serbia (`RS`) under countries with no restriction on pay-ins, users, recipient bank accounts or payouts. However, Mangopay states that the **platform company itself must be registered in the EEA or UK** to register for its services.

Primary sources:
- https://docs.mangopay.com/guides/users/country-restrictions
- https://docs.mangopay.com/support
- https://docs.mangopay.com/guides/users/verification

### 3. Adyen for Platforms

Technically strong marketplace product with split payments, held balances, payouts, risk controls and reconciliation. Better suited once volume and operating scale justify enterprise onboarding.

Important eligibility note: the current Adyen for Platforms supported-country list does not include Serbia for platform users/onboarding. Eligibility must be checked against the platform and seller jurisdictions before implementation.

Primary sources:
- https://docs.adyen.com/platforms
- https://docs.adyen.com/marketplaces
- https://docs.adyen.com/marketplaces/onboard-users

### 4. PayPal

PayPal's current country feature list says Serbia supports send, receive and withdraw. That makes it a possible payments/payout component, but this alone does not establish a marketplace held-funds/escrow architecture. PayPal Commerce Platform/partner eligibility, seller onboarding, delayed disbursement and dispute liability would need explicit approval before treating it as the platform provider.

Primary source:
- https://developer.paypal.com/payouts/supported-features/

## Decision rule

1. Confirm the country and legal form of the entity that will contract with the payment provider.
2. Confirm target expert countries for the first launch cohort.
3. Ask the provider to approve the exact services-marketplace funds flow in writing.
4. Prefer **Mangopay** if the platform entity is EEA/UK and its commercial terms fit; its held-wallet model is particularly aligned with milestone release.
5. Prefer **Stripe Connect** if the platform entity and connected-account countries are eligible and Stripe approves the intended delayed-transfer flow; it has the lowest implementation friction for this codebase.
6. Consider **Adyen** when scale/volume warrants enterprise onboarding.
7. Do not ship production money movement using the mock provider, a generic Stripe checkout account plus manual payouts, or a self-managed "escrow" balance.

## Code architecture while provider decision is pending

The repository intentionally remains provider-neutral:
- `MarketplacePaymentProvider` starts provider actions and receives `PENDING` or synchronous `CONFIRMED` results.
- stable provider idempotency keys prevent duplicate payment/transfer/refund creation on retries.
- `paymentStatus` is distinct from work-delivery milestone status.
- provider-confirmed events are the only path that turns funding/release/refund into final money truth.
- a provider event receipt and action receipt make redelivery/idempotency explicit.
- an immutable ledger entry is created in the same Firestore transaction as the confirmed contract state update.
- `messagingUnlockedAt` is set only by confirmed funding processing.
- `PAYMENT_PROVIDER=mock` is rejected when `NODE_ENV=production`.

## Required inputs before the real adapter can be selected

- platform legal entity country
- legal entity type/company name used for provider onboarding
- settlement bank country/currency
- launch countries for experts receiving payouts
- launch countries/currencies for clients paying
- desired platform fee model (percentage, fixed fee, or hybrid)
- refund/dispute commercial policy

Until these are known and provider eligibility is approved, the real-provider checkbox in `BUILD_GUIDE.md` must remain unchecked.
