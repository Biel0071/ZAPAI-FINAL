#!/bin/bash
# Setup monitoramento 72h ZAPFLOW
# Executar uma vez na VPS

DEPLOY_DIR="/root/ZAPAI-FINAL/deploy"
LOG_DIR="/root/ZAPAI-FINAL/logs"

chmod +x "$DEPLOY_DIR/monitor-72h.sh"
chmod +x "$DEPLOY_DIR/health-check.sh"
mkdir -p "$LOG_DIR"

# Adicionar cron job se nao existir
CRON_JOB="*/5 * * * * $DEPLOY_DIR/monitor-72h.sh"
(crontab -l 2>/dev/null | grep -v "monitor-72h" ; echo "$CRON_JOB") | crontab -

echo "Monitoramento configurado:"
echo "  - Health check manual: $DEPLOY_DIR/health-check.sh"
echo "  - Monitor automatico: $DEPLOY_DIR/monitor-72h.sh (a cada 5 min)"
echo "  - Logs: $LOG_DIR/"
echo ""
echo "Verificar status:"
echo "  docker ps"
echo "  tail -f $LOG_DIR/alerts.log"
