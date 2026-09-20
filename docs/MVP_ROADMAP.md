# MVP Roadmap

## Execution Status

- Current phase: Core Phase 5 fulfillment/trust work, alongside unfinished Phase 2-4 details and open Phase 0 decisions
- Phase 0: In progress; booking, deposit, category, provider, localization, moderation-operation, retention, and support-matrix decisions remain open
- Phase 1: Locally established; repository, Docker services, FastAPI, PostgreSQL/PostGIS, Alembic, three clients, generated contracts, observability baseline, and CI definition exist
- Phase 2: Partially implemented; identity schema, local email/mobile authentication, session security, profiles, addresses, and staff boundary exist; recovery, production providers, account deletion, and complete client account management remain
- Phase 3: Partially implemented; categories, listings, pricing, lifecycle, seller headers, availability blocks, search, and basic moderation exist; media, richer filters, SEO pages, appeal, and complete admin tooling remain
- Phase 4: Partially implemented; quote, request, accept/reject/cancel, allocation, booking-scoped messaging, and contact blocking exist; expiry automation, outbox, notifications, and concurrency/load proof remain
- Phase 5: Partially implemented; scheduling, handover/return challenges, condition reports, offline acknowledgements, completion, reviews, reports, disputes, staff denial, and listing moderation audit exist; evidence media, overdue automation, verification, case assignment, sanctions, and retention holds remain
- Phase 6: Planned; no staging, pilot, or production deployment exists
- Locally verified environment: Docker PostgreSQL/PostGIS, Redis, MinIO, Mailpit, API, customer web, admin web, and Expo Metro foundations
- Detailed status source: [Implementation Plan](IMPLEMENTATION_PLAN.md)

This roadmap describes phase outcomes. A phase is not complete merely because part of its behavior exists; the package-level status and evidence in the implementation plan control all implementation claims.

## Planning Basis

This roadmap assumes a small focused team, a new codebase, and a controlled Tamil-Nadu-wide pilot (superseding the earlier Kanyakumari-only pilot framing). The sequence is dependency-based. Calendar estimates should be finalized after team size, provider choices, and operational policies are confirmed.

Indicative duration: 25 to 32 weeks for a three-to-four-person team delivering the complete pilot-ready mobile, customer web, admin, backend, and operational MVP. This excludes external legal, provider, app-store, and identity-verification approval delays. Parallel frontend capacity and design readiness can materially change the range.

## Phase 0: Product and Operational Decisions

Target: 2 to 3 weeks, partly parallel with engineering foundation

Deliverables:

- Approved cancellation, expiry, overdue, deposit, damage, offline repayment, and dispute policies
- Initial prohibited and restricted-item catalogue
- Category attributes and risk tiers for the first five categories
- SMS/OTP, maps, email, push, storage, and scanning provider decisions
- Tamil and English content ownership
- Pilot support and moderation operating procedures
- Baseline wireframes and clickable critical-flow prototype
- Responsive web and native mobile interaction specifications for every critical journey

Exit criteria:

- Every booking transition has an owner, rule, timeout, and user-facing outcome.
- Payment-at-pickup and deposit limitations are approved and clearly disclosed.
- Legal and operational owners accept the pilot boundaries.

## Phase 1: Engineering Foundation

Target: 3 to 4 weeks

Deliverables:

- Repository structure and local developer environment
- Automated checks and deployment environments
- FastAPI application, PostgreSQL/PostGIS, Alembic, Redis, and worker baseline
- Expo TypeScript mobile application
- Next.js responsive customer web application with public-page rendering
- Separate admin web shell
- Shared generated contracts, API client, validation rules, and design tokens
- Structured configuration, secrets, logs, metrics, traces, and request IDs
- Mobile OTP, email/password, rotating sessions, profile, and address foundations
- Private upload pipeline skeleton

Current note: the application, database, Redis, clients, and local object-storage/email services exist. Transactional outbox workers and the private upload/scanning pipeline remain target work.

