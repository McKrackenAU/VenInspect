#!/usr/bin/env bash
# VenInspect in-place updater — builds in a staging tree, then swaps with a short restart window.
# Invoked by systemd (veninspect-update.service) when /var/lib/veninspect/update.request appears.
set -euo pipefail

APP_LIVE="${APP_DIR:-/opt/veninspect}"
APP_STAGE="${APP_STAGE:-/opt/veninspect-staging}"
DATA_DIR="${DATA_DIR:-/var/lib/veninspect}"
APP_USER="${APP_USER:-veninspect}"
REQUEST_FILE="${DATA_DIR}/update.request"
STATUS_FILE="${DATA_DIR}/update-status.json"
LOG_FILE="${DATA_DIR}/update.log"

CHANNEL="${UPDATE_CHANNEL:-gitea}"
REPO_GITEA="${VENINSPECT_REPO_GITEA:-http://192.168.13.9:3000/McKraken/VenInspect.git}"
REPO_GITHUB="${VENINSPECT_REPO_GITHUB:-https://github.com/McKrackenAU/VenInspect.git}"

mkdir -p "$DATA_DIR"
touch "$LOG_FILE"

log() {
  echo "[$(date -Iseconds)] $*" | tee -a "$LOG_FILE"
}

write_status() {
  local state="$1"
  local message="$2"
  local from_v="${3:-}"
  local to_v="${4:-}"
  local channel_v="${5:-}"
  FROM_V="$from_v" TO_V="$to_v" CH_V="$channel_v" STATE="$state" MSG="$message" \
  STATUS_FILE="$STATUS_FILE" LOG_FILE="$LOG_FILE" python3 <<'PY'
import json, os, datetime
from pathlib import Path
path = Path(os.environ["STATUS_FILE"])
prev = {}
if path.exists():
    try:
        prev = json.loads(path.read_text())
    except Exception:
        prev = {}
status = dict(prev)
status["state"] = os.environ["STATE"]
status["message"] = os.environ["MSG"]
try:
    status["logTail"] = Path(os.environ["LOG_FILE"]).read_text(errors="ignore")[-4000:]
except Exception:
    status["logTail"] = ""
if os.environ.get("FROM_V"):
    status["fromVersion"] = os.environ["FROM_V"]
if os.environ.get("TO_V"):
    status["toVersion"] = os.environ["TO_V"]
if os.environ.get("CH_V"):
    status["channel"] = os.environ["CH_V"]
now = datetime.datetime.utcnow().isoformat() + "Z"
if status["state"] == "running" and "startedAt" not in status:
    status["startedAt"] = now
if status["state"] in ("success", "error"):
    status["finishedAt"] = now
path.write_text(json.dumps(status, indent=2))
PY
}

if [[ ! -f "$REQUEST_FILE" ]]; then
  log "No update.request — exiting"
  exit 0
fi

if command -v python3 >/dev/null 2>&1; then
  CHANNEL=$(REQUEST_FILE="$REQUEST_FILE" CHANNEL="$CHANNEL" python3 <<'PY'
import json, os
from pathlib import Path
try:
    d = json.loads(Path(os.environ["REQUEST_FILE"]).read_text())
    print(d.get("channel") or os.environ["CHANNEL"])
except Exception:
    print(os.environ["CHANNEL"])
PY
)
fi

if [[ "$CHANNEL" == "github" ]]; then
  REPO_URL="$REPO_GITHUB"
else
  REPO_URL="$REPO_GITEA"
fi

FROM_VER="unknown"
if [[ -f "$APP_LIVE/VERSION" ]]; then
  FROM_VER=$(tr -d '[:space:]' <"$APP_LIVE/VERSION" | sed 's/^[vV]//')
elif [[ -f "$APP_LIVE/package.json" ]]; then
  FROM_VER=$(python3 -c "import json;print(json.load(open('$APP_LIVE/package.json')).get('version',''))" 2>/dev/null || echo unknown)
fi

write_status "running" "Updating from ${FROM_VER} via ${CHANNEL}…" "$FROM_VER" "" "$CHANNEL"
log "Starting update channel=${CHANNEL} repo=${REPO_URL} from=${FROM_VER}"

export DEBIAN_FRONTEND=noninteractive

if [[ -d "$APP_STAGE/.git" ]]; then
  log "Refreshing staging checkout"
  git -C "$APP_STAGE" remote set-url origin "$REPO_URL" || true
  git -C "$APP_STAGE" fetch --depth 1 origin main
  git -C "$APP_STAGE" reset --hard origin/main
