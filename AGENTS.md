# 4by4 For Hire Agent Guide

## Scope

These instructions apply to the entire `4by4-forhire` repository. Do not modify another workspace project unless the user explicitly requests it.

## Sources of Truth

- Use `docs/PRODUCT_REQUIREMENTS.md` for approved product scope.
- Use `docs/IMPLEMENTATION_PLAN.md` for current implementation status and work-package order.
- Use `docs/TECHNICAL_ARCHITECTURE.md` for application boundaries.
- Use `docs/DATABASE_RELATIONSHIPS.md` for the target PostgreSQL model.
- Use `docs/API_DESIGN.md` for API conventions and proposed contracts.
- Use `docs/SECURITY_PAYMENTS_AND_TRUST.md` for privacy, trust, and offline-payment boundaries.
- Use `docs/UI_UX_PLAN.md` for mobile, responsive web, and admin experience requirements.
- Use `docs/MVP_ROADMAP.md` for phase outcomes and release gates.

Never describe planned behavior as implemented, verified, staged, or deployed. Update the implementation tracker and the owning document whenever status changes.

## Product Boundary

- The MVP is customer-to-customer. Every listing belongs to one user account.
- A seller header is presentation metadata only; it does not create a store, staff role, branch, or delegated access.
- Every booking requires owner approval.
- MVP payment is handled at pickup or handover outside platform payment processing.
- The platform does not collect, hold, settle, guarantee, or refund money during MVP.
- Phone numbers, email addresses, precise public locations, identity evidence, and private media remain protected.
- Storefronts, online payments, platform delivery, and vehicle rentals are deferred.

## Architecture Rules

- Build one FastAPI modular monolith, one Expo mobile app, one Next.js customer web app, and one separate admin web app.
- Use PostgreSQL with PostGIS for all business behavior. Do not add a SQLite application path.
- Use Alembic as the schema authority. Production startup must not create tables.
- Keep route, service, repository, model, schema, integration, and worker responsibilities explicit.
- Services own transactions and booking state transitions.
- Recheck availability transactionally when accepting a booking.
- Use idempotency for retry-sensitive commands and a transactional outbox for external effects.
- Keep provider integrations behind small interfaces.

## Authentication and Authorization

- Resolve the authenticated actor server-side and derive ownership from database records.
- Use secure mobile credential storage and rotating refresh sessions.
- Use secure HTTP-only cookies and CSRF protection for browser sessions.
- Keep customer and admin authorization boundaries separate.
- Hiding a control in a client is not authorization.

## Data and Media

- Store money as integer minor units with ISO currency.
- Keep status and payment acknowledgements append-only where specified.
- Store uploads in private object storage using opaque keys.
- Quarantine and scan uploads before active use.
- Never log secrets, OTPs, tokens, identity documents, precise addresses, or signed media URLs.

## Validation

- After the first substantive edit, run the narrowest executable check for the touched slice.
- Test ownership denial, cross-user access, booking transition denial, idempotency, and concurrent availability where relevant.
- Test backend migrations and database behavior against PostgreSQL.
- Test customer web workflows at mobile and desktop viewports with Playwright.
- Test critical mobile workflows on Android and iOS before pilot release.
- Run the complete approved suites before any deployment.

## Deployment Safety

- Do not provision or deploy without an explicit user request.
- Keep development, staging, and production credentials and data separate.
- Record staging and deployment verification separately from local implementation status.
