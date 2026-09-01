# n8nexperts.io

A production-oriented Next.js marketplace for hiring reviewed n8n automation experts. This repository intentionally replaces the previous site implementation.

## What is implemented

- Premium white-theme public marketplace: homepage, expert directory, expert profiles, public jobs and job details.
- Firebase Auth session architecture using secure server session cookies.
- Client and expert account roles with separate onboarding and dashboard paths.
- Expert onboarding with **mandatory profile photo and PDF CV** upload paths and manual verification state.
- Workflow showcase model and moderation-ready expert review UI.
- Public vs private job model, client job creation and invite-ready structure.
- Proposal API with server-side anti-circumvention checks.
- Contact guard that detects email, phone, URLs, social handles and common messaging-platform references before funding.
- Contract + milestone state model and payment-gated messages.
- Payment-provider interface plus safe `mock` adapter for development. Provider-specific credentials are intentionally not hard-coded.
- Admin portal for expert verification, payment reconciliation and disputes.
- Firestore, Storage and Realtime Database security rules with deny-by-default posture.
- Firebase App Hosting configuration.
- SEO metadata and independent-brand disclaimer.

## Architecture

```text
Browser
  -> Firebase App Hosting / Next.js 16
      -> Firebase Authentication
      -> server session cookie
      -> Next.js Route Handlers
          -> Firebase Admin SDK
          -> Firestore (marketplace state)
          -> Storage (CV/photo/workflow/contract files)
          -> payment provider abstraction
      -> Realtime Database (presence/typing when enabled)
```

Financial, verification, moderation and contract-message authorization happens on the server. The Admin SDK bypasses Firebase client rules, so every sensitive Route Handler performs its own session and relationship checks.

## Local setup

1. Install Node 22+ and dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
cp .env.example .env.local
```

3. Create a Firebase project and configure Web Auth values in `.env.local`. For server-side Admin SDK access locally, use Application Default Credentials or `GOOGLE_APPLICATION_CREDENTIALS` pointing to a local service-account file that is **never committed**.

4. Run:

```bash
npm run dev
```

For UI-only exploration without Firebase, set:

```text
DEMO_MODE=true
DEMO_ROLE=client
```

Use `DEMO_ROLE=expert` or `admin` to inspect those portals. **Never enable DEMO_MODE in production.**

## Firebase project setup

Create separate projects for dev/staging/prod. Recommended minimum services:

- Firebase Authentication: Email/Password + Google
- Cloud Firestore
- Cloud Storage
- Realtime Database (presence/typing only)
- Firebase App Hosting
- App Check + reCAPTCHA Enterprise before public launch

Deploy data-plane rules separately from App Hosting:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage,database
```

Connect the repository to Firebase App Hosting and make `master` the production rollout branch if that is your deployment policy.

## Required production decisions

### 1. Payment provider

`PAYMENT_PROVIDER=mock` is the only enabled adapter in this commit. Do **not** flip it to Stripe/Mangopay without an implemented provider adapter, provider approval, webhook verification and reconciliation tests.

The domain model deliberately uses `FUNDED`, `RELEASED`, `REFUNDED`, and `DISPUTED` rather than leaking provider-specific vocabulary throughout the codebase.

### 2. n8n brand/domain clearance

The product is styled independently and includes a non-affiliation statement. Before public commercial launch, obtain the appropriate legal/trademark review for the `n8nexperts.io` name and any use of n8n marks.

### 3. Legal documents

The `/legal/*` routes are **placeholders**, not final legal terms. Replace them with counsel-approved Marketplace Terms, Privacy Policy, payment/refund rules, dispute policy, seller tax/KYC disclosures and retention rules.

## Security invariants

- No unrestricted contract messages until `messagingUnlockedAt` exists on the contract.
- Funding state must come from trusted server/provider confirmation, never a client-side redirect.
- Expert publication and verification writes are admin-only server operations.
- CVs stay private; public photo copies should be created only after approval.
- Contract files, disputes, payment records, ledger entries and audit logs are not directly writable from browser clients.
- Pre-funding text must pass the contact guard.
- Never publish raw n8n JSON without secret scanning and review.
- Production admins should use MFA and separate finance/moderation privileges.

## Recommended next implementation checkpoints

- [ ] Add Cloud Functions v2 payment webhook endpoint and idempotent `webhookEvents` processing.
- [ ] Implement the selected provider (Mangopay or Stripe Connect) behind `MarketplacePaymentProvider`.
- [ ] Add workflow JSON sanitization worker and public-safe derivative generation.
- [ ] Add post-funding file uploads with malware scanning.
- [ ] Add invitation/proposal/offer screens backed by Firestore rather than demo records.
- [ ] Add scheduled payment reconciliation and milestone review-deadline workers.
- [ ] Add transactional email (Resend or equivalent) and in-app notification worker.
- [x] Add Customer.io profile identification and account/login event tracking.
- [ ] Add Firebase Emulator security-rule tests to CI.
- [ ] Add Better Stack ingest if desired for application logs; keep Firebase/Cloud Logging for infrastructure logs.
- [ ] Add App Check enforcement after staging validation.
- [ ] Complete provider KYC/payout onboarding and production risk controls.

## Data collections

Primary durable collections expected by the app:

`users`, `expertProfiles`, `expertPrivate`, `expertVerifications`, `expertShowcases`, `clientProfiles`, `jobs`, `jobInvites`, `proposals`, `contracts`, `conversations`, `payments`, `ledgerEntries`, `payoutProfiles`, `disputes`, `reviews`, `reports`, `moderationCases`, `notifications`, `webhookEvents`, `adminAuditLogs`.

Contract milestones are stored as `contracts/{contractId}/milestones/{milestoneId}`.

## Design principles

- White/light UI, strong whitespace, restrained blue accent.
- User value visible immediately after login.
- Status semantics are explicit: `Profile reviewed`, `Payment funded`, and `KYC enabled` must never be conflated.
- Marketplace users always see whether money is funded before work begins.
- Mobile dashboards collapse to focused single-column flows.

---

This is an independent marketplace implementation. n8n is a trademark of its respective owner; no affiliation or endorsement is implied.

## Customer.io integration

The server identifies each signed-in user in Customer.io using the Firebase UID and tracks
`account_created` and `logged_in` events. Customer.io failures do not block authentication.

Create a dedicated Track API key in Customer.io, then create the App Hosting secrets
`CUSTOMERIO_SITE_ID` and `CUSTOMERIO_TRACK_API_KEY`. Set `CUSTOMERIO_REGION` to `eu` if the
Customer.io workspace is hosted in the EU; it defaults to `us`.

The official Customer.io MCP server is separate from the application runtime. It connects an
AI client to Customer.io over OAuth at `https://mcp.customer.io/mcp` (US) or
`https://mcp-eu.customer.io/mcp` (EU); the application itself uses the Track API integration above.
