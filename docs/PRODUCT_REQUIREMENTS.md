# Product Requirements

## Document Status

- Product: 4by4 For Hire
- Stage: Approved MVP planning baseline
- Market: India
- Operational pilot: Tamil Nadu, statewide (superseding the earlier Kanyakumari-district-only framing)
- Implementation status: Foundation and core identity/catalog/booking slices are implemented locally; fulfillment/trust slices are partially implemented; pilot-readiness work remains incomplete
- Status source: [Implementation Plan](IMPLEMENTATION_PLAN.md)

The requirements in this document describe approved target behavior. They are not an implementation checklist by themselves. See the [Implementation Plan](IMPLEMENTATION_PLAN.md) for current code, local verification evidence, open policy/provider decisions, and remaining work. Nothing in this document claims staging, pilot, or production deployment.

## Product Vision

4by4 For Hire helps people make useful items available for short-term rental. The first release focuses on practical, nearby inventory used by households, technicians, labourers, small contractors, farmers, event organizers, and local business owners acting through normal user accounts.

The phrase "rent anything" describes broad utility, not unrestricted inventory. Listings remain subject to category rules, safety requirements, applicable Indian law, and platform moderation.

## Product Goals

1. Make nearby rental inventory easy to discover and compare.
2. Let any user publish one or many personal items without requiring a store.
3. Let frequent and business sellers create owner-operated stores that group their listings without introducing staff roles, branches, or separate inventory ownership.
4. Prevent overlapping confirmed bookings for the same inventory.
5. Protect phone numbers, exact addresses, identity documents, and payment details.
6. Create reliable evidence for pickup, delivery, condition, return, and disputes.
7. Validate the Tamil-Nadu-wide operating model before expanding operations across India.
8. Let customers complete the same core marketplace journey on Android, iOS, or the responsive web application.

## Supported Platforms

### Mobile Applications

- Android and iOS applications built with React Native and Expo
- Device camera and photo-library support for listings and condition evidence
- Native push notifications, deep links, secure session storage, and location permission
- Resilient uploads and clear behavior on variable mobile connections

### Customer Web Application

- Responsive browser experience for mobile, tablet, laptop, and desktop widths
- Public, shareable, search-engine-readable category, listing, and seller pages
- Authenticated listing, booking, messaging, handover, return, and account workflows
- Browser geolocation where permitted, with locality or postal-code entry as a complete fallback
- Installable progressive web app behavior where it improves repeat use

### Platform Parity

Core marketplace rules and capabilities must remain consistent across mobile and web. Platform-specific presentation is allowed for navigation, camera and file selection, location permission, notifications, secure session handling, sharing, and handover scanning. A booking created on one platform must be immediately manageable from another.

## Non-Goals for MVP

- A platform-operated delivery fleet
- Live driver tracking or route optimization
- Vehicle rentals
- Store staff roles, branches, delegated access, and inventory owned independently of a user
- Online payment processing, settlements, and owner payouts
- Platform commission collection
- Subscription plans or promoted listings
- Auction, bidding, or rent-to-own workflows
- International currencies, addresses, or tax rules
- Fully automated dispute decisions

## Personas

### Renter

Needs an item for a limited period, wants transparent pricing and availability, and may prefer pickup or local delivery.

### Owner or Frequent Seller

Lists personal, work, or business inventory under one user account, approves each request, and receives payment at pickup during MVP. A frequent seller may add a lightweight public header with a display name, description, locality, and cover image, but every listing remains owned and operated by that user.

### Platform Administrator

Manages categories, moderation, verification, restricted listings, disputes, and platform configuration.

### Support Agent

Reviews user reports and booking evidence without receiving unrestricted administrator access.

## Launch Categories

The pilot should prioritize the first five categories. The remaining categories can be enabled after supply, operations, and risk controls are validated.