Exit criteria:

- Authentication and session revocation tests pass.
- Mobile secure-storage and web secure-cookie/CSRF tests pass.
- Migrations run forward and on a clean PostgreSQL database.
- Development and staging contain no shared production credentials or data.

## Phase 2: Identity and Accounts

Target: 4 to 5 weeks

Deliverables:

- Users, authentication identities, sessions, profiles, addresses, and verification-state migrations
- Email registration, verification, login, and recovery
- Mobile OTP registration and login through a provider adapter
- Rotating mobile sessions using secure device storage
- Secure customer-web cookies with CSRF protection
- Profile, address, account, and session management on mobile and web
- Separate administrator authentication and permission baseline
- Account export, deactivation, and policy-driven deletion workflow

Exit criteria:

- One account can authenticate and revoke sessions across mobile and web.
- OTP expiry, replay, rate-limit, and enumeration defenses pass.
- Web cookie, CSRF, cache-control, and logout tests pass.
- Cross-user and customer-to-admin authorization denials pass.
- Account deletion respects active bookings, retention, and legal holds.

## Phase 3: Catalog and Seller Profiles

Target: 4 to 5 weeks

Deliverables:

- Category-driven listing creation
- Canonical listing checks, review, active, pause, archive, removal, and appeal transitions
- Private listing media scanning and derivatives
- Pricing, quantity, availability rules, and blocks
- Search by text, category, distance, dates, and fulfillment option
- Individual owner workspace
- Optional seller header for users with multiple listings
- Public, canonical web category, listing, and seller pages
- Initial moderation queue

Exit criteria:

- A user can publish one or many valid listings under the same account.
- Prohibited or suspicious content is blocked or queued according to policy.
- Public APIs do not expose precise addresses, contact details, or private object keys.
- Public web metadata is indexable without exposing authenticated or private data.
- Cross-owner authorization tests pass.

## Phase 4: Booking and Availability

Target: 5 to 6 weeks

Deliverables:

- Server-side quotes and price snapshots
- Booking request, expiry, accept, reject, and cancel workflows
- Quantity-aware availability holds and allocations
- Transactional acceptance with conflict protection
- Pickup and owner-managed delivery selection
- Booking timelines for renter and owner
- Booking-linked messaging and push notifications
- Equivalent authenticated workflows on mobile and responsive web

Exit criteria:

- Concurrent acceptance tests cannot oversell inventory.
- Retried booking commands do not duplicate records or events.
- Unauthorized users cannot view bookings, conversations, or fulfillment data.
- Expired requests release holds and notify participants exactly once.
- A booking created on one platform is immediately manageable from another.

## Phase 5: Fulfillment, Trust, and Administration

Target: 5 to 7 weeks

### Handover and Return Deliverables

Deliverables:

- Payment-at-pickup records for all eligible listings
- Separate renter and owner payment acknowledgements
- Optional deposit snapshot and acknowledgement
- Handover/return challenge, condition reports, and private evidence
- Inspection, completion, overdue, and dispute initiation

Exit criteria:

- No API or UI can create or imply a platform-processed online payment.
- Payment acknowledgements are not presented as gateway verification.
- Retried acknowledgements and fulfillment commands are idempotent.
- Handover and return evidence is private and auditable.

### Trust and Administration Deliverables

- Risk-triggered verification orchestration
- Reports, reviews, blocking, disputes, and evidence
- Admin queues and permission-scoped case handling
- Reason-coded moderation and enforcement
- Sensitive-access and administrative audit trail
- Privacy requests and retention jobs
- Pilot operational dashboards

Exit criteria:

- High-value scenarios trigger the approved verification level.
- Only completed booking participants can review.
- Support and moderation staff cannot access identity data without permission.
- Disputed evidence is protected from scheduled deletion.

## Phase 6: Pilot Hardening

