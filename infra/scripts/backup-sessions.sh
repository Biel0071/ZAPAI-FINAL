#!/bin/bash
# Backup automático das sessões WhatsApp (Baileys)
# Adicionar ao crontab: 0 */6 * * * /opt/zapai/infra/scripts/backup-sessions.sh

BACKUP_DIR="/opt/zapai/backups/sessions"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
KEEP_DAYS=7

mkdir -p "$BACKUP_DIR"

echo "[SESSIONS-BACKUP] Iniciando backup $TIMESTAMP"

docker run --rm \
  -v zapai_sessions:/data:ro \
  -v "$BACKUP_DIR":/backup \
  alpine tar czf "/backup/sessions-$TIMESTAMP.tar.gz" -C /data . 2>&1

find "$BACKUP_DIR" -name "sessions-*.tar.gz" -mtime +$KEEP_DAYS -delete

echo "[SESSIONS-BACKUP] Concluído. Arquivo: sessions-$TIMESTAMP.tar.gz"
