# Contributing

## Current Scope

The repository is implementing the customer-to-customer MVP described in [Product Requirements](docs/PRODUCT_REQUIREMENTS.md). Check [Implementation Plan](docs/IMPLEMENTATION_PLAN.md) before starting work and update the relevant work-package status with each implementation change.

Storefronts, delegated store access, online payments, platform commission, platform delivery, and vehicle rentals are deferred.

## Prerequisites

- Node.js 24 LTS is the pinned and CI-tested version in `.nvmrc`; `package.json` accepts supported Node versions from 22.14 through 24
- npm 10 or 11
- Python 3.12, as specified by `.python-version`
- Docker with Compose for local PostgreSQL/PostGIS, Redis, MinIO, and Mailpit

The repository may warn or fail on unsupported Node or Python versions. Use the pinned Node 24 and Python 3.12 versions for reproducible local and CI behavior.

## Initial Setup

```bash
nvm use
cp .env.example .env
npm install
```

Do not invent production credentials in local files or commit `.env` files. Backend setup and validation commands are documented in `backend/README.md`.

## Local Infrastructure

Render and validate the Compose configuration without starting services:

```bash
npm run infra:config
```

Start PostgreSQL/PostGIS, Redis, MinIO, and the local verification inbox, then create the private local bucket idempotently:

```bash
npm run infra:up
```

Local email and mobile verification codes appear in Mailpit at `http://127.0.0.1:18080`. Mobile codes use a synthetic `@sms.forhire.local` inbox. Codes are never returned by the API or written to application logs.

Inspect status or recent logs and stop the services:

```bash
npm run infra:status
npm run infra:logs
npm run infra:down
```

`npm run infra:reset` stops the stack and permanently deletes its local database, Redis, and object-storage volumes. Use it only when a clean local environment is intentional.

## Root Commands

The root npm scripts run the matching command in every workspace that provides it:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run check
```

The root commands currently cover the customer web, mobile, admin web, shared TypeScript packages, generated contracts, and backend checks. PostgreSQL integration tests require `DATABASE_URL` and are run separately with `npm run backend:test:integration`.

## Local Applications

After `npm run infra:up` and `npm run db:upgrade`, start each application in a separate terminal:

```bash
# API
cd backend
../.venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Customer web
npm run dev --workspace web -- --hostname 127.0.0.1 --port 3000

# Admin web
npm run dev --workspace admin-web -- --host 127.0.0.1 --port 3001

# Expo Metro
npm run start --workspace mobile -- --port 8081
```

Use one hostname consistently for browser sessions. The default clients and documented local CORS configuration use `127.0.0.1`; mixing it with `localhost` can prevent cookies from being sent.

## Engineering Rules

1. Build vertical slices across the API, mobile app, and customer web app.
2. Keep FastAPI routes thin; services own transactions and state transitions.
3. Use PostgreSQL/PostGIS for business behavior and Alembic for every schema change.
4. Derive ownership and authorization from the authenticated actor on the server.
5. Keep user media private and never commit credentials or restricted sample data.
6. Add focused tests for changed behavior before broad validation.
7. Update the owning specification and implementation tracker in the same change.
8. Keep repository, locally verified, staging, and deployment status separate.

## Documentation Status

Architecture and product documents describe target behavior unless their status block says otherwise. Follow the status vocabulary and documentation protocol in [Implementation Plan](docs/IMPLEMENTATION_PLAN.md).

When a work package becomes locally verified, add an acceptance record containing the work-package ID, date, runtime versions, exact commands, covered risk scenarios, artifact paths, open risks, and next action. A passing generic build alone is not sufficient evidence for authorization, privacy, concurrency, retry, or state-transition behavior.
