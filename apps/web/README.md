# 4by4 For Hire Customer Web

Next.js customer application for the 4by4 For Hire C2C rental marketplace.

## Current Scope

Implemented locally:

- Email registration, verification, login, cookie sessions, CSRF, account summary, session list, and logout
- Category/listing discovery, listing creation and publication, owner inventory, quotes, and booking requests
- Renter/owner booking views, accept/reject/cancel actions, booking-scoped messages, scheduling, handover/return challenge confirmation, offline-payment acknowledgement, inspection completion, review, dispute, and report controls
- Responsive navigation and loading, empty, unauthorized, error, and success states

Not yet complete: listing/evidence media, advanced search/filter/detail pages, password recovery, complete address/profile editing, notifications, verification, evidence-rich disputes, authenticated Playwright journeys, accessibility acceptance, localization acceptance, and deployment.

## Run

From the repository root, after starting local infrastructure and the API:

```bash
npm run dev --workspace web -- --hostname 127.0.0.1 --port 3000
```

Open `http://127.0.0.1:3000`. Keep the browser hostname aligned with the API CORS and cookie configuration; do not mix `localhost` and `127.0.0.1` during one session.

The API base URL defaults to `http://127.0.0.1:8000/api/v1` and can be overridden with `NEXT_PUBLIC_API_BASE_URL`.

## Architecture

- Next.js App Router, React, and TypeScript
- Shared generated contracts and `@4by4/api-client`
- HTTP-only web session cookies plus a CSRF token retained in session storage
- Lucide icons and project CSS/design tokens
- Playwright for browser journeys

## Validate

```bash
npm run lint --workspace web
npm run typecheck --workspace web
npm run build --workspace web
npm run test:e2e --workspace web
```

See [Implementation Plan](../../docs/IMPLEMENTATION_PLAN.md) for authoritative status and [UI/UX Plan](../../docs/UI_UX_PLAN.md) for target journeys.
