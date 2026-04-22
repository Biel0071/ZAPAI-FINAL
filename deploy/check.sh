#!/usr/bin/env bash
# ============================================================
# ZapAI CRM — HEALTH CHECK
#
# Usage:
#   bash deploy/check.sh
#
# Checks: backend, nginx, PM2, database, socket.io, disk
# ============================================================
set -uo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'
pass()  { echo -e "  ${GREEN}✓${RESET}  $*"; }
fail()  { echo -e "  ${RED}✗${RESET}  $*"; FAILURES=$((FAILURES+1)); }
warn()  { echo -e "  ${YELLOW}!${RESET}  $*"; }
section() { echo -e "\n${BOLD}$*${RESET}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_PORT=4025
PM2_PROCESS="zapai-backend"
FAILURES=0

echo -e "${BOLD}"
echo "  ╔═════════════════════════════════════════╗"
echo "  ║   ZapAI CRM — Health Check              ║"
echo "  ║   $(date '+%Y-%m-%d %H:%M:%S')                  ║"
echo "  ╚═════════════════════════════════════════╝"
echo -e "${RESET}"

# ── Backend API ──────────────────────────────────────────────
section "Backend"
HEALTH_CODE=$(curl -s -o /tmp/zapai_health.json -w "%{http_code}" \
  http://127.0.0.1:$BACKEND_PORT/health 2>/dev/null || echo "000")

if [[ "$HEALTH_CODE" == "200" ]]; then
  pass "HTTP $HEALTH_CODE  http://127.0.0.1:$BACKEND_PORT/health"
  if command -v python3 &>/dev/null; then
    DB_ST=$(python3 -c "import json,sys; d=json.load(open('/tmp/zapai_health.json')); print(d.get('data',{}).get('database','?'))" 2>/dev/null || echo "?")
    SOCK_ST=$(python3 -c "import json,sys; d=json.load(open('/tmp/zapai_health.json')); print(d.get('data',{}).get('system',{}).get('socket','?'))" 2>/dev/null || echo "?")
    WA_ST=$(python3 -c "import json,sys; d=json.load(open('/tmp/zapai_health.json')); print(d.get('data',{}).get('whatsapp','?'))" 2>/dev/null || echo "?")
    [[ "$DB_ST" == "online" ]] && pass "Database   : $DB_ST" || fail "Database   : $DB_ST"
    [[ "$SOCK_ST" == "connected" ]] && pass "Socket.io  : $SOCK_ST" || warn "Socket.io  : $SOCK_ST"
    echo -e "  ${BLUE}i${RESET}  WhatsApp   : $WA_ST"
  else
    pass "Response body received (install python3 for detailed parsing)"
  fi
else
  fail "Backend unreachable (HTTP $HEALTH_CODE)"
fi

# Auth endpoint
AUTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST http://127.0.0.1:$BACKEND_PORT/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"__check__","password":"__check__"}' 2>/dev/null || echo "000")
if [[ "$AUTH_CODE" =~ ^(200|401|400)$ ]]; then
  pass "Auth endpoint : HTTP $AUTH_CODE (reachable)"
else
  fail "Auth endpoint : HTTP $AUTH_CODE"
fi

# ── PM2 ──────────────────────────────────────────────────────
section "PM2"
if command -v pm2 &>/dev/null; then
  # Use pm2 jlist (JSON) — reliable across all PM2 versions
  # (pm2 describe uses Unicode box chars that grep -oP cannot match portably)
  if command -v python3 &>/dev/null; then
    # Write pm2 JSON to temp file so python3 can read it cleanly
    pm2 jlist 2>/dev/null > /tmp/zapai_pm2.json || echo "[]" > /tmp/zapai_pm2.json
    _PM2_INFO=$(python3 -c "
import json
name='$PM2_PROCESS'
try:
  procs=[p for p in json.load(open('/tmp/zapai_pm2.json')) if p.get('name')==name]
  if procs:
    env=procs[0].get('pm2_env',{})
    st=env.get('status','unknown')
    rs=str(env.get('restart_time',0))
    mem=str(procs[0].get('monit',{}).get('memory',0))
    print(st+'|'+rs+'|'+mem)
  else:
    print('not_found|0|0')
except:
  print('error|0|0')
" 2>/dev/null || echo "unknown|0|0")
    PM2_STATUS=$(echo "$_PM2_INFO"   | cut -d'|' -f1)
    PM2_RESTARTS=$(echo "$_PM2_INFO" | cut -d'|' -f2)
    _MEM_BYTES=$(echo "$_PM2_INFO"   | cut -d'|' -f3)
    PM2_MEM_MB=$(( _MEM_BYTES / 1024 / 1024 ))
  else
    # Fallback: plain text list grep (less reliable but works)
    PM2_STATUS=$(pm2 list 2>/dev/null | grep -i "$PM2_PROCESS" | \
      grep -oE 'online|stopped|errored|launching' | head -1 || echo "unknown")
    PM2_RESTARTS="?"; PM2_MEM_MB="?"
  fi

  if [[ "$PM2_STATUS" == "online" ]]; then
    pass "$PM2_PROCESS : $PM2_STATUS"
  else
    fail "$PM2_PROCESS : ${PM2_STATUS} — run: pm2 start /tmp/zapai_ecosystem.js --env production"
  fi

  if [[ "$PM2_RESTARTS" =~ ^[0-9]+$ ]] && [[ "$PM2_RESTARTS" -gt 10 ]]; then
    warn "Restart count: $PM2_RESTARTS (possible crash loop — check: pm2 logs $PM2_PROCESS)"
  else
    echo -e "  ${BLUE}i${RESET}  Restarts   : $PM2_RESTARTS"
  fi
  echo -e "  ${BLUE}i${RESET}  Memory     : ${PM2_MEM_MB} MB"
else
  fail "pm2 not installed"
fi

# ── Nginx ────────────────────────────────────────────────────
section "Nginx"
if command -v nginx &>/dev/null; then
  if systemctl is-active nginx &>/dev/null; then
    pass "nginx service : active"
  else
    fail "nginx service : inactive"
  fi
  nginx -t 2>/dev/null && pass "nginx config  : valid" || fail "nginx config  : invalid"
  NGINX_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1/ 2>/dev/null || echo "000")
  echo -e "  ${BLUE}i${RESET}  HTTP /      : $NGINX_CODE"
else
  warn "nginx not installed (frontend served differently?)"
fi

# ── PostgreSQL ───────────────────────────────────────────────
section "PostgreSQL"
if command -v psql &>/dev/null; then
  if systemctl is-active postgresql &>/dev/null; then
    pass "postgresql service : active"
  else
    fail "postgresql service : inactive"
  fi
  PG_VER=$(psql --version 2>/dev/null | awk '{print $3}' || echo "?")
  echo -e "  ${BLUE}i${RESET}  Version    : $PG_VER"
else
  warn "psql CLI not found on PATH"
fi

# ── Disk ─────────────────────────────────────────────────────
section "Disk"
DISK_USE=$(df -h "$APP_DIR" 2>/dev/null | awk 'NR==2{print $5}' | tr -d '%')
DISK_DISPLAY=$(df -h "$APP_DIR" 2>/dev/null | awk 'NR==2{print $3"/"$2" ("$5")"}')
if [[ "$DISK_USE" -ge 90 ]]; then
  fail "Disk usage    : $DISK_DISPLAY — CRITICAL"
elif [[ "$DISK_USE" -ge 75 ]]; then
  warn "Disk usage    : $DISK_DISPLAY — high"
else
  pass "Disk usage    : $DISK_DISPLAY"
fi

# ── Git ──────────────────────────────────────────────────────
section "Git"
BRANCH=$(git -C "$APP_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "?")
COMMIT=$(git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null || echo "?")
echo -e "  ${BLUE}i${RESET}  Branch     : $BRANCH"
echo -e "  ${BLUE}i${RESET}  Commit     : $COMMIT"

# ── Frontend dist ────────────────────────────────────────────
section "Frontend"
DIST="$APP_DIR/frontend/dist"
if [[ -d "$DIST" ]]; then
  DIST_FILES=$(find "$DIST" -type f | wc -l)
  DIST_TIME=$(stat -c "%y" "$DIST" 2>/dev/null | cut -d. -f1 || echo "?")
  pass "dist/          : $DIST_FILES files (built $DIST_TIME)"
else
  fail "dist/ missing — run: cd $APP_DIR/frontend && npm run build"
fi

# ── Summary ──────────────────────────────────────────────────
echo ""
echo -e "${BOLD}─────────────────────────────────────────────${RESET}"
if [[ "$FAILURES" -eq 0 ]]; then
  echo -e "${BOLD}${GREEN}  ✓  All checks passed${RESET}"
else
  echo -e "${BOLD}${RED}  ✗  $FAILURES check(s) failed${RESET}"
fi
echo -e "  pm2 logs  : pm2 logs $PM2_PROCESS --lines 50"
echo -e "  Update    : bash $SCRIPT_DIR/update.sh"
echo ""

exit $FAILURES