| Priority | Category | Examples | Initial risk |
| --- | --- | --- | --- |
| 1 | Tools and repair | Screwdrivers, drills, grinders, saws, toolkits | Standard or controlled |
| 2 | Construction and labour equipment | Ladders, cutters, mixers, welding machines, safety gear | Controlled |
| 3 | Cleaning and home equipment | Pressure washers, vacuums, carpet cleaners, water pumps | Standard |
| 4 | Garden and agricultural equipment | Grass cutters, tillers, sprayers, farming tools | Controlled |
| 5 | Events and functions | Chairs, tables, speakers, lights, tents, vessels | Standard |
| 6 | Electronics and photography | Cameras, projectors, laptops, microphones | High value |
| 7 | Travel and outdoor | Tents, backpacks, camping gear, bicycles | Standard or controlled |
| 8 | Home and office | Furniture, appliances, office equipment | Standard |
| 9 | Fashion and personal accessories | Costumes, wedding clothing, watches, handbags | Controlled or high value |
| Deferred | Vehicles | Bikes and cars | Restricted; not in MVP |

Category configuration must control required fields, minimum age, verification level, deposit rules, listing review rules, and prohibited subcategories.

## Core User Journeys

### Registration and Account Access

1. A user selects mobile OTP or email/password registration.
2. The system verifies the mobile number or email address.
3. The user accepts the terms, privacy notice, and marketplace rules.
4. The user creates a basic profile and location preference.
5. The same account can rent items and publish any number of listings.

### Discover and Request a Rental

1. The renter chooses a location or uses device location permission.
2. The renter searches or browses by category.
3. Filters narrow results by dates, distance, price, delivery, rating, and verification.
4. The renter selects a rental period and quantity.
5. The platform calculates rental charge, delivery fee, optional deposit, and total.
6. The renter submits a booking request and selects an allowed payment method.
7. The owner accepts or rejects the request before it expires.
8. Accepted bookings proceed to handover with payment due at pickup.

### List an Item

1. The owner selects a category and enters required attributes.
2. The owner adds photos, title, description, condition, quantity, and approximate location.
3. The owner defines rental units and prices, optional deposit, availability, pickup, and delivery options.
4. Publishing immediately submits the listing to automated checks.
5. A listing becomes searchable as soon as those checks pass.
6. High-risk or suspicious listings remain unsearchable until manual review approves them.
7. Moderation may later hold or remove an active listing with a reason and appeal path.

### Listing Lifecycle

| Status | Searchable | Meaning |
| --- | --- | --- |
| `draft` | No | Owner is editing; no publication requested |
| `pending_checks` | No | Publish requested; required fields, media, and automated policy checks are running |
| `under_review` | No | A risk rule or moderator requires manual review |
| `active` | Yes | Approved and available for search and booking subject to availability |
| `paused` | No | Temporarily hidden by the owner |
| `archived` | No | Retired by the owner and retained for referenced booking history |
| `removed` | No | Restricted by moderation with a reason and appeal state |

Publishing is immediate as a submission action, not a promise of immediate discoverability. Resuming an unchanged paused listing returns it to `active`; materially edited or policy-sensitive content returns to `pending_checks`.

### Pickup or Delivery Handover

1. The parties communicate only through in-app messaging.
2. Exact pickup or delivery instructions are revealed only to authorized booking participants at the appropriate stage.
3. The owner records condition photos and a checklist.
4. Both parties confirm handover using a short-lived OTP or QR challenge.
5. The booking becomes an active rental.

### Return and Completion

1. The renter initiates or confirms the scheduled return.
2. The owner records returned condition, photos, and missing accessories.
3. The owner accepts the return or opens a dispute within the inspection window.
4. The parties acknowledge any deposit return or other offline repayment when applicable.
5. Both parties can review each other after completion.

## Booking State Model

The canonical booking state is controlled by the server.

```text
requested
  -> accepted
  -> ready_for_handover
  -> active
  -> return_pending
  -> inspection
  -> completed
```

Exceptional states include `rejected`, `expired`, `cancelled`, `overdue`, and `disputed`. A resolved dispute can transition to the policy-approved operational state or `completed`. A status-history record must capture every transition, actor, timestamp, reason, and request identifier.

## Functional Requirements

