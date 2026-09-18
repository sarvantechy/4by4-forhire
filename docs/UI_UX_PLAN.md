# UI and UX Plan

## Document Status

- Specification status: Ready for wireframes and design system work
- Implementation status: Customer web and Expo mobile include connected authentication, listing/search, quote/request, booking actions, booking messages, code-based handover/return, offline acknowledgement, review, and report controls; admin includes staff sign-in, report queue, and listing approve/remove actions
- Locally verified screens: Customer/admin production builds and typechecks, mobile typecheck/lint and Expo Doctor, two customer Playwright shell tests, and responsive unauthenticated booking/admin inspections; authenticated browser and physical-device journeys remain pending
- Status source: [Implementation Plan](IMPLEMENTATION_PLAN.md)

Screen names and journeys describe the target behavior. Use the implementation plan to distinguish connected controls from remaining media, evidence, verification, notification, and release work.

Current UI gaps include listing and condition photos, private upload progress/retry, category-specific forms, advanced discovery filters/maps, full profile/address/session editing on mobile, password recovery, notification inbox/preferences, verification, complete dispute timelines/evidence, staff case assignment, rich evidence review, sanctions/appeals, and English/Tamil acceptance evidence.

## Experience Goal

4by4 For Hire should feel like a practical local utility, not a classifieds feed. A renter should quickly understand whether an item is available, what the complete cost is, how it will be received, and what protection applies. An owner should be able to manage a request with minimal typing.

The customer experience targets Android, iOS, and responsive web from the MVP. Android receives additional pilot attention because of the likely local device mix, while the web application supports public discovery and complete authenticated marketplace workflows. The admin console remains separate responsive web software intended for platform operations.

## Design Direction

- Clear, work-focused visual language suitable for tools, events, homes, and frequent local sellers
- Light surfaces with charcoal text, safety-yellow highlights, teal confirmations, and red reserved for risk or destructive actions
- Strong photography and condition evidence rather than decorative illustration
- Compact information hierarchy with prominent price, availability, distance, and fulfillment method
- Familiar icons from the selected mobile and web icon libraries
- Minimum 44-by-44 point touch targets
- No nested cards, oversized marketing sections, or decorative effects that reduce scanability
- English and Tamil layouts considered from the first design pass; localized content must be able to expand without clipping

## Mobile Navigation

Recommended bottom navigation:

1. **Home**: Location, categories, nearby items, recent searches
2. **Explore**: Search, filters, map/list results
3. **List Item**: Primary creation action
4. **Bookings**: Renting and lending activity with status counts
5. **Account**: Profile, seller header, verification, favorites, settings, and support

Inbox is accessible from the header and booking detail, with an unread badge. A dedicated Inbox tab can replace List Item if pilot research shows messaging is used more frequently than listing.

## Customer Web Navigation

The responsive web application uses the same information architecture with browser-appropriate composition:

- Desktop header with product identity, location, search, categories, bookings, list-item action, inbox, and account menu
- Mobile-web bottom navigation or compact header matching the five core mobile destinations
- Persistent filter rail or drawer for larger search viewports
- Split list/map view where screen width permits it
- Breadcrumbs on category, listing, seller, and account-management pages
- Stable, shareable URLs for public categories, listings, and seller headers

Authenticated pages must preserve a safe return URL through login. Browser back/forward navigation, opening in a new tab, refresh, and deep links must work without losing authoritative booking state.

## Entry and Authentication

### Welcome

- Product identity and location benefit
- Continue with mobile number
- Continue with email
- Terms and privacy links

### Mobile OTP

- Country code fixed or selectable with India default
- National-number validation
- OTP entry with resend timer and change-number action
- Clear retry and rate-limit states

### Email

- Registration, verification, login, forgotten password, and reset flows
- Password visibility toggle and strength requirements

Authentication should return users to their interrupted listing or booking action after success.

On web, authenticated sessions use secure cookies and forms include CSRF protection. On mobile, credentials use platform-secure storage. Both platforms show and revoke active sessions from the same account screen.

## Home

First viewport:

- Current locality control
- Search field
- Horizontally scrollable launch categories
- Available-nearby results

