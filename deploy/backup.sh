#!/usr/bin/env bash
# backup.sh — snapshot sessions + DB before each deploy
# Usage: ./deploy/backup.sh
set -euo pipefail

BACKUP_DIR="/opt/zapai/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
APP_DIR="/opt/zapai"
DB_NAME="${DB_NAME:-zapai_crm}"
DB_USER="${DB_USER:-zapai}"

echo "[BACKUP] Starting backup at $TIMESTAMP"
mkdir -p "$BACKUP_DIR"

# 1. WhatsApp sessions
echo "[BACKUP] Archiving sessions..."
tar -czf "$BACKUP_DIR/sessions_$TIMESTAMP.tar.gz" -C "$APP_DIR/backend" sessions data 2>/dev/null || true

# 2. PostgreSQL dump
echo "[BACKUP] Dumping PostgreSQL..."
pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_DIR/db_$TIMESTAMP.sql.gz"

# 3. Keep last 10 backups only
echo "[BACKUP] Pruning old backups (keep last 10)..."
ls -t "$BACKUP_DIR"/sessions_*.tar.gz 2>/dev/null | tail -n +11 | xargs rm -f || true
ls -t "$BACKUP_DIR"/db_*.sql.gz       2>/dev/null | tail -n +11 | xargs rm -f || true

echo "[BACKUP] Done: $BACKUP_DIR/sessions_$TIMESTAMP.tar.gz + db_$TIMESTAMP.sql.gz"
echo "$TIMESTAMP" > "$BACKUP_DIR/last_backup"
