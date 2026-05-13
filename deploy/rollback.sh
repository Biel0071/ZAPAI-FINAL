#!/bin/bash
# ==============================================================================
# ZAPAI — Rollback Script
#
# Reverte para o release anterior se o deploy falhar.
# Mantém estrutura releases/ com current/ e previous/ snapshots.
#
# Uso:
#   bash deploy/rollback.sh                  (rollback para previous/)
#   bash deploy/rollback.sh --commit=<sha>   (rollback para commit específico)
#   bash deploy/rollback.sh --list           (listar releases disponíveis)
# ==============================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RELEASES_DIR="$ROOT_DIR/releases"
CURRENT_DIR="$RELEASES_DIR/current"
PREVIOUS_DIR="$RELEASES_DIR/previous"
TIMESTAMPS_DIR="$RELEASES_DIR/timestamps"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend-official"
PORT="${PORT:-4025}"
HEALTH_URL="http://127.0.0.1:${PORT}/health"

TARGET_COMMIT=""
LIST_ONLY=false

for arg in "$@"; do
  case $arg in
    --commit=*) TARGET_COMMIT="${arg#*=}" ;;
    --list)     LIST_ONLY=true ;;
  esac
done

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${GREEN}[ROLLBACK $(date +%H:%M:%S)] ✔ $*${NC}"; }
warn() { echo -e "${YELLOW}[ROLLBACK $(date +%H:%M:%S)] ⚠ $*${NC}"; }
err()  { echo -e "${RED}[ROLLBACK $(date +%H:%M:%S)] ✖ $*${NC}"; }
step() { echo -e "\n${CYAN}━━━ $* ━━━${NC}"; }

mkdir -p "$CURRENT_DIR" "$PREVIOUS_DIR" "$TIMESTAMPS_DIR"

# ─── List releases ────────────────────────────────────────────────────────────
if $LIST_ONLY; then
  echo ""
  echo "  Available release snapshots:"
  echo "  ─────────────────────────────"
  if [ -f "$CURRENT_DIR/commit" ]; then
    CURR="$(cat "$CURRENT_DIR/commit")"
    CURR_TS="$(cat "$CURRENT_DIR/timestamp" 2>/dev/null || echo 'unknown')"
    echo "  CURRENT:  $CURR ($CURR_TS)"
  fi
  if [ -f "$PREVIOUS_DIR/commit" ]; then
    PREV="$(cat "$PREVIOUS_DIR/commit")"
    PREV_TS="$(cat "$PREVIOUS_DIR/timestamp" 2>/dev/null || echo 'unknown')"
    echo "  PREVIOUS: $PREV ($PREV_TS)"
  fi
  echo "  ─────────────────────────────"
  ls "$TIMESTAMPS_DIR"/ 2>/dev/null | sort -r | head -10 | while read -r f; do
    echo "  ARCHIVE:  $f"
  done
  exit 0
fi

# ─── Determine rollback target ─────────────────────────────────────────────────
step "ROLLBACK TARGET"

ROLLBACK_COMMIT=""
ROLLBACK_DIST=""

if [ -n "$TARGET_COMMIT" ]; then
  ROLLBACK_COMMIT="$TARGET_COMMIT"
  log "Target: explicit commit $ROLLBACK_COMMIT"
elif [ -f "$PREVIOUS_DIR/commit" ]; then
  ROLLBACK_COMMIT="$(cat "$PREVIOUS_DIR/commit")"
  ROLLBACK_DIST="$PREVIOUS_DIR/dist"
  ROLLBACK_TS="$(cat "$PREVIOUS_DIR/timestamp" 2>/dev/null || echo 'unknown')"
  log "Target: previous release $ROLLBACK_COMMIT ($ROLLBACK_TS)"
else
  # Try git log
  ROLLBACK_COMMIT="$(git -C "$ROOT_DIR" log --oneline | sed -n '2p' | awk '{print $1}')"
  if [ -z "$ROLLBACK_COMMIT" ]; then
    err "No previous release found in releases/ and no git history"
    exit 1
  fi
  warn "No releases/previous/ snapshot — using git history: $ROLLBACK_COMMIT"
fi

CURRENT_COMMIT="$(git -C "$ROOT_DIR" rev-parse HEAD 2>/dev/null || echo 'unknown')"
log "Current: $CURRENT_COMMIT → Rollback: $ROLLBACK_COMMIT"

# ─── Git rollback ─────────────────────────────────────────────────────────────
step "GIT RESET"
cd "$ROOT_DIR"
git reset --hard "$ROLLBACK_COMMIT" 2>/dev/null || {
  err "git reset --hard $ROLLBACK_COMMIT failed"
  exit 1
}
log "Git: now at $(git rev-parse --short HEAD)"

# ─── Restore frontend dist snapshot ───────────────────────────────────────────
step "FRONTEND DIST"
if [ -n "$ROLLBACK_DIST" ] && [ -d "$ROLLBACK_DIST" ]; then
  rm -rf "$FRONTEND_DIR/dist"
  cp -r "$ROLLBACK_DIST" "$FRONTEND_DIR/dist"
  log "Frontend dist restored from releases/previous/dist"
