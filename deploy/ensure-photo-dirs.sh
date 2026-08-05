#!/usr/bin/env bash
# Ensure DATA_DIR / PHOTO_DIR exist and are writable by the VenInspect app user.
# Safe on unprivileged LXC bind mounts (chown may be a no-op — we still probe write).
set -euo pipefail

APP_USER="${APP_USER:-veninspect}"
APP_GROUP="${APP_GROUP:-$APP_USER}"

# Prefer EnvironmentFile values when sourced by systemd ExecStartPre
DATA_DIR="${DATA_DIR:-/var/lib/veninspect}"
PHOTO_DIR="${PHOTO_DIR:-$DATA_DIR/photos}"

mkdir -p "$DATA_DIR" "$PHOTO_DIR" "$DATA_DIR/photos" 2>/dev/null || true

# Best-effort ownership (bind mounts from the host often reject this)
chown -R "$APP_USER:$APP_GROUP" "$DATA_DIR" 2>/dev/null || true
chown -R "$APP_USER:$APP_GROUP" "$PHOTO_DIR" 2>/dev/null || true
chmod u+rwx "$DATA_DIR" "$PHOTO_DIR" 2>/dev/null || true

probe_write() {
  local dir="$1"
  local probe="$dir/.veninspect-write-test"
  if runuser -u "$APP_USER" -- sh -c "touch \"$probe\" && rm -f \"$probe\"" 2>/dev/null; then
    return 0
  fi
  # Fallback when runuser is unavailable (still as root during install)
  if touch "$probe" 2>/dev/null; then
    rm -f "$probe" 2>/dev/null || true
    return 0
  fi
  return 1
}

if ! probe_write "$PHOTO_DIR"; then
  echo "WARNING: PHOTO_DIR is not writable by ${APP_USER}: ${PHOTO_DIR}" >&2
  echo "  On the Proxmox host / CT, fix ownership or CIFS uid/gid, e.g.:" >&2
  echo "    chown -R ${APP_USER}:${APP_GROUP} ${PHOTO_DIR}" >&2
  echo "  Unprivileged LXC bind mounts must be writable for the mapped UID." >&2
  # Do not fail service start — app will surface a clear upload error.
fi

exit 0
