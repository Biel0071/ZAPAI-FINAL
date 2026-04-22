#!/usr/bin/env bash
# ============================================================
# ZapAI CRM — ROLLBACK
#
# Usage:
#   bash deploy/rollback.sh              # revert 1 commit
#   bash deploy/rollback.sh v1-stable-freeze   # revert to tag
#
# Restores DB backup if found; sessions always restored.
# ============================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'
ok()   { echo -e "${GREEN}[OK]${RESET}  $*"; }
info() { echo -e "${BLUE}[--]${RESET}  $*"; }
warn() { echo -e "${YELLOW}[!!]${RESET}  $*"; }
die()  { echo -e "${RED}[ERR]${RESET} $*" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$APP_DIR/backups"
DB_NAME="${DB_NAME:-zapai_crm}"
DB_USER="${DB_USER:-zapai}"
PM2_PROCESS="zapai-backend"
BACKEND_PORT=4025

TARGET="${1:-}"

echo -e "${BOLD}"
echo "  ╔═════════════════════════════════════════╗"
echo "  ║   ZapAI CRM — Rollback                  ║"
echo "  ║   $(date '+%Y-%m-%d %H:%M:%S')                  ║"
echo "  ╚═════════════════════════════════════════╝"
echo -e "${RESET}"

# Resolve target
cd "$APP_DIR"
if [[ -z "$TARGET" ]]; then
  TARGET=$(git log --oneline -2 | tail -1 | awk '{print $1}')
  info "No target specified — reverting to previous commit: $TARGET"
else
  info "Target: $TARGET"
fi

# Confirm
echo -e "${YELLOW}WARNING: This will revert code and restart the backend.${RESET}"
read -rp "Continue? [y/N] " CONFIRM
[[ "${CONFIRM,,}" == "y" ]] || { echo "Aborted."; exit 0; }

# 1. Stop backend
info "Stopping PM2..."
pm2 stop "$PM2_PROCESS" || true

# 2. Revert code
info "Checking out $TARGET..."
git fetch --all --tags
git checkout "$TARGET"
ok "Code reverted to $TARGET"

# 3. Restore sessions backup (optional)
LATEST_SESSIONS=$(ls -t "$BACKUP_DIR"/sessions_*.tar.gz 2>/dev/null | head -1 || true)
if [[ -n "$LATEST_SESSIONS" ]]; then
  info "Restoring sessions from $LATEST_SESSIONS..."
  rm -rf "$APP_DIR/backend/sessions"
  tar -xzf "$LATEST_SESSIONS" -C "$APP_DIR/backend" 2>/dev/null || true
  ok "Sessions restored"
else
  warn "No session backup found in $BACKUP_DIR — skipping sessions restore"
fi

# 4. Restore DB backup (optional)
LATEST_DB=$(ls -t "$BACKUP_DIR"/db_*.sql.gz 2>/dev/null | head -1 || true)
if [[ -n "$LATEST_DB" ]]; then
  info "Restoring database from $LATEST_DB..."
  sudo -u postgres dropdb "${DB_NAME}_rollback_old" 2>/dev/null || true
  sudo -u postgres createdb -O "$DB_USER" "${DB_NAME}_rollback_tmp"
  gunzip -c "$LATEST_DB" | sudo -u postgres psql "${DB_NAME}_rollback_tmp"
  sudo -u postgres psql -c \
    "ALTER DATABASE \"$DB_NAME\" RENAME TO \"${DB_NAME}_pre_rollback\";" postgres
  sudo -u postgres psql -c \
    "ALTER DATABASE \"${DB_NAME}_rollback_tmp\" RENAME TO \"$DB_NAME\";" postgres
  ok "Database restored"
else
  warn "No DB backup found in $BACKUP_DIR — skipping DB restore"
fi

# 5. Reinstall backend deps
info "Installing backend dependencies..."
cd "$APP_DIR/backend"
npm ci --omit=dev --no-audit --no-fund 2>&1 | tail -3
ok "Backend deps ready"

# 6. Restart PM2
info "Restarting PM2..."
sed "s|/opt/zapai|$APP_DIR|g" "$APP_DIR/deploy/ecosystem.config.js" > /tmp/zapai_ecosystem.js
pm2 start /tmp/zapai_ecosystem.js --env production
pm2 save
ok "PM2 restarted"

# 7. Health check
sleep 4
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:$BACKEND_PORT/health || echo "000")
if [[ "$HEALTH" == "200" ]]; then
  ok "Health check PASSED (HTTP $HEALTH)"
else
  die "Health check FAILED (HTTP $HEALTH) — check: pm2 logs $PM2_PROCESS"
fi

echo ""
echo -e "${BOLD}${GREEN}  ✓  Rollback complete — reverted to $TARGET${RESET}"
echo -e "  Logs: pm2 logs $PM2_PROCESS"
echo ""
