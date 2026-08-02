#!/bin/sh
set -e
export DATA_DIR="${DATA_DIR:-/data}"
mkdir -p "$DATA_DIR/photos" "$DATA_DIR/uploads"
# Apply migrations against the mounted data volume, then start
npx prisma migrate deploy
exec "$@"
