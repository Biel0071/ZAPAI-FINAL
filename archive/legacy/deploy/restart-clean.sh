#!/bin/bash

# ============================================================================
# RESTART LIMPO DOCKER - BACKEND PRODUÇÃO
# ============================================================================

set -e

echo "=========================================="
echo "ZAPAI BACKEND - RESTART LIMPO"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Step 1: Stop containers
echo -e "${YELLOW}[1/6] Parando containers...${NC}"
docker compose down || true

# Step 2: Clean up
echo -e "${YELLOW}[2/6] Limpando recursos antigos...${NC}"
docker system prune -f --volumes || true

# Step 3: Pull latest code
echo -e "${YELLOW}[3/6] Pulling latest code...${NC}"
git pull origin main || echo "No git repo or pull failed, continuing..."

# Step 4: Build
echo -e "${YELLOW}[4/6] Building containers...${NC}"
docker compose build backend

# Step 5: Start
echo -e "${YELLOW}[5/6] Starting backend...${NC}"
docker compose up -d backend

# Step 6: Health check
echo -e "${YELLOW}[6/6] Health check...${NC}"
sleep 10

if curl -f http://localhost:4025/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend healthy${NC}"
else
    echo -e "${RED}✗ Backend health check failed${NC}"
    echo "Logs:"
    docker compose logs backend
    exit 1
fi

echo ""
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}RESTART COMPLETE!${NC}"
echo -e "${GREEN}==========================================${NC}"
echo ""
echo "Backend URL: http://localhost:4025"
echo "Health: http://localhost:4025/health"
echo "Metrics: http://localhost:4025/metrics"
echo ""
echo "Logs:"
echo "  docker compose logs -f backend"
echo ""
echo -e "${GREEN}Done!${NC}"
