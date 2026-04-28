#!/usr/bin/env bash
# ============================================================
# ZapAI CRM — DOCTOR
# Self-healing: scans every component, fixes automatically.
#
# Usage:
#   bash deploy/doctor.sh           # scan + fix everything
#   bash deploy/doctor.sh --dry     # scan only, no changes
#
# Exit code: 0 = all healthy, 1 = unfixable issues remain
# ============================================================
set -uo pipefail

# ── Colours + helpers ────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

pass()   { echo -e "  ${GREEN}✓${RESET}  $*"; }
fail()   { echo -e "  ${RED}✗${RESET}  $*"; (( ISSUES++ )) || true; }
warn()   { echo -e "  ${YELLOW}!${RESET}  $*"; }
info()   { echo -e "  ${BLUE}→${RESET}  $*"; }
fixed()  { echo -e "  ${CYAN}⚡${RESET}  FIXED: $*"; (( FIXES_APPLIED++ )) || true; }
section(){ echo -e "\n${BOLD}${BLUE}▶ $*${RESET}"; }
die()    { echo -e "${RED}[ERR]${RESET} $*" >&2; exit 1; }

DRY=0
[[ "${1:-}" == "--dry" ]] && DRY=1

# ── Config ───────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
DEPLOY_DIR="$APP_DIR/deploy"
LOG_DIR="$APP_DIR/logs"
BACKEND_PORT=4025
PM2_PROCESS="zapai-backend"
NODE_MIN=20
ISSUES=0
FIXES_APPLIED=0
START_TIME=$(date +%s)

maybe_fix() {
  # maybe_fix "description" "command"
  local desc="$1"; shift
  if [[ "$DRY" -eq 1 ]]; then
    warn "DRY-RUN — would fix: $desc"
  else
    eval "$@" && fixed "$desc" || warn "Fix attempted but may have failed: $desc"
  fi
}

# ── Banner ───────────────────────────────────────────────────
echo -e "${BOLD}"
echo "  ╔═══════════════════════════════════════════════════╗"
echo "  ║   ZapAI CRM — Doctor  $([ $DRY -eq 1 ] && echo '[DRY-RUN]' || echo '         ')              ║"
echo "  ║   $(date '+%Y-%m-%d %H:%M:%S')                              ║"
echo "  ╚═══════════════════════════════════════════════════╝"
echo -e "${RESET}"
[[ $DRY -eq 1 ]] && warn "Dry-run mode: detecting issues only, no changes applied."

# ══════════════════════════════════════════════════════════════
# SECTION 1 — System info
# ══════════════════════════════════════════════════════════════
section "1. System"

OS_NAME=$(lsb_release -ds 2>/dev/null || \
          awk -F'"' '/PRETTY_NAME/{print $2}' /etc/os-release 2>/dev/null || echo "Unknown")
PUBLIC_IP=$(curl -s --connect-timeout 4 https://api.ipify.org 2>/dev/null || \
            curl -s --connect-timeout 4 https://checkip.amazonaws.com 2>/dev/null || \
            hostname -I 2>/dev/null | awk '{print $1}')
PUBLIC_IP="${PUBLIC_IP// /}"
SYS_HOST=$(hostname -f 2>/dev/null || hostname)
DISK_FREE=$(df -BG "$APP_DIR" 2>/dev/null | awk 'NR==2{gsub(/G/,"",$4); print $4}' || echo "0")
MEM_FREE=$(free -m 2>/dev/null | awk '/^Mem/{print $7}' || echo "?")

info "OS       : $OS_NAME"
info "IP       : ${PUBLIC_IP:-unknown}"
info "Hostname : $SYS_HOST"
info "App dir  : $APP_DIR"
info "Disk free: ${DISK_FREE}GB"
info "RAM free : ${MEM_FREE}MB"

