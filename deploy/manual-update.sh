#!/usr/bin/env bash
# One-shot manual update for an existing VenInspect LXC install.
# Run as root inside the CT (no sudo needed):
#   bash /opt/veninspect/deploy/manual-update.sh
#   OR after fetching a fresh copy:
#   curl -fsSL http://192.168.13.9:3000/McKraken/VenInspect/raw/branch/main/deploy/manual-update.sh | bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/veninspect}"
APP_STAGE="${APP_STAGE:-/opt/veninspect-staging}"
DATA_DIR="${DATA_DIR:-/var/lib/veninspect}"
APP_USER="${APP_USER:-veninspect}"
REPO_URL="${1:-${VENINSPECT_REPO:-http://192.168.13.9:3000/McKraken/VenInspect.git}}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root inside the LXC." >&2
  exit 1
fi

as_app() {
  if command -v runuser >/dev/null 2>&1; then
    runuser -u "$APP_USER" -- env HOME="$APP_DIR" DATA_DIR="$DATA_DIR" "$@"
  else
    env HOME="$APP_DIR" DATA_DIR="$DATA_DIR" "$@"
  fi
}

echo "==> Clearing stuck update state"
systemctl stop veninspect-update.service 2>/dev/null || true
rm -f \
  "$DATA_DIR/update.request" \
  "$DATA_DIR/update.request.active" \
  "$DATA_DIR/update.lock"
cat >"$DATA_DIR/update-status.json" <<'EOF'
{
  "state": "idle",
  "message": "Cleared by manual-update.sh"
}
EOF

echo "==> Fetching latest into staging ($REPO_URL)"
rm -rf "$APP_STAGE"
git clone --depth 1 --branch main "$REPO_URL" "$APP_STAGE"
chown -R "$APP_USER:$APP_USER" "$APP_STAGE" 2>/dev/null || true

set -a
# shellcheck disable=SC1091
[[ -f /etc/veninspect.env ]] && . /etc/veninspect.env
set +a
export DATA_DIR="${DATA_DIR:-/var/lib/veninspect}"

echo "==> Building in staging (live app stays up)"
cd "$APP_STAGE"
# Always install build tooling — NODE_ENV=production in /etc/veninspect.env would
# otherwise skip devDependencies (@tailwindcss/postcss, typescript, etc.).
as_app npm ci --include=dev
as_app npx prisma generate
as_app npm run build

TO_VER="unknown"
if [[ -f "$APP_STAGE/VERSION" ]]; then
  TO_VER=$(tr -d '[:space:]' <"$APP_STAGE/VERSION" | sed 's/^[vV]//')
fi
echo "==> Staging build OK — ${TO_VER}. Swapping…"

systemctl stop veninspect

rsync -a --delete \
  --exclude node_modules \
  --exclude .next \
  "$APP_STAGE"/ "$APP_DIR"/
rsync -a --delete "$APP_STAGE/node_modules"/ "$APP_DIR/node_modules"/
if [[ -d "$APP_STAGE/.next" ]]; then
  rsync -a --delete "$APP_STAGE/.next"/ "$APP_DIR/.next"/
fi
chown -R "$APP_USER:$APP_USER" "$APP_DIR" 2>/dev/null || true

cd "$APP_DIR"
as_app npx prisma migrate deploy || true
as_app npm run db:ensure-admin || true

install -m 644 "$APP_DIR/deploy/veninspect.service" /etc/systemd/system/veninspect.service
install -m 644 "$APP_DIR/deploy/veninspect-update.service" /etc/systemd/system/veninspect-update.service
install -m 644 "$APP_DIR/deploy/veninspect-update.path" /etc/systemd/system/veninspect-update.path
install -m 755 "$APP_DIR/deploy/update.sh" "$APP_DIR/deploy/update.sh"
install -m 755 "$APP_DIR/deploy/manual-update.sh" "$APP_DIR/deploy/manual-update.sh"
systemctl daemon-reload
systemctl enable --now veninspect-update.path
systemctl start veninspect

cat >"$DATA_DIR/update-status.json" <<EOF
{
  "state": "success",
  "message": "Manual shell update to ${TO_VER} completed.",
  "toVersion": "${TO_VER}",
  "finishedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo "==> Waiting for health check…"
for i in $(seq 1 60); do
  if curl -fsS -o /dev/null "http://127.0.0.1:8181/login" 2>/dev/null; then
    echo "OK — VenInspect ${TO_VER} is up."
    exit 0
  fi
  sleep 2
done

echo "Update applied but health check timed out — check: systemctl status veninspect" >&2
exit 1
