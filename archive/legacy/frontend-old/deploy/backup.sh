#!/bin/bash

# ============================================================================
# BACKUP.SH - BACKUP DEPLOYMENT
# ============================================================================

set -e

APP_DIR="/opt/zapai-frontend"
BACKUP_DIR="/opt/zapai-backup"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "=========================================="
echo "ZAPAI FRONTEND - BACKUP"
echo "=========================================="
echo ""

mkdir -p $BACKUP_DIR

cd $APP_DIR

# Create backup
echo "[1/3] Creating backup..."
docker-compose -f deploy/docker-compose.yml exec frontend tar -czf /tmp/backup-$TIMESTAMP.tar.gz /usr/share/nginx/html
cp /tmp/backup-$TIMESTAMP.tar.gz $BACKUP_DIR/
echo "Backup saved to $BACKUP_DIR/backup-$TIMESTAMP.tar.gz"

# Clean old backups (keep last 7)
echo "[2/3] Cleaning old backups..."
cd $BACKUP_DIR
ls -t backup-*.tar.gz | tail -n +8 | xargs -r rm --

# List backups
echo "[3/3] Available backups:"
ls -lh $BACKUP_DIR/backup-*.tar.gz

echo "=========================================="
echo "BACKUP COMPLETE!"
echo "=========================================="
