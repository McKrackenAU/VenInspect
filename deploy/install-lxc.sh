#!/usr/bin/env bash
# Install VenInspect inside a Debian/Ubuntu Proxmox LXC (native systemd — no Docker).
# Run as root inside the CT:
#   curl -fsSL ... | bash
#   OR:  bash deploy/install-lxc.sh [git-repo-url]
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/veninspect}"
DATA_DIR="${DATA_DIR:-/var/lib/veninspect}"
APP_USER="${APP_USER:-veninspect}"
REPO_URL="${1:-${VENINSPECT_REPO:-}}"
NODE_MAJOR="${NODE_MAJOR:-22}"

# Soft chown — bind mounts from the Proxmox host often reject chown in unprivileged CTs.
chown_safe() {
  if ! chown "$@" 2>/dev/null; then
    echo "Note: could not chown $* (common on bind mounts in unprivileged LXC — continuing)"
  fi
}

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root inside the LXC." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends \
  ca-certificates curl git build-essential python3 \
  openssl locales rsync

# Quiet locale warnings
if ! locale -a 2>/dev/null | grep -qi 'en_US.utf8\|en_US.UTF-8'; then
  sed -i 's/^# *en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/' /etc/locale.gen 2>/dev/null || true
  grep -q 'en_US.UTF-8 UTF-8' /etc/locale.gen 2>/dev/null || echo 'en_US.UTF-8 UTF-8' >> /etc/locale.gen
  locale-gen en_US.UTF-8 >/dev/null 2>&1 || true
fi
export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/^v//' | cut -d. -f1)" -lt "$NODE_MAJOR" ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi

echo "Node: $(node -v)  npm: $(npm -v)"

id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"

mkdir -p "$DATA_DIR/photos" "$APP_DIR"

if [[ -d "$APP_DIR/.git" ]]; then
  echo "Updating existing checkout in $APP_DIR"
  git -C "$APP_DIR" pull --ff-only || true
elif [[ -n "$REPO_URL" ]]; then
  rm -rf "$APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
else
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
  if [[ "$REPO_ROOT" != "$APP_DIR" ]]; then
    rsync -a --delete \
      --exclude node_modules --exclude .next --exclude data --exclude .git \
      "$REPO_ROOT"/ "$APP_DIR"/
  fi
fi

chown_safe -R "$APP_USER:$APP_USER" "$APP_DIR"
chown_safe -R "$APP_USER:$APP_USER" "$DATA_DIR"

if [[ -n "${PHOTO_DIR:-}" ]]; then
  mkdir -p "$PHOTO_DIR"
  chown_safe -R "$APP_USER:$APP_USER" "$PHOTO_DIR"
fi

# Preserve existing SESSION_SECRET / Maps key on reinstall
EXISTING_SECRET=""
EXISTING_MAPS_KEY=""
if [[ -f /etc/veninspect.env ]]; then
  EXISTING_SECRET="$(grep -E '^SESSION_SECRET=' /etc/veninspect.env | cut -d= -f2- || true)"
  EXISTING_MAPS_KEY="$(grep -E '^(GOOGLE_MAPS_API_KEY|NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)=' /etc/veninspect.env | head -1 | cut -d= -f2- || true)"
fi
SESSION_SECRET="${SESSION_SECRET:-${EXISTING_SECRET:-$(openssl rand -hex 32)}}"
MAPS_KEY="${GOOGLE_MAPS_API_KEY:-${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:-${EXISTING_MAPS_KEY:-}}}"

{
  echo "NODE_ENV=production"
  echo "DATA_DIR=$DATA_DIR"
  echo "PORT=8181"
  echo "HOSTNAME=0.0.0.0"
  echo "SESSION_SECRET=$SESSION_SECRET"
  if [[ -n "${PHOTO_DIR:-}" ]]; then
    echo "PHOTO_DIR=$PHOTO_DIR"
  fi
  if [[ -n "$MAPS_KEY" ]]; then
    echo "GOOGLE_MAPS_API_KEY=$MAPS_KEY"
  fi
} >/etc/veninspect.env

chmod 640 /etc/veninspect.env
chown_safe root:"$APP_USER" /etc/veninspect.env

cd "$APP_DIR"

# Build as app user when possible; otherwise as root (then fix ownership)
if sudo -u "$APP_USER" test -w "$APP_DIR" 2>/dev/null; then
  RUN=(sudo -u "$APP_USER" -H env HOME="$APP_DIR" DATA_DIR="$DATA_DIR")
else
  echo "Note: building as root (app user cannot write under $APP_DIR)"
  RUN=(env HOME="$APP_DIR" DATA_DIR="$DATA_DIR")
fi

"${RUN[@]}" npm ci --include=dev
"${RUN[@]}" npx prisma generate
"${RUN[@]}" npm run build
"${RUN[@]}" npx prisma migrate deploy
"${RUN[@]}" npm run db:ensure-admin

chown_safe -R "$APP_USER:$APP_USER" "$APP_DIR" "$DATA_DIR"

install -m 644 "$APP_DIR/deploy/veninspect.service" /etc/systemd/system/veninspect.service
chmod 755 "$APP_DIR/deploy/update.sh" "$APP_DIR/deploy/manual-update.sh" 2>/dev/null || true
install -m 644 "$APP_DIR/deploy/veninspect-update.service" /etc/systemd/system/veninspect-update.service
install -m 644 "$APP_DIR/deploy/veninspect-update.path" /etc/systemd/system/veninspect-update.path
if [[ -f "$APP_DIR/deploy/veninspect-update.sudoers" ]]; then
  mkdir -p /etc/sudoers.d
  install -m 440 "$APP_DIR/deploy/veninspect-update.sudoers" /etc/sudoers.d/veninspect-update || true
fi
systemctl daemon-reload
systemctl enable --now veninspect
systemctl enable --now veninspect-update.path
systemctl --no-pager --full status veninspect || true

echo
echo "VenInspect is installed as the main server on this LXC."
echo "  App:      $APP_DIR"
echo "  Data:     $DATA_DIR  (SQLite + compressed photos — mount a Proxmox disk here)"
echo "  Listen:   http://0.0.0.0:8181"
echo "  Login:    root / calvin"
echo "  Updates:  Admin → System (Gitea/GitHub) via veninspect-update.path"
echo "  Service:  systemctl status veninspect"
echo
echo "Optional demo seed (once):"
echo "  sudo -u $APP_USER env DATA_DIR=$DATA_DIR npm --prefix $APP_DIR run db:seed"
