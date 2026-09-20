# API Design

## Document Status

- Specification status: Active implementation reference
- Implementation status: System, identity, catalog, booking, booking-scoped messaging, fulfillment, review, report, dispute, and basic staff moderation routes implemented
- Existing contract: Generated OpenAPI and TypeScript client include the implemented `/api/v1` routes; planned media, notification, verification, appeal, assignment, and recovery routes remain absent
- Status source: [Implementation Plan](IMPLEMENTATION_PLAN.md)

The implemented route inventory below is grounded in the current FastAPI routers and generated OpenAPI contract. Other endpoint tables in this document describe the approved target API and remain proposed until their implementation work package and focused tests are complete.

## Implemented Route Inventory

The current API registers these application routes under `/api/v1`:

- Identity: email register/verify/login; mobile OTP request/verify; refresh, logout, session list/revoke; current profile update; address list/create/update/delete
- Catalog: category list; listing search/detail; owner listing list/create/update; publish/pause/resume/archive; availability-block creation; seller-header upsert/public read
- Booking: quote creation; booking create/list/detail; accept/reject/cancel; booking-scoped message list/send
- Fulfillment and trust: fulfillment scheduling; handover/return challenge creation and confirmation; condition reports; offline-payment acknowledgement; return initiation; inspection acceptance; review, dispute, and report creation
- Administration: staff-scoped report list and listing approve/remove action

Not implemented routes include password recovery, verification providers, favorites, media upload, listing history/appeal, notification APIs, booking-history reads, message attachments/report/block APIs, dispute detail/evidence/response APIs, and broader administration case-management APIs.

## Principles

- Base path: `/api/v1`
- JSON over HTTPS for application APIs
- OpenAPI is the contract source for generated clients and tests.
- Resource identifiers are opaque.
- The authenticated actor is resolved from the session.
- Listing ownership is never trusted from client claims.
- Commands with retry risk require `Idempotency-Key`.
- Timestamps use ISO 8601 with timezone information.
- Money uses integer minor units plus ISO currency.
- List APIs use cursor pagination where result sets can grow.
- Error responses use stable machine-readable codes and safe human messages.
- Public discovery responses are safe for server rendering and shared caching; authenticated or private responses are explicitly non-cacheable.

## Standard Error Shape

```json
{
  "error": {
    "code": "BOOKING_AVAILABILITY_CHANGED",
    "message": "The requested quantity is no longer available.",
    "request_id": "req_...",
    "details": {}
  }
}
```

Validation details must not reveal internal schema, queries, credentials, or unrelated records.

## Authentication APIs

Current status: all rows except password recovery are implemented. Password recovery remains target behavior.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/auth/mobile/request-otp` | Request a rate-limited OTP |
| POST | `/auth/mobile/verify-otp` | Verify OTP and create or access an account |
| POST | `/auth/email/register` | Register with email and password |
| POST | `/auth/email/verify` | Verify email challenge |
| POST | `/auth/login` | Authenticate by supported credentials |
| POST | `/auth/token/refresh` | Rotate a refresh session |
| POST | `/auth/logout` | Revoke the current session |
| GET | `/auth/sessions` | List the user's active sessions |
| DELETE | `/auth/sessions/{session_id}` | Revoke a session |
| DELETE | `/auth/me` | Deactivate and anonymize the current account |
| POST | `/auth/password/forgot` | Start password recovery |
| POST | `/auth/password/reset` | Complete password recovery |

Authentication responses should not reveal whether an unverified identifier belongs to an account where doing so enables enumeration.

Mobile clients authenticate API calls with short-lived bearer access tokens and keep refresh credentials in platform-secure storage. The customer and admin web applications use secure, HTTP-only session cookies. Cookie-authenticated state-changing requests require an approved CSRF defense, and authentication responses must use restrictive cache headers.

Account deactivation revokes every session, removes login identifiers, addresses, profile and
inventory media, anonymizes the profile, and hides owned listings and stores. Stable user IDs and
required booking, payment acknowledgement, message, dispute, review, and audit records are
retained. The mutation uses the same bearer-or-cookie and CSRF boundary as other account changes.

## Profile and Verification APIs

Current status: profile and address operations are implemented under `/auth/me` and `/auth/me/addresses`; seller-header upsert and public read are implemented under catalog routes. Verification and notification operations remain target behavior.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/auth/me` | Get current profile and capabilities |
| PATCH | `/auth/me` | Update allowed profile fields |
| GET | `/auth/me/addresses` | List private saved addresses |
| POST | `/auth/me/addresses` | Add an address |
| PUT | `/auth/me/addresses/{address_id}` | Update an address |
| DELETE | `/auth/me/addresses/{address_id}` | Remove an unused address |
| GET | `/me/verifications` | Get verification requirements and status |
| POST | `/me/verifications` | Start an approved verification flow |
| GET | `/me/seller-header` | Get the user's optional public seller header |
| PUT | `/me/seller-header` | Create or update public seller presentation metadata |
| DELETE | `/me/seller-header` | Hide the optional seller header |
| GET | `/me/notifications` | List notifications |
| PATCH | `/me/notification-preferences` | Update channel preferences |