if [[ "$DISK_FREE" =~ ^[0-9]+$ ]] && [[ "$DISK_FREE" -lt 1 ]]; then
  fail "Disk space critical: ${DISK_FREE}GB free — clean up before continuing"
elif [[ "$DISK_FREE" =~ ^[0-9]+$ ]] && [[ "$DISK_FREE" -lt 3 ]]; then
  warn "Disk low: ${DISK_FREE}GB free (recommend 3GB+)"
else
  pass "Disk: ${DISK_FREE}GB free"
fi

# ══════════════════════════════════════════════════════════════
# SECTION 2 — Node.js
# ══════════════════════════════════════════════════════════════
section "2. Node.js"

if command -v node &>/dev/null; then
  NODE_VER=$(node -e "process.stdout.write(process.version.slice(1).split('.')[0])" 2>/dev/null || echo "0")
  if [[ "$NODE_VER" -ge "$NODE_MIN" ]]; then
    pass "Node $(node -v) — OK"
  else
    fail "Node v${NODE_VER} < v${NODE_MIN} required"
    maybe_fix "Install Node.js $NODE_MIN LTS" "
      curl -fsSL https://deb.nodesource.com/setup_${NODE_MIN}.x | bash - >/dev/null &&
      apt-get install -y -qq nodejs >/dev/null
    "
  fi
else
  fail "Node.js not installed"
  maybe_fix "Install Node.js $NODE_MIN LTS" "
    apt-get install -y -qq curl >/dev/null 2>&1 || true
    curl -fsSL https://deb.nodesource.com/setup_${NODE_MIN}.x | bash - >/dev/null &&
    apt-get install -y -qq nodejs >/dev/null
  "
fi

if command -v npm &>/dev/null; then
  pass "npm $(npm -v) — OK"
else
  fail "npm not found"
fi

# ══════════════════════════════════════════════════════════════
# SECTION 3 — PM2
# ══════════════════════════════════════════════════════════════
section "3. PM2"

if command -v pm2 &>/dev/null; then
  pass "PM2 $(pm2 -v) installed"
else
  fail "PM2 not installed"
  maybe_fix "Install PM2 globally" "npm install -g pm2 --quiet"
fi

