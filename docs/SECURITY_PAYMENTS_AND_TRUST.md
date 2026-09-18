# Security, Payments, and Trust

## Document Status

- Specification status: Planned baseline; operating policies and providers remain open
- Implementation status: Core participant authorization, session rotation/revocation, CSRF, structured condition records, offline acknowledgement, review, report, dispute, staff-denial, and moderation-mutation audit controls implemented; media/provider/retention controls remain planned
- Verified controls: Cookie CSRF denial, refresh replay denial, participant-scoped booking/message access, direct phone-sharing rejection, dual handover/return confirmation, review eligibility, staff denial, and moderation mutation audit
- Status source: [Implementation Plan](IMPLEMENTATION_PLAN.md)

Not yet implemented: private listing/evidence media storage and scanning, signed media delivery, production OTP/email providers, identity verification, user blocking, generic idempotency storage, legal/dispute holds, sensitive-read audit, staff case assignment, sanctions/appeals, notification workers, and retention jobs.

## Purpose

A rental marketplace combines identity, physical property, money, location, and direct interactions. Security and trust controls are product requirements, not optional infrastructure work.

This document defines the MVP baseline. Legal review and provider review are still required before public launch. No control described here should be treated as implemented until verification evidence is recorded in the implementation plan.

## Privacy Baseline

- Do not reveal one user's phone number or email address to another user.
- Keep communication inside booking-linked conversations.
- Show approximate locality and distance on public listings, not precise coordinates.
- Reveal pickup or delivery instructions only to authorized booking participants at the required stage.
- Store identity documents and condition evidence in private object storage.
- Use short-lived signed URLs after an authorization check.
- Minimize data collected and define retention by record type.
- Support account access, correction, deletion, and consent records as required by applicable Indian law.
- Prevent restricted values from appearing in application logs, analytics, crash reports, and support exports.

## Authentication

### Mobile OTP

- Normalize Indian mobile numbers to E.164.
- Rate-limit OTP requests by account, number, device, IP, and risk signal.
- Store only a secure digest of the OTP.
- Use short expiry, limited attempts, and one-time consumption.
- Detect repeated registration and account-recovery abuse.

### Email and Password

- Verify the email address before sensitive actions.
- Hash passwords using Argon2id or a current recommended password hasher.
- Block known-compromised passwords where practical.
- Rate-limit login attempts and notify users about suspicious access.

### Sessions

- Issue short-lived access tokens and rotating refresh tokens.
- Store mobile refresh credentials only in platform-secure storage.
- Use secure, HTTP-only, appropriately scoped `SameSite` cookies for customer and admin web sessions.
- Protect cookie-authenticated state-changing requests against CSRF.
- Store session records server-side with client type, device or browser metadata, and revocation state.
- Revoke the token family on detected refresh-token reuse.
- Allow users to review and terminate active sessions.
- Require recent or step-up authentication for sensitive account and identity changes.

### Web Security

- Restrict CORS to approved HTTPS origins; never use wildcard origins with credentials.
- Apply a strict Content Security Policy and standard browser security headers.
- Prevent authenticated pages, private API responses, and signed media URLs from entering public caches.
- Sanitize user-generated text and never render untrusted HTML.
- Use canonical URLs and structured metadata only for public category, listing, and seller content.
- Mark account, booking, conversation, handover, dispute, and private-media routes as non-indexable.
- Keep the public customer application and privileged admin application on separate authorization and deployment boundaries.

## Authorization

- Resolve the actor from the authenticated session.
- Derive listing ownership from server-side records.
- Scope conversations, bookings, media, addresses, and payment records to authorized participants.
- Separate support, moderation, identity-review, and super-administrator permissions.
- Record sensitive administrative reads and every administrative mutation.
- Never authorize a request using an owner ID or verification claim supplied by the client.
- A public seller header does not create roles, delegation, or access for another account.

### Administrative Permission Matrix

| Capability | Support | Moderator | Identity reviewer | Administrator |
| --- | --- | --- | --- | --- |
| View assigned booking support case | Yes | Yes | No | Yes |
| View private condition/dispute evidence | Assigned case only | Assigned case only | No | Approved case only |
| Review or remove a listing/seller header | No | Yes | No | Yes |
| Review identity evidence | No | No | Yes | Emergency audited access |
| Restrict a user | Recommend | Policy-scoped | Verification-only hold | Yes |
| Decide a dispute | Assigned policy cases | Escalated safety cases | No | Escalation only |
| Override another decision | No | No | No | Two-step approval required |
| Manage administrator permissions | No | No | No | Separate privileged approval |

Sensitive evidence access requires an assigned case or approved emergency workflow and always creates an audit event. Roles provide defaults; server-side permissions and case assignment make the final decision.

## Listing Publication and Moderation

Publishing immediately submits a listing to automated checks. Only an `active` listing is searchable or bookable.

Pre-publication controls:

- Required category attributes
- Allowed media type and size validation
- Malware and unsafe-content scanning
- Prohibited keyword and category detection
- Duplicate and suspicious-price signals
- Owner account and risk-status checks

Post-publication controls:

- User reporting
- Risk-scored moderation queues
- Temporary search suppression
- Reason-coded removal or restriction
- Owner appeal workflow
- Immutable moderation history

Listings that match restricted categories, high-risk thresholds, or suspicious signals can be held for review before becoming searchable.

The canonical state flow is `draft` to `pending_checks`, then `active` or `under_review`. Review can approve to `active` or reject to `removed`. Owners can pause or archive eligible listings, while moderation can move an active listing to `removed`. Every transition is append-only and reason-coded.

Seller headers use the same automated text/media and impersonation signals. Their display names need not be unique, but public pages use stable user identifiers, and suspicious headers can be suppressed without changing listing ownership.

