#!/usr/bin/env bash
# Install Cloudflare tunnel daemon for VenInspect (LXC / Debian).
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root" >&2
  exit 1
fi

TOKEN_FILE="${TOKEN_FILE:-/etc/veninspect.cloudflared.token}"
ENV_FILE="${ENV_FILE:-/etc/veninspect.env}"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE" || true
fi

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "Installing cloudflared…"
  curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
  chmod +x /usr/local/bin/cloudflared
fi

if [[ ! -s "$TOKEN_FILE" ]]; then
  echo "Paste tunnel token into $TOKEN_FILE (from VenInspect root admin → Tunnel), then re-run."
  touch "$TOKEN_FILE"
  chmod 600 "$TOKEN_FILE"
  exit 0
fi

TOKEN="$(tr -d '\r\n' < "$TOKEN_FILE")"

cat >/etc/systemd/system/cloudflared.service <<EOF
[Unit]
Description=Cloudflare Tunnel for VenInspect
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/local/bin/cloudflared tunnel --no-autoupdate run --token ${TOKEN}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable cloudflared.service
systemctl restart cloudflared.service
echo "cloudflared installed and started."
