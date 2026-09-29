#!/bin/bash
# ==============================================================================
# ZAPAI — restart.sh
# Safe backend restart that preserves WhatsApp sessions.
# Reloads PM2 (zero-downtime) and validates health after restart.
# Usage: bash deploy/restart.sh [--hard]
# ==============================================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." 2>/dev/null && pwd)"
ENV_FILE="$APP_DIR/.env.production"

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[RESTART $(date +%H:%M:%S)] ✔ $*${NC}"; }
warn() { echo -e "${YELLOW}[RESTART $(date +%H:%M:%S)] ⚠ $*${NC}"; }
err()  { echo -e "${RED}[RESTART $(date +%H:%M:%S)] ✖ $*${NC}"; exit 1; }

HARD_RESTART=false
for arg in "$@"; do
  [ "$arg" = "--hard" ] && HARD_RESTART=true
done

BACKEND_PORT=$(grep '^PORT=' "$ENV_FILE" 2>/dev/null | cut -d= -f2 | tr -d '"' || echo "4025")
HEALTH_URL="http://127.0.0.1:${BACKEND_PORT}/health"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ZAPAI RESTART — $(date)"
echo "  Mode: $([ "$HARD_RESTART" = true ] && echo 'HARD (stop+start)' || echo 'SOFT (reload)')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if ! command -v pm2 >/dev/null 2>&1; then
  err "PM2 not installed"
fi

# Source .env for any env-dependent logic
set -a
source "$ENV_FILE" 2>/dev/null || true
set +a

if $HARD_RESTART; then
  warn "Hard restart: pm2 stop → pm2 start (sessions may reconnect)"
  pm2 stop zapflow-api 2>/dev/null || true
  sleep 2
  pm2 start "$APP_DIR/backend/ecosystem.config.js" --env production
else
  log "Soft reload: pm2 reload (zero-downtime)"
  pm2 reload zapflow-api 2>/dev/null || {
    warn "Reload failed — falling back to restart"
    pm2 restart zapflow-api 2>/dev/null || \
      pm2 start "$APP_DIR/backend/ecosystem.config.js" --env production
  }
fi

pm2 save --force 2>/dev/null || true

# Nginx reload
if nginx -t 2>/dev/null; then
  systemctl reload nginx 2>/dev/null || true
  log "Nginx reloaded"
else
  warn "Nginx config invalid — skipping reload"
fi

# Health validation
echo ""
log "Validating health..."
sleep 5

HEALTH_OK=false
for i in $(seq 1 8); do
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$HEALTH_URL" 2>/dev/null || echo "000")
  if [ "$HTTP" = "200" ]; then
    HEALTH_OK=true
    log "Health: 200 OK (attempt $i)"
    break
  fi
  echo "  → Attempt $i/8 — HTTP $HTTP, waiting 3s..."
  sleep 3
done

echo ""
if $HEALTH_OK; then
  echo -e "${GREEN}  ✅ RESTART COMPLETE — System healthy${NC}"
  pm2 status zapflow-api
else
  echo -e "${RED}  ✖ Restart done but health check failed${NC}"
  echo "  → pm2 logs zapflow-api --lines 30"
  exit 1
fi
echo ""
