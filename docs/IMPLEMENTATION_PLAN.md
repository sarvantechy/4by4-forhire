# Implementation Plan

## Document Control

- Product: 4by4 For Hire
- Baseline date: 2026-09-16
- Plan version: 1.2
- Documentation reconciled: 2026-09-17
- Current phase: Phase 5 fulfillment and trust implementation, alongside open Phase 0 decisions
- Repository state: Foundation plus working identity, catalog, booking, messaging, handover, trust, and basic moderation slices
- Application implementation: Core C2C rental journey is connected across the API, customer web, mobile, and staff report queue; media, notifications, verification, and release hardening remain incomplete
- Local verification: PostgreSQL migrations through `20260916_0005`, 10 standard backend tests plus five PostgreSQL integration tests, generated-contract drift, workspace lint/typechecks/builds, Expo Doctor 21/21, two customer Playwright smoke tests, and responsive customer/admin browser checks verified on 2026-09-16
- Staging deployment: Not available
- Production deployment: Not available

This document is the source of truth for implementation status. The [MVP Roadmap](MVP_ROADMAP.md) describes product phases and outcomes; this plan breaks those phases into executable engineering work packages.

## MVP Completion Boundary

"Implement everything" means completing the approved customer-to-customer MVP across the FastAPI backend, Expo mobile app, Next.js customer web app, and separate admin web app. It includes identity, listings, search, availability, bookings, private messaging, owner-managed fulfillment, offline-payment acknowledgements, reviews, moderation, disputes, observability, recovery, and pilot release.

It does not include the capabilities marked `Deferred` at the end of this document. Adding those capabilities requires a separately approved plan.

## Delivery Assumptions

- Team model: three to four people covering backend, mobile/web, product/design, and quality/operations, with some roles combined.
- Expected elapsed time: 25 to 32 weeks, excluding external legal, provider, app-store, and identity-verification approval delays.
- Delivery method: thin vertical slices. Backend schema and contract land first within a slice, followed immediately by mobile and web integration rather than waiting for the entire backend.
- Iteration length: one or two weeks, with only packages whose dependencies are satisfied admitted to an iteration.
- Release method: local verification, then staging verification, then a controlled Kanyakumari pilot. No direct development-to-production release.

## Status Vocabulary

Use only these values for work packages and implementation claims:

| Status | Meaning |
| --- | --- |
| Planned | Scope is documented but prerequisites or scheduling are incomplete |
| Ready | Requirements, dependencies, and acceptance checks are clear |
| In progress | Code, design, policy, or infrastructure work has started |
| Blocked | Progress requires a named unresolved dependency |
| Implemented | Code exists but focused validation has not passed |
| Locally verified | Focused automated checks pass in the local environment |
| Staging verified | Deployed to staging and acceptance checks pass there |
| Pilot deployed | Released to the controlled Kanyakumari pilot |
| Production deployed | Released to the approved production audience |
| Deferred | Explicitly outside the current MVP |

Do not use `implemented`, `verified`, or `deployed` interchangeably. A feature can be implemented without being locally verified, and locally verified without being deployed.

## Current Status Snapshot

| Area | Status | Evidence |
| --- | --- | --- |
| Product requirements | Ready | Approved baseline in `PRODUCT_REQUIREMENTS.md` |
| Technical architecture | Ready | Target architecture in `TECHNICAL_ARCHITECTURE.md` |
| Database foundation | Locally verified | Docker PostgreSQL/PostGIS is healthy and Alembic upgrades through `20260916_0005` |
| API contract | Locally verified | FastAPI OpenAPI export and shared TypeScript client compile deterministically |
| Security and trust design | In progress | Participant ownership, CSRF, staff denial, reviews, reports, disputes, and moderation audit are implemented; provider and operating policies remain open |
| Repository workspace | Locally verified | Root npm orchestration, version pins, environment template, and Git repository exist |
| Mobile application | Implemented | Identity, catalog, quote/request, booking actions, messaging, handover, return, review, and report screens typecheck; device journeys pending |
| Customer web application | Implemented | Identity, catalog, quote/request, booking actions, messaging, handover, return, review, dispute, and report workflows typecheck; updated browser journeys pending |
| Admin web application | Implemented | Staff sign-in, live report queue, listing decisions, and API-enforced denial are connected; updated browser journey pending |
| Backend application | Locally verified | Ten standard tests and five PostgreSQL integration tests cover system, identity, catalog, booking, messaging, fulfillment, trust, and moderation behavior |
| Local infrastructure | Locally verified | PostGIS, Redis, MinIO, and Mailpit run healthy on dedicated local ports |
| Automated tests | Locally verified | 10 standard backend tests, five PostgreSQL integration tests, and two customer Playwright smoke tests pass; authenticated browser journeys, physical-device coverage, load proof, and remote CI evidence remain pending |
| Deployment | Planned | No deployment configuration or environment exists |

