#!/bin/sh
set -eu

log() {
  echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] [entrypoint] $*"
}

DB_HOST="${POSTGRES_HOST:-postgres}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_USER="${POSTGRES_USER:-zapai}"
DB_NAME="${POSTGRES_DB:-zapai_crm}"
DB_PASSWORD="${POSTGRES_PASSWORD:-}"
DB_WAIT_TIMEOUT_SECONDS="${DB_WAIT_TIMEOUT_SECONDS:-120}"
DB_WAIT_INTERVAL_SECONDS="${DB_WAIT_INTERVAL_SECONDS:-2}"

if [ "$DB_WAIT_INTERVAL_SECONDS" -le 0 ]; then
  DB_WAIT_INTERVAL_SECONDS=2
fi

MAX_ATTEMPTS=$((DB_WAIT_TIMEOUT_SECONDS / DB_WAIT_INTERVAL_SECONDS))
if [ "$MAX_ATTEMPTS" -lt 1 ]; then
  MAX_ATTEMPTS=1
fi

log "=========================================="
log "ZAPAI BACKEND - DOCKER ENTRYPOINT"
log "=========================================="
log "Config: db=${DB_HOST}:${DB_PORT}/${DB_NAME}, timeout=${DB_WAIT_TIMEOUT_SECONDS}s, interval=${DB_WAIT_INTERVAL_SECONDS}s"

attempt=1
while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
  if PGPASSWORD="$DB_PASSWORD" pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
    log "PostgreSQL is ready (attempt ${attempt}/${MAX_ATTEMPTS})"
    break
  fi

  log "Waiting for PostgreSQL (attempt ${attempt}/${MAX_ATTEMPTS})..."
  if [ "$attempt" -eq "$MAX_ATTEMPTS" ]; then
    log "ERROR: PostgreSQL did not become ready within ${DB_WAIT_TIMEOUT_SECONDS}s"
    exit 1
  fi

  attempt=$((attempt + 1))
  sleep "$DB_WAIT_INTERVAL_SECONDS"
done

if [ -f scripts/init-database.js ]; then
  log "Running database migrations..."
  node scripts/init-database.js
else
  log "Skipping migrations (scripts/init-database.js not found)"
fi

if [ -f scripts/seed-admin.js ]; then
  log "Seeding admin user..."
  node scripts/seed-admin.js
else
  log "Skipping admin seed (scripts/seed-admin.js not found)"
fi

log "Starting backend application: $*"
exec "$@"
