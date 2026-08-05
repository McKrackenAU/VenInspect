#!/usr/bin/env bash
# VenInspect in-place updater — builds in staging, then swaps with a short restart.
# Single-flight via flock. Claims update.request immediately.
set -euo pipefail

APP_LIVE="${APP_DIR:-/opt/veninspect}"
APP_STAGE="${APP_STAGE:-/opt/veninspect-staging}"
DATA_DIR="${DATA_DIR:-/var/lib/veninspect}"
APP_USER="${APP_USER:-veninspect}"
REQUEST_FILE="${DATA_DIR}/update.request"
ACTIVE_FILE="${DATA_DIR}/update.request.active"
LOCK_FILE="${DATA_DIR}/update.lock"
STATUS_FILE="${DATA_DIR}/update-status.json"
LOG_FILE="${DATA_DIR}/update.log"

# Repo URLs may come from env; channel always comes from the request file when present.
REPO_GITEA="${VENINSPECT_REPO_GITEA:-http://192.168.13.9:3000/McKraken/VenInspect.git}"
REPO_GITHUB="${VENINSPECT_REPO_GITHUB:-https://github.com/McKrackenAU/VenInspect.git}"

mkdir -p "$DATA_DIR"

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
    status["logTail"] = Path(os.environ["LOG_FILE"]).read_text(errors="ignore")[-6000:]
except Exception:
    status["logTail"] = ""
if os.environ.get("FROM_V"):
    status["fromVersion"] = os.environ["FROM_V"]
if os.environ.get("TO_V"):
    status["toVersion"] = os.environ["TO_V"]
if os.environ.get("CH_V"):
    status["channel"] = os.environ["CH_V"]
now = datetime.datetime.utcnow().isoformat() + "Z"
if status["state"] == "running":
    status["startedAt"] = now
    status.pop("finishedAt", None)
if status["state"] in ("success", "error"):
    status["finishedAt"] = now
path.write_text(json.dumps(status, indent=2))
PY
}

fail() {
  local msg="$1"
  log "ERROR: $msg"
  write_status "error" "$msg" "${FROM_VER:-}" "${TO_VER:-}" "${CHANNEL:-}"
  exit 1
}

# --- single-flight lock ---
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[$(date -Iseconds)] Another update holds the lock — exiting" >>"$LOG_FILE"
  exit 0
fi

# Fresh log for this run (UI must not show yesterday's failures forever)
: >"$LOG_FILE"

# Claim request immediately (stops PathExists from re-triggering)
if [[ -f "$REQUEST_FILE" ]]; then
  mv -f "$REQUEST_FILE" "$ACTIVE_FILE"
elif [[ ! -f "$ACTIVE_FILE" ]]; then
  log "No update.request — exiting"
  exit 0
fi

cleanup_active() {
  rm -f "$ACTIVE_FILE" "$REQUEST_FILE"
}
trap cleanup_active EXIT

# Load env for repo URL overrides only (do not let UPDATE_CHANNEL override the UI choice)
set -a
# shellcheck disable=SC1091
[[ -f /etc/veninspect.env ]] && . /etc/veninspect.env
set +a
export DATA_DIR="${DATA_DIR:-/var/lib/veninspect}"
REPO_GITEA="${VENINSPECT_REPO_GITEA:-$REPO_GITEA}"
REPO_GITHUB="${VENINSPECT_REPO_GITHUB:-$REPO_GITHUB}"

CHANNEL="github"
GIT_REF="main"
if command -v python3 >/dev/null 2>&1; then
  # shellcheck disable=SC2034
  read -r CHANNEL GIT_REF < <(ACTIVE_FILE="$ACTIVE_FILE" python3 <<'PY'
import json, os, re
from pathlib import Path
channel = "github"
ref = "main"
try:
    d = json.loads(Path(os.environ["ACTIVE_FILE"]).read_text())
    ch = (d.get("channel") or "github").strip().lower()
    channel = "gitea" if ch == "gitea" else "github"
    raw = (d.get("ref") or d.get("tag") or "main").strip()
    if raw == "main" or re.fullmatch(r"[A-Za-z0-9._/-]{1,64}", raw):
        if ".." not in raw and not raw.startswith("-") and not raw.startswith("/"):
            ref = raw
except Exception:
    pass
print(channel, ref)
PY
)
fi

if [[ "$CHANNEL" == "github" ]]; then
  REPO_URL="$REPO_GITHUB"
else
  REPO_URL="$REPO_GITEA"
fi

FROM_VER="unknown"
if [[ -f "$APP_LIVE/package.json" ]]; then
  FROM_VER=$(python3 -c "import json;print(json.load(open('$APP_LIVE/package.json')).get('version',''))" 2>/dev/null || echo unknown)
elif [[ -f "$APP_LIVE/VERSION" ]]; then
  FROM_VER=$(tr -d '[:space:]' <"$APP_LIVE/VERSION" | sed 's/^[vV]//')
fi

write_status "running" "Updating from ${FROM_VER} → ${GIT_REF} via ${CHANNEL}…" "$FROM_VER" "" "$CHANNEL"
log "Starting update channel=${CHANNEL} ref=${GIT_REF} repo=${REPO_URL} from=${FROM_VER} pid=$$"