## Implementation Principles

1. Deliver vertical slices through backend, web, and mobile rather than completing one platform in isolation.
2. Keep PostgreSQL/PostGIS as the only business-data path; do not create a separate SQLite runtime.
3. Use Alembic as the schema authority; application startup must not create tables.
4. Keep public web responses separate from authenticated and private data.
5. Enforce ownership, booking transitions, and media authorization on the server.
6. Keep all user media private and scan it before active use.
7. Make retry-sensitive commands idempotent and external effects outbox-driven.
8. Add focused tests with each work package and update status only after those checks run.
9. Keep deployment claims separate from repository implementation claims.
10. Do not implement deferred stores, online payments, commissions, or platform delivery inside MVP abstractions.

## Proposed Repository Structure

```text
4by4-forhire/
  apps/
    mobile/
    web/
    admin-web/
  backend/
    app/
    alembic/
    tests/
  packages/
    api-client/
    contracts/
    design-tokens/
    validation/
  deployment/
  docs/
  docker-compose.yml
  README.md
```

The initial scaffold should use one JavaScript workspace for the three frontend applications and shared packages. Backend dependencies remain independently managed with Python packaging.

## Delivery Sequence

### Phase 0: Decisions and Delivery Readiness

Goal: remove policy and provider ambiguity that would otherwise cause implementation rework.

| ID | Work package | Status | Depends on | Blocks | Completion evidence |
| --- | --- | --- | --- | --- | --- |
| P0-01 | Approve booking expiry and cancellation rules | Planned | Product owner | BKG-01, BKG-02, BKG-04 | Versioned policy with examples and edge cases |
| P0-02 | Approve overdue, damage, deposit, and offline repayment rules | Planned | Product owner and legal review | FUL-01 through TRU-01 | Versioned policy and support decision tree |
| P0-03 | Approve prohibited and restricted item policy | Planned | Legal and operations | CAT-01, CAT-02, CAT-10 | Category enforcement matrix |
| P0-04 | Select OTP, email, maps, storage, scanning, push, and identity providers | Planned | Cost, privacy, and compliance review | ID-02, ID-03, CAT-03, CAT-05, BKG-06, TRU-02A | Decision records for each provider, local fake adapters, and fallback plan |
| P0-05 | Define Tamil and English content workflow | Planned | Product owner | FND-08C, REL-01 | Translation ownership and review process |
| P0-06 | Produce critical mobile and web wireframes | Planned | Product requirements | Feature UI packages | Approved renter, owner, handover, and dispute flows |
| P0-07 | Define pilot support and moderation operation | Planned | Operations owner | TRU-03A through TRU-03D, REL-10 | Queue ownership, hours, escalation, and response targets |
| P0-08 | Approve retention, deletion, and legal-hold schedule | Planned | Legal, privacy, and operations | ID-09, CAT-03, FUL-03, TRU-01, REL-07 | Record-type retention matrix and deletion authority |
| P0-09 | Approve supported device/browser matrix and pilot load profile | Planned | Product and engineering | REL-03 through REL-08 | Version matrix, viewport list, request mix, concurrency, and latency targets |

Engineering foundation can begin while these decisions progress, but booking policy, category enforcement, provider integration, and public launch cannot be marked ready until their relevant decisions are complete.

#### Decision Gate Rules

- Packages blocked by an open Phase 0 decision remain `Planned` or `Blocked`; they cannot become `Ready` based on an engineer's assumption.
- Provider adapters may be developed against deterministic local fakes before `P0-04`, but production adapter selection and integration remain blocked.
- Shell navigation and design-system work may proceed before `P0-06`; feature-specific UI acceptance remains blocked until its wireframe is approved.
- Retention code must fail closed when a legal or dispute hold exists, even before final retention durations are configured.

