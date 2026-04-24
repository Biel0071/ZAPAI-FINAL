#!/bin/bash

# ============================================================================
# ROLLBACK.SH - ROLLBACK DEPLOYMENT
# ============================================================================

set -e

APP_DIR="/opt/zapai-frontend"
BACKUP_DIR="/opt/zapai-backup"

echo "=========================================="
echo "ZAPAI FRONTEND - ROLLBACK"
echo "=========================================="
echo ""

# List backups
echo "Available backups:"
ls -lh $BACKUP_DIR/backup-*.tar.gz

echo ""
read -p "Enter backup file name: " BACKUP_FILE

if [ ! -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
    echo "Backup file not found!"
    exit 1
fi

cd $APP_DIR

# Stop container
echo "[1/4] Stopping container..."
docker-compose -f deploy/docker-compose.yml down

# Restore backup
echo "[2/4] Restoring backup..."
docker run --rm -v $BACKUP_DIR:/backup -v $APP_DIR/dist:/target alpine tar -xzf /backup/$BACKUP_FILE -C /target --strip-components=2

# Start container
echo "[3/4] Starting container..."
docker-compose -f deploy/docker-compose.yml up -d

# Wait for health check
echo "[4/4] Waiting for health check..."
sleep 10

if curl -f http://localhost/health; then
    echo "Rollback successful!"
else
    echo "Health check failed!"
    exit 1
fi

echo "=========================================="
echo "ROLLBACK COMPLETE!"
echo "=========================================="