## Category and Discovery APIs

Current status: category list, listing search/detail, quote creation, and public seller-header read are implemented. Category-form, availability-summary, favorites, and complete filter/pagination behavior remain target work.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/categories` | List enabled category hierarchy |
| GET | `/categories/{category_id}/form` | Get typed listing requirements |
| GET | `/listings` | Search by text, category, dates, location, price, and fulfillment |
| GET | `/listings/{listing_id}` | Get public listing detail and availability summary |
| GET | `/listings/{listing_id}/availability` | Query dates and available quantity |
| POST | `/listings/{listing_id}/quotes` | Calculate an expiring server-side quote |
| GET | `/sellers/{user_id}` | Get a public seller header and active listings |
| POST | `/favorites/{listing_id}` | Save a listing |
| DELETE | `/favorites/{listing_id}` | Remove a saved listing |
| GET | `/favorites` | List saved listings |

Public listing responses include approximate locality and distance. They exclude private coordinates, phone numbers, email addresses, identity evidence, internal risk signals, and private object keys. Public category, listing, and seller responses expose stable slugs and safe metadata for canonical web URLs and link previews.

## Listing Management APIs

Current status: create/update, publish/pause/resume/archive, owner listing read, availability-block creation, and seller-header upsert are implemented. Appeal, history, media, price replacement, recurring rules, and availability-block deletion remain target work.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/listings` | Create a listing owned by the authenticated user |
| PATCH | `/listings/{listing_id}` | Update mutable listing fields |
| POST | `/listings/{listing_id}/publish` | Publish after automated checks |
| POST | `/listings/{listing_id}/pause` | Pause discovery and new requests |
| POST | `/listings/{listing_id}/resume` | Resume unchanged content or restart checks after material edits |
| POST | `/listings/{listing_id}/archive` | Archive a listing when allowed |
| POST | `/listings/{listing_id}/appeal` | Appeal an eligible moderation removal |
| GET | `/listings/{listing_id}/history` | Get owner-visible lifecycle and moderation history |
| POST | `/listings/{listing_id}/media/uploads` | Authorize a private upload |
| DELETE | `/listings/{listing_id}/media/{media_id}` | Remove eligible media |
| PUT | `/listings/{listing_id}/prices` | Replace future pricing rules |
| GET | `/listings/{listing_id}/availability-rules` | Get owner scheduling rules |
| PUT | `/listings/{listing_id}/availability-rules` | Update future scheduling rules |
| POST | `/listings/{listing_id}/availability-blocks` | Block inventory for an interval |
| DELETE | `/listings/{listing_id}/availability-blocks/{block_id}` | Remove an eligible block |

Creating or updating a listing returns moderation state separately from publication state. Seller-header endpoints modify presentation only; they never alter listing ownership or authorization.

The canonical listing states are `draft`, `pending_checks`, `under_review`, `active`, `paused`, `archived`, and `removed`. Only `active` listings appear in public search or accept quote requests. Clients submit actions such as publish, pause, resume, archive, or appeal; they never set an arbitrary status directly.

## Booking APIs

Current status: booking create/list/detail and accept/reject/cancel actions are implemented. The history read endpoint, expiry automation, policy snapshots, and generic idempotency-key storage remain target work.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/bookings` | Create a request from a valid quote |
| GET | `/bookings` | List bookings visible to the actor |
| GET | `/bookings/{booking_id}` | Get authorized booking detail |
| POST | `/bookings/{booking_id}/accept` | Owner accepts after availability recheck |
| POST | `/bookings/{booking_id}/reject` | Reject with a reason code |
| POST | `/bookings/{booking_id}/cancel` | Cancel under the snapshotted policy |
| GET | `/bookings/{booking_id}/history` | Get authorized transition history |

Each action endpoint accepts only action-specific fields. Clients cannot submit a desired arbitrary booking status.

The MVP booking lifecycle is `requested` to `accepted`, `ready_for_handover`, `active`, `return_pending`, `inspection`, and `completed`, with policy-controlled `rejected`, `expired`, `cancelled`, `overdue`, and `disputed` paths. There is no `payment_pending` or online-payment confirmation state in MVP.

### Booking Creation Example

```json
{
  "quote_id": "2d113595-3492-4793-bdc4-71a530f62115",
  "fulfillment_method": "pickup"
}
```

The current booking request accepts a valid quote ID and fulfillment method. Payment remains outside platform processing and is represented only through later participant acknowledgements.

## Payment-at-Pickup APIs

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/bookings/{booking_id}/payment-at-pickup/acknowledge` | Record a participant's handover acknowledgement |

