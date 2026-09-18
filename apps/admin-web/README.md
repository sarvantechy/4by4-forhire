# 4by4 For Hire Admin Web

Separate Vite/React operations application for permission-scoped marketplace administration.

## Current Scope

Implemented locally:

- Email/password session entry using the shared API client
- Server-enforced active `platform_staff` boundary
- Open report counts and report list
- Listing approve/remove actions
- Append-only moderation mutation records
- Responsive staff login and queue layouts

Not yet complete: staff provisioning UI, MFA, granular role/permission matrix, case assignment and priority, dispute decisions, verification review, evidence viewer, sensitive-read audit, sanctions/appeals, operational search/metrics, authenticated browser tests, and deployment.

There are no default administrator credentials. A user must already exist and have an active `platform_staff` row before the API permits access.

## Run

From the repository root, after starting local infrastructure and the API:

```bash
npm run dev --workspace admin-web -- --host 127.0.0.1 --port 3001
```

Open `http://127.0.0.1:3001`. The API base URL defaults to `http://127.0.0.1:8000/api/v1` and can be overridden with `VITE_API_BASE_URL`.

## Validate

```bash
npm run lint --workspace admin-web
npm run typecheck --workspace admin-web
npm run build --workspace admin-web
```

See [Implementation Plan](../../docs/IMPLEMENTATION_PLAN.md) and [Security, Payments, and Trust](../../docs/SECURITY_PAYMENTS_AND_TRUST.md) for the authoritative authorization and status boundaries.
