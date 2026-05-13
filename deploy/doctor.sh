#!/bin/bash
# ==============================================================================
# ZAPAI — doctor.sh
# Diagnóstico completo do sistema em produção.
# Usage: bash deploy/doctor.sh
# ==============================================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." 2>/dev/null && pwd)"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend-official"
ENV_FILE="$APP_DIR/.env.production"

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "  ${GREEN}✔${NC} $*"; }
fail() { echo -e "  ${RED}✖${NC} $*"; ISSUES=$((${ISSUES:-0} + 1)); }
warn() { echo -e "  ${YELLOW}⚠${NC} $*"; }
sep()  { echo -e "\n${CYAN}━━━ $* ━━━${NC}"; }

ISSUES=0

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║        ZAPAI DOCTOR — $(date '+%Y-%m-%d %H:%M')       ║"
echo "╚══════════════════════════════════════════════════╝"

# ─── System resources ─────────────────────────────────────────────────────────
sep "SYSTEM RESOURCES"
RAM_USED=$(free -m | awk '/^Mem/{printf "%.0f", ($3/$2)*100}')
DISK_USED=$(df "$APP_DIR" | awk 'NR==2{gsub(/%/,"",$5); print $5}')
LOAD=$(uptime | awk -F'load average:' '{print $2}' | xargs)

echo "  RAM usage:  ${RAM_USED}%"
echo "  Disk usage: ${DISK_USED}%"
echo "  Load avg:   $LOAD"

[ "${RAM_USED:-0}" -gt 90 ] && fail "RAM >90% — risk of OOM kill" || ok "RAM OK (${RAM_USED}%)"
[ "${DISK_USED:-0}" -gt 90 ] && fail "Disk >90% — builds may fail" || ok "Disk OK (${DISK_USED}%)"

# ─── Backend / PM2 ────────────────────────────────────────────────────────────
sep "BACKEND / PM2"
if command -v pm2 >/dev/null 2>&1; then
  PM2_STATUS=$(pm2 jlist 2>/dev/null | python3 -c "
import sys, json
try:
    procs = json.load(sys.stdin)
    z = [p for p in procs if p.get('name') == 'zapflow-api']
    if z:
        s = z[0].get('pm2_env', {}).get('status', '?')
        mem = z[0].get('monit', {}).get('memory', 0) // (1024*1024)
        restarts = z[0].get('pm2_env', {}).get('restart_time', 0)
        print(f'{s} | mem={mem}MB | restarts={restarts}')
    else:
        print('NOT_FOUND')
except:
    print('ERROR')
" 2>/dev/null || echo "?")

  if echo "$PM2_STATUS" | grep -q "online"; then
    ok "zapflow-api: $PM2_STATUS"
  else
    fail "zapflow-api: $PM2_STATUS"
    echo "    → Fix: pm2 start $BACKEND_DIR/ecosystem.config.js --env production"
  fi
else
  fail "PM2 not installed"
fi

# ─── Backend HTTP ──────────────────────────────────────────────────────────────
sep "BACKEND HTTP"
BACKEND_PORT=$(grep '^PORT=' "$ENV_FILE" 2>/dev/null | cut -d= -f2 | tr -d '"' || echo "4025")
HEALTH_HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://127.0.0.1:${BACKEND_PORT}/health" 2>/dev/null || echo "000")
if [ "$HEALTH_HTTP" = "200" ]; then
  HEALTH_JSON=$(curl -s --max-time 5 "http://127.0.0.1:${BACKEND_PORT}/health" 2>/dev/null)
  ok "GET /health → 200 OK"
  echo "    Response: $(echo "$HEALTH_JSON" | head -c 150)"
else
  fail "GET /health → HTTP $HEALTH_HTTP"
  echo "    → Check: pm2 logs zapflow-api --lines 30"
fi

# WebSocket probe
WS_HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
  -H "Upgrade: websocket" -H "Connection: Upgrade" \
  "http://127.0.0.1:${BACKEND_PORT}/socket.io/" 2>/dev/null || echo "000")
[ "$WS_HTTP" != "000" ] && ok "WebSocket endpoint: HTTP $WS_HTTP" || fail "WebSocket endpoint unreachable"