These endpoints do not process, hold, settle, guarantee, or refund money. Online checkout and payment webhooks are outside MVP.

## Fulfillment APIs

Current status: every row in this table is implemented. Structured condition reports contain checklist data and notes; private evidence files are not implemented.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| PUT | `/bookings/{booking_id}/fulfillment` | Create or update owner-controlled schedule fields |
| POST | `/bookings/{booking_id}/handover/challenge` | Create a short-lived handover challenge |
| POST | `/bookings/{booking_id}/challenge/confirm` | Confirm a handover or return challenge |
| POST | `/bookings/{booking_id}/condition-reports` | Add handover or return evidence |
| POST | `/bookings/{booking_id}/return/initiate` | Mark item ready for return |
| POST | `/bookings/{booking_id}/return/challenge` | Create a short-lived return challenge |
| POST | `/bookings/{booking_id}/inspection/accept` | Complete an accepted return |

Private addresses are returned only when the actor, booking state, and fulfillment method authorize them.

## Messaging APIs

Current implementation exposes booking-scoped routes rather than separate conversation-resource routes:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/bookings/{booking_id}/messages` | List authorized booking messages |
| POST | `/bookings/{booking_id}/messages` | Send an idempotent booking message |

The conversation, attachment, message-report, user-block, WebSocket, and notification behavior below remains target design.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/bookings/{booking_id}/conversation` | Get the booking conversation |
| GET | `/conversations/{conversation_id}/messages` | Cursor-page authorized messages |
| POST | `/conversations/{conversation_id}/messages` | Send a message with idempotency |
| POST | `/conversations/{conversation_id}/attachments/uploads` | Authorize a private attachment upload |
| POST | `/messages/{message_id}/report` | Report abusive or unsafe content |
| POST | `/users/{user_id}/block` | Block future interaction where policy permits |

WebSocket channels use short-lived authorization and subscribe only to conversations and bookings visible to the actor.

Message creation checks for phone numbers, email addresses, UPI handles, bank details, external URLs intended to bypass the platform, and common obfuscations. Prohibited contact or payment details are rejected before message storage with `MESSAGE_PRIVATE_CONTACT_BLOCKED`. The API records only a redacted safety event and never stores the rejected plaintext in logs or moderation metadata.

## Review, Report, and Dispute APIs

Current status: completion-gated review creation, report creation, and booking dispute creation are implemented. Review lists, dispute detail, evidence upload, participant responses, and case decisions remain target work.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/bookings/{booking_id}/reviews` | Submit a completion-gated review |
| GET | `/listings/{listing_id}/reviews` | List moderated listing reviews |
| POST | `/reports` | Report a listing, user, seller header, or message |
| POST | `/bookings/{booking_id}/disputes` | Open an eligible dispute |
| GET | `/disputes/{dispute_id}` | Get participant-visible case state |
| POST | `/disputes/{dispute_id}/evidence/uploads` | Add private evidence |
| POST | `/disputes/{dispute_id}/responses` | Add a participant response |

## Administration APIs

Implemented admin routes live under `/api/v1/admin` and require an active `platform_staff` record:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/admin/reports` | List staff-visible reports |
| POST | `/admin/listings/{listing_id}/moderate` | Approve or remove a listing and append a moderation action |

The broader capabilities below remain target design and are not yet available.

- Category and risk-policy management
- Moderation queues and actions
- User and high-risk seller verification review
- Booking support interventions through domain commands
- Dispute assignment, evidence review, and decision
- Audit-event search
- Operational metrics and privacy-filtered exports

Administrative APIs must not provide unrestricted database access or arbitrary status updates.

## Pagination and Filtering

Cursor-paginated responses use:

```json
{
  "items": [],
  "next_cursor": "opaque-or-null",
  "has_more": false
}
```

Search filters are allow-listed and validated. Sorting uses stable secondary keys to prevent duplicates between pages.

## Idempotency

Target requirement: booking creation, acceptance, payment acknowledgement, handover confirmation, return confirmation, message sends, and sensitive administrative actions should accept durable idempotency keys.

Current implementation provides record-level idempotency for booking creation from a quote, per-actor payment acknowledgement, per-actor challenge confirmation, reviews, disputes, and messages using `client_message_id`. A generic `idempotency_keys` store and reusable command middleware are not implemented.

## Versioning and Compatibility

- Breaking API changes require a new version or a documented migration window.
- Additive response fields are allowed.
- Mobile and web clients must tolerate unknown enum values with a safe fallback.
- Minimum supported app versions can be enforced only with a clear upgrade path.
- Provider payloads remain inside integration adapters and do not become public API contracts.

## Audit and Observability

Every response includes or propagates a request ID. Logs record route template, actor ID where allowed, status, latency, and error code without request secrets or sensitive bodies. Booking and listing transitions use append-only history tables, payment acknowledgements are append-only per actor, and moderation mutations append `moderation_actions`. A general domain-event/outbox audit stream is not implemented.
