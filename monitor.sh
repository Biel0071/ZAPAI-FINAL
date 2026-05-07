#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/ZAPAI-FINAL}"
BACKEND_PORT="${BACKEND_PORT:-4025}"
PM2_PROCESS="${PM2_PROCESS:-zapai-backend}"
LOG_DIR="$APP_DIR/logs"
MONITOR_LOG="$LOG_DIR/monitor.log"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${BACKEND_PORT}/health}"
FULL_HEALTH_URL="${FULL_HEALTH_URL:-http://127.0.0.1:${BACKEND_PORT}/health/full}"
FAIL_COUNT_FILE="/tmp/zapai-monitor-fail-count"

mkdir -p "$LOG_DIR"
touch "$MONITOR_LOG"

log() {
  echo "[MONITOR][$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$MONITOR_LOG"
}

restart_backend() {
  log "Reiniciando PM2: $PM2_PROCESS"
  if pm2 describe "$PM2_PROCESS" >/dev/null 2>&1; then
    pm2 restart "$PM2_PROCESS" --update-env >> "$MONITOR_LOG" 2>&1
  else
    APP_DIR="$APP_DIR" pm2 start "$APP_DIR/deploy/ecosystem.config.js" --env production --only "$PM2_PROCESS" >> "$MONITOR_LOG" 2>&1
  fi
  pm2 save >> "$MONITOR_LOG" 2>&1 || true
}

code="$(curl -s -o /tmp/zapai-monitor-health.out -w '%{http_code}' --max-time 10 "$HEALTH_URL" || echo '000')"
full_code="$(curl -s -o /tmp/zapai-monitor-full-health.out -w '%{http_code}' --max-time 10 "$FULL_HEALTH_URL" || echo '000')"

if [ "$code" = "200" ] && [ "$full_code" = "200" ]; then
  rm -f "$FAIL_COUNT_FILE"
  log "OK healthcheck HTTP 200 full=200"
  exit 0
fi

log "FALHA healthcheck HTTP=$code full=$full_code URL=$HEALTH_URL"
cat /tmp/zapai-monitor-health.out >> "$MONITOR_LOG" 2>/dev/null || true
cat /tmp/zapai-monitor-full-health.out >> "$MONITOR_LOG" 2>/dev/null || true

fail_count="$(( $(cat "$FAIL_COUNT_FILE" 2>/dev/null || echo 0) + 1 ))"
echo "$fail_count" > "$FAIL_COUNT_FILE"
log "Falhas consecutivas: $fail_count/3"

if [ "$fail_count" -lt 3 ]; then
  exit 0
fi

restart_backend

sleep 10
code_after="$(curl -s -o /tmp/zapai-monitor-health-after.out -w '%{http_code}' --max-time 10 "$HEALTH_URL" || echo '000')"

if [ "$code_after" = "200" ]; then
  rm -f "$FAIL_COUNT_FILE"
  log "RECUPERADO após restart HTTP 200"
  exit 0
fi

log "CRÍTICO backend não recuperou após restart HTTP=$code_after"
pm2 logs "$PM2_PROCESS" --lines 60 --nostream >> "$MONITOR_LOG" 2>&1 || true
exit 1
