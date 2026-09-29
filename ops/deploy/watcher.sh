#!/bin/bash
# ==============================================================================
# ZAPAI — Git Commit Watcher / Auto-Deploy Trigger
#
# Detecta novos commits no GitHub e dispara auto-deploy.sh automaticamente.
# Roda via cron (*/2) OU via systemd timer (zapai-watcher.timer).
#
# NÃO executa deploy simultâneo (lockfile em /tmp/zapai-deploy.lock).
# Logs em: $ROOT_DIR/logs/deploy/watcher.log
# ==============================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOCK_FILE="/tmp/zapai-deploy.lock"
WATCHER_STATE="$ROOT_DIR/logs/deploy/.watcher_state"
DEPLOY_LOG_DIR="$ROOT_DIR/logs/deploy"
BRANCH="${DEPLOY_BRANCH:-main}"
REMOTE="${DEPLOY_REMOTE:-origin}"

mkdir -p "$DEPLOY_LOG_DIR"

ts() { date '+%Y-%m-%d %H:%M:%S'; }
log()  { echo "[$(ts)] ✔ $*"; }
warn() { echo "[$(ts)] ⚠ $*"; }
err()  { echo "[$(ts)] ✖ $*"; }

# ─── 1. Check git is available ────────────────────────────────────────────────
if ! command -v git >/dev/null 2>&1; then
  err "git not found"
  exit 1
fi

if [ ! -d "$ROOT_DIR/.git" ]; then
  err "Not a git repository: $ROOT_DIR"
  exit 1
fi

cd "$ROOT_DIR"

# ─── 2. Fetch remote refs (quiet, no merge) ───────────────────────────────────
if ! git fetch "$REMOTE" "$BRANCH" --quiet 2>/dev/null; then
  warn "git fetch failed — no internet or remote unreachable"
  exit 0
fi

# ─── 3. Compare local vs remote ───────────────────────────────────────────────
LOCAL_SHA="$(git rev-parse HEAD 2>/dev/null || echo 'unknown')"
REMOTE_SHA="$(git rev-parse "$REMOTE/$BRANCH" 2>/dev/null || echo 'none')"

if [ "$LOCAL_SHA" = "$REMOTE_SHA" ]; then
  # Already up to date — log once per hour to avoid filling the log
  LAST_OK="$(cat "$WATCHER_STATE" 2>/dev/null || echo '0')"
  NOW="$(date +%s)"
  if [ $((NOW - LAST_OK)) -gt 3600 ]; then
    log "Up to date at $LOCAL_SHA — no deploy needed"
    echo "$NOW" > "$WATCHER_STATE"
  fi
  exit 0
fi

log "New commit detected: $LOCAL_SHA → $REMOTE_SHA"
log "Triggering deploy..."

# ─── 4. Lockfile — prevent concurrent deploys ─────────────────────────────────
if [ -f "$LOCK_FILE" ]; then
  LOCK_PID="$(cat "$LOCK_FILE" 2>/dev/null || echo '')"
  if [ -n "$LOCK_PID" ] && kill -0 "$LOCK_PID" 2>/dev/null; then
    warn "Deploy already running (PID $LOCK_PID) — skipping"
    exit 0
  else
    warn "Stale lockfile found (PID $LOCK_PID not running) — removing"
    rm -f "$LOCK_FILE"
  fi
fi

# Write lockfile with current PID
echo "$$" > "$LOCK_FILE"

cleanup_lock() {
  rm -f "$LOCK_FILE"
}
trap cleanup_lock EXIT

# ─── 5. Execute deploy ────────────────────────────────────────────────────────
DEPLOY_SCRIPT="$SCRIPT_DIR/auto-deploy.sh"

if [ ! -f "$DEPLOY_SCRIPT" ]; then
  err "auto-deploy.sh not found at $DEPLOY_SCRIPT"
  exit 1
fi

log "Running: bash $DEPLOY_SCRIPT"
DEPLOY_START="$(date +%s)"

if bash "$DEPLOY_SCRIPT" 2>&1; then
  DEPLOY_END="$(date +%s)"
  DEPLOY_DURATION=$((DEPLOY_END - DEPLOY_START))
  log "Deploy SUCCESS in ${DEPLOY_DURATION}s — now at $REMOTE_SHA"
  echo "$(date +%s)" > "$WATCHER_STATE"
else
  DEPLOY_END="$(date +%s)"
  DEPLOY_DURATION=$((DEPLOY_END - DEPLOY_START))
  err "Deploy FAILED after ${DEPLOY_DURATION}s — rollback should have been triggered"
  err "Check: $DEPLOY_LOG_DIR/"
  exit 1
fi