elif [ -d "$FRONTEND_DIR/dist.rollback" ]; then
  rm -rf "$FRONTEND_DIR/dist"
  mv "$FRONTEND_DIR/dist.rollback" "$FRONTEND_DIR/dist"
  log "Frontend dist restored from dist.rollback snapshot"
else
  warn "No dist snapshot available — PM2 will restart with current dist"
fi

# ─── Reinstall backend deps ───────────────────────────────────────────────────
step "BACKEND DEPS"
cd "$BACKEND_DIR"
npm install --production --prefer-offline --no-audit --no-fund 2>&1 | tail -3
log "Backend deps reinstalled for $ROLLBACK_COMMIT"

# ─── PM2 restart ──────────────────────────────────────────────────────────────
step "PM2 RESTART"
if command -v pm2 >/dev/null 2>&1; then
  if pm2 pid zapflow-api >/dev/null 2>&1; then
    pm2 restart ecosystem.config.js --env production --update-env 2>&1 | tail -5
  else
    pm2 start ecosystem.config.js --env production 2>&1 | tail -5
  fi
  pm2 save --force >/dev/null 2>&1 || true
  log "PM2 restarted"
else
  warn "PM2 not found — restart manually"
fi

# ─── Nginx reload ─────────────────────────────────────────────────────────────
step "NGINX RELOAD"
if command -v nginx >/dev/null 2>&1 && nginx -t 2>/dev/null; then
  systemctl reload nginx 2>/dev/null || nginx -s reload 2>/dev/null || true
  log "Nginx reloaded"
fi

# ─── Health check ─────────────────────────────────────────────────────────────
step "HEALTH CHECK"
sleep 6
HEALTH_OK=false
for i in $(seq 1 8); do
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$HEALTH_URL" 2>/dev/null || echo "000")
  if [ "$HTTP" = "200" ]; then
    HEALTH_OK=true
    log "Health: 200 OK (attempt $i)"
    break
  fi
  echo "  Attempt $i/8 — HTTP $HTTP..."
  sleep 5
done

echo ""
if $HEALTH_OK; then
  echo "============================================================"
  log "ROLLBACK SUCCESSFUL — running at $ROLLBACK_COMMIT"
  echo "============================================================"
else
  err "Health check failed after rollback — manual intervention required"
  err "Check: pm2 logs zapflow-api && pm2 status"
  exit 1
fi

# ─── Helpers: save / rotate releases ─────────────────────────────────────────
# These functions are called by auto-deploy.sh to manage the releases/ dir.
# They're exported here for use by watcher/deploy scripts.
save_release_snapshot() {
  local commit="$1"
  local timestamp
  timestamp="$(date +%Y%m%d_%H%M%S)"

  # Rotate: previous → archive
  if [ -f "$CURRENT_DIR/commit" ]; then
    local prev_commit
    prev_commit="$(cat "$CURRENT_DIR/commit")"
    local prev_ts
    prev_ts="$(cat "$CURRENT_DIR/timestamp" 2>/dev/null || echo 'unknown')"

    mkdir -p "$TIMESTAMPS_DIR/$prev_ts"
    [ -f "$CURRENT_DIR/commit" ]    && cp "$CURRENT_DIR/commit"    "$TIMESTAMPS_DIR/$prev_ts/"
    [ -f "$CURRENT_DIR/timestamp" ] && cp "$CURRENT_DIR/timestamp" "$TIMESTAMPS_DIR/$prev_ts/"
    [ -d "$CURRENT_DIR/dist" ]      && cp -r "$CURRENT_DIR/dist"   "$TIMESTAMPS_DIR/$prev_ts/" 2>/dev/null || true

    # Move current → previous
    rm -rf "$PREVIOUS_DIR"
    cp -r "$CURRENT_DIR" "$PREVIOUS_DIR" 2>/dev/null || true
    [ -f "$PREVIOUS_DIR/commit" ] && log "Previous release saved: $prev_commit"
  fi

  # Save new current
  echo "$commit"    > "$CURRENT_DIR/commit"
  echo "$timestamp" > "$CURRENT_DIR/timestamp"

  # Save dist snapshot (lightweight — only if < 100MB)
  if [ -d "$FRONTEND_DIR/dist" ]; then
    DIST_SIZE=$(du -sm "$FRONTEND_DIR/dist" 2>/dev/null | cut -f1 || echo "999")
    if [ "$DIST_SIZE" -lt 100 ]; then
      rm -rf "$CURRENT_DIR/dist"
      cp -r "$FRONTEND_DIR/dist" "$CURRENT_DIR/dist"
    fi
  fi

  # Keep only last 5 timestamp archives
  ls -1t "$TIMESTAMPS_DIR"/ 2>/dev/null | tail -n +6 | xargs -I{} rm -rf "$TIMESTAMPS_DIR/{}" 2>/dev/null || true

  log "Release snapshot saved: $commit at $timestamp"
}