### Phase 1: Engineering Foundation

Goal: establish a deployable, testable skeleton without implementing marketplace behavior prematurely.

| ID | Work package | Status | Depends on | Completion evidence |
| --- | --- | --- | --- | --- |
| FND-01 | Initialize repository governance and workspace tooling | Locally verified | None | Root scripts, ignore rules, environment examples, contribution commands |
| FND-02 | Add local PostgreSQL/PostGIS, Redis, and object-storage services | Locally verified | FND-01 | Compose renders without error; services have health checks; startup and reset commands documented; no real secrets |
| FND-03 | Scaffold FastAPI modular monolith | Locally verified | FND-01 | `/api/v1/health/live`, `/ready`, and `/version` tests pass; request IDs and safe JSON errors verified |
| FND-04 | Configure SQLAlchemy and Alembic | Locally verified | FND-02, FND-03 | Upgrade on clean PostgreSQL, downgrade one revision, and re-upgrade all pass |
| FND-05 | Scaffold Expo mobile application | Implemented | FND-01 | Type check and Expo checks pass; root navigation and environment validation render |
| FND-06 | Scaffold Next.js customer web application | Locally verified | FND-01 | Type check, production build, and Playwright smoke checks pass at 360 px and 1280 px |
| FND-07 | Scaffold separate admin web application | Locally verified | FND-01 | Type check and production build pass; customer routes and privileges are absent |
| FND-08A | Export and version the FastAPI OpenAPI contract | Locally verified | FND-03 | Deterministic schema artifact generated; drift check fails on uncommitted contract changes |
| FND-08B | Generate shared TypeScript contracts and API client | Locally verified | FND-05, FND-06, FND-08A | Generated package compiles and is consumed by mobile and customer web health calls |
| FND-08C | Add shared validation, design tokens, and English/Tamil i18n foundation | Implemented | FND-05, FND-06, FND-07, P0-05 | All clients render shared tokens and switch locale in a smoke test |
| FND-09 | Establish CI quality gates | Implemented | FND-03 through FND-08C | GitHub Actions definition covers infrastructure, migrations, backend/integration tests, contracts, client checks/builds, audits, Playwright, and secret scan; remote run evidence remains pending |
| FND-10 | Add observability and secret-handling baseline | Locally verified | FND-03 | Request IDs propagate; sensitive-value redaction tests pass; health and error metrics emit |
| FND-11 | Add deterministic factories and local demo data command | Planned | FND-04, ID-01 | Repeatable synthetic seed contains no real personal data and is safe to rerun |

#### First Implementation Slice

Implement in this order:

1. `FND-01`: repository workspace, language versions, command conventions, and environment templates.
2. `FND-02`: local dependencies with health checks and no committed credentials.
3. `FND-03` and `FND-04`: backend health endpoint plus PostgreSQL migration smoke test.
4. `FND-06`: customer web shell consuming the health/version contract.
5. `FND-05`: mobile shell consuming the same contract.
6. `FND-07`: admin shell with a visibly separate trust boundary.
7. `FND-08A` through `FND-08C`, then `FND-09`: generated contracts, shared foundations, and repeatable quality gates.

This sequence gives the project one thin, end-to-end, locally verifiable path before authentication or marketplace state is introduced.

#### FND-01 Verification Evidence

Verified locally on 2026-09-16:

- Initialized a Git repository on `main`; no commit or remote was created.
- Added npm workspace orchestration for `apps/*` and `packages/*`.
- Pinned Node.js 24 LTS and Python 3.12 for application development.
- Added safe local environment examples, ignore rules, editor rules, contributor guidance, and repository instructions.
- Parsed `package.json`, checked `scripts/run-workspaces.mjs` syntax, and ran `npm run check` successfully.
- Verified `.env`, `.env.local`, and generated mobile native directories are ignored.

The machine used for this check currently runs Node.js 25.2.1. Switch to the pinned Node.js 24 LTS before installing framework dependencies in subsequent packages.

#### Foundation Batch Verification Evidence

Verified locally on 2026-09-16:

- Ten standard backend tests pass for liveness, readiness, version, request-ID, safe-error, database configuration, JSON logging, and redaction behavior.
- Five PostgreSQL integration tests pass for web identity/CSRF, mobile refresh replay denial, listing lifecycle/search/risk review, booking allocation/private messaging, and handover/return/trust/staff moderation.
- Ruff and mypy pass for the backend; Alembic deterministically generates PostGIS and trigram extension SQL.
- Customer web typecheck, lint, production build, and Playwright smoke journeys pass at 360 px and 1280 px with no horizontal overflow.
- Admin web typecheck, lint, production build, and browser inspection pass at desktop and mobile widths with no horizontal overflow.
- Expo mobile lint, TypeScript, public config parsing, and Expo Doctor pass 21 of 21 checks.
- OpenAPI and generated TypeScript contracts are deterministic; contracts, typed API client, and both customer consumers compile.
- Shared design tokens, English/Tamil catalog foundation, and validation helpers compile across all workspaces.
- Python audit reports no known vulnerabilities. npm has no high or critical findings; 13 moderate transitive Expo advisories remain without a compatible non-breaking fix.

Pending before Milestone 1 can close:

- Launch and verify critical Expo journeys on supported Android and iOS targets; Metro and Expo Doctor alone are insufficient device evidence.
- Approve Tamil content ownership under `P0-05` and add locale-switch browser/device evidence.
- Run the CI workflow remotely, including its secret scan.
- Correct the local Homebrew Node 24 installation, which currently resolves to Node 25.2.1 despite the project pin.

### Phase 2: Identity Vertical Slice

Goal: one account works securely across mobile and customer web.

| ID | Work package | Status | Depends on | Completion evidence |
| --- | --- | --- | --- | --- |
| ID-01 | Implement users, identities, sessions, profiles, and addresses migrations | Locally verified | FND-04 | Migration and repository integration tests pass |
| ID-02 | Implement email registration, verification, login, and recovery | In progress | ID-01, P0-04 | Registration, verification, and login work with local email; recovery and production provider controls remain |
| ID-03 | Implement mobile OTP registration and login | In progress | ID-01, P0-04 | Local OTP and normalized login work; production provider and full abuse controls remain |
| ID-04 | Implement mobile bearer and rotating refresh sessions | Locally verified | ID-01 | Secure storage, refresh rotation, and replay denial are implemented and tested |
| ID-05 | Implement customer web cookie sessions and CSRF protection | Locally verified | ID-01 | Cookie authentication, CSRF denial, and logout are tested |
| ID-06 | Build profile, address, session, and account screens on mobile | In progress | ID-02 through ID-04 | Authentication works; full profile, address, and session management UI remains |
| ID-07 | Build equivalent customer web account workflows | In progress | ID-02, ID-03, ID-05 | Account and session UI works; address editing and updated browser evidence remain |
| ID-08 | Add admin authentication and permission baseline | Locally verified | ID-01, FND-07 | Staff-only API denial is tested and the admin sign-in boundary builds |
| ID-09 | Implement account export, deactivation, and deletion workflow | Planned | ID-01, P0-08 | Active-booking denial, anonymization, retention, and audit tests pass |

### Phase 3: Catalog and Seller Vertical Slice

Goal: a user can publish and discover one or many safe listings on mobile and web.

| ID | Work package | Status | Depends on | Completion evidence |
| --- | --- | --- | --- | --- |
| CAT-01 | Implement categories and typed category attributes | Locally verified | FND-04, P0-03 | Seed categories and category-aware listing validation pass PostgreSQL integration |
| CAT-02 | Implement listings, prices, quantity, and lifecycle | Locally verified | CAT-01, ID-01, P0-03 | Draft, publish, active visibility, and risk-review behavior pass PostgreSQL integration |
| CAT-03 | Implement private upload quarantine, scan, and derivative flow | Planned | FND-02, P0-04 | Unauthorized and unsafe-media tests pass |
| CAT-04 | Implement availability rules and owner blocks | Planned | CAT-02 | Timezone, overlap, and quantity tests pass |
| CAT-05 | Implement PostGIS and text search | In progress | CAT-02, CAT-04 | Text and distance search work; full privacy/filter/pagination matrix remains |
| CAT-06 | Implement optional seller header | Implemented | ID-01, CAT-02 | Header is account-owned and cannot delegate listing ownership |
| CAT-07 | Build mobile list, owner workspace, search, and detail flows | In progress | CAT-02 through CAT-06 | Search, create, publish, and booking entry work; media/detail device journeys remain |
| CAT-08 | Build responsive web listing and discovery flows | In progress | CAT-02 through CAT-06 | Search, create, publish, and booking entry work; media/detail browser journeys remain |
| CAT-09 | Add canonical public web metadata and sitemap | Planned | CAT-08 | SEO metadata and private-indexing tests pass |
| CAT-10 | Add moderation and report APIs | In progress | CAT-02, P0-03 | Report, approve/remove, staff denial, and reason-coded audit work; appeal and policy matrix remain |
| CAT-11 | Build admin category and listing moderation UI | In progress | CAT-10, FND-07 | Live report queue and listing decisions build; assignment, evidence, and browser journeys remain |

