# Store Listing Readiness

This document tracks the assets and copy required to publish the `4x4 For Hire`
mobile app on the Google Play Store and Apple App Store. It covers listing
readiness only — app.json/EAS build configuration is tracked separately in
`apps/mobile` and is out of scope here.

## Status

Draft — no assets produced yet. Update the checklist below as each item is
completed and store the final files under `apps/mobile/store-assets/` (create
this folder when the first asset is ready).

## App Identity

- **App name:** 4x4 For Hire
- **Short description (Android, ≤80 chars):** "Rent or hire local 4x4 gear, tools, and services near you."
- **Full description (Android, ≤4000 chars) / promotional text (iOS, ≤170 chars):** draft pending — should cover peer-to-peer rental, bargain/offer negotiation, in-app chat, and booking/dispute protection.
- **Category:** Android — Lifestyle or House & Home; iOS — Lifestyle or Utilities.
- **Content rating:** Everyone / 4+ (no mature content; user-generated listing photos should be covered by the moderation/report flow already implemented).
- **Privacy policy URL:** `https://api.forhire.4by4softwares.com/privacy` (production verified 2026-09-20).
- **Account deletion URL:** `https://api.forhire.4by4softwares.com/account-deletion` (production verified 2026-09-20).
- **Support URL / contact email:** required by both stores — use an existing 4by4softwares support address.

## Screenshots

| Platform | Required sizes | Count needed | Status |
|---|---|---|---|
| Android (phone) | 16:9 or 9:16, min 320px, max 3840px per side | 2–8 | Not started |
| Android (7" tablet, optional) | 16:9 or 9:16 | 0–8 | Optional |
| Android (10" tablet, optional) | 16:9 or 9:16 | 0–8 | Optional |
| iOS (6.7" display, iPhone) | 1290×2796 or 2796×1290 | 3–10 | Not started |
| iOS (6.5" display, iPhone) | 1242×2688 or 2688×1242 | 3–10 | Not started |
| iOS (12.9" iPad Pro, if iPad supported) | 2048×2732 or 2732×2048 | 3–10 | Optional |

Suggested screenshot flow (5 screens): home/browse map, listing detail with
bargain/offer form, chat with an owner, booking confirmation, account/offers
screen.

## Icons & Feature Graphic

| Asset | Spec | Status |
|---|---|---|
| Android app icon | 512×512 PNG, 32-bit with alpha | Not started |
| Android feature graphic | 1024×500 PNG/JPG, no alpha | Not started |
| iOS app icon | 1024×1024 PNG, no alpha, no rounded corners | Not started |
| Adaptive icon foreground/background (Android) | 108×108dp safe zone per Android adaptive icon spec | Not started |

## Data Safety / App Privacy Declarations

- Android Data Safety form and iOS App Privacy "nutrition label" must both
  declare: account info (email/mobile), approximate/precise location, photos
  (listing images), and in-app messages, matching what the backend already
  collects.
- Declare that data is not sold, and describe the reporting/dispute pipeline
  as the safety mechanism for user-submitted content.

## Pre-submission Checklist

- [x] Privacy policy published and linked
- [x] In-app account deletion and external deletion-information page implemented locally
- [ ] Support URL/email confirmed reachable
- [ ] Screenshots captured for all required sizes above
- [ ] App icon and feature graphic finalized
- [ ] Store descriptions finalized and proofread
- [ ] Data safety / privacy declarations completed
- [ ] Content rating questionnaire completed
- [ ] Internal test build installed on a physical device for a final pass

Android upload-key setup is documented in `apps/mobile/RELEASE_SIGNING.md`. The release build is
configured to fail rather than use the debug keystore when signing credentials are absent.

## Out of Scope Here

- `app.json` / `eas.json` build configuration, bundle identifiers, and signing
  credentials are tracked in the mobile app itself, not this document.
- Backend/API deployment readiness is tracked in `docs/MVP_ROADMAP.md`.