Additional sections can include recently viewed, available this weekend, popular tools nearby, event equipment, and verified sellers. Empty states should suggest a nearby locality or broader distance rather than fabricate listings.

On desktop web, search and locality remain prominent in the header while content uses the additional width for useful inventory density. On mobile and narrow web viewports, sections become touch-friendly horizontal or single-column lists without hiding core filters.

## Search and Discovery

### Search Results

- List/map segmented control
- Date and time range
- Distance radius
- Category and category-specific attributes
- Price range and pricing unit
- Pickup, delivery, or either
- Verified owner filter
- Available quantity
- Sort by recommended, nearest, price, rating, or newest

Listing rows show a real item photo, short title, primary price unit, approximate distance, availability signal, fulfillment icons, rating, and optional frequent-seller indicator.

Web search pages use semantic links so listings can open in new tabs. Filter and sort state is represented in the URL where safe, allowing refresh and sharing without including precise location or private account data.

### Location Privacy

- Explain device-location permission at the moment it is useful.
- Allow typed locality or postal-code search when permission is declined.
- Show approximate map pins before booking authorization.
- Never display a private residential address on public screens.

## Listing Detail

The page should prioritize:

- Media gallery
- Item title, condition, and owner trust indicators
- Price options and complete cost preview
- Date/time and quantity controls
- Availability result
- Pickup and delivery choices
- Approximate location and distance
- Deposit and cancellation summary
- Description, specifications, included accessories, and usage restrictions
- Reviews and report action
- Sticky request action with selected total

Contact details are never displayed. The owner can be contacted through the booking-linked conversation after a request is created.

Public web listing pages include safe titles, descriptions, canonical URLs, and link-preview metadata. They do not include exact addresses, private media, contact data, booking availability internals, or user-generated structured markup.

## Quote and Booking Request

Use a short sequence rather than one long form:

1. Rental dates and quantity
2. Pickup or owner-managed delivery
3. Address selection when delivery is allowed
4. Price breakdown and optional deposit
5. Verification requirement, if triggered
6. Payment method
7. Review and submit request

After submission, show owner response deadline, request status, cancellation terms, and the in-app conversation. Do not imply that a request is accepted before explicit owner approval; payment remains due at handover.

## Booking Detail

A timeline is the primary structure. It presents the current state and the next valid action without exposing arbitrary status controls.

Common sections:

- Item and participant summary
- State timeline
- Rental and fulfillment schedule
- Price, payment acknowledgement, deposit, and disagreement state
- Pickup or delivery instructions when authorized
- Conversation
- Condition reports
- Cancellation, report, help, or dispute actions when eligible

Owner actions such as accept, reject, prepare, confirm handover, inspect return, and open a dispute require a confirmation sheet showing consequences.

## List an Item

Use a category-driven draft with autosave:

1. Category
2. Photos
3. Title and description
4. Category-specific details
5. Condition and included accessories
6. Quantity
7. Pricing and optional deposit
8. Availability and turnaround buffer
9. Pickup and optional delivery
10. Approximate public location and private handover location
11. Preview and publish

Inline validation should explain prohibited or restricted content before submission. Publishing moves the listing into visible automated checks; only an `active` listing appears in search. Manual-review, rejection, appeal, pause, resume, and archive states must show the next valid owner action.

Mobile supports direct camera capture. Web supports camera capture where available plus accessible drag-and-drop and file selection. Drafts synchronize through the server after authentication so a user can begin on one platform and continue on another.

## Owner Workspace

The Account area provides an owner mode with:

- Listings and drafts
- Incoming requests
- Active rentals
- Returns and inspections
- Calendar and availability blocks
- Earnings records for offline payments
- Reviews, reports, and help

Status-based queues should make urgent work visible: requests expiring, handovers today, returns today, and overdue rentals.

## Seller Profile Header

A user who publishes multiple listings can add a lightweight header containing:

- Public seller display name
- Cover image and short description
- Approximate locality and optional operating hours
- Verification and rating indicators
- Active listings from the same user account

This is profile presentation, not a storefront. It does not introduce staff access, branches, separate inventory ownership, online payments, or a separate legal identity.