### Phase 4: Booking and Messaging Vertical Slice

Goal: renters and owners can safely agree on a conflict-free rental.

| ID | Work package | Status | Depends on | Completion evidence |
| --- | --- | --- | --- | --- |
| BKG-01 | Implement quote snapshots | Locally verified | CAT-02, CAT-04, P0-01 | Price snapshot and booking creation pass PostgreSQL integration; expiry policy remains open |
| BKG-02 | Implement canonical booking state machine and append-only history | In progress | BKG-01, P0-01 | Requested through completion/dispute works; expiry, overdue automation, and complete denial matrix remain |
| BKG-03 | Implement transactional holds and allocations | Implemented | BKG-02 | Row-locked quantity allocation rejects a conflicting request; concurrent load proof remains |
| BKG-04 | Implement request expiry, cancellation, and outbox events | Planned | BKG-02, P0-01 | Retry and exactly-once-effect tests pass |
| BKG-05 | Implement booking-scoped conversations | Locally verified | BKG-02 | Participant-scoped messages and retry idempotency pass PostgreSQL integration |
| BKG-05A | Implement contact and external-payment detail protection | In progress | BKG-05 | Direct phone sharing is blocked before storage; broader obfuscation fixtures remain |
| BKG-06 | Implement in-app, email, and push notification orchestration | Planned | BKG-04, P0-04 | Deduplication and preference tests pass |
| BKG-07 | Build mobile booking, timeline, inbox, and owner actions | Implemented | BKG-02 through BKG-06 | Connected workflow typechecks; Android/iOS journey evidence remains |
| BKG-08 | Build equivalent customer web booking workflows | Implemented | BKG-02 through BKG-06 | Connected responsive workflow typechecks; updated browser journey evidence remains |

### Phase 5: Handover, Return, and Trust

Goal: complete a rental with private evidence and explicit offline-payment limitations.

| ID | Work package | Status | Depends on | Completion evidence |
| --- | --- | --- | --- | --- |
| FUL-01 | Implement pickup and owner-managed delivery records | In progress | BKG-02, P0-02 | Owner scheduling works; address authorization and delivery policy remain |
| FUL-02 | Implement short-lived handover and return challenges | Implemented | FUL-01 | Dual participant confirmation works; expiry and replay denial tests remain |
| FUL-03 | Implement condition reports and private evidence | In progress | CAT-03, FUL-01 | Structured reports persist; private media, scanning, and retention remain |
| FUL-04 | Implement payment-at-pickup and deposit acknowledgements | Locally verified | FUL-02, P0-02 | Dual append-only offline acknowledgements pass PostgreSQL integration |
| FUL-05 | Implement return, inspection, overdue, and completion | In progress | FUL-02, FUL-03, P0-02 | Return through completion passes; overdue and timeout automation remain |
| TRU-01 | Implement reviews, reports, blocking, disputes, and evidence holds | In progress | FUL-05, P0-02, P0-08 | Review eligibility, reports, and disputes work; user blocking and evidence holds remain |
| TRU-02A | Implement verification policy and provider adapter | Planned | ID-01, CAT-01, P0-04 | Risk triggers, provider failure, least-data storage, and expiry tests pass |
| TRU-02B | Build mobile verification and status journey | Planned | TRU-02A | Capture, consent, failure, retry, and status journeys pass |
| TRU-02C | Build customer web verification and status journey | Planned | TRU-02A | Upload/camera fallback, consent, failure, retry, and status journeys pass |
| TRU-03A | Implement support/moderation case and assignment APIs | In progress | TRU-01, P0-07 | Report queue works; assignment, priority, and case-state APIs remain |
| TRU-03B | Build admin case queue and evidence-review UI | In progress | TRU-03A, FND-07 | Live report triage and listing decisions build; evidence and browser journeys remain |
| TRU-03C | Implement admin permission matrix and sensitive-access audit | In progress | ID-08, TRU-03A | Staff denial and moderation mutation audit pass; role matrix and sensitive-read audit remain |
| TRU-03D | Implement sanctions, appeals, and restoration workflows | Planned | CAT-10, TRU-03A | Restrict, suspend, appeal, restore, and denied-override scenarios pass |
| FUL-06 | Build complete mobile handover and return journeys | In progress | FUL-01 through FUL-05 | Code, condition, payment, return, inspection, and review controls exist; camera/device journeys remain |
| FUL-07 | Build complete responsive web handover and return journeys | In progress | FUL-01 through FUL-05 | Code, payment, return, inspection, review, and dispute controls exist; evidence/browser journeys remain |