# PM2 process status
if command -v pm2 &>/dev/null; then
  if command -v python3 &>/dev/null; then
    pm2 jlist > /tmp/zapai_dr_pm2.json 2>/dev/null || echo "[]" > /tmp/zapai_dr_pm2.json
    _PM2_ST=$(python3 -c "
import json
try:
  ps=[p for p in json.load(open('/tmp/zapai_dr_pm2.json')) if p.get('name')=='$PM2_PROCESS']
  print(ps[0].get('pm2_env',{}).get('status','not_found') if ps else 'not_found')
except: print('error')
" 2>/dev/null || echo "unknown")
  else
    _PM2_ST=$(pm2 list 2>/dev/null | grep -i "$PM2_PROCESS" | grep -oE 'online|stopped|errored' | head -1 || echo "not_found")
  fi

  if [[ "$_PM2_ST" == "online" ]]; then
    pass "Process '$PM2_PROCESS' : online"
  else
    fail "Process '$PM2_PROCESS' : $_PM2_ST"
    maybe_fix "Start PM2 process" "
      sed \"s|/opt/zapai|$APP_DIR|g\" \"$DEPLOY_DIR/ecosystem.config.js\" > /tmp/zapai_dr_eco.js
      pm2 start /tmp/zapai_dr_eco.js --env production
      pm2 save
    "
  fi
fi

# PM2 startup registered?
if systemctl is-enabled pm2-root &>/dev/null || systemctl is-enabled pm2-$(whoami) &>/dev/null; then
  pass "PM2 startup: registered (survives reboot)"
else
  warn "PM2 startup not registered — PM2 won't auto-start on reboot"
  maybe_fix "Register PM2 startup" "
    _U=\"\${SUDO_USER:-$(whoami)}\"
    _H=\$(getent passwd \"\$_U\" | cut -d: -f6 || echo /root)
    pm2 startup systemd -u \"\$_U\" --hp \"\$_H\" 2>&1 | grep -E '^sudo|^env ' | bash || true
    pm2 save
  "
fi

# ══════════════════════════════════════════════════════════════
# SECTION 4 — PostgreSQL
# ══════════════════════════════════════════════════════════════
section "4. PostgreSQL"

if command -v psql &>/dev/null; then
  pass "PostgreSQL $(psql --version | awk '{print $3}') installed"
  if systemctl is-active postgresql &>/dev/null; then
    pass "PostgreSQL service: active"
  else
    fail "PostgreSQL service: stopped"
    maybe_fix "Start PostgreSQL" "systemctl start postgresql && systemctl enable postgresql"
  fi

  # Check DB + user exist
  DB_EXISTS=$(sudo -u postgres psql -tAc \
    "SELECT 1 FROM pg_database WHERE datname='zapai_crm'" 2>/dev/null || echo "0")
  USER_EXISTS=$(sudo -u postgres psql -tAc \
    "SELECT 1 FROM pg_roles WHERE rolname='zapai'" 2>/dev/null || echo "0")

  [[ "$DB_EXISTS" == "1" ]] && pass "Database 'zapai_crm' exists" || {
    fail "Database 'zapai_crm' missing"
    if [[ "$USER_EXISTS" != "1" ]]; then
      _PASS=$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32)
      maybe_fix "Create DB user 'zapai'" \
        "sudo -u postgres psql -c \"CREATE USER zapai WITH PASSWORD '$_PASS';\""
    fi
    maybe_fix "Create database 'zapai_crm'" \
      "sudo -u postgres createdb -O zapai zapai_crm"
  }
else
  fail "PostgreSQL not installed"
  maybe_fix "Install PostgreSQL" \
    "apt-get install -y -qq postgresql postgresql-contrib >/dev/null"
fi

# ══════════════════════════════════════════════════════════════
# SECTION 5 — Environment files
# ══════════════════════════════════════════════════════════════
section "5. Environment files"

if [[ -f "$BACKEND_DIR/.env" ]]; then
  pass "backend/.env exists"
  # Verify key vars are set (not blank or placeholder)
  _CHECK_KEYS=(JWT_SECRET DATABASE_URL NODE_ENV)
  for k in "${_CHECK_KEYS[@]}"; do
    _val=$(grep -E "^${k}=" "$BACKEND_DIR/.env" 2>/dev/null | cut -d= -f2-)
    if [[ -z "$_val" || "$_val" == "changeme" || "$_val" == "your_*" ]]; then
      warn "$k is empty or placeholder in backend/.env"
    fi
  done
else
  fail "backend/.env missing"
  if [[ -f "$BACKEND_DIR/.env.example" ]]; then
    maybe_fix "Create backend/.env from .env.example" "
      cp \"$BACKEND_DIR/.env.example\" \"$BACKEND_DIR/.env\"
      _JWT=\$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 64)
      sed -i \"s|JWT_SECRET=.*|JWT_SECRET=\$_JWT|g\" \"$BACKEND_DIR/.env\"
      sed -i \"s|AUTH_JWT_SECRET=.*|AUTH_JWT_SECRET=\$_JWT|g\" \"$BACKEND_DIR/.env\"
      sed -i \"s|NODE_ENV=.*|NODE_ENV=production|g\" \"$BACKEND_DIR/.env\"
    "
  else
    warn ".env.example not found — cannot auto-create .env"
  fi
fi

if [[ -f "$FRONTEND_DIR/.env.production" ]]; then
  pass "frontend/.env.production exists"
  VITE_URL=$(grep 'VITE_API_URL=' "$FRONTEND_DIR/.env.production" | cut -d= -f2-)
  info "VITE_API_URL = ${VITE_URL:-<empty>}"
  if [[ "$VITE_URL" == *"localhost"* ]]; then
    warn "VITE_API_URL uses 'localhost' — frontend built with this will NOT work remotely"
    warn "Fix: update VITE_API_URL to http://${PUBLIC_IP:-YOUR_VPS_IP} and rebuild frontend"
  fi
