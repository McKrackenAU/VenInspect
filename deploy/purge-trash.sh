#!/usr/bin/env bash
# Purge soft-deleted inspections older than 30 days (call from cron/systemd timer).
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/veninspect}"
cd "$APP_DIR"
sudo -u veninspect env DATA_DIR="${DATA_DIR:-/var/lib/veninspect}" \
  npx tsx scripts/purge-trash.ts
