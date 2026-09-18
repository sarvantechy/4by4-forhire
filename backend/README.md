# Backend

FastAPI modular monolith for the 4by4 For Hire marketplace.

## Current Domains

- `identity`: email/mobile authentication, sessions, profile, and addresses
- `catalog`: categories, listings, prices, availability blocks, seller headers, and search
- `bookings` and `messaging`: quotes, booking transitions, allocations, and booking-scoped messages
- `fulfillment`: scheduling, handover/return challenges, condition reports, offline acknowledgements, reviews, reports, disputes, and staff moderation routes

PostgreSQL/PostGIS is the only business-data path. Alembic migrations through `20260916_0005` are the current schema authority.

## Setup

Use Python 3.12 from the repository root:

```bash
python3.12 -m venv .venv
.venv/bin/python -m pip install -e './backend[dev]'
```

## Run

```bash
cd backend
../.venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## Validate

```bash
cd backend
../.venv/bin/ruff check app tests
../.venv/bin/mypy app
../.venv/bin/pytest
```

From the repository root, the equivalent combined check is:

```bash
npm run backend:check
```

Run PostgreSQL integration tests with the local database URL configured. The root script forwards `DATABASE_URL` to pytest as `TEST_DATABASE_URL`:

```bash
DATABASE_URL='postgresql+psycopg://forhire:forhire_local@127.0.0.1:15432/forhire' \
	npm run backend:test:integration
```

## Database Migrations

With the local PostgreSQL service running:

```bash
cd backend
../.venv/bin/alembic upgrade head
../.venv/bin/alembic current
```

Migration rollback verification must run against PostgreSQL, never SQLite.

## Current Boundaries

The backend does not yet implement private media upload/scanning, transactional outbox workers, notifications, production OTP/email providers, identity verification, complete case assignment, retention jobs, or deployment infrastructure. See [Implementation Plan](../docs/IMPLEMENTATION_PLAN.md) for authoritative status.