else
  fail "frontend/.env.production missing"
  maybe_fix "Create frontend/.env.production" "
    _BASE_URL=\"http://${PUBLIC_IP:-localhost}:$BACKEND_PORT\"
    cat > \"$FRONTEND_DIR/.env.production\" <<_ENV
VITE_API_URL=\$_BASE_URL
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
_ENV
  "
fi

# ══════════════════════════════════════════════════════════════
# SECTION 6 — npm dependencies
# ══════════════════════════════════════════════════════════════
section "6. npm dependencies"

if [[ -d "$BACKEND_DIR/node_modules" ]]; then
  _NM_COUNT=$(find "$BACKEND_DIR/node_modules" -maxdepth 1 -type d | wc -l)
  pass "backend/node_modules: $_NM_COUNT packages"
else
  fail "backend/node_modules missing"
  maybe_fix "npm install backend" \
    "cd \"$BACKEND_DIR\" && npm ci --omit=dev --no-audit --no-fund 2>&1 | tail -3"
fi

if [[ -d "$FRONTEND_DIR/node_modules" ]]; then
  _NM_COUNT=$(find "$FRONTEND_DIR/node_modules" -maxdepth 1 -type d | wc -l)
  pass "frontend/node_modules: $_NM_COUNT packages"
else
  fail "frontend/node_modules missing"
  maybe_fix "npm install frontend" \
    "cd \"$FRONTEND_DIR\" && npm ci --no-audit --no-fund 2>&1 | tail -3"
fi

# ══════════════════════════════════════════════════════════════
# SECTION 7 — Frontend build
# ══════════════════════════════════════════════════════════════
section "7. Frontend build"

DIST_DIR="$FRONTEND_DIR/dist"
if [[ -d "$DIST_DIR" ]]; then
  DIST_FILES=$(find "$DIST_DIR" -type f | wc -l)
  DIST_AGE_DAYS=$(( ( $(date +%s) - $(stat -c %Y "$DIST_DIR" 2>/dev/null || echo 0) ) / 86400 ))
  pass "dist/ exists: $DIST_FILES files (${DIST_AGE_DAYS}d old)"
  if [[ "$DIST_FILES" -lt 5 ]]; then
    fail "dist/ has suspiciously few files ($DIST_FILES) — may be corrupt"
    maybe_fix "Rebuild frontend" \
      "cd \"$FRONTEND_DIR\" && npm run build 2>&1 | grep -E 'built|error' | tail -5"
  fi
else
  fail "frontend/dist/ missing — frontend not built"
  maybe_fix "Build frontend" \
    "cd \"$FRONTEND_DIR\" && [[ -d node_modules ]] || npm ci --no-audit --no-fund 2>&1 | tail -3; npm run build 2>&1 | grep -E 'built|error' | tail -5"
fi

# ══════════════════════════════════════════════════════════════
# SECTION 8 — Nginx
# ══════════════════════════════════════════════════════════════
section "8. Nginx"

