#!/usr/bin/env bash
# Install and configure local PostgreSQL for VenInspect inside an LXC.
# Safe to re-run: preserves existing password from /etc/veninspect.env when present.
# Does NOT switch the app off SQLite — that happens in the Postgres cutover (see docs/POSTGRES-MIGRATION.md).
set -euo pipefail

APP_USER="${APP_USER:-veninspect}"
ENV_FILE="${ENV_FILE:-/etc/veninspect.env}"
PG_DB="${POSTGRES_DB:-veninspect}"
PG_USER="${POSTGRES_USER:-veninspect}"
PG_HOST="${POSTGRES_HOST:-127.0.0.1}"
PG_PORT="${POSTGRES_PORT:-5432}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root inside the LXC." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

echo "==> Installing PostgreSQL"
apt-get update
apt-get install -y --no-install-recommends postgresql postgresql-contrib

# Prefer the cluster's default version (Debian/Ubuntu package)
systemctl enable --now postgresql

# Read existing password if re-running
EXISTING_PW=""
if [[ -f "$ENV_FILE" ]]; then
  EXISTING_PW="$(grep -E '^POSTGRES_PASSWORD=' "$ENV_FILE" | cut -d= -f2- || true)"
fi
PG_PASSWORD="${POSTGRES_PASSWORD:-${EXISTING_PW:-$(openssl rand -hex 24)}}"

echo "==> Ensuring role and database ($PG_DB / $PG_USER)"
# Create role if missing
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${PG_USER}'" | grep -q 1; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c \
    "CREATE ROLE ${PG_USER} LOGIN PASSWORD '${PG_PASSWORD}';"
else
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c \
    "ALTER ROLE ${PG_USER} WITH LOGIN PASSWORD '${PG_PASSWORD}';"
fi

# Create database if missing
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${PG_DB}'" | grep -q 1; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c \
    "CREATE DATABASE ${PG_DB} OWNER ${PG_USER};"
else
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c \
    "ALTER DATABASE ${PG_DB} OWNER TO ${PG_USER};"
fi

sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$PG_DB" -c \
  "GRANT ALL ON SCHEMA public TO ${PG_USER};"

# Local peer/auth: ensure password auth for 127.0.0.1 (md5/scram)
# Default Debian pg_hba already allows local socket peer + 127.0.0.1 scram/md5.

DATABASE_URL="postgresql://${PG_USER}:${PG_PASSWORD}@${PG_HOST}:${PG_PORT}/${PG_DB}"

# Write/update postgres keys in env without wiping the rest
touch "$ENV_FILE"
chmod 640 "$ENV_FILE" || true
chown root:"$APP_USER" "$ENV_FILE" 2>/dev/null || true

upsert_env() {
  local key="$1"
  local val="$2"
  if grep -qE "^#?${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i -E "s|^#?${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$val" >>"$ENV_FILE"
  fi
}

upsert_env "POSTGRES_HOST" "$PG_HOST"
upsert_env "POSTGRES_PORT" "$PG_PORT"
upsert_env "POSTGRES_DB" "$PG_DB"
upsert_env "POSTGRES_USER" "$PG_USER"
upsert_env "POSTGRES_PASSWORD" "$PG_PASSWORD"
# Ready-made URL kept commented so the app stays on SQLite until cutover
if grep -qE '^#?DATABASE_URL_POSTGRES=' "$ENV_FILE" 2>/dev/null; then
  sed -i -E "s|^#?DATABASE_URL_POSTGRES=.*|DATABASE_URL_POSTGRES=${DATABASE_URL}|" "$ENV_FILE"
else
  printf 'DATABASE_URL_POSTGRES=%s\n' "$DATABASE_URL" >>"$ENV_FILE"
fi
if ! grep -qE '^# Cutover: set DATABASE_URL=' "$ENV_FILE" 2>/dev/null; then
  cat >>"$ENV_FILE" <<EOF
# Cutover: set DATABASE_URL=\${DATABASE_URL_POSTGRES} (or copy the value) after running the
# SQLite→Postgres migration — see docs/POSTGRES-MIGRATION.md. Until then the app uses SQLite.
EOF
fi

echo "==> PostgreSQL ready (app still on SQLite until cutover)"
echo "  Host:     ${PG_HOST}:${PG_PORT}"
echo "  Database: ${PG_DB}"
echo "  User:     ${PG_USER}"
echo "  URL key:  DATABASE_URL_POSTGRES in ${ENV_FILE}"
echo
echo "Test:  sudo -u postgres psql -d ${PG_DB} -c '\\conninfo'"
