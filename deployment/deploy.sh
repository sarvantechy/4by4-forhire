#!/usr/bin/env bash
# Deploy the 4by4-forhire FastAPI backend to the shared EC2 instance.
#
# Mirrors the 4by4-cms deployment pattern: build a wheel locally, ship it to S3,
# then have the instance (via SSM RunShellScript) install it into a dedicated
# venv, run Alembic migrations against the isolated forhire-postgres Docker
# container, and restart the systemd service.
#
# Requires: aws cli (profile "dev"), python3.12, npm not required (API only).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"
AWS_PROFILE="dev"
AWS_REGION="ap-south-2"
INSTANCE_ID="i-0baf4f73e58afd63d"
RELEASE_BUCKET="scoringbasket"
RELEASE_PREFIX="4by4-forhire/releases"
APP_HOST="api.forhire.4by4softwares.com"
APP_PORT="8006"
SERVICE_NAME="4by4-forhire.service"
APP_DIR="/opt/4by4-forhire"
ENV_FILE="/etc/4by4-forhire.env"

RELEASE_ID="$(date +%Y%m%d%H%M%S)"
S3_RELEASE="s3://${RELEASE_BUCKET}/${RELEASE_PREFIX}/${RELEASE_ID}"

echo "==> Building wheel (release ${RELEASE_ID})"
rm -rf "$BACKEND_DIR/dist" "$BACKEND_DIR/.venv-build"
python3.12 -m venv "$BACKEND_DIR/.venv-build"
"$BACKEND_DIR/.venv-build/bin/pip" install --quiet --upgrade pip build
"$BACKEND_DIR/.venv-build/bin/python" -m build --wheel --outdir "$BACKEND_DIR/dist" "$BACKEND_DIR"
WHEEL_FILE="$(ls "$BACKEND_DIR"/dist/*.whl | head -n1)"
WHEEL_NAME="$(basename "$WHEEL_FILE")"

echo "==> Uploading release artifacts to ${S3_RELEASE}"
aws s3 cp "$WHEEL_FILE" "${S3_RELEASE}/${WHEEL_NAME}" --profile "$AWS_PROFILE" --region "$AWS_REGION"
aws s3 cp "$BACKEND_DIR/alembic.ini" "${S3_RELEASE}/alembic.ini" --profile "$AWS_PROFILE" --region "$AWS_REGION"
aws s3 sync "$BACKEND_DIR/alembic" "${S3_RELEASE}/alembic" --exclude "__pycache__/*" --exclude "versions/__pycache__/*" --profile "$AWS_PROFILE" --region "$AWS_REGION"
aws s3 cp "$REPO_ROOT/deployment/nginx-https.conf" "${S3_RELEASE}/nginx-https.conf" --profile "$AWS_PROFILE" --region "$AWS_REGION"
aws s3 cp "$REPO_ROOT/deployment/4by4-forhire.service" "${S3_RELEASE}/4by4-forhire.service" --profile "$AWS_PROFILE" --region "$AWS_REGION"

