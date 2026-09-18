# 4by4 For Hire Mobile

Expo Router mobile application for the 4by4 For Hire C2C rental marketplace.

## Current Scope

Implemented locally:

- Email and mobile OTP authentication with access/refresh credentials in Expo SecureStore
- Listing discovery, listing creation/publication, quote creation, and booking requests
- Renter/owner booking actions, booking-scoped messages, handover/return challenge confirmation, structured condition reports, offline-payment acknowledgement, inspection completion, reviews, and reports
- Shared generated API client, project design tokens, and Expo-compatible cryptographic message IDs

Not yet complete: listing/evidence media and camera capture, complete account/address/session management, notifications, verification, offline retry, deep-link acceptance, English/Tamil journey evidence, Android/iOS end-to-end tests, store builds, and deployment.

## Run

From the repository root, after starting local infrastructure and the API:

```bash
npm run start --workspace mobile -- --port 8081
```

Use Expo Go or the configured Android/iOS launch command. A physical device cannot reach a Mac-only `127.0.0.1` API; set `EXPO_PUBLIC_API_BASE_URL` to a reachable LAN URL when testing on-device.

## Validate

```bash
npm run lint --workspace mobile
npm run typecheck --workspace mobile
npx expo-doctor apps/mobile
```

See [Implementation Plan](../../docs/IMPLEMENTATION_PLAN.md) for authoritative status and [UI/UX Plan](../../docs/UI_UX_PLAN.md) for target journeys.