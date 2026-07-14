#!/bin/bash
# ==============================================================================
# ZAPAI-FINAL — Auto Deploy Script
# Zero-downtime deploy com rollback automático.
#
# Uso:
#   bash deploy/auto-deploy.sh
#   bash deploy/auto-deploy.sh --skip-build     (skip frontend build)
#   bash deploy/auto-deploy.sh --skip-migrate   (skip migrations)
#   bash deploy/auto-deploy.sh --dry-run        (valida sem aplicar)
#
# Fluxo:
#   1. Git pull
#   2. Backend deps
#   3. Migrations
#   4. Frontend build
#   5. TypeScript check
#   6. PM2 restart
#   7. Nginx reload
#   8. Health validation
#   9. Rollback automático se falhar
# ==============================================================================

set -euo pipefail

# ─── Config ───────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend-official"
LOGS_DIR="$ROOT_DIR/logs/deploy"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
LOG_FILE="$LOGS_DIR/deploy_${TIMESTAMP}.log"
BACKEND_PORT="${PORT:-4025}"
HEALTH_URL="http://127.0.0.1:${BACKEND_PORT}/health"
NGINX_URL="http://127.0.0.1"   # via Nginx (porta 80 local ou 3000 Docker)
MAX_HEALTH_RETRIES=12
HEALTH_WAIT_SECONDS=5

# ─── Flags ────────────────────────────────────────────────────────────────────
SKIP_BUILD=false
SKIP_MIGRATE=false
DRY_RUN=false
for arg in "$@"; do
  case $arg in
    --skip-build)   SKIP_BUILD=true ;;
    --skip-migrate) SKIP_MIGRATE=true ;;
    --dry-run)      DRY_RUN=true ;;
  esac
done

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

log()  { echo -e "${GREEN}[✔ $(date +%H:%M:%S)] $*${NC}" | tee -a "$LOG_FILE"; }
warn() { echo -e "${YELLOW}[⚠ $(date +%H:%M:%S)] $*${NC}" | tee -a "$LOG_FILE"; }
err()  { echo -e "${RED}[✖ $(date +%H:%M:%S)] $*${NC}" | tee -a "$LOG_FILE"; }
step() { echo -e "\n${CYAN}━━━ $(date +%H:%M:%S) ▶ $* ━━━${NC}" | tee -a "$LOG_FILE"; }

# ─── Setup ────────────────────────────────────────────────────────────────────
mkdir -p "$LOGS_DIR"
exec > >(tee -a "$LOG_FILE") 2>&1

echo ""
echo "============================================================"
echo -e "${CYAN}  ZAPAI AUTO-DEPLOY — $TIMESTAMP${NC}"
echo "  Root: $ROOT_DIR"
echo "  Skip build: $SKIP_BUILD | Skip migrate: $SKIP_MIGRATE | Dry run: $DRY_RUN"
echo "============================================================"

# ─── Pre-flight checks ────────────────────────────────────────────────────────
step "PRE-FLIGHT"
command -v node   >/dev/null || { err "node not found"; exit 1; }
command -v npm    >/dev/null || { err "npm not found"; exit 1; }
command -v pm2    >/dev/null 2>&1 || warn "pm2 not found — will skip pm2 steps"
command -v nginx  >/dev/null 2>&1 || warn "nginx not found — will skip nginx reload"
command -v git    >/dev/null || { err "git not found"; exit 1; }
log "Node: $(node --version) | npm: $(npm --version)"

if $DRY_RUN; then
  warn "DRY-RUN mode — no changes will be applied"
fi

# ─── Save rollback point ──────────────────────────────────────────────────────
step "1. ROLLBACK POINT"
cd "$ROOT_DIR"
CURRENT_COMMIT="$(git rev-parse HEAD 2>/dev/null || echo 'unknown')"
CURRENT_SHORT="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
log "Current commit: $CURRENT_SHORT ($CURRENT_COMMIT)"