### Listings and Inventory

- Every listing belongs to exactly one user account.
- Support quantity greater than one without duplicating the listing.
- Support hourly, daily, weekly, and monthly prices where enabled by category.
- Preserve price and policy snapshots on each booking.
- Show only approximate item location before booking authorization.
- Store private media with authorized access.
- Allow pause, archive, and temporary availability blocks.

### Availability

- Search results must account for the requested period and quantity.
- Accepted requests must not oversell inventory.
- Availability updates must use database transactions and conflict checks.
- Expired requests must release temporary holds automatically.
- Rental periods and buffers use timezone-aware timestamps.

### Stores and Seller Presentation

- A user may create owner-operated stores with a public display name, short description, locality, and operating hours.
- A listing may remain personal or be assigned to one active store owned by the same user.
- A store groups the same user's listings and does not create a separate legal owner, staff account, branch, inventory pool, or permission scope.
- The user's private name, phone number, email address, and precise address remain hidden.
- Store display names do not need to be globally unique; stable slugs and owner identifiers prevent mistaken ownership.
- New or edited stores remain subject to moderation and can be held or removed.

### Communication and Privacy

- Provide booking-linked in-app conversations.
- Do not expose phone numbers or email addresses to other users.
- Detect and warn on attempts to send contact details or external payment instructions.
- Allow users to report messages and block another account.
- Administrators access messages only through an auditable support or safety workflow.

### Payments

- All MVP rentals use payment at pickup or handover.
- The platform records the agreed amount and owner/renter acknowledgement but does not collect, hold, settle, or guarantee funds.
- Platform commission is deferred and remains zero.
- Rental charges, delivery charges, and optional deposits remain separate booking amounts.
- Online payment, gateway webhooks, platform refunds, and payouts are deferred until a later payment phase.

### Ratings and Reviews

- Only participants in a completed booking can review each other or the item.
- One review is allowed per reviewer, subject, and booking.
- Reviews can be reported and moderated but retain audit history.

### Administration

- Manage category configuration and risk tiers.
- Search users, seller headers, listings, bookings, reports, and disputes.
- Restrict accounts and listings with reason codes and history.
- Review verification evidence through least-privilege access.
- Manage booking intervention without implying that the platform can reverse an offline payment.
- Export operational reports without exposing unnecessary identity data.

## Non-Functional Requirements

- Target 99.9% monthly API availability after general release.
- Keep common read API p95 latency below 500 ms under expected pilot load.
- Support horizontal API and worker scaling without local session state.
- Keep public web listing pages indexable while preventing indexing of account, booking, conversation, precise-location, and private-media pages.
- Meet responsive web targets from 360 px mobile browsers through large desktop viewports.
- Make booking and payment commands idempotent.
- Provide structured logs, metrics, traces, and alerting without secrets or restricted data.
- Back up PostgreSQL and object metadata with tested restoration procedures.
- Meet applicable Indian privacy, consumer, tax, and payment requirements before launch.
- Meet WCAG 2.2 AA for the customer web application and provide equivalent accessible mobile semantics.
- Provide accessible touch targets, keyboard navigation on web, readable text, and clear loading, empty, offline, and error states.

## Pilot Success Measures

- Verified active listings and sellers by launch category
- Search-to-item-view and item-view-to-request conversion
- Owner response and acceptance times
- Confirmed, completed, cancelled, expired, and disputed bookings
- Availability conflict rate
- On-time handover and return rate
- Repeat renter and owner activity
- Moderation response time and prohibited-listing rate
- Payment-at-pickup acknowledgement and disagreement rate
- Support contacts per completed booking

## Open Operational Policies

These do not block technical design but must be approved before public launch:

- Booking request expiry duration
- Cancellation windows and fees
- Late-return charges and grace periods
- Deposit claim and inspection windows
- Seller verification evidence for high-risk or high-value rentals
- Minimum renter and owner age
- Tax invoice ownership and GST treatment
- Damage, loss, insurance, and police-report procedures
- Final prohibited and restricted-item catalogue
