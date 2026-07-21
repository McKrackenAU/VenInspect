#!/usr/bin/env bash
# Finish / repair VenInspect install inside an existing CT (e.g. after a failed first run).
# Run on the Proxmox HOST as root:
#
#   CTID=969 PHOTO_MP=/monolith/VenInspect bash ct/finish-install.sh
#   # or:
#   bash ct/finish-install.sh 969 /monolith/VenInspect
#
set -euo pipefail

CTID="${1:-${CTID:-}}"
PHOTO_MP="${2:-${PHOTO_MP:-}}"
REPO_URL="${REPO_URL:-http://192.168.13.9:3000/McKraken/VenInspect.git}"

if [[ -z "$CTID" ]]; then
  echo "Usage: CTID=969 [PHOTO_MP=/path] bash ct/finish-install.sh" >&2
  echo "   or: bash ct/finish-install.sh 969 [/path/to/photos]" >&2
  exit 1
fi

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root on the Proxmox host." >&2
  exit 1
fi

if ! pct status "$CTID" &>/dev/null; then
  echo "CT $CTID not found." >&2
  exit 1
fi

# Enable nesting if missing (helps systemd in Debian 12)
if ! grep -q 'nesting=1' "/etc/pve/lxc/${CTID}.conf" 2>/dev/null; then
  echo "Enabling nesting=1 on CT ${CTID}…"
  pct set "$CTID" --features nesting=1 || true
  pct reboot "$CTID" || { pct stop "$CTID"; pct start "$CTID"; }
  sleep 5
fi

pct start "$CTID" 2>/dev/null || true

echo "Installing from ${REPO_URL} into CT ${CTID}…"
pct exec "$CTID" -- bash -c "apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq git ca-certificates curl >/dev/null"
pct exec "$CTID" -- bash -c "rm -rf /tmp/VenInspect && git clone --depth 1 '${REPO_URL}' /tmp/VenInspect"

if [[ -n "$PHOTO_MP" ]]; then
  mkdir -p "$PHOTO_MP"
  pct exec "$CTID" -- mkdir -p /mnt/veninspect-photos /var/lib/veninspect
  pct exec "$CTID" -- bash -c 'cd /tmp/VenInspect && PHOTO_DIR=/mnt/veninspect-photos bash deploy/install-lxc.sh "'"${REPO_URL}"'"'

  CT_UID=$(pct exec "$CTID" -- id -u veninspect)
  CT_GID=$(pct exec "$CTID" -- id -g veninspect)
  HOST_UID=$((100000 + CT_UID))
  HOST_GID=$((100000 + CT_GID))
  echo "Mapping photo ownership on host: ${PHOTO_MP} → ${HOST_UID}:${HOST_GID}"
  chown -R "${HOST_UID}:${HOST_GID}" "$PHOTO_MP" 2>/dev/null || chmod -R a+rwX "$PHOTO_MP"

  pct exec "$CTID" -- bash -c '
    if grep -q "^PHOTO_DIR=" /etc/veninspect.env; then
      sed -i "s|^PHOTO_DIR=.*|PHOTO_DIR=/mnt/veninspect-photos|" /etc/veninspect.env
    else
      echo "PHOTO_DIR=/mnt/veninspect-photos" >> /etc/veninspect.env
    fi
    systemctl restart veninspect
  '
else
  pct exec "$CTID" -- bash -c "cd /tmp/VenInspect && bash deploy/install-lxc.sh '${REPO_URL}'"
fi

IP=$(pct exec "$CTID" -- bash -c "hostname -I 2>/dev/null | awk '{print \$1}'" || true)
echo
echo "Done. Open http://${IP:-<ct-ip>}:8181/login"
echo "  User: root   Password: calvin"
echo "  Status: pct exec ${CTID} -- systemctl status veninspect"
