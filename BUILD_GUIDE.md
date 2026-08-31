# n8nexperts.io Build Guide

Last reviewed: 2026-08-31

This file is the implementation source of truth for turning the current marketplace into a production-ready hiring platform. Checkboxes must only be marked complete after the implementation is committed and its relevant validation passes.

## Product goal

n8nexperts.io is a two-sided marketplace where clients can discover vetted n8n experts, publish public or private jobs, invite experts, receive proposals, create contracts, fund milestones, collaborate inside a guarded workspace, release funds after approval, and escalate disputes to marketplace staff. Experts maintain reviewed profiles, upload proof/CVs, publish workflow showcases, receive invites, submit proposals, deliver work and get paid.

## Current architecture

- Next.js 16 / React 19 / TypeScript
- Firebase Authentication with server-side Firebase session cookies
- Firestore for marketplace state
- Firebase Storage for private expert assets and public approved images
- Firebase App Hosting deployment config
- Server Route Handlers for privileged mutations
- Provider-neutral marketplace payment abstraction; mock provider is development-only and hard-blocked in production
- Explicit milestone payment state separate from work-delivery state
- Provider-confirmed money-event processor with idempotent provider receipts and atomic ledger writes
- Contract activity timeline and completed-contract reviews
- Zod validation on important write endpoints
- Firestore-backed distributed rate limiting for sensitive write endpoints
- GitHub Actions CI for tests, typecheck, lint and production build

## Confirmed product flows already present

- [x] Public homepage, expert directory, expert profile pages, public job listing and job detail surfaces
- [x] Client/expert/admin account roles and guarded dashboard areas
- [x] Expert onboarding, profile editing, CV/documents and profile photo flow
- [x] Expert verification/admin review surfaces
- [x] Workflow showcase creation, attachments and moderation surfaces
- [x] Public/private jobs, job creation and expert invites
- [x] Expert proposal submission with anti-circumvention validation
- [x] Proposal acceptance creates a contract and milestone plan
- [x] Contract workspace with payment-gated messaging, milestone submission/release, change requests and disputes
- [x] Completed-contract reviews and contract activity timeline
- [x] Notifications and support ticket flows
- [x] Firebase Firestore/Storage rules and Firebase App Hosting configuration

## P0 - Marketplace correctness and safety

- [x] Make proposal acceptance atomic/idempotent so concurrent accepts cannot create duplicate contracts or accept multiple proposals for one already-filled job.
- [x] Ensure accepting one proposal prevents other proposals on the same job from being accepted afterwards.
- [x] Delete the corresponding private Storage object when an expert deletes a document record.
- [x] Verify uploaded document metadata against the actual Storage object before persisting it to Firestore.
- [x] Add baseline HTTP security headers (frame protection, MIME sniffing protection, referrer policy, permissions policy and CSP baseline).
- [x] Make CI deterministic with `npm ci` and keep tests + typecheck + lint + production build as merge gates.
- [x] Add automated tests for auth/authorization boundaries, proposal acceptance and milestone state transitions.
- [x] Add request rate limiting for auth/session, claim verification, proposal creation, messaging and support endpoints.

## P0 - Payments and money movement

The mock provider is useful for development but **must never be treated as real escrow or production money movement**. See `docs/PAYMENTS_PROVIDER_DECISION.md` before selecting a provider.

- [ ] Select the production payment/marketplace provider and document its supported countries, KYC/KYB requirements, payout timing, refund/dispute model and marketplace liability. Provider comparison is documented; final selection is blocked on the platform legal-entity jurisdiction and launch payout countries.
- [ ] Add a real provider adapter behind `MarketplacePaymentProvider`.
- [ ] Implement signed webhook verification.
- [ ] Implement webhook idempotency using unique provider event IDs. The event/action receipt processor is idempotent, but this stays open until a signed real-provider webhook is wired to it.
- [x] Persist provider funding/release/refund IDs in ledger records.
- [x] Model `PENDING`, `FUNDED`, `RELEASE_PENDING`, `RELEASED`, `REFUND_PENDING`, `REFUNDED` from provider-confirmed events rather than optimistic UI actions.
- [x] Prevent messaging unlock until a provider-confirmed funding event exists.
- [ ] Add reconciliation job/admin view for Firestore state vs provider state.
- [ ] Add expert payout onboarding/status and block release when payout setup is incomplete.
- [ ] Add platform fee calculation and immutable ledger entries. Immutable money-movement ledger entries are implemented; fee calculation remains open.

