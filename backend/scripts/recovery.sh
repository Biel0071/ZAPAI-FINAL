#!/bin/bash
# ==============================================================================
# ZAPAI — Auto Recovery Script
# Detecta falhas no runtime e restaura automaticamente.
#
# Uso:
#   bash scripts/recovery.sh           (diagnose + recover)
#   bash scripts/recovery.sh --dry-run (apenas diagnóstico)
#   bash scripts/recovery.sh --force   (força restart mesmo se online)
# ==============================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$ROOT_DIR"
SESSIONS_DIR="$ROOT_DIR/sessions"
LOGS_DIR="$ROOT_DIR/logs"
RECOVERY_LOG="$LOGS_DIR/recovery_$(date +%Y%m%d_%H%M%S).log"
PORT="${PORT:-4025}"
HEALTH_URL="http://127.0.0.1:${PORT}/health"

DRY_RUN=false
FORCE=false
for arg in "$@"; do
  case $arg in
    --dry-run) DRY_RUN=true ;;
    --force)   FORCE=true ;;
  esac
done

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

mkdir -p "$LOGS_DIR"
exec > >(tee -a "$RECOVERY_LOG") 2>&1

log()   { echo -e "${GREEN}[RECOVERY $(date +%H:%M:%S)] $*${NC}"; }
warn()  { echo -e "${YELLOW}[RECOVERY $(date +%H:%M:%S)] ⚠ $*${NC}"; }
err()   { echo -e "${RED}[RECOVERY $(date +%H:%M:%S)] ✖ $*${NC}"; }
action(){ echo -e "${CYAN}[RECOVERY $(date +%H:%M:%S)] → $*${NC}"; }
dryrun(){ echo -e "${YELLOW}[DRY-RUN] Would: $*${NC}"; }

echo "============================================================"
echo "  ZAPAI RECOVERY — $(date)"
echo "  Port: $PORT | Dry-run: $DRY_RUN | Force: $FORCE"
echo "============================================================"

ISSUES_FOUND=0

# ─── 1. Check port ────────────────────────────────────────────────────────────
PORT_LISTENING=false
if command -v ss >/dev/null 2>&1; then
  ss -tlnp "sport = :${PORT}" 2>/dev/null | grep -q ":${PORT}" && PORT_LISTENING=true
elif command -v netstat >/dev/null 2>&1; then
  netstat -tlnp 2>/dev/null | grep ":${PORT}" | grep -q LISTEN && PORT_LISTENING=true
fi

if $PORT_LISTENING; then
  log "Port $PORT: LISTENING ✓"
else
  warn "Port $PORT: NOT listening"
  ISSUES_FOUND=$((ISSUES_FOUND+1))
fi

# ─── 2. Check HTTP health ─────────────────────────────────────────────────────
BACKEND_HEALTHY=false
if command -v curl >/dev/null 2>&1; then
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$HEALTH_URL" 2>/dev/null || echo "000")
  if [ "$HTTP" = "200" ]; then
    log "HTTP /health: 200 ✓"
    BACKEND_HEALTHY=true
  else
    warn "HTTP /health: $HTTP"
    ISSUES_FOUND=$((ISSUES_FOUND+1))
  fi
else
  warn "curl not available — skipping HTTP check"
fi