### Phase 6: Pilot Hardening and Release

Goal: prove operational, security, recovery, and cross-platform readiness before inviting pilot users.

| ID | Work package | Status | Depends on | Completion evidence |
| --- | --- | --- | --- | --- |
| REL-01 | Complete English and Tamil localization | Planned | Product flows complete | Content review and layout tests pass |
| REL-02 | Run full backend and migration suites | Planned | Feature implementation complete | CI evidence retained |
| REL-03 | Run Android and iOS critical journeys | Planned | Mobile features complete, P0-09 | Approved emulator/simulator and physical-device evidence retained |
| REL-04 | Run customer web browser and viewport matrix | Planned | Web features complete, P0-09 | Chromium, WebKit, and Firefox evidence retained at approved viewports |
| REL-05 | Complete accessibility review | Planned | REL-03, REL-04 | Mobile checks and WCAG 2.2 AA issues resolved |
| REL-06 | Complete security review and penetration testing | Planned | Feature implementation complete | No open critical or high findings |
| REL-07 | Prove backup restoration and incident procedures | Planned | Staging environment | Recovery evidence retained |
| REL-08 | Complete load and booking-race testing | Planned | Staging environment, P0-09 | Read API p95 under 500 ms, booking command p95 under 1 s under approved pilot load, and allocation race invariant holds |
| REL-09 | Prepare mobile store and customer web releases | Planned | REL-01 through REL-08 | Release candidates approved |
| REL-10 | Launch controlled Kanyakumari pilot | Planned | REL-09, P0-07 | Pilot verification and monitoring report |

## Cross-Platform Acceptance Matrix

Each customer-facing capability is complete only when its required surfaces and shared behavior are verified.

| Capability | Backend | Mobile | Customer web | Admin web | Required verification |
| --- | --- | --- | --- | --- | --- |
| Authentication | Required | Required | Required | Separate admin flow | Session, CSRF, revocation, abuse controls |
| Profile and addresses | Required | Required | Required | Support read only | Ownership and private-data tests |
| Categories and search | Required | Required | Required | Category management | Location privacy and responsive results |
| Listing management | Required | Required | Required | Moderation | Ownership, upload, and lifecycle tests |
| Seller header | Required | Required | Required | Moderation | No delegation or ownership change |
| Booking | Required | Required | Required | Support view | Race, idempotency, and cross-platform state |
| Messaging | Required | Required | Required | Case-scoped access | Participant and contact-leakage tests |
| Handover and return | Required | Required | Required | Dispute support | Challenge, evidence, and privacy tests |
| Reviews and disputes | Required | Required | Required | Required | Eligibility and audit tests |

## Milestone Gates

| Milestone | Included work | Exit gate |
| --- | --- | --- |
| M1 Foundation | FND packages | Local services healthy; backend migration smoke passes; all clients build; generated contract has no drift; CI is green |
| M2 Identity | ID packages | One account registers, authenticates, revokes sessions, and manages profile on mobile and web; cross-user and admin denials pass |
| M3 Marketplace | CAT packages | A user publishes and discovers safe inventory on mobile/web; private location/media remain protected; moderation operates |
| M4 Rental Agreement | BKG packages | Request through owner decision and private messaging works cross-platform; race and idempotency invariants pass |
| M5 Fulfillment and Trust | FUL/TRU packages | Handover through completion/dispute works with private evidence, offline-payment boundaries, and audited admin cases |
| M6 Pilot Ready | REL packages and all P0 decisions | Security, accessibility, performance, recovery, localization, operations, and release evidence are approved |