if command -v nginx &>/dev/null; then
  pass "Nginx installed: $(nginx -v 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')"

  if systemctl is-active nginx &>/dev/null; then
    pass "Nginx service: active"
  else
    fail "Nginx service: stopped"
    maybe_fix "Start nginx" "systemctl start nginx && systemctl enable nginx"
  fi

  if nginx -t 2>/dev/null; then
    pass "Nginx config: valid"
  else
    fail "Nginx config: INVALID (run 'nginx -t' for details)"
  fi

  # Check zapai site is enabled
  if [[ -L /etc/nginx/sites-enabled/zapai ]]; then
    pass "Nginx site 'zapai': enabled"
  else
    fail "Nginx site 'zapai': NOT enabled"
    maybe_fix "Enable nginx site" "
      ln -sf /etc/nginx/sites-available/zapai /etc/nginx/sites-enabled/zapai
      rm -f /etc/nginx/sites-enabled/default
      nginx -t && systemctl reload nginx
    "
  fi

  # Test nginx responds
  _NGX_CODE=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1/ 2>/dev/null || echo "000")
  if [[ "$_NGX_CODE" =~ ^(200|301|302)$ ]]; then
    pass "Nginx HTTP response: $_NGX_CODE"
  else
    fail "Nginx HTTP response: $_NGX_CODE"
  fi
else
  fail "Nginx not installed"
  maybe_fix "Install nginx" "apt-get install -y -qq nginx >/dev/null"
fi

# ══════════════════════════════════════════════════════════════
# SECTION 9 — Backend API
# ══════════════════════════════════════════════════════════════
section "9. Backend API"