# Snapshot backend dist if it exists
DIST_BACKUP=""
if [ -d "$FRONTEND_DIR/dist" ]; then
  DIST_BACKUP="$FRONTEND_DIR/dist.rollback"
  rm -rf "$DIST_BACKUP"
  cp -r "$FRONTEND_DIR/dist" "$DIST_BACKUP"
  log "Frontend dist snapshot: $DIST_BACKUP"
fi

rollback() {
  err "Deploy failed. Logs do PM2 antes do rollback:"
  if [ -f "$BACKEND_DIR/logs/pm2-error.log" ]; then
    echo "=== PM2 ERROR LOGS ($BACKEND_DIR/logs/pm2-error.log) ==="
    tail -n 40 "$BACKEND_DIR/logs/pm2-error.log" || true
  fi
  if [ -f "$BACKEND_DIR/logs/pm2-out.log" ]; then
    echo "=== PM2 OUT LOGS ($BACKEND_DIR/logs/pm2-out.log) ==="
    tail -n 40 "$BACKEND_DIR/logs/pm2-out.log" || true
  fi

  err "Deploy failed. Rolling back..."
  cd "$ROOT_DIR"
  git reset --hard "$CURRENT_COMMIT" 2>/dev/null || true
  if [ -n "$DIST_BACKUP" ] && [ -d "$DIST_BACKUP" ]; then
    rm -rf "$FRONTEND_DIR/dist"
    mv "$DIST_BACKUP" "$FRONTEND_DIR/dist"
    warn "Frontend dist restored from snapshot"
  fi
  if command -v pm2 >/dev/null 2>&1 && pm2 pid zapflow-api >/dev/null 2>&1; then
    pm2 restart zapflow-api 2>/dev/null || true
    warn "PM2 restarted with previous code"
  fi
  err "Rollback complete. Review $LOG_FILE"
  exit 1
}
trap rollback ERR

# ─── 1. Git pull ──────────────────────────────────────────────────────────────
step "2. GIT PULL"
if $DRY_RUN; then
  warn "[DRY-RUN] Skipping git pull"
else
  git fetch origin main --quiet
  git reset --hard origin/main
  rm -f "$BACKEND_DIR/.env" 2>/dev/null || true
  NEW_SHORT="$(git rev-parse --short HEAD)"
  if [ "$NEW_SHORT" = "$CURRENT_SHORT" ]; then
    log "No changes — already at $NEW_SHORT"
  else
    log "Updated: $CURRENT_SHORT → $NEW_SHORT"
  fi
fi

# ─── 2. Backend dependencies ─────────────────────────────────────────────────
step "3. BACKEND DEPS"
cd "$BACKEND_DIR"
if $DRY_RUN; then
  warn "[DRY-RUN] Skipping npm install"
else
  npm install \
    --production \
    --legacy-peer-deps \
    --prefer-offline \
    --no-audit \
    --no-fund \
    2>&1 | tail -5
  log "Backend deps installed"
fi

# ─── 3. Migrations ────────────────────────────────────────────────────────────
step "4. MIGRATIONS"
if $SKIP_MIGRATE; then
  warn "Migrations skipped (--skip-migrate)"
elif $DRY_RUN; then
  warn "[DRY-RUN] Skipping migrations"
