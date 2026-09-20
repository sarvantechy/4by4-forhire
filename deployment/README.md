# 4by4-forhire — Production Deployment

Backend runs on the same shared EC2 instance (`i-0baf4f73e58afd63d`, `ap-south-2`)
used by the other 4by4softwares apps, at `https://api.forhire.4by4softwares.com`
(port `8006` internally).

## Architecture decisions

- **Isolated Postgres+PostGIS container**, not the shared bare-metal cluster.
  The shared Postgres 17 install (used by `cms`/`himalayan-access`/`scoringbasket`/
  `umami`) has no PostGIS extension, and Amazon Linux 2023's default repo doesn't
  package it. Adding the third-party PGDG repo to install it system-wide risked
  conflicting with the distro-native `postgresql17-server` package that those
  other live databases depend on. Instead, `forhire-postgres` runs as its own
  Docker container (`ghcr.io/baosystems/postgis:17-3.5`, the same image used in
  local dev) bound to `127.0.0.1:5433`, with data persisted at
  `/opt/forhire-pg/data` on the host. This fully isolates forhire's data store
  from every other app's database.
- **`ALLOW_LOOPBACK_DATABASE` opt-in**: `Settings` in `app/core/config.py` still
  rejects `localhost`/`127.0.0.1` database URLs in staging/production by default
  (catches accidental dev-default config). Because forhire's Postgres
  intentionally lives on the same host via loopback, the production env file
  sets `ALLOW_LOOPBACK_DATABASE=true` to explicitly opt in.
- **Dedicated S3 bucket** `4by4-forhire-media` (private, public access blocked,
  SSE-S3 encryption) for listing photos — kept separate from the shared
  `scoringbasket` bucket to avoid key-prefix collisions with other apps' user
  data. The EC2 instance role (`EC2-S3-Read`, which despite the name has
  `AmazonS3FullAccess` attached) already has read/write access to it.
- **Deployment release artifacts** (wheel, alembic files, configs) are staged
  through `s3://scoringbasket/4by4-forhire/releases/<release_id>/`, mirroring
  the existing `4by4-cms` deployment convention. DB backups before each
  migration go to `s3://scoringbasket/4by4-forhire/backups/`.

## One-time infra setup (already completed)

1. `4by4-forhire-media` S3 bucket created, public access blocked, SSE-S3 enabled.
2. Route 53 `A` record: `api.forhire.4by4softwares.com` → `40.192.83.40`.
3. `forhire-postgres` Docker container started on the EC2 host
   (`127.0.0.1:5433`, db `forhire`, role `forhire_owner`, PostGIS 3.5 enabled).
4. System user `forhire` (no login shell) and directories `/opt/4by4-forhire`,
   `/var/lib/4by4-forhire` created on the EC2 host.
5. `/etc/4by4-forhire.env` written on the host (root:forhire, mode 640) with
   `DATABASE_URL`, `ALLOW_LOOPBACK_DATABASE=true`, `SESSION_SECRET`, S3 config,
   and `CORS_ORIGINS`. `PRIVACY_CONTACT_EMAIL` defaults to the company support mailbox and can be
   overridden in this env file after the mailbox is confirmed. The DB password and session secret were generated
   locally and staged through encrypted SSM `SecureString` parameters
   (`/4by4-forhire/prod/database_password`, `/4by4-forhire/prod/session_secret`)
   so they never appeared in plaintext command output or history.

## Repeat deployments

```bash
./deployment/deploy.sh
```

This builds the wheel, uploads release artifacts to S3, and runs a remote SSM
script that installs the wheel into `/opt/4by4-forhire/.venv`, backs up the
database, runs `alembic upgrade head`, installs/reloads the systemd unit and
nginx config (with automatic nginx rollback on a failed `nginx -t`), restarts
the service, and verifies the local/public health endpoints plus the public privacy and account
deletion pages.

## TLS certificate (one-time bootstrap — already completed)

`deployment/nginx-https.conf` references a Let's Encrypt certificate for
`api.forhire.4by4softwares.com`. Since the cert didn't exist on the first
deploy, it was bootstrapped once via:

1. Installed `deployment/nginx-http-bootstrap.conf` (HTTP-only, proxies to
   port 8006, serves `/.well-known/acme-challenge/` from
   `/var/www/4by4-forhire`) as `/etc/nginx/conf.d/4by4-forhire.conf`.
2. Ran `sudo certbot certonly --webroot -w /var/www/4by4-forhire -d api.forhire.4by4softwares.com`
   (reused the existing certbot account already registered on the host).
3. Re-ran `deployment/deploy.sh`, which installed the final
   `nginx-https.conf` now that the cert exists.

The certificate auto-renews via certbot's existing systemd timer on the host.
This bootstrap is only needed once per new hostname; it is not part of
`deploy.sh` itself and does not need to be repeated for future deploys.

## Safety notes

- Only `4by4-forhire.service`, `forhire-postgres` (Docker), and
  `4by4-forhire.conf` (nginx) are touched by this app's deployment. No other
  app's systemd service, database, or nginx vhost is modified or restarted.
- Do not run `deployment/deploy.sh` without an explicit request, per the
  repository's deployment-safety conventions.