Target: 3 to 4 weeks

Deliverables:

- Full critical-flow Android and iOS testing
- Full customer web testing at mobile, tablet, desktop, and wide desktop viewports
- Browser back/forward, refresh, deep-link, canonical URL, and private-cache testing
- English and Tamil layout and content checks
- Performance and booking-race testing
- Mobile accessibility and WCAG 2.2 AA web review
- Security review and penetration testing remediation
- Backup restoration exercise
- Initial seller onboarding and support training
- Play Store and App Store release preparation
- Customer web deployment, domain, robots, sitemap, and monitoring preparation
- Controlled Tamil-Nadu-wide launch and monitoring plan

Exit criteria:

- Critical end-to-end journeys pass in staging.
- Customer web pages pass responsive layout, keyboard navigation, metadata, and privacy-cache checks.
- No open critical or high-severity security findings.
- Backup restoration meets approved objectives.
- Payment-at-pickup acknowledgement and disagreement tests pass.
- Pilot support, moderation, and incident ownership are staffed.

## Pilot Rollout

### Cohort 1: Internal and Invited Suppliers

- Onboard a small set of tool, construction, cleaning, garden, and event suppliers.
- Validate listing quality, inventory accuracy, response times, and handover evidence.
- Keep customer access invite-only.

### Cohort 2: Limited Tamil-Nadu-Wide Public Access

- Open discovery and booking within selected service areas.
- Monitor disputes, cancellations, payment failures, and support load daily.
- Maintain manual review for high-value listings and early disputes.

### Cohort 3: District-Wide Pilot

- Expand supply and serviceable areas based on measured fulfillment reliability.
- Enable additional categories only after category-specific controls are ready.
- Decide readiness for another Tamil Nadu district using pilot metrics.

## Workstreams

Parallel workstreams should remain coordinated through shared acceptance criteria:

- Product policy and operations
- Mobile application
- Customer web application
- Backend and database
- Admin web
- Provider integrations
- Security and privacy
- Quality engineering
- Supplier onboarding and support

## Deferred Backlog

- Storefronts, store-owned inventory, staff roles, branches, and stock transfers
- Online payments, settlements, payouts, refunds, and financial ledger
- Platform commission activation
- Platform delivery partners and live tracking
- Dynamic or promotional pricing
- Subscriptions and featured listings
- Insurance-provider integration
- Vehicle rental workflows
- Advanced fraud scoring
- Dedicated search infrastructure

Deferred capabilities should not be represented as implemented in marketing, support content, or application UI.

## Delivery Risks

| Risk | Response |
| --- | --- |
| Undefined deposit and damage policy | Finalize before payment and fulfillment implementation |
| Users mistake acknowledgements for platform payment protection | Use explicit disclosures and prohibit online-payment language in MVP |
| Low-quality or unsafe listings after immediate publication | Automated checks, risk holds, reporting, and moderation queue |
| Double booking | PostgreSQL transaction, allocation constraints, and race tests |
| Contact and off-platform payment leakage | Private profiles, booking chat, detection, warnings, and reports |
| Poor local inventory density | Invite suppliers by launch category before public demand campaign |
| Delivery expectations exceed MVP | Clearly label pickup and owner-managed delivery; do not imply platform delivery |
| Tamil localization arrives late | Design and test both languages during each feature phase |

## Definition of Pilot Ready

The product is pilot ready only when:

1. A renter can discover, request, communicate, pay where eligible, receive, return, and review an item.
2. An owner can list immediately, add multiple ads, and manage payment-at-pickup rentals.
3. A frequent seller can add a public header without creating a separate store or permission scope.
4. Inventory cannot be double-booked through concurrent or retried requests.
5. Contact details, precise locations, identity evidence, and private media remain protected.
6. Administrators can moderate listings and resolve supported cases with complete audit history.
7. Monitoring, support, incident response, offline-payment disagreement handling, backups, and restoration are operational.