No milestone is complete because a screen renders or an endpoint returns success once. Its listed denial, retry, privacy, concurrency, and recovery scenarios must also pass.

## Work-Package Acceptance Record

Add a dated evidence subsection when a package changes to `Locally verified` or beyond:

```yaml
work_package: BKG-03
status: locally_verified
verified_on: YYYY-MM-DD
runtime_versions:
  node: 24.x
  python: 3.12.x
commands:
  - focused command and result
scenarios:
  - exact allowed, denied, retry, or concurrency scenario
artifacts:
  - test, migration, screenshot, or report path
open_risks: []
next_action: staging verification or dependent package
```

Evidence must name executable checks and artifacts. Arbitrary test counts or coverage percentages do not replace risk-based scenario coverage.

## Validation Commands

Root orchestration is available through `npm run check`. Exact package commands will be added as each scaffold is implemented. The expected command groups are:

```text
Backend: migration check, focused pytest, full pytest
Mobile: type check, lint, unit/component tests, Expo checks
Customer web: type check, lint, unit tests, production build, Playwright
Admin web: type check, lint, unit tests, production build, Playwright
Workspace: generated-contract drift check and dependency/security checks
```

Do not mark a work package `Locally verified` until its focused executable checks pass. Documentation-only review does not count as implementation verification.

## Documentation Update Protocol

Every implementation change must update this plan and the owning specification in the same change set.

1. Before implementation, set the work package to `In progress` and confirm its requirements remain current.
2. After code is written, set it to `Implemented` only if the behavior exists across all stated files and migrations.
3. After focused checks pass, set it to `Locally verified` and record the command or test evidence in the work-package notes.
4. After staging acceptance, set it to `Staging verified` and record the environment and verification date without secrets.
5. After release, update `README.md` and the owning document with the exact deployed scope and environment.
6. If behavior differs from a specification, update the specification before calling the package complete.
7. Keep deferred capabilities labeled `Deferred`; do not create placeholder UI that implies availability.

### Owning Documents

| Change area | Documents to update |
| --- | --- |
| Scope, persona, workflow, or policy | `PRODUCT_REQUIREMENTS.md`, `MVP_ROADMAP.md` |
| Components, providers, deployment, or client structure | `TECHNICAL_ARCHITECTURE.md` |
| Tables, constraints, indexes, or retention | `DATABASE_RELATIONSHIPS.md` |
| Endpoints, payloads, errors, auth, or versioning | `API_DESIGN.md` |
| Identity, privacy, moderation, deposit, or dispute controls | `SECURITY_PAYMENTS_AND_TRUST.md` |
| Navigation, screens, content, responsive behavior, or accessibility | `UI_UX_PLAN.md` |
| Any implementation status change | `IMPLEMENTATION_PLAN.md` and `README.md` when phase-level status changes |

## Open Decisions

The following decisions are still open and must not be silently invented during implementation:

- Booking request expiry and cancellation windows
- Late-return grace period and consequences
- Deposit limits, acknowledgement, and disagreement process
- Initial prohibited and restricted item catalogue
- OTP, email, maps, push, object-storage scanning, and identity providers
- Minimum supported Android, iOS, and browser versions
- Tamil translation and review ownership
- Pilot support hours and escalation ownership
- Hosting environment, domains, and recovery objectives
- Final record-retention and account-deletion schedule
- Pilot traffic profile and supported device/browser versions

When a decision blocks a package, mark it `Blocked`, name the decision ID, and continue only with independent work.

## Deferred Capabilities

- Storefronts, store-owned inventory, staff, branches, and delegated access
- Online payments, refunds, settlements, payouts, commission, and financial ledger
- Platform-operated delivery and driver accounts
- Vehicle rentals
- Insurance integration
- Paid promotion and subscriptions
- Dedicated search infrastructure before measured need

These require separate approved requirements, threat analysis, schema changes, APIs, UX, and rollout gates.