## Handover and Return

### Handover

- Confirm included accessories and current condition.
- Capture fresh photos using the camera where possible.
- Generate a short-lived QR or OTP challenge.
- Require both-party confirmation or a documented exception workflow.
- Show each participant's payment-at-pickup acknowledgement without describing it as platform-verified payment.

### Return

- Compare initial and returned condition side by side.
- Record missing accessories or damage.
- Confirm return or open a dispute during the inspection window.
- Clearly show deposit-return acknowledgement or disagreement when relevant.

## Messaging

- Booking context remains visible above the conversation.
- Phone numbers, email addresses, payment handles, bank details, and external-payment instructions are blocked before sending with a clear correction message.
- Attachments use private authorized upload.
- Block, report, and safety actions remain accessible.
- Delivery and payment actions use structured booking controls, not informal chat agreements.

## Notifications

Use push and in-app notifications for actionable events. SMS or email is reserved for authentication, critical booking events, and configured fallback.

Avoid sending multiple notifications for one domain event. Deep links must reopen the correct authorized booking, conversation, verification, or support screen.

## States and Resilience

Every network-backed screen needs explicit loading, empty, retry, unauthorized, offline, and stale-data behavior.

- Preserve unsent listing drafts locally.
- Queue only operations designed for safe idempotent retry.
- Do not show a booking as accepted, paid, handed over, or returned until confirmed by the server.
- Present stale status with a refresh action after reconnecting.
- Optimize media uploads for variable mobile connectivity and resume where provider support allows.
- On web, preserve safe draft and filter state across refresh without storing private tokens in browser-accessible storage.

## Accessibility and Localization

- Support screen readers, logical focus order, and descriptive control labels.
- Do not communicate booking or payment state using color alone.
- Support dynamic text without clipping important actions.
- Support complete web keyboard navigation, visible focus, landmarks, skip links, and accessible dialogs.
- Format Indian currency, phone numbers, dates, and addresses appropriately.
- Keep copy ready for Tamil translation and test both scripts on small screens.
- Avoid forcing device location when a typed location can complete the task.

## Responsive Web Experience

The customer web application must provide the complete renter and owner journey, not a marketing-only companion site:

- Public home, categories, search, listing detail, and seller pages
- Registration, login, account, verification, addresses, favorites, and sessions
- Listing creation, media upload, pricing, availability, and owner workspace
- Booking request, approval, timeline, messaging, handover, return, and disputes
- Responsive layouts at mobile, tablet, laptop, and wide desktop widths
- Install prompt and web push only when browser support and user context make them useful

Public pages can be server-rendered and cached using privacy-safe data. Authenticated pages and APIs must not enter shared caches. Sensitive workflows should require reauthentication when risk policy demands it.

## Admin Web Experience

The admin console should be a dense operational interface with permission-scoped navigation:

- Queues for verification, moderation, reports, disputes, and payment disagreements
- Search across safe user, seller-header, listing, and booking summaries
- Evidence viewer with access logging
- Timeline of domain and administrative actions
- Reason-coded action forms
- Metrics for supply, bookings, payments, safety, and support

The interface must distinguish automated signals from confirmed policy violations and require confirmation for high-impact actions.

## UX Validation

Before pilot launch, test these journeys on low- and mid-range Android devices, at least one iOS device, and supported desktop and mobile browsers:

1. Register by mobile OTP and by email.
2. Find an available drill nearby and request pickup.
3. Publish a tool listing with an optional deposit.
4. Accept a request and complete payment at pickup.
5. Acknowledge payment at pickup and record a disagreement without implying platform processing.
6. Complete handover and return with condition evidence.
7. Configure a seller header and confirm that all listings remain owned by the same user.
8. Report a listing and open a dispute without exposing contact information.
9. Recover from interrupted upload, offline state, expired quote, and availability conflict.
10. Complete core flows in English and Tamil without clipped content.
11. Start a listing or booking on web and continue it on mobile, then reverse the direction.
12. Navigate every customer web workflow by keyboard and verify mobile, tablet, and desktop layouts.
13. Open and share public listing URLs while confirming private routes and data remain non-indexable.
