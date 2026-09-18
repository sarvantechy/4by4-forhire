# 4by4 For Hire

4by4 For Hire is a customer-to-customer rental marketplace for mobile and web. People can list useful items, discover nearby inventory, request a rental, and complete pickup or owner-managed delivery without exposing private contact information.

## Current Status

Phase 0 policy and provider decisions remain in progress while the core C2C workflow is implemented locally. The PostgreSQL-backed FastAPI API, responsive customer web, Expo mobile app, separate staff console, generated contracts, and structured logging currently cover:

- Email verification/login and mobile OTP login using local delivery adapters
- Rotating mobile refresh sessions, web cookie sessions, CSRF protection, profiles, addresses, and session management
- Categories, listing creation and lifecycle, pricing, availability blocks, seller headers, PostGIS-backed discovery, and risk-review holds
- Quote snapshots, owner-approved booking transitions, quantity allocation, booking-scoped messages, and direct-contact blocking
- Fulfillment scheduling, dual handover/return challenges, structured condition reports, offline-payment acknowledgements, return/inspection completion, reviews, reports, and disputes
- Staff authentication, report listing, listing approve/remove actions, and append-only moderation audit records

Local infrastructure and migrations through `20260916_0005` are verified. Backend checks, five PostgreSQL integration tests, generated-contract drift checks, workspace lint/typechecks/builds, Expo Doctor, customer Playwright smoke tests, and responsive browser inspections passed locally during the 2026-09-16 implementation session.

Private media upload/quarantine/scanning, evidence files, outbox workers, notifications, production OTP/email providers, identity verification, complete moderation case assignment, account deletion/retention, full concurrency/load proof, physical-device journeys, staging, and deployment remain incomplete. No production or pilot deployment is claimed.

Implementation status is tracked in [Implementation Plan](docs/IMPLEMENTATION_PLAN.md). A documented capability must not be described as implemented, verified, or deployed unless that tracker contains the corresponding evidence.

## Approved MVP Direction

- Ship customer experiences on Android, iOS, and a responsive web application.
- Keep core marketplace capabilities consistent across mobile and web while using platform-appropriate navigation, authentication storage, uploads, location, and notifications.
- Serve users across India and pilot operations in Kanyakumari district, Tamil Nadu.
- Support mobile OTP and email/password authentication.
- Allow users to publish listings immediately, subject to automated checks and post-publication moderation.
- Require owner approval for every booking.
- Support payment at pickup for all approved bookings.
- Defer online payment, settlement, and platform commission collection.
- Charge no platform commission during MVP.
- Allow an optional refundable security deposit per listing.
- Keep phone numbers and other direct contact details private; communication stays in the app.
- Support customer pickup and optional owner-managed delivery.
- Let frequent or business sellers add a lightweight seller header to their profile and publish multiple user-owned listings.
- Defer storefronts, store staff, branches, and store-owned inventory.
- Apply enhanced identity verification to high-value or high-risk rentals.

## Documentation

- [Implementation Plan and Status](docs/IMPLEMENTATION_PLAN.md)
- [Product Requirements](docs/PRODUCT_REQUIREMENTS.md)
- [MVP Roadmap](docs/MVP_ROADMAP.md)
- [Technical Architecture](docs/TECHNICAL_ARCHITECTURE.md)
- [Database Relationships](docs/DATABASE_RELATIONSHIPS.md)
- [API Design](docs/API_DESIGN.md)
- [Security, Payments, and Trust](docs/SECURITY_PAYMENTS_AND_TRUST.md)
- [UI and UX Plan](docs/UI_UX_PLAN.md)

## Development

Repository tooling targets Node.js 24 LTS, npm 10 or 11, and Python 3.12. Setup conventions and root validation commands are documented in [CONTRIBUTING.md](CONTRIBUTING.md).

Default local endpoints after following the contributing guide:

| Service | URL or port |
| --- | --- |
| Customer web | `http://127.0.0.1:3000` |
| Admin web | `http://127.0.0.1:3001` |
| API and OpenAPI docs | `http://127.0.0.1:8000`, `http://127.0.0.1:8000/api/docs` |
| Expo Metro | `http://127.0.0.1:8081` |
| Mailpit | `http://127.0.0.1:18080` |
| MinIO console | `http://127.0.0.1:19001` |
| PostgreSQL/PostGIS | `127.0.0.1:15432` |
| Redis | `127.0.0.1:16379` |

## Reference Application

Scoring Basket is a delivery reference for Expo Router, React Native, FastAPI, PostgreSQL, media upload, and mobile release workflows. 4by4 For Hire will add a dedicated responsive customer web application and remain a separate product. It will not copy domain models, public-media defaults, startup schema creation, permissive CORS, or deployment credentials from Scoring Basket.

## Working Principles

1. Keep the first release useful for local workers, households, and rental shops.
2. Build a modular monolith before considering microservices.
3. Treat availability, booking transitions, payment acknowledgements, deposits, and disputes as transactional business records.
4. Keep user identity and precise item location private until authorized by the booking workflow.
5. Make trust controls proportional to item value and category risk.
6. Design for India-wide expansion without pretending the initial operational pilot covers all India.
