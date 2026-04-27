#!/bin/bash

# ============================================================================
# UPDATE.SH - UPDATE DEPLOYMENT
# ============================================================================

set -e

echo "=========================================="
echo "ZAPAI FRONTEND - UPDATE"
echo "=========================================="
echo ""

APP_DIR="/opt/zapai-frontend"
BACKUP_DIR="/opt/zapai-backup"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

cd $APP_DIR

# Backup current deployment
echo "[1/5] Creating backup..."
mkdir -p $BACKUP_DIR
docker-compose -f deploy/docker-compose.yml exec frontend tar -czf /tmp/backup-$TIMESTAMP.tar.gz /usr/share/nginx/html
cp /tmp/backup-$TIMESTAMP.tar.gz $BACKUP_DIR/
echo "Backup saved to $BACKUP_DIR/backup-$TIMESTAMP.tar.gz"

# Pull latest changes
echo "[2/5] Pulling latest changes..."
git pull

# Rebuild
echo "[3/5] Rebuilding Docker image..."
docker-compose -f deploy/docker-compose.yml build

# Restart
echo "[4/5] Restarting container..."
docker-compose -f deploy/docker-compose.yml up -d

# Wait for health check
echo "[5/5] Waiting for health check..."
sleep 10

# Check health
if curl -f http://localhost/health; then
    echo "Update successful!"
else
    echo "Health check failed! Auto rollback is disabled for locked releases."
    echo "Investigate and run manual rollback only if explicitly approved."
    exit 1
fi

echo "=========================================="
echo "UPDATE COMPLETE!"
echo "=========================================="
