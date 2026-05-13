#!/bin/bash

# ============================================================================
# ZAPAI - Initialize Database in Docker Container
# ============================================================================
# Usage: bash deploy/init-database-container.sh
# ============================================================================

set -e

echo "=========================================="
echo "ZAPAI DATABASE INITIALIZATION (DOCKER)"
echo "=========================================="
echo ""

# Check if backend container is running
if ! docker ps | grep -q "zapai-backend"; then
    echo "Error: Backend container is not running"
    echo "Run: docker compose up -d backend"
    exit 1
fi

echo "Running database initialization..."
docker exec zapai-backend node scripts/init-database.js

echo ""
echo "Running admin seed..."
docker exec zapai-backend node scripts/seed-admin.js

echo ""
echo "=========================================="
echo "DATABASE INITIALIZATION COMPLETE"
echo "=========================================="