_HEALTH_CODE=$(curl -s -o /tmp/zapai_dr_health.json -w '%{http_code}' \
  http://127.0.0.1:$BACKEND_PORT/health 2>/dev/null || echo "000")

if [[ "$_HEALTH_CODE" == "200" ]]; then
  pass "/health → HTTP $_HEALTH_CODE"

  if command -v python3 &>/dev/null; then
    _DB_ST=$(python3 -c "
import json
try:
  d=json.load(open('/tmp/zapai_dr_health.json'))
  print(d.get('data',{}).get('database','?'))
except: print('?')
" 2>/dev/null || echo "?")
    _WA_ST=$(python3 -c "
import json
try:
  d=json.load(open('/tmp/zapai_dr_health.json'))
  print(d.get('data',{}).get('whatsapp','?'))
except: print('?')
" 2>/dev/null || echo "?")
    [[ "$_DB_ST" == "online" ]] && pass "Database: $_DB_ST" || fail "Database: $_DB_ST"
    info "WhatsApp: $_WA_ST"
  fi
else
  fail "Backend unreachable (HTTP $_HEALTH_CODE)"
  if command -v pm2 &>/dev/null; then
    maybe_fix "Restart PM2 process" "
      sed \"s|/opt/zapai|$APP_DIR|g\" \"$DEPLOY_DIR/ecosystem.config.js\" > /tmp/zapai_dr_eco.js
      pm2 start /tmp/zapai_dr_eco.js --env production 2>/dev/null || pm2 restart $PM2_PROCESS
      pm2 save
    "
    sleep 4
    _RETRY=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$BACKEND_PORT/health 2>/dev/null || echo "000")
    [[ "$_RETRY" == "200" ]] && pass "Backend after fix: HTTP $_RETRY ✓" || \
      warn "Backend still not responding after fix (HTTP $_RETRY) — check: pm2 logs $PM2_PROCESS"
  fi
fi

# Auth endpoint
_AUTH=$(curl -s -o /dev/null -w '%{http_code}' \
  -X POST http://127.0.0.1:$BACKEND_PORT/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"__probe__","password":"__probe__"}' 2>/dev/null || echo "000")
[[ "$_AUTH" =~ ^(200|400|401)$ ]] && \
  pass "Auth endpoint: HTTP $_AUTH (reachable)" || \
  fail "Auth endpoint: HTTP $_AUTH"

# ══════════════════════════════════════════════════════════════
# SECTION 10 — Ports
# ══════════════════════════════════════════════════════════════
section "10. Ports"

_P80=$(ss -tlnp 2>/dev/null | grep ':80 ' | awk '{print $NF}' | head -1 || echo "")
_P4025=$(ss -tlnp 2>/dev/null | grep ":$BACKEND_PORT " | awk '{print $NF}' | head -1 || echo "")

if [[ -n "$_P80" ]]; then
  if echo "$_P80" | grep -qi nginx; then
    pass "Port 80: nginx ✓"
  else
    warn "Port 80: in use by — $_P80"
  fi
else
  warn "Port 80: nothing listening (nginx down?)"
fi

if [[ -n "$_P4025" ]]; then
  if echo "$_P4025" | grep -qi node; then
    pass "Port $BACKEND_PORT: node/backend ✓"
  else
    warn "Port $BACKEND_PORT: in use by — $_P4025"
  fi
else
  warn "Port $BACKEND_PORT: nothing listening (backend down?)"
fi

# ══════════════════════════════════════════════════════════════
# SECTION 11 — Git / repo health
# ══════════════════════════════════════════════════════════════
section "11. Git"

if git -C "$APP_DIR" rev-parse HEAD &>/dev/null; then
  _BRANCH=$(git -C "$APP_DIR" rev-parse --abbrev-ref HEAD)
  _COMMIT=$(git -C "$APP_DIR" rev-parse --short HEAD)
  pass "Repo OK — branch: $_BRANCH  commit: $_COMMIT"
  if git -C "$APP_DIR" diff --quiet 2>/dev/null; then
    pass "Working tree: clean"
  else
    warn "Working tree has local modifications (may conflict with update.sh)"
  fi
else
  fail "Not a valid git repo at $APP_DIR"
fi

# ══════════════════════════════════════════════════════════════
# SECTION 12 — Log directory
# ══════════════════════════════════════════════════════════════
section "12. Logs"

mkdir -p "$LOG_DIR" 2>/dev/null || true
if [[ -d "$LOG_DIR" ]]; then
  pass "Log directory: $LOG_DIR"
  _LOG_SIZE=$(du -sh "$LOG_DIR" 2>/dev/null | awk '{print $1}')
  info "Log dir size: $_LOG_SIZE"
else
  fail "Log directory missing: $LOG_DIR"
fi

# ══════════════════════════════════════════════════════════════
# FINAL REPORT
# ══════════════════════════════════════════════════════════════
END_TIME=$(date +%s)
ELAPSED=$(( END_TIME - START_TIME ))

echo ""
echo -e "${BOLD}─────────────────────────────────────────────────────────${RESET}"
echo -e "  Scan completed in ${ELAPSED}s  |  Issues: $ISSUES  |  Fixed: $FIXES_APPLIED"
echo ""

if [[ "$ISSUES" -eq 0 ]]; then
  echo -e "${BOLD}${GREEN}  ✓  System healthy — all checks passed${RESET}"
elif [[ "$FIXES_APPLIED" -ge "$ISSUES" ]]; then
  echo -e "${BOLD}${CYAN}  ⚡  $FIXES_APPLIED issue(s) detected and auto-fixed${RESET}"
else
  REMAINING=$(( ISSUES - FIXES_APPLIED ))
  echo -e "${BOLD}${RED}  ✗  $REMAINING issue(s) require manual attention${RESET}"
  echo ""
  echo -e "  Manual steps:"
  echo -e "    1. Check backend logs : pm2 logs $PM2_PROCESS --lines 50"
  echo -e "    2. Check nginx errors  : journalctl -u nginx -n 20"
  echo -e "    3. Check postgres      : journalctl -u postgresql -n 20"
  echo -e "    4. Full reinstall      : sudo bash $DEPLOY_DIR/install.sh"
fi

echo ""
echo -e "  ${BOLD}URL:${RESET}  http://${PUBLIC_IP:-$(hostname -I | awk '{print $1}')}/"
echo -e "  ${BOLD}API:${RESET}  http://127.0.0.1:$BACKEND_PORT/health"
echo -e "  ${BOLD}Logs:${RESET} pm2 logs $PM2_PROCESS"
echo ""

[[ "$ISSUES" -eq 0 ]] || [[ "$FIXES_APPLIED" -ge "$ISSUES" ]] && exit 0 || exit 1