## P1 - Contract workspace

- [ ] Add contract file exchange after first funded milestone using `private/contracts/...` server-authorized uploads/downloads.
- [x] Add explicit "request changes" milestone action and state transition.
- [ ] Add submission attachments and delivery history per milestone.
- [x] Add milestone activity/audit timeline.
- [x] Add contract cancellation rules for unfunded and funded states. Direct cancellation is allowed only with no money at risk; otherwise the dispute path is required.
- [x] Add contract completion/review prompt after all milestones are released.
- [x] Add client-to-expert and expert-to-client review/rating records tied to completed contracts.

## P1 - Jobs, proposals and invitations

- [ ] Add proposal withdraw flow for experts while proposal is still actionable.
- [ ] Add client shortlist/decline actions and corresponding notifications.
- [ ] Add job edit flow while draft/open, with server ownership enforcement.
- [ ] Add job close/cancel flow and automatically stop new proposals.
- [ ] Improve private jobs so only invited experts can view/apply.
- [ ] Add invite accept/decline state instead of treating invitations as display-only records.
- [ ] Add pagination for expert directory, jobs, proposals, notifications, admin queues and support tickets.
- [ ] Add server-side search/filter indexes for expert skills/integrations and jobs.

## P1 - Expert trust and verification

- [ ] Require approved photo before final public publication rather than publishing a pending-review photo immediately.
- [ ] Add clear verification checklist: identity, CV, n8n evidence, workflow evidence, profile completeness.
- [ ] Add admin audit log for every verification/moderation decision.
- [ ] Add suspension reason/history and prevent suspended experts from proposals/invites/public visibility.
- [ ] Add duplicate-profile/duplicate-account checks during claim/self-signup.
- [ ] Add signed/expiring private document access for reviewers or keep all review access server-streamed with complete audit logs.

## P1 - Anti-circumvention and marketplace protection

- [ ] Apply contact guard consistently to pre-funding job descriptions, proposals, invites and any pre-contract messaging surface.
- [ ] Add normalized detection tests for Unicode-obfuscated emails, spaced phone numbers, social handles and URL variants.
- [ ] Add moderation event logging when content is blocked.
- [ ] Add configurable grace/policy enforcement instead of hard-coded policy behavior.

## P1 - Observability and operations

- [ ] Add structured server logging with request ID, actor UID, route, action and outcome; never log tokens or sensitive document content.
- [ ] Add error monitoring and alerting for 5xx responses, auth failures, payment webhooks and failed notifications.
- [ ] Add OpenTelemetry traces for slow server routes and external provider calls.
- [ ] Add operational health endpoint that verifies app process plus non-destructive dependency readiness.
- [ ] Add admin metrics for open jobs, proposal conversion, contracts, GMV, funded/released amounts, disputes and verification backlog.
- [ ] Add backup/export and recovery procedure for Firestore and Storage metadata.

## P1 - Security hardening

- [ ] Add CSRF/origin protection to state-changing cookie-authenticated routes.
- [x] Validate all Storage paths against exact expected prefixes and actual object metadata.
- [ ] Add malware/content scanning strategy for uploaded documents before reviewer access.
- [ ] Add maximum request body sizes for JSON and upload metadata endpoints.
- [ ] Review every Admin SDK query for explicit ownership/role checks because Admin SDK bypasses Firebase rules.
- [ ] Add security-rule emulator tests for Firestore, Storage and Realtime Database.
- [ ] Add dependency/security scanning in CI.
- [ ] Document secret rotation and least-privilege Firebase service identity setup.

## P2 - UX and growth

- [ ] Saved experts / shortlist for clients.
- [ ] Saved job searches and expert job alerts.
- [ ] Email notification delivery in addition to in-app notifications.
- [ ] Expert availability calendar/status.
- [ ] Better public expert SEO: structured data, profile metadata, canonical URLs and sitemap coverage.
- [ ] Public trust pages explaining verification, payment protection and dispute handling.
- [ ] Empty/loading/error states across every dashboard list and mutation.
- [ ] Mobile QA for onboarding, job creation, proposals and contract workspace.
- [ ] Accessibility pass: keyboard navigation, labels, focus states, contrast and semantic status updates.

