#!/bin/bash
# ZAPFLOW - Monitoramento 72h de estabilidade
# Executar via cron: */5 * * * * /root/ZAPAI-FINAL/deploy/monitor-72h.sh

LOG_DIR="/root/ZAPAI-FINAL/logs"
mkdir -p "$LOG_DIR"

TIMESTAMP=$(date -Iseconds)
ALERT_LOG="$LOG_DIR/alerts.log"
STATUS_LOG="$LOG_DIR/status.log"

HEALTH=$(curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:4025/api/health || echo "000")
FRONTEND=$(curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/ || echo "000")
NGINX=$(curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1/ || echo "000")

MEMORY=$(docker stats --no-stream --format "{{.MemUsage}}" zapai-backend 2>/dev/null || echo "N/A")
CPU=$(docker stats --no-stream --format "{{.CPUPerc}}" zapai-backend 2>/dev/null || echo "N/A")

# Log status
printf "%s | health=%s frontend=%s nginx=%s mem=%s cpu=%s\n" "$TIMESTAMP" "$HEALTH" "$FRONTEND" "$NGINX" "$MEMORY" "$CPU" >> "$STATUS_LOG"

# Alertas
if [ "$HEALTH" != "200" ]; then
  printf "%s | ALERTA: Backend health retornou %s\n" "$TIMESTAMP" "$HEALTH" >> "$ALERT_LOG"
fi

if [ "$NGINX" != "200" ]; then
  printf "%s | ALERTA: Nginx frontend retornou %s\n" "$TIMESTAMP" "$NGINX" >> "$ALERT_LOG"
fi

# Checagem de memory leak (backend > 500MB RSS)
RSS_MB=$(docker stats --no-stream --format "{{.MemUsage}}" zapai-backend 2>/dev/null | grep -oP '^[0-9.]+' | head -1)
if [ -n "$RSS_MB" ] && [ "${RSS_MB%.*}" -gt 500 ] 2>/dev/null; then
  printf "%s | ALERTA: Backend memory alta: %s\n" "$TIMESTAMP" "$RSS_MB" >> "$ALERT_LOG"
fi

# Rotatelog status (manter ultimas 10000 linhas)
tail -n 10000 "$STATUS_LOG" > "$STATUS_LOG.tmp" && mv "$STATUS_LOG.tmp" "$STATUS_LOG"
tail -n 1000 "$ALERT_LOG" > "$ALERT_LOG.tmp" && mv "$ALERT_LOG.tmp" "$ALERT_LOG"