# ─── 3. Check PM2 ────────────────────────────────────────────────────────────
PM2_ONLINE=false
if command -v pm2 >/dev/null 2>&1; then
  PM2_STATUS=$(pm2 jlist 2>/dev/null | \
    node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');const p=JSON.parse(d||'[]');const z=p.find(x=>x.name==='zapflow-api');console.log(z?z.pm2_env?.status:'not_found')" \
    2>/dev/null || echo "unknown")
  
  if [ "$PM2_STATUS" = "online" ]; then
    log "PM2 zapflow-api: online ✓"
    PM2_ONLINE=true
  else
    warn "PM2 zapflow-api: $PM2_STATUS"
    ISSUES_FOUND=$((ISSUES_FOUND+1))
  fi
else
  warn "PM2 not found"
fi

# ─── 4. Check stale .pid / .lock files ───────────────────────────────────────
STALE_LOCKS=()
for lock_file in "$ROOT_DIR"/*.lock "$ROOT_DIR"/*.pid "$ROOT_DIR"/sessions/*.lock 2>/dev/null; do
  [ -f "$lock_file" ] || continue
  LOCK_AGE=$(find "$lock_file" -mmin +5 2>/dev/null | wc -l)
  if [ "$LOCK_AGE" -gt 0 ]; then
    STALE_LOCKS+=("$lock_file")
    warn "Stale lock found: $lock_file"
    ISSUES_FOUND=$((ISSUES_FOUND+1))
  fi
done

# ─── 5. Check Baileys sessions ────────────────────────────────────────────────
if [ -d "$SESSIONS_DIR" ]; then
  ORPHAN_LOCKS=0
  for lock in "$SESSIONS_DIR"/*/.lock "$SESSIONS_DIR"/*/.write_lock 2>/dev/null; do
    [ -f "$lock" ] || continue
    AGE=$(find "$lock" -mmin +10 2>/dev/null | wc -l)
    if [ "$AGE" -gt 0 ]; then
      ORPHAN_LOCKS=$((ORPHAN_LOCKS+1))
      warn "Orphan session lock: $lock"
    fi
  done
  if [ "$ORPHAN_LOCKS" -gt 0 ]; then
    ISSUES_FOUND=$((ISSUES_FOUND+1))
  fi
fi

# ─── 6. Summarize ─────────────────────────────────────────────────────────────
echo ""
if [ "$ISSUES_FOUND" = "0" ] && ! $FORCE; then
  log "System appears healthy — $ISSUES_FOUND issues found"
  log "Use --force to restart anyway"
  exit 0
fi

warn "Found $ISSUES_FOUND issue(s) — starting recovery"
echo ""

# ─── 7. Recovery actions ──────────────────────────────────────────────────────

# 7a. Clear stale locks
for lock in "${STALE_LOCKS[@]:-}"; do
  [ -n "$lock" ] || continue
  if $DRY_RUN; then
    dryrun "rm -f $lock"
  else
    action "Removing stale lock: $lock"
    rm -f "$lock" 2>/dev/null || true
  fi
done

# 7b. Clear orphan Baileys session locks
if [ -d "$SESSIONS_DIR" ]; then
  for lock in "$SESSIONS_DIR"/*/.lock "$SESSIONS_DIR"/*/.write_lock 2>/dev/null; do
    [ -f "$lock" ] || continue
    AGE=$(find "$lock" -mmin +10 2>/dev/null | wc -l)
    if [ "$AGE" -gt 0 ]; then
      if $DRY_RUN; then
        dryrun "rm -f $lock"
      else
        action "Removing orphan lock: $lock"
        rm -f "$lock" 2>/dev/null || true
      fi
    fi
  done
fi

# 7c. Restart PM2
if ! $BACKEND_HEALTHY || $FORCE; then
  if command -v pm2 >/dev/null 2>&1; then
    if $DRY_RUN; then
      dryrun "pm2 restart zapflow-api"
    else
      action "Restarting PM2..."
      cd "$BACKEND_DIR"
      if pm2 pid zapflow-api >/dev/null 2>&1; then
        pm2 restart ecosystem.config.js --env production --update-env 2>&1 | tail -5
        log "PM2 restarted"
      else
        pm2 start ecosystem.config.js --env production 2>&1 | tail -5
        log "PM2 started"
      fi
      pm2 save --force >/dev/null 2>&1 || true
    fi
  else
    warn "PM2 not available — manual intervention required"
  fi
fi

# 7d. Wait and re-validate
if ! $DRY_RUN; then
  action "Waiting 8s for backend startup..."
  sleep 8

  MAX_TRIES=6
  RECOVERED=false
  for i in $(seq 1 $MAX_TRIES); do
    HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$HEALTH_URL" 2>/dev/null || echo "000")
    if [ "$HTTP" = "200" ]; then
      RECOVERED=true
      break
    fi
    action "Attempt $i/$MAX_TRIES — HTTP $HTTP..."
    sleep 5
  done

  if $RECOVERED; then
    log "Recovery successful — backend healthy ✓"
  else
    err "Recovery failed — backend still not responding at $HEALTH_URL"
    err "Manual intervention required. Check: pm2 logs zapflow-api"
    exit 1
  fi
fi

echo ""
echo "============================================================"
echo -e "${GREEN}  RECOVERY COMPLETE — $(date)${NC}"
echo "  Log: $RECOVERY_LOG"
echo "============================================================"
exit 0