# ─── PostgreSQL ───────────────────────────────────────────────────────────────
sep "POSTGRESQL"
if command -v psql >/dev/null 2>&1; then
  DB_PASS=$(grep '^POSTGRES_PASSWORD=' "$ENV_FILE" 2>/dev/null | cut -d= -f2 || echo "zapai123")
  DB_USER=$(grep '^POSTGRES_USER=' "$ENV_FILE" 2>/dev/null | cut -d= -f2 || echo "zapai")
  DB_NAME=$(grep '^POSTGRES_DB=' "$ENV_FILE" 2>/dev/null | cut -d= -f2 || echo "zapai_crm")
  if PGPASSWORD="$DB_PASS" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -c "SELECT COUNT(*) FROM schema_migrations" -t 2>/dev/null | grep -q '[0-9]'; then
    MIGRATION_COUNT=$(PGPASSWORD="$DB_PASS" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -c "SELECT COUNT(*) FROM schema_migrations" -t 2>/dev/null | xargs)
    ok "PostgreSQL: connected | $MIGRATION_COUNT migrations applied"
  else
    if PGPASSWORD="$DB_PASS" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" >/dev/null 2>&1; then
      ok "PostgreSQL: connected (no migrations table yet)"
    else
      fail "PostgreSQL: ECONNREFUSED"
      echo "    → Fix: systemctl restart postgresql"
    fi
  fi
else
  warn "psql not in PATH — skip PG check"
fi

# ─── Redis ────────────────────────────────────────────────────────────────────
sep "REDIS"
if command -v redis-cli >/dev/null 2>&1; then
  REDIS_PING=$(redis-cli ping 2>/dev/null | tr -d '[:space:]')
  [ "$REDIS_PING" = "PONG" ] && ok "Redis: PONG" || fail "Redis: not responding"
else
  warn "redis-cli not found — skip Redis check"
fi

# ─── Nginx ────────────────────────────────────────────────────────────────────
sep "NGINX"
if command -v nginx >/dev/null 2>&1; then
  if nginx -t 2>/dev/null; then
    ok "Nginx config: valid"
  else
    fail "Nginx config: invalid — run: nginx -t"
  fi
  if systemctl is-active --quiet nginx 2>/dev/null; then
    ok "Nginx service: active"
  else
    fail "Nginx service: not running"
    echo "    → Fix: systemctl start nginx"
  fi
  ZAPAI_SITE=$(ls /etc/nginx/sites-enabled/zapai 2>/dev/null && echo "enabled" || echo "missing")
  [ "$ZAPAI_SITE" = "enabled" ] && ok "zapai site: enabled" || fail "zapai site: not enabled in sites-enabled/"
else
  fail "nginx not installed"
fi

# ─── Frontend dist ────────────────────────────────────────────────────────────
sep "FRONTEND"
if [ -f "$FRONTEND_DIR/dist/index.html" ]; then
  DIST_SIZE=$(du -sh "$FRONTEND_DIR/dist" 2>/dev/null | cut -f1)
  JS_CHUNKS=$(find "$FRONTEND_DIR/dist/assets" -name '*.js' 2>/dev/null | wc -l)
  ok "dist/index.html: present ($DIST_SIZE, $JS_CHUNKS JS chunks)"
else
  fail "dist/index.html: missing"
  echo "    → Fix: bash deploy/auto-deploy.sh"
fi

# ─── .env.production ──────────────────────────────────────────────────────────
sep "ENVIRONMENT"
if [ -f "$ENV_FILE" ]; then
  ENV_PERMS=$(stat -c "%a" "$ENV_FILE" 2>/dev/null || echo "?")
  ok ".env.production: present (perms: $ENV_PERMS)"
  [ "$ENV_PERMS" = "600" ] && ok "Permissions: 600 ✔" || warn "Permissions: $ENV_PERMS (should be 600)"
  grep -q "JWT_SECRET=" "$ENV_FILE" && ok "JWT_SECRET: set" || fail "JWT_SECRET: missing"
  grep -q "DATABASE_URL=" "$ENV_FILE" && ok "DATABASE_URL: set" || fail "DATABASE_URL: missing"
else
  fail ".env.production: missing"
  echo "    → Fix: bash deploy/install.sh"
fi

# ─── Auto-deploy watcher ──────────────────────────────────────────────────────
sep "AUTO-DEPLOY WATCHER"
if systemctl is-active --quiet zapai-watcher.timer 2>/dev/null; then
  ok "zapai-watcher.timer: active"
else
  warn "zapai-watcher.timer: not active"
  echo "    → Fix: systemctl enable --now zapai-watcher.timer"
fi

# ─── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════"
if [ "${ISSUES:-0}" -eq 0 ]; then
  echo -e "${GREEN}  ✅ ALL CHECKS PASSED — System healthy${NC}"
else
  echo -e "${RED}  ✖ $ISSUES ISSUE(S) FOUND — see above for fixes${NC}"
fi
echo "════════════════════════════════════════════════════"
echo ""