## Data model / architecture work

- [ ] Add immutable `auditEvents` collection for privileged state changes.
- [x] Add immutable `ledgerEntries` schema with unique provider event/action IDs.
- [x] Add `reviews` collection linked to contract + reviewer + reviewee with one-review-per-side constraint.
- [ ] Add `invites` lifecycle statuses and timestamps.
- [ ] Add explicit payment/payout status fields rather than deriving money truth only from milestone UI state. Explicit payment status is complete; payout onboarding/status still remains.
- [ ] Add migration/backfill scripts for every schema change that affects existing data. Payment reads include a backwards-compatible legacy status mapper, but no destructive backfill is required yet.

## Test plan

- [ ] Unit tests: contact guard, claim-code hashing/verification, workflow parser, money helpers and state transition rules. Payment, proposal, milestone, change-request and cancellation transition coverage exists; remaining listed units stay open.
- [ ] API tests: unauthenticated, wrong role, wrong owner, invalid input and happy path for every sensitive route.
- [ ] Transaction tests: concurrent proposal acceptance and duplicate payment webhook handling. Pure policy/idempotency behavior exists; Firestore/emulator concurrency coverage stays open.
- [ ] Firebase emulator tests for Firestore/Storage/Realtime Database security rules.
- [ ] E2E client journey: sign up -> create job -> invite/receive proposal -> accept -> fund -> message -> approve/release -> review.
- [ ] E2E expert journey: sign up -> profile/docs/showcase -> review -> browse/invite -> proposal -> contract -> submit -> payout state.
- [ ] E2E dispute journey: funded milestone -> dispute -> admin decision -> refund/release -> audit trail.

## Deployment checklist

- [ ] Production Firebase project selected and App Hosting connected to the intended branch.
- [ ] Firebase Auth providers/domains configured.
- [ ] Firestore indexes deployed.
- [ ] Firestore, Storage and Realtime Database rules deployed and emulator-tested.
- [ ] Server runtime identity can use Firebase Admin without embedding a service-account key in the repo.
- [ ] Payment provider secrets configured in the hosting secret store, never `NEXT_PUBLIC_*`.
- [ ] Production payment provider enabled; mock provider blocked in production. The mock block is complete; this remains open until a real provider is enabled.
- [ ] Monitoring/error reporting configured.
- [ ] Custom domain, HTTPS, canonical host and redirects verified.
- [ ] Smoke test performed after deployment for all P0 client/expert/admin flows.

## Definition of done for a checkbox

A task can be checked only when all applicable conditions are true:

1. Implementation is committed to the working branch.
2. Authorization and input-validation behavior is explicit.
3. Error paths return useful non-sensitive errors.
4. Tests, typecheck, lint and production build pass in CI.
5. Tests exist for stateful/security-sensitive behavior where practical.
6. Documentation/env examples are updated when configuration changes.
7. Production-only external dependencies are clearly marked when they cannot be validated without credentials or provider approval.

## Current implementation sprint

Working branch: `build/p1-contract-completion`

- [x] Add client `Request changes` and expert resubmission lifecycle.
- [x] Add money-safe direct cancellation and force funded/pending cases into disputes.
- [x] Reopen the job/proposal when an unfunded contract is cancelled.
- [x] Add contract activity records and workspace timeline.
- [x] Add one final review per side after completion.
- [x] Recalculate expert rating/review count from completed-contract client reviews.
- [x] Increment expert `completedProjects` exactly once when the final release is provider-confirmed.
- [x] Record dispute open/resolution and provider-confirmed funding/release/refund in the timeline.
- [ ] Add contract file exchange and submission attachments/delivery history.

### Validation note

The tests/rate-limit sprint established Node 22 automated policy tests and the CI gate. The payment-core sprint added provider-confirmed state and ledger tests. The contract-completion sprint increases the stacked suite to 20 tests, including change-request authorization/state and cancellation money-safety coverage.

During validation, TypeScript found a transaction-closure narrowing issue in the new cancellation route after all 20 tests had already passed. The route was corrected to carry only notification metadata out of the transaction. The subsequent CI run passed all 20 tests, typecheck, lint and the production Next.js build before these contract-workspace items were checked.

The provider comparison is intentionally not the same as provider selection. Current public eligibility documentation must be rechecked against the actual legal entity and launch countries before the real adapter, webhook and payout flows can be implemented.