## Risk Tiers and Verification

| Tier | Typical use | Required controls |
| --- | --- | --- |
| Standard | Low-value household items | Verified mobile or email |
| Controlled | Power tools and potentially hazardous equipment | Strong account verification and category acknowledgement |
| High value | Cameras, laptops, premium watches | Government ID, selfie/liveness where lawful, deposit, enhanced evidence |
| Restricted | Categories requiring manual review | Platform approval and category-specific evidence |
| Prohibited | Illegal, unsafe, or unsupported items | Block listing and preserve moderation evidence |

Verification requirements are calculated from category, replacement value, rental value, deposit, booking history, and owner settings. Raw government identifiers should not be used as searchable business identifiers or exposed to owners.

## MVP Payment Model

### All Owners

- Payment at pickup only.
- The app records the selected method and owner confirmation.
- The platform does not claim to process, hold, guarantee, or settle the funds.
- Cash or UPI used at handover remains an arrangement between the renter and owner, not a gateway-confirmed platform payment.
- The platform commission is zero and no amount is deducted or settled by the platform.

### Payment-at-Pickup Safety

- Do not collect full card data, CVV, bank credentials, UPI PINs, or payment-provider secrets.
- Show the agreed rental charge, delivery charge, and optional deposit before handover.
- Record each participant's acknowledgement separately and preserve disagreements.
- Do not label an acknowledgement as platform-verified payment.
- Warn users not to pay an unknown owner in advance outside the approved handover flow.
- Support can document a disagreement but cannot reverse cash or an external UPI transfer.

## Future Online Payments

Online checkout, payment custody, refunds, settlements, payouts, commission, and a double-entry ledger are deferred. They require a separate approved design and payment-provider review before implementation. The future payment domain must not reinterpret MVP acknowledgements as provider-confirmed transactions.

## Deposits

- Deposits are optional and configured per listing within platform limits.
- The booking stores a snapshot of the agreed deposit.
- The UI must distinguish a refundable deposit from a rental charge.
- Deposits are exchanged at handover outside platform payment processing during MVP.
- Owner claims require reason, amount, condition evidence, and submission within the inspection window.
- The renter can respond before a contested claim is finalized.
- Platform staff do not make irreversible high-value decisions without a documented review process.

The platform records deposit acknowledgements and dispute evidence but cannot hold or release the money during MVP.

## Booking and Handover Evidence

- Generate short-lived, single-use handover and return challenges.
- Do not use a static booking code.
- Record who confirmed, when, on which booking, and through which method.
- Capture pre-handover and return condition checklists and photos.
- Preserve booking policy, item description, price, and condition snapshots.
- Apply a legal or dispute hold before deleting relevant evidence.

Current status: short-lived hashed challenges, per-actor confirmations, structured handover/return checklists, notes, payment snapshots, and append-only status history are implemented. Photo evidence, private object references, malware scanning, retention holds, and exception workflows are not implemented.

## Messaging Protection

- Encrypt transport using HTTPS and secure WebSocket connections.
- Authorize every conversation subscription and message operation.
- Block phone numbers, email addresses, UPI handles, bank details, and external-payment instructions before storing a message.
- Detect common spacing, punctuation, and word-based obfuscations and return a clear correction message to the sender.
- Store only a redacted safety event for rejected content; never persist the rejected plaintext in messages, logs, analytics, or moderation metadata.
- Rate-limit spam and attachment uploads.
- Provide block and report controls.
- Restrict staff message access to assigned, auditable support cases.

Current status: booking participant authorization, message retry idempotency, and direct phone-number rejection before storage are verified. Comprehensive email/UPI/bank/link obfuscation detection, attachments, rate limits, block controls, message reports, and case-scoped staff access remain incomplete.

## Disputes and Enforcement

Dispute types include item not received, item materially different, damage, missing parts, late return, non-return, payment disagreement, unsafe behavior, and abusive communication.

Each case should include:

- Booking and participants
- Reason and requested outcome
- Evidence references
- Timeline and messages relevant to the case
- Assigned support agent
- Decisions, approvals, and financial actions
- Appeal status

Account and listing enforcement uses reason codes, expiry where applicable, and audit history. Avoid destructive deletion of evidence needed for an active dispute.

## High-Level Prohibited Items

The final policy requires legal review. The initial block list should include illegal goods, weapons and ammunition, controlled drugs and medicines, stolen goods, hazardous substances without an approved workflow, counterfeit goods, surveillance tools intended for unlawful use, live animals, personal identity documents, and items the platform cannot safely or legally support.

Vehicles remain disabled until licence verification, insurance, permits, agreements, incident response, and category-specific regulations are implemented.

## Security Operations

- Encrypt data in transit and at rest.
- Use managed secrets and rotated credentials.
- Enforce least-privilege cloud and database access.
- Protect admin access with multi-factor authentication.
- Maintain dependency, container, and infrastructure scanning.
- Alert on authentication spikes, payment anomalies, unusual exports, and privileged actions.
- Maintain incident response, breach notification, backup restoration, and provider outage procedures.
- Perform penetration testing before public launch and after material payment or identity changes.

## Release Gates

The public pilot cannot launch until:

1. Prohibited-item, privacy, terms, cancellation, late-return, and dispute policies are approved.
2. Payment-at-pickup limitations are clearly disclosed before request and handover.
3. Authorization tests cover cross-account access.
4. Booking concurrency and command replay tests pass.
5. Private media and identity evidence cannot be accessed through public URLs.
6. Backup restoration is demonstrated.
7. Administrative actions and sensitive reads are auditable.
8. Support staff are trained on safety escalation and the limits of offline-payment assistance.