REMOTE_SCRIPT=$(cat <<EOS
set -euo pipefail
RELEASE_ID="${RELEASE_ID}"
S3_RELEASE="${S3_RELEASE}"
WHEEL_NAME="${WHEEL_NAME}"
APP_DIR="${APP_DIR}"
ENV_FILE="${ENV_FILE}"
SERVICE_NAME="${SERVICE_NAME}"
APP_PORT="${APP_PORT}"

echo "--- fetching release \${RELEASE_ID} ---"
sudo mkdir -p "\$APP_DIR/releases/\$RELEASE_ID"
sudo aws s3 cp "\$S3_RELEASE/\$WHEEL_NAME" "\$APP_DIR/releases/\$RELEASE_ID/" --region ${AWS_REGION}
sudo aws s3 cp "\$S3_RELEASE/alembic.ini" "\$APP_DIR/alembic.ini" --region ${AWS_REGION}
sudo aws s3 sync "\$S3_RELEASE/alembic" "\$APP_DIR/alembic" --region ${AWS_REGION}
sudo aws s3 cp "\$S3_RELEASE/nginx-https.conf" /tmp/4by4-forhire-nginx-https.conf --region ${AWS_REGION}
sudo aws s3 cp "\$S3_RELEASE/4by4-forhire.service" /tmp/4by4-forhire.service --region ${AWS_REGION}

echo "--- installing venv ---"
if [ ! -d "\$APP_DIR/.venv" ]; then
  sudo -u forhire python3.12 -m venv "\$APP_DIR/.venv"
fi
sudo -u forhire "\$APP_DIR/.venv/bin/pip" install --quiet --upgrade pip
sudo -u forhire "\$APP_DIR/.venv/bin/pip" install --quiet --force-reinstall "\$APP_DIR/releases/\$RELEASE_ID/\$WHEEL_NAME"
sudo chown -R forhire:forhire "\$APP_DIR"

echo "--- backing up forhire-postgres before migration ---"
BACKUP_FILE="/tmp/forhire-pre-\${RELEASE_ID}.sql.gz"
sudo docker exec forhire-postgres pg_dump -U forhire_owner forhire | gzip > "\$BACKUP_FILE"
sudo aws s3 cp "\$BACKUP_FILE" "s3://scoringbasket/4by4-forhire/backups/pre-\${RELEASE_ID}.sql.gz" --region ${AWS_REGION}
rm -f "\$BACKUP_FILE"

echo "--- running migrations ---"
sudo bash -c "set -a; source \$ENV_FILE; set +a; cd \$APP_DIR && ./.venv/bin/alembic -c alembic.ini upgrade head"

echo "--- installing systemd unit + nginx config ---"
sudo cp /tmp/4by4-forhire.service /etc/systemd/system/4by4-forhire.service
sudo systemctl daemon-reload
sudo systemctl enable 4by4-forhire.service

if [ ! -f /etc/nginx/conf.d/4by4-forhire.conf ]; then
  sudo cp /tmp/4by4-forhire-nginx-https.conf /etc/nginx/conf.d/4by4-forhire.conf
else
  sudo cp /etc/nginx/conf.d/4by4-forhire.conf /etc/nginx/conf.d/4by4-forhire.conf.bak-\$RELEASE_ID
  sudo cp /tmp/4by4-forhire-nginx-https.conf /etc/nginx/conf.d/4by4-forhire.conf
fi
if sudo nginx -t; then
  sudo systemctl reload nginx
else
  echo "nginx config test failed, rolling back" >&2
  if [ -f /etc/nginx/conf.d/4by4-forhire.conf.bak-\$RELEASE_ID ]; then
    sudo cp /etc/nginx/conf.d/4by4-forhire.conf.bak-\$RELEASE_ID /etc/nginx/conf.d/4by4-forhire.conf
    sudo systemctl reload nginx
  fi
  exit 1
fi

echo "--- restarting service ---"
sudo systemctl restart "\$SERVICE_NAME"

echo "--- health check ---"
for i in \$(seq 1 10); do
  if curl -fsS "http://127.0.0.1:\$APP_PORT/api/v1/health/live" >/dev/null 2>&1; then
    echo "service healthy"
    break
  fi
  if [ "\$i" -eq 10 ]; then
    echo "service failed health check, recent logs:" >&2
    sudo journalctl -u "\$SERVICE_NAME" -n 60 --no-pager >&2
    exit 1
  fi
  sleep 2
done

echo "--- public endpoint check ---"
curl -fsS "https://api.forhire.4by4softwares.com/api/v1/health/live" || echo "WARNING: public HTTPS check failed (DNS/cert may still be propagating)"
curl -fsS "https://api.forhire.4by4softwares.com/privacy" >/dev/null
curl -fsS "https://api.forhire.4by4softwares.com/account-deletion" >/dev/null

echo "--- deploy complete: release \${RELEASE_ID} ---"
EOS
)

echo "==> Running remote deployment via SSM"
SSM_PARAMS_FILE="$(mktemp)"
trap 'rm -f "$SSM_PARAMS_FILE"' EXIT
python3 -c '
import json, sys
script = sys.stdin.read()
json.dump({"commands": [script]}, open(sys.argv[1], "w"))
' "$SSM_PARAMS_FILE" <<<"$REMOTE_SCRIPT"

CMD_ID=$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters "file://$SSM_PARAMS_FILE" \
  --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --query "Command.CommandId" --output text)

echo "Command ID: $CMD_ID"
aws ssm wait command-executed --command-id "$CMD_ID" --instance-id "$INSTANCE_ID" --profile "$AWS_PROFILE" --region "$AWS_REGION" || true
aws ssm get-command-invocation --command-id "$CMD_ID" --instance-id "$INSTANCE_ID" --profile "$AWS_PROFILE" --region "$AWS_REGION" \
  --query "{Status:Status,Out:StandardOutputContent,Err:StandardErrorContent}" --output json
