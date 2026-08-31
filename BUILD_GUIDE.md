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
- Payment provider abstraction with a development-only mock provider
- Zod validation on important write endpoints
- GitHub Actions CI for typecheck, lint and production build

## Confirmed product flows already present

- [x] Public homepage, expert directory, expert profile pages, public job listing and job detail surfaces
- [x] Client/expert/admin account roles and guarded dashboard areas
- [x] Expert onboarding, profile editing, CV/documents and profile photo flow
- [x] Expert verification/admin review surfaces
- [x] Workflow showcase creation, attachments and moderation surfaces
- [x] Public/private jobs, job creation and expert invites
- [x] Expert proposal submission with anti-circumvention validation
- [x] Proposal acceptance creates a contract and milestone plan
- [x] Contract workspace with payment-gated messaging, milestone submission/release and disputes
- [x] Notifications and support ticket flows
- [x] Firebase Firestore/Storage rules and Firebase App Hosting configuration

## P0 - Marketplace correctness and safety

- [x] Make proposal acceptance atomic/idempotent so concurrent accepts cannot create duplicate contracts or accept multiple proposals for one already-filled job.
- [x] Ensure accepting one proposal prevents other proposals on the same job from being accepted afterwards.
- [x] Delete the corresponding private Storage object when an expert deletes a document record.
- [x] Verify uploaded document metadata against the actual Storage object before persisting it to Firestore.
- [x] Add baseline HTTP security headers (frame protection, MIME sniffing protection, referrer policy, permissions policy and CSP baseline).
- [x] Make CI deterministic with `npm ci` and keep typecheck + lint + production build as merge gates.
- [ ] Add automated tests for auth/authorization boundaries, proposal acceptance and milestone state transitions.
- [ ] Add request rate limiting for auth/session, claim verification, proposal creation, messaging and support endpoints.

## P0 - Payments and money movement

The current payment abstraction is useful for development but **the mock provider must never be treated as real escrow**.

- [ ] Select the production payment/marketplace provider and document its supported countries, KYC/KYB requirements, payout timing, refund/dispute model and marketplace liability.
- [ ] Add a real provider adapter behind `MarketplacePaymentProvider`.
- [ ] Implement signed webhook verification.
- [ ] Implement webhook idempotency using unique provider event IDs.
- [ ] Persist provider funding/release/refund IDs in ledger records.
- [ ] Model `PENDING`, `FUNDED`, `RELEASE_PENDING`, `RELEASED`, `REFUND_PENDING`, `REFUNDED` from provider-confirmed events rather than optimistic UI actions.
- [ ] Prevent messaging unlock until a provider-confirmed funding event exists.
- [ ] Add reconciliation job/admin view for Firestore state vs provider state.
- [ ] Add expert payout onboarding/status and block release when payout setup is incomplete.
- [ ] Add platform fee calculation and immutable ledger entries.

## P1 - Contract workspace

- [ ] Add contract file exchange after first funded milestone using `private/contracts/...` server-authorized uploads/downloads.
- [ ] Add explicit "request changes" milestone action and state transition.
- [ ] Add submission attachments and delivery history per milestone.
- [ ] Add milestone activity/audit timeline.
- [ ] Add contract cancellation rules for unfunded and funded states.
- [ ] Add contract completion/review prompt after all milestones are released.
- [ ] Add client-to-expert and expert-to-client review/rating records tied to completed contracts.

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
- [ ] Add immutable `ledgerEntries` schema with unique provider event/action IDs.
- [ ] Add `reviews` collection linked to contract + reviewer + reviewee with one-review-per-side constraint.
- [ ] Add `invites` lifecycle statuses and timestamps.
- [ ] Add explicit payment/payout status fields rather than deriving money truth only from milestone UI state.
- [ ] Add migration/backfill scripts for every schema change that affects existing data.

## Test plan

- [ ] Unit tests: contact guard, claim-code hashing/verification, workflow parser, money helpers and state transition rules.
- [ ] API tests: unauthenticated, wrong role, wrong owner, invalid input and happy path for every sensitive route.
- [ ] Transaction tests: concurrent proposal acceptance and duplicate payment webhook handling.
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
- [ ] Production payment provider enabled; mock provider blocked in production.
- [ ] Monitoring/error reporting configured.
- [ ] Custom domain, HTTPS, canonical host and redirects verified.
- [ ] Smoke test performed after deployment for all P0 client/expert/admin flows.

## Definition of done for a checkbox

A task can be checked only when all applicable conditions are true:

1. Implementation is committed to the working branch.
2. Authorization and input-validation behavior is explicit.
3. Error paths return useful non-sensitive errors.
4. Typecheck, lint and production build pass in CI.
5. Tests exist for stateful/security-sensitive behavior where practical.
6. Documentation/env examples are updated when configuration changes.
7. Production-only external dependencies are clearly marked when they cannot be validated without credentials.

## Current implementation sprint

Working branch: `build/marketplace-hardening`

- [x] Atomic/idempotent proposal acceptance
- [x] Storage cleanup + object verification for expert documents
- [x] Baseline HTTP security headers
- [x] Deterministic CI (`npm ci`)
- [x] Re-run CI and mark completed items above

### Validation note

The first hardening run exposed a pre-existing toolchain incompatibility: TypeScript 7.0.2 could not be loaded by the `typescript-eslint` version used by Next 16.3.3, and ESLint 10 was outside the peer range of bundled plugins. The branch now pins `typescript` to Microsoft's TypeScript 6 compatibility package (`@typescript/typescript6@6.0.3`) and ESLint 9.39.5, with a regenerated committed lockfile. Final read-only CI validation passed `npm ci`, typecheck, lint, and the production Next.js build before these tasks were checked.
