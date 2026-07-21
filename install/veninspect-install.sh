#!/usr/bin/env bash
# Runs INSIDE an existing Debian/Ubuntu LXC (or after helper script creates one).
# Prefer the host one-liner in ct/veninspect.sh for a full Proxmox helper-style install.
#
#   bash install/veninspect-install.sh [git-repo-url]
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_URL="${1:-${VENINSPECT_REPO:-}}"

if [[ ! -f "$REPO_ROOT/deploy/install-lxc.sh" ]]; then
  echo "deploy/install-lxc.sh not found. Clone the repo first." >&2
  exit 1
fi

exec bash "$REPO_ROOT/deploy/install-lxc.sh" ${REPO_URL:+"$REPO_URL"}