else
  cd "$BACKEND_DIR"
  if [ -f "$ROOT_DIR/.env.production" ]; then
    set -a
    source "$ROOT_DIR/.env.production" 2>/dev/null
    set +a
    
    # Auto-repair: generate and append ENCRYPTION_KEY if it is missing
    if [ -z "${ENCRYPTION_KEY:-}" ] || [ ${#ENCRYPTION_KEY} -lt 32 ]; then
      ENCRYPTION_KEY="$(openssl rand -hex 32)"
      echo "" >> "$ROOT_DIR/.env.production"
      echo "# Auto-healed: added missing ENCRYPTION_KEY on deploy" >> "$ROOT_DIR/.env.production"
      echo "ENCRYPTION_KEY=${ENCRYPTION_KEY}" >> "$ROOT_DIR/.env.production"
      log "Auto-healed: added missing/invalid ENCRYPTION_KEY to .env.production"
      export ENCRYPTION_KEY
    fi
  fi
  node scripts/run-migrations.js
  log "Migrations complete"
fi

# ─── 4. Frontend build ────────────────────────────────────────────────────────
step "5. FRONTEND BUILD"
if $SKIP_BUILD; then
  warn "Frontend build skipped (--skip-build)"
elif $DRY_RUN; then
  warn "[DRY-RUN] Skipping frontend build"
else
  cd "$FRONTEND_DIR"
  # Install dev deps needed for build (vite, tsc, etc.)
  NODE_ENV=development npm install \
    --legacy-peer-deps \
    --prefer-offline \
    --no-audit \
    --no-fund \
    2>&1 | tail -5

  # TypeScript check before build
  echo "  → TypeScript check..."
  if npx tsc --noEmit 2>&1 | tee /tmp/tsc_output.txt | head -20; then
    log "TypeScript: no errors"
  else
    TS_ERRORS=$(wc -l < /tmp/tsc_output.txt)
    err "TypeScript: $TS_ERRORS error(s) — aborting build"
    cat /tmp/tsc_output.txt
    exit 1
  fi

  # Build
  echo "  → Building..."
  NODE_ENV=production VITE_API_URL="${VITE_API_URL:-/}" npx vite build 2>&1 | tail -15
  log "Frontend built: $(find dist/assets -name '*.js' 2>/dev/null | wc -l) JS chunks"

  # Validate build artifact
  [ -f "$FRONTEND_DIR/dist/index.html" ] || { err "dist/index.html missing"; exit 1; }
fi

# ─── 5. PM2 restart ──────────────────────────────────────────────────────────
step "6. PM2 RESTART"
if $DRY_RUN; then
  warn "[DRY-RUN] Skipping PM2 restart"
elif command -v pm2 >/dev/null 2>&1; then
  cd "$BACKEND_DIR"
  
  # Stop PM2 first so it cannot immediately respawn a listener that becomes
  # orphaned when the tracked process is deleted.
  pm2 stop zapflow-api >/dev/null 2>&1 || true
  pm2 delete zapflow-api >/dev/null 2>&1 || true
  sleep 1

  ZOMBIE_PID=$(lsof -t -iTCP:${BACKEND_PORT:-4025} -sTCP:LISTEN 2>/dev/null || netstat -lnp 2>/dev/null | grep ":${BACKEND_PORT:-4025} " | awk '{print $7}' | cut -d'/' -f1 | grep -E '^[0-9]+$' || true)
  if [ -n "$ZOMBIE_PID" ]; then
    warn "Porta ${BACKEND_PORT:-4025} ocupada pelo PID $ZOMBIE_PID. Encerrando processo zumbi..."
    kill -TERM $ZOMBIE_PID 2>/dev/null || true
    sleep 3
    kill -0 $ZOMBIE_PID 2>/dev/null && kill -KILL $ZOMBIE_PID 2>/dev/null || true
  fi

  pm2 start ecosystem.config.js --env production
  log "PM2: zapflow-api started fresh"
  pm2 save --force >/dev/null 2>&1 || true
else
  warn "PM2 not available — skipping restart"
fi

# ─── 6. Nginx reload ─────────────────────────────────────────────────────────
step "7. NGINX RELOAD"
if $DRY_RUN; then
  warn "[DRY-RUN] Skipping nginx reload"
else
  # Importa o módulo do Nginx para executar o motor de auto-cura e auto-detecção
  # shellcheck disable=SC1090
  if [ -f "$ROOT_DIR/deploy/lib/nginx.sh" ]; then
    # Garante que as funções auxiliares de log existam no escopo antes do source
    type log >/dev/null 2>&1 || log() { echo "  [✔] $*"; }
    type warn >/dev/null 2>&1 || warn() { echo "  [⚠] $*"; }
    type err >/dev/null 2>&1 || err() { echo "  [✖] $*"; }
    
    source "$ROOT_DIR/deploy/lib/nginx.sh"
    deploy_nginx_auto_heal
    log "Nginx/OpenResty auto-detectado e ativo"
  else
    warn "nginx.sh library não encontrada — pulando auto-cura"
  fi
fi

# ─── 7. Health validation ─────────────────────────────────────────────────────
step "8. HEALTH CHECK"
if $DRY_RUN; then
  warn "[DRY-RUN] Skipping health check"
else
  echo "  → Waiting for backend to accept connections..."
  sleep 5

  HEALTH_OK=false
  for i in $(seq 1 $MAX_HEALTH_RETRIES); do
    HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$HEALTH_URL" 2>/dev/null || echo "000")
    if [ "$HTTP" = "200" ]; then
      HEALTH_OK=true
      log "Backend /health: 200 OK (attempt $i)"
      break
    fi
    echo "  → Attempt $i/$MAX_HEALTH_RETRIES — HTTP $HTTP, waiting ${HEALTH_WAIT_SECONDS}s..."
    sleep $HEALTH_WAIT_SECONDS
  done

  if [ "$HEALTH_OK" != "true" ]; then
    err "Backend health check failed after $MAX_HEALTH_RETRIES attempts"
    rollback
  fi

  # Validate API health envelope
  HEALTH_JSON=$(curl -s --max-time 5 "$HEALTH_URL" 2>/dev/null || echo "{}")
  if echo "$HEALTH_JSON" | grep -q '"success":true'; then
    log "Health envelope: success=true ✓"
  else
    warn "Health envelope may be non-standard: $(echo "$HEALTH_JSON" | head -c 200)"
  fi

  # WebSocket endpoint reachable (HTTP upgrade check via curl)
  WS_HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
    --max-time 5 -H "Upgrade: websocket" -H "Connection: Upgrade" \
    "http://127.0.0.1:${BACKEND_PORT:-4025}/socket.io/" 2>/dev/null || echo "000")
  if [ "$WS_HTTP" != "000" ]; then
    log "WebSocket endpoint: HTTP $WS_HTTP (reachable) ✓"
  else
    warn "WebSocket endpoint unreachable — check nginx /socket.io/ proxy"
  fi

  # PostgreSQL connectivity
  if command -v psql >/dev/null 2>&1; then
    if PGPASSWORD="${POSTGRES_PASSWORD:-}" psql \
        -h "${POSTGRES_HOST:-localhost}" \
        -U "${POSTGRES_USER:-zapai}" \
        -d "${POSTGRES_DB:-zapai_crm}" \
        -c 'SELECT 1' >/dev/null 2>&1; then
      log "PostgreSQL: connection OK ✓"
    else
      warn "PostgreSQL: connection failed — check .env.production credentials"
    fi
  fi

  # Redis ping
  if command -v redis-cli >/dev/null 2>&1; then
    if redis-cli ping 2>/dev/null | grep -q PONG; then
      log "Redis: PONG ✓"
    else
      warn "Redis: not responding"
    fi
  fi

  # Nginx config validity
  if nginx -t 2>/dev/null; then
    log "Nginx: config valid ✓"
  else
    warn "Nginx: config test failed — run: nginx -t"
  fi

  # Frontend dist exists
  DIST_INDEX="$FRONTEND_DIR/dist/index.html"
  if [ -f "$DIST_INDEX" ]; then
    DIST_SIZE=$(du -sh "$FRONTEND_DIR/dist" 2>/dev/null | cut -f1)
    log "Frontend dist: present ($DIST_SIZE) ✓"
  else
    warn "Frontend dist/index.html missing — build may have failed"
  fi
fi

# ─── 8. Save release snapshot (for rollback) ─────────────────────────────────
step "9. SAVE RELEASE SNAPSHOT"
RELEASES_DIR="$ROOT_DIR/releases"
RELEASES_CURRENT="$RELEASES_DIR/current"
RELEASES_PREVIOUS="$RELEASES_DIR/previous"
RELEASES_TIMESTAMPS="$RELEASES_DIR/timestamps"
mkdir -p "$RELEASES_CURRENT" "$RELEASES_PREVIOUS" "$RELEASES_TIMESTAMPS"

NEW_COMMIT="$(git rev-parse HEAD 2>/dev/null || echo 'unknown')"
NEW_TS="$(date +%Y%m%d_%H%M%S)"

if ! $DRY_RUN; then
  # Rotate: current → previous
  if [ -f "$RELEASES_CURRENT/commit" ]; then
    PREV_COMMIT="$(cat "$RELEASES_CURRENT/commit")"
    PREV_TS="$(cat "$RELEASES_CURRENT/timestamp" 2>/dev/null || echo 'unknown')"
    mkdir -p "$RELEASES_TIMESTAMPS/$PREV_TS"
    cp "$RELEASES_CURRENT/commit"    "$RELEASES_TIMESTAMPS/$PREV_TS/" 2>/dev/null || true
    cp "$RELEASES_CURRENT/timestamp" "$RELEASES_TIMESTAMPS/$PREV_TS/" 2>/dev/null || true
    [ -d "$RELEASES_CURRENT/dist" ] && cp -r "$RELEASES_CURRENT/dist" "$RELEASES_TIMESTAMPS/$PREV_TS/" 2>/dev/null || true
    rm -rf "$RELEASES_PREVIOUS"
    cp -r "$RELEASES_CURRENT" "$RELEASES_PREVIOUS" 2>/dev/null || true
    log "Previous release archived: $PREV_COMMIT"
  fi

  # Save new current
  echo "$NEW_COMMIT" > "$RELEASES_CURRENT/commit"
  echo "$NEW_TS"     > "$RELEASES_CURRENT/timestamp"
  if [ -d "$FRONTEND_DIR/dist" ]; then
    DIST_SIZE=$(du -sm "$FRONTEND_DIR/dist" 2>/dev/null | cut -f1 || echo "999")
    if [ "$DIST_SIZE" -lt 100 ]; then
      rm -rf "$RELEASES_CURRENT/dist"
      cp -r "$FRONTEND_DIR/dist" "$RELEASES_CURRENT/dist"
    fi
  fi
  log "Release snapshot: $NEW_COMMIT at $NEW_TS"

  # Keep only last 5 timestamp archives
  ls -1t "$RELEASES_TIMESTAMPS"/ 2>/dev/null | tail -n +6 | xargs -I{} rm -rf "$RELEASES_TIMESTAMPS/{}" 2>/dev/null || true
fi

# ─── 9. Cleanup ──────────────────────────────────────────────────────────────
step "10. CLEANUP"
# Remove dist.rollback snapshot (releases/ now owns rollback artifacts)
rm -rf "$FRONTEND_DIR/dist.rollback" 2>/dev/null || true

# Rotate old deploy logs (keep last 30)
if [ -d "$LOGS_DIR" ]; then
  ls -1t "$LOGS_DIR"/deploy_*.log 2>/dev/null | tail -n +31 | xargs rm -f 2>/dev/null || true
fi


echo ""
echo "============================================================"
echo -e "${GREEN}  ✨ DEPLOY CONCLUÍDO — $(date +%H:%M:%S) ✨${NC}"
echo "  Commit: $(git rev-parse --short HEAD 2>/dev/null)"
echo "  Log: $LOG_FILE"
echo "  Health: $HEALTH_URL"
echo "============================================================"

trap - ERR
exit 0
