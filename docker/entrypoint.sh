#!/bin/sh
set -e
mkdir -p /data/uploads
export DATA_DIR="${DATA_DIR:-/data}"
# Apply migrations against the mounted data volume, then start
npx prisma migrate deploy
exec "$@"
