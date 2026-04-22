#!/usr/bin/env bash
# rollback.sh — revert to previous git tag + restore latest backup
# Usage: ./deploy/rollback.sh [TAG]
# Example: ./deploy/rollback.sh v1-stable-freeze
set -euo pipefail

APP_DIR="/opt/zapai"
BACKUP_DIR="$APP_DIR/backups"
TARGET_TAG="${1:-v1-stable-freeze}"
DB_NAME="${DB_NAME:-zapai_crm}"
DB_USER="${DB_USER:-zapai}"

echo "[ROLLBACK] Target tag: $TARGET_TAG"

# 1. Find latest backup
LATEST_SESSIONS=$(ls -t "$BACKUP_DIR"/sessions_*.tar.gz 2>/dev/null | head -1)
LATEST_DB=$(ls -t "$BACKUP_DIR"/db_*.sql.gz             2>/dev/null | head -1)

if [[ -z "$LATEST_SESSIONS" || -z "$LATEST_DB" ]]; then
  echo "[ROLLBACK] ERROR: No backup found in $BACKUP_DIR — aborting"
  exit 1
fi

echo "[ROLLBACK] Using sessions backup: $LATEST_SESSIONS"
echo "[ROLLBACK] Using DB backup:       $LATEST_DB"

# 2. Stop backend
echo "[ROLLBACK] Stopping PM2..."
pm2 stop zapai-backend || true

# 3. Reset code to tag
echo "[ROLLBACK] Checking out $TARGET_TAG..."
cd "$APP_DIR"
git fetch --tags
git checkout "$TARGET_TAG"

# 4. Restore sessions
echo "[ROLLBACK] Restoring sessions..."
rm -rf "$APP_DIR/backend/sessions" "$APP_DIR/backend/data"
tar -xzf "$LATEST_SESSIONS" -C "$APP_DIR/backend"

# 5. Restore DB
echo "[ROLLBACK] Restoring PostgreSQL..."
dropdb  -U "$DB_USER" "${DB_NAME}_rollback_old" 2>/dev/null || true
createdb -U "$DB_USER" "${DB_NAME}_rollback_tmp"
gunzip -c "$LATEST_DB" | psql -U "$DB_USER" "${DB_NAME}_rollback_tmp"
psql -U "$DB_USER" -c "ALTER DATABASE \"$DB_NAME\" RENAME TO \"${DB_NAME}_pre_rollback\";" postgres
psql -U "$DB_USER" -c "ALTER DATABASE \"${DB_NAME}_rollback_tmp\" RENAME TO \"$DB_NAME\";" postgres

# 6. Reinstall + restart
echo "[ROLLBACK] Reinstalling backend deps..."
cd "$APP_DIR/backend" && npm ci --omit=dev

echo "[ROLLBACK] Restarting PM2..."
pm2 start "$APP_DIR/deploy/ecosystem.config.js" --env production
pm2 save

echo "[ROLLBACK] Done. System rolled back to $TARGET_TAG."
