#!/usr/bin/env bash
# ============================================================
# ZapAI CRM — ROLLING UPDATE (zero-downtime)
#
# Usage:
#   bash deploy/update.sh
#   bash deploy/update.sh main          # specific branch
#   bash deploy/update.sh v2.0.0        # specific tag
#
# Runs: git pull → npm install → build frontend → pm2 reload
# Safe: rolls back automatically on health-check failure.
# ============================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'
ok()   { echo -e "${GREEN}[OK]${RESET}  $*"; }
info() { echo -e "${BLUE}[--]${RESET}  $*"; }
warn() { echo -e "${YELLOW}[!!]${RESET}  $*"; }
die()  { echo -e "${RED}[ERR]${RESET} $*" >&2; exit 1; }
step() { echo -e "\n${BOLD}${BLUE}══ $* ${RESET}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
DEPLOY_DIR="$APP_DIR/deploy"

TARGET="${1:-}"          # optional branch/tag override
BACKEND_PORT=4025
PM2_PROCESS="zapai-backend"

echo -e "${BOLD}"
echo "  ╔═════════════════════════════════════════╗"
echo "  ║   ZapAI CRM — Rolling Update            ║"
echo "  ║   $(date '+%Y-%m-%d %H:%M:%S')                  ║"
echo "  ╚═════════════════════════════════════════╝"
echo -e "${RESET}"

# ── Save rollback point ──────────────────────────────────────
PREV_COMMIT=$(git -C "$APP_DIR" rev-parse HEAD)
info "Current commit: $PREV_COMMIT"

# ── Step 1 — Git pull ────────────────────────────────────────
step "1/5  Git pull"
cd "$APP_DIR"

if [[ -n "$TARGET" ]]; then
  info "Checking out $TARGET..."
  git fetch --all --tags
  git checkout "$TARGET"
else
  CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
  info "Pulling branch: $CURRENT_BRANCH"
  git pull origin "$CURRENT_BRANCH"
fi

NEW_COMMIT=$(git rev-parse HEAD)
if [[ "$PREV_COMMIT" == "$NEW_COMMIT" ]]; then
  ok "Already up-to-date ($NEW_COMMIT)"
else
  ok "Updated $PREV_COMMIT → $NEW_COMMIT"
fi

# ── Step 2 — Backend deps ────────────────────────────────────
step "2/5  Backend npm install"
cd "$BACKEND_DIR"
npm ci --omit=dev --no-audit --no-fund 2>&1 | tail -5
ok "Backend dependencies ready"

# ── Step 3 — Frontend build ──────────────────────────────────
step "3/5  Frontend build"
cd "$FRONTEND_DIR"
npm ci --no-audit --no-fund 2>&1 | tail -5
npm run build 2>&1 | grep -E "built in|✓|error" | tail -5
ok "Frontend built → $FRONTEND_DIR/dist"

# ── Step 4 — PM2 reload ──────────────────────────────────────
step "4/5  PM2 reload (zero-downtime)"
sed "s|/opt/zapai|$APP_DIR|g" "$DEPLOY_DIR/ecosystem.config.js" > /tmp/zapai_ecosystem.js

if pm2 describe "$PM2_PROCESS" &>/dev/null; then
  pm2 reload /tmp/zapai_ecosystem.js --env production --update-env
  pm2 save
  ok "PM2 reloaded"
else
  pm2 start /tmp/zapai_ecosystem.js --env production
  pm2 save
  ok "PM2 started (was not running)"
fi

# ── Step 5 — Health check ────────────────────────────────────
step "5/5  Health check"
sleep 4

HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:$BACKEND_PORT/health || echo "000")
if [[ "$HEALTH" == "200" ]]; then
  ok "Health check PASSED (HTTP $HEALTH) ✓"
else
  warn "Health check FAILED (HTTP $HEALTH)"
  warn "Auto-rolling back to $PREV_COMMIT..."
  git -C "$APP_DIR" checkout "$PREV_COMMIT"
  pm2 restart "$PM2_PROCESS" || true
  sleep 3
  RETRY=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:$BACKEND_PORT/health || echo "000")
  if [[ "$RETRY" == "200" ]]; then
    warn "Rollback OK — running on previous commit $PREV_COMMIT"
  else
    die "Rollback also failed. Manual intervention required. Check: pm2 logs $PM2_PROCESS"
  fi
  exit 1
fi

# Reload Nginx if installed
if command -v nginx &>/dev/null; then
  nginx -t 2>/dev/null && systemctl reload nginx && ok "Nginx reloaded"
fi

echo ""
echo -e "${BOLD}${GREEN}  ✓  Update complete — $(date '+%H:%M:%S')${RESET}"
echo -e "  Commit : $NEW_COMMIT"
echo -e "  Logs   : pm2 logs $PM2_PROCESS"
echo ""