else
  log "Cloning into staging ${APP_STAGE}"
  rm -rf "$APP_STAGE"
  git clone --depth 1 --branch main "$REPO_URL" "$APP_STAGE"
fi

chown -R "$APP_USER:$APP_USER" "$APP_STAGE" 2>/dev/null || true

set -a
# shellcheck disable=SC1091
[[ -f /etc/veninspect.env ]] && . /etc/veninspect.env
set +a
export DATA_DIR="${DATA_DIR:-/var/lib/veninspect}"

log "Installing deps + building in staging (live app still up)"
cd "$APP_STAGE"
run_stage() {
  if sudo -u "$APP_USER" test -w "$APP_STAGE" 2>/dev/null; then
    sudo -u "$APP_USER" -H env HOME="$APP_STAGE" DATA_DIR="$DATA_DIR" "$@"
  else
    env HOME="$APP_STAGE" DATA_DIR="$DATA_DIR" "$@"
  fi
}
run_stage npm ci
run_stage npx prisma generate
run_stage npm run build

TO_VER="$FROM_VER"
if [[ -f "$APP_STAGE/VERSION" ]]; then
  TO_VER=$(tr -d '[:space:]' <"$APP_STAGE/VERSION" | sed 's/^[vV]//')
elif [[ -f "$APP_STAGE/package.json" ]]; then
  TO_VER=$(python3 -c "import json;print(json.load(open('$APP_STAGE/package.json')).get('version',''))" 2>/dev/null || echo "$FROM_VER")
fi

log "Staging build OK — version ${TO_VER}. Swapping with brief service restart…"

systemctl stop veninspect || true

rsync -a --delete \
  --exclude node_modules \
  --exclude .next \
  "$APP_STAGE"/ "$APP_LIVE"/

rsync -a --delete "$APP_STAGE/node_modules"/ "$APP_LIVE/node_modules"/
if [[ -d "$APP_STAGE/.next" ]]; then
  rsync -a --delete "$APP_STAGE/.next"/ "$APP_LIVE/.next"/
fi

chown -R "$APP_USER:$APP_USER" "$APP_LIVE" 2>/dev/null || true

cd "$APP_LIVE"
if sudo -u "$APP_USER" test -w "$APP_LIVE" 2>/dev/null; then
  sudo -u "$APP_USER" -H env HOME="$APP_LIVE" DATA_DIR="$DATA_DIR" npx prisma migrate deploy || true
  sudo -u "$APP_USER" -H env HOME="$APP_LIVE" DATA_DIR="$DATA_DIR" npm run db:ensure-admin || true
else
  env HOME="$APP_LIVE" DATA_DIR="$DATA_DIR" npx prisma migrate deploy || true
  env HOME="$APP_LIVE" DATA_DIR="$DATA_DIR" npm run db:ensure-admin || true
fi

if [[ -f "$APP_LIVE/deploy/veninspect.service" ]]; then
  install -m 644 "$APP_LIVE/deploy/veninspect.service" /etc/systemd/system/veninspect.service
fi
if [[ -f "$APP_LIVE/deploy/veninspect-update.service" ]]; then
  install -m 644 "$APP_LIVE/deploy/veninspect-update.service" /etc/systemd/system/veninspect-update.service
fi
if [[ -f "$APP_LIVE/deploy/veninspect-update.path" ]]; then
  install -m 644 "$APP_LIVE/deploy/veninspect-update.path" /etc/systemd/system/veninspect-update.path
fi
if [[ -f "$APP_LIVE/deploy/update.sh" ]]; then
  install -m 755 "$APP_LIVE/deploy/update.sh" /opt/veninspect/deploy/update.sh
fi
systemctl daemon-reload

rm -f "$REQUEST_FILE"
systemctl start veninspect
systemctl enable --now veninspect-update.path 2>/dev/null || true

for i in $(seq 1 60); do
  if curl -fsS -o /dev/null "http://127.0.0.1:8181/login" 2>/dev/null; then
    log "Service healthy after update"
    write_status "success" "Updated to ${TO_VER}. Service is back online." "$FROM_VER" "$TO_VER" "$CHANNEL"
    exit 0
  fi
  sleep 2
done

write_status "error" "Update applied but health check timed out — check systemctl status veninspect" "$FROM_VER" "$TO_VER" "$CHANNEL"
log "Health check timed out"
exit 1