export DEBIAN_FRONTEND=noninteractive
export GIT_TERMINAL_PROMPT=0

as_app() {
  local home="$1"
  shift
  if command -v runuser >/dev/null 2>&1; then
    runuser -u "$APP_USER" -- env HOME="$home" DATA_DIR="$DATA_DIR" NODE_ENV=production "$@"
  else
    env HOME="$home" DATA_DIR="$DATA_DIR" NODE_ENV=production "$@"
  fi
}

# Always fresh shallow clone of the selected tag/branch
log "Cloning ${REPO_URL} @ ${GIT_REF} into staging (clean)"
rm -rf "$APP_STAGE"
if ! git clone --depth 1 --branch "$GIT_REF" "$REPO_URL" "$APP_STAGE"; then
  fail "git clone failed for ${CHANNEL} ref=${GIT_REF} (${REPO_URL}). Tag missing or network blocked from this CT."
fi
log "Clone OK (${GIT_REF})"
chown -R "$APP_USER:$APP_USER" "$APP_STAGE" 2>/dev/null || true

log "Installing deps + building in staging (live app still up)"
cd "$APP_STAGE"
as_app "$APP_STAGE" npm ci --include=dev || fail "npm ci failed"
as_app "$APP_STAGE" npx prisma generate || fail "prisma generate failed"
as_app "$APP_STAGE" npm run build || fail "next build failed"

TO_VER="$FROM_VER"
if [[ -f "$APP_STAGE/package.json" ]]; then
  TO_VER=$(python3 -c "import json;print(json.load(open('$APP_STAGE/package.json')).get('version',''))" 2>/dev/null || echo "$FROM_VER")
elif [[ -f "$APP_STAGE/VERSION" ]]; then
  TO_VER=$(tr -d '[:space:]' <"$APP_STAGE/VERSION" | sed 's/^[vV]//')
fi

# When a specific release tag was requested, refuse a mismatched tree
if [[ "$GIT_REF" != "main" ]]; then
  EXPECT_VER=$(echo "$GIT_REF" | sed 's/^[vV]//')
  if [[ -n "$EXPECT_VER" && "$TO_VER" != "$EXPECT_VER" ]]; then
    fail "Ref ${GIT_REF} built as ${TO_VER}, expected ${EXPECT_VER}. Aborting swap."
  fi
fi

log "Staging build OK — version ${TO_VER}. Swapping…"
write_status "running" "Swapping to ${TO_VER} (brief restart)…" "$FROM_VER" "$TO_VER" "$CHANNEL"

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

# Bind-mount photo volume must stay writable by the app user after updates
if [[ -f "$APP_LIVE/deploy/ensure-photo-dirs.sh" ]]; then
  chmod +x "$APP_LIVE/deploy/ensure-photo-dirs.sh" 2>/dev/null || true
  APP_USER="$APP_USER" bash "$APP_LIVE/deploy/ensure-photo-dirs.sh" || true
else
  PHOTO_DIR_EFFECTIVE="${PHOTO_DIR:-$DATA_DIR/photos}"
  mkdir -p "$PHOTO_DIR_EFFECTIVE" 2>/dev/null || true
  chown -R "$APP_USER:$APP_USER" "$PHOTO_DIR_EFFECTIVE" 2>/dev/null || true
fi

cd "$APP_LIVE"
as_app "$APP_LIVE" npx prisma migrate deploy || true
as_app "$APP_LIVE" npm run db:ensure-admin || true

if [[ -f "$APP_LIVE/deploy/veninspect.service" ]]; then
  install -m 644 "$APP_LIVE/deploy/veninspect.service" /etc/systemd/system/veninspect.service
fi
if [[ -f "$APP_LIVE/deploy/veninspect-update.service" ]]; then
  install -m 644 "$APP_LIVE/deploy/veninspect-update.service" /etc/systemd/system/veninspect-update.service
fi
if [[ -f "$APP_LIVE/deploy/veninspect-update.path" ]]; then
  install -m 644 "$APP_LIVE/deploy/veninspect-update.path" /etc/systemd/system/veninspect-update.path
fi
if [[ -f "$APP_LIVE/deploy/veninspect-update.sudoers" ]]; then
  mkdir -p /etc/sudoers.d
  install -m 440 "$APP_LIVE/deploy/veninspect-update.sudoers" /etc/sudoers.d/veninspect-update || true
fi
chmod 755 "$APP_LIVE/deploy/update.sh" "$APP_LIVE/deploy/manual-update.sh" 2>/dev/null || true
systemctl daemon-reload

systemctl start veninspect
systemctl enable --now veninspect-update.path 2>/dev/null || true

for i in $(seq 1 60); do
  if curl -fsS -o /dev/null "http://127.0.0.1:8181/login" 2>/dev/null; then
    log "Service healthy after update to ${TO_VER}"
    write_status "success" "Updated to ${TO_VER} via ${CHANNEL}. Service is back online." "$FROM_VER" "$TO_VER" "$CHANNEL"
    exit 0
  fi
  sleep 2
done

fail "Update applied but health check timed out — check: systemctl status veninspect"
