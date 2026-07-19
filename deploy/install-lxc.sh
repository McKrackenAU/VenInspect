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

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root inside the LXC." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends \
  ca-certificates curl git build-essential python3 \
  openssl

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/^v//' | cut -d. -f1)" -lt "$NODE_MAJOR" ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi

echo "Node: $(node -v)  npm: $(npm -v)"

id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"

mkdir -p "$DATA_DIR/uploads" "$APP_DIR"

if [[ -d "$APP_DIR/.git" ]]; then
  echo "Updating existing checkout in $APP_DIR"
  sudo -u "$APP_USER" git -C "$APP_DIR" pull --ff-only
elif [[ -n "$REPO_URL" ]]; then
  rm -rf "$APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
  chown -R "$APP_USER:$APP_USER" "$APP_DIR"
else
  # Script is running from an already-copied tree (e.g. scp/rsync)
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
  if [[ "$REPO_ROOT" != "$APP_DIR" ]]; then
    rsync -a --delete \
      --exclude node_modules --exclude .next --exclude data --exclude .git \
      "$REPO_ROOT"/ "$APP_DIR"/
  fi
  chown -R "$APP_USER:$APP_USER" "$APP_DIR"
fi

chown -R "$APP_USER:$APP_USER" "$DATA_DIR"

cat >/etc/veninspect.env <<EOF
NODE_ENV=production
DATA_DIR=$DATA_DIR
PORT=3000
HOSTNAME=0.0.0.0
EOF
chmod 640 /etc/veninspect.env
chown root:"$APP_USER" /etc/veninspect.env

cd "$APP_DIR"
sudo -u "$APP_USER" npm ci
sudo -u "$APP_USER" npx prisma generate
sudo -u "$APP_USER" env DATA_DIR="$DATA_DIR" npm run build
sudo -u "$APP_USER" env DATA_DIR="$DATA_DIR" npx prisma migrate deploy

install -m 644 "$APP_DIR/deploy/veninspect.service" /etc/systemd/system/veninspect.service
systemctl daemon-reload
systemctl enable --now veninspect
systemctl --no-pager --full status veninspect || true

echo
echo "VenInspect is installed as the main server on this LXC."
echo "  App:      $APP_DIR"
echo "  Data:     $DATA_DIR  (SQLite + compressed photos — mount a Proxmox disk here)"
echo "  Listen:   http://0.0.0.0:3000"
echo "  Service:  systemctl status veninspect"
echo
echo "Optional demo seed (once):"
echo "  sudo -u $APP_USER env DATA_DIR=$DATA_DIR npm --prefix $APP_DIR run db:seed"
