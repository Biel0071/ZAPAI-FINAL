#!/bin/bash

# ============================================================================
# ZAPAI NODE INSTALL - WORKER VPS
# ============================================================================
# Instala e registra um node worker no Master
# Uso: sudo bash deploy/install-node.sh <MASTER_URL> <MASTER_TOKEN>
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

if [ "$#" -lt 2 ]; then
    echo -e "${RED}Usage: $0 <MASTER_URL> <MASTER_TOKEN>${NC}"
    echo "Example: $0 https://209.50.229.68:4025 your_token_here"
    exit 1
fi

MASTER_URL="$1"
MASTER_TOKEN="$2"

echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}ZAPAI NODE INSTALL - WORKER${NC}"
echo -e "${BLUE}==========================================${NC}"
echo ""
echo "Master URL: $MASTER_URL"
echo ""

# ============================================================================
# STEP 1: Install Docker
# ============================================================================
echo -e "${YELLOW}[1/8] Installing Docker...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh -y > /dev/null 2>&1
    rm get-docker.sh
    usermod -aG docker $SUDO_USER || true
else
    echo -e "${GREEN}✓ Docker already installed${NC}"
fi

if ! command -v docker-compose &> /dev/null; then
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
else
    echo -e "${GREEN}✓ Docker Compose already installed${NC}"
fi
echo ""

# ============================================================================
# STEP 2: Clone or pull repository
# ============================================================================
echo -e "${YELLOW}[2/8] Pulling latest code...${NC}"
if [ -d "ZAPAI-FINAL" ]; then
    cd ZAPAI-FINAL
    git pull origin main > /dev/null 2>&1
else
    git clone https://github.com/Biel0071/ZAPAI-FINAL.git
    cd ZAPAI-FINAL
fi
echo -e "${GREEN}✓ Code updated${NC}"
echo ""

# ============================================================================
# STEP 3: Detect public IP
# ============================================================================
echo -e "${YELLOW}[3/8] Detecting public IP...${NC}"
PUBLIC_IP=$(curl -s --connect-timeout 4 https://api.ipify.org 2>/dev/null || \
            curl -s --connect-timeout 4 https://checkip.amazonaws.com 2>/dev/null || \
            curl -s --connect-timeout 4 ifconfig.me 2>/dev/null || \
            hostname -I | awk '{print $1}')
PUBLIC_IP="${PUBLIC_IP// /}"

if ! echo "$PUBLIC_IP" | grep -Eq '^([0-9]{1,3}\.){3}[0-9]{1,3}$'; then
    PUBLIC_IP="127.0.0.1"
fi

echo -e "${GREEN}✓ Public IP: $PUBLIC_IP${NC}"
echo ""

# ============================================================================
# STEP 4: Generate NODE_ID and NODE_TOKEN
# ============================================================================
echo -e "${YELLOW}[4/8] Generating node credentials...${NC}"
NODE_ID="node-$(hostname)-$(date +%s)"
NODE_TOKEN=$(openssl rand -base64 32)
echo -e "${GREEN}✓ Node ID: $NODE_ID${NC}"
echo ""

# ============================================================================
# STEP 5: Create .env for worker
# ============================================================================
echo -e "${YELLOW}[5/8] Creating .env...${NC}"
cat > .env << EOF
NODE_ENV=production
PORT=4025
HOST=0.0.0.0

# Database (worker nodes may use shared database or local)
DATABASE_URL=${DATABASE_URL:-postgresql://zapai:zapai_password@postgres:5432/zapai_crm}
POSTGRES_HOST=${POSTGRES_HOST:-postgres}
POSTGRES_USER=${POSTGRES_USER:-zapai}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-zapai_password}
POSTGRES_DB=${POSTGRES_DB:-zapai_crm}

# JWT Secret (use same as master or generate new)
JWT_SECRET=${JWT_SECRET:-$(openssl rand -base64 64)}
AUTH_JWT_SECRET=${AUTH_JWT_SECRET:-$(openssl rand -base64 64)}

# Master Configuration
MASTER_API_URL=$MASTER_URL
MASTER_TOKEN=$MASTER_TOKEN
NODE_ID=$NODE_ID
NODE_TOKEN=$NODE_TOKEN

# Frontend URL
FRONTEND_URL=http://$PUBLIC_IP:3000
CORS_ALLOWED_ORIGINS=http://$PUBLIC_IP:3000,https://swift-wa-assist.lovable.app

# Auth
AUTH_DEFAULT_USERNAME=admin
AUTH_DEFAULT_PASSWORD=admin123

# Logs
LOG_LEVEL=info
CRASH_EXIT_ON_UNHANDLED=true
EOF

echo -e "${GREEN}✓ .env created${NC}"
echo ""

# ============================================================================
# STEP 6: Stop existing containers
# ============================================================================
echo -e "${YELLOW}[6/8] Stopping existing containers...${NC}"
docker compose down -v > /dev/null 2>&1 || true
echo -e "${GREEN}✓ Containers stopped${NC}"
echo ""

# ============================================================================
# STEP 7: Build and start containers
# ============================================================================
echo -e "${YELLOW}[7/8] Building and starting containers...${NC}"
docker compose build > /dev/null 2>&1
docker compose up -d
echo -e "${GREEN}✓ Containers started${NC}"
echo ""

# ============================================================================
# STEP 8: Wait for backend and register
# ============================================================================
echo -e "${YELLOW}[8/8] Registering node with master...${NC}"
MAX_ATTEMPTS=60
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if curl -f http://localhost:4025/health > /dev/null 2>&1 || curl -f http://localhost:4025/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Backend is healthy${NC}"
        break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    echo "Waiting for backend... ($ATTEMPT/$MAX_ATTEMPTS)"
    sleep 2
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo -e "${RED}✗ Backend health check failed${NC}"
    docker compose logs backend
    exit 1
fi

echo ""
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}NODE INSTALLATION COMPLETE${NC}"
echo -e "${GREEN}==========================================${NC}"
echo ""
echo -e "${BLUE}Node ID:${NC} $NODE_ID"
echo -e "${BLUE}Public IP:${NC} $PUBLIC_IP"
echo -e "${BLUE}Master URL:${NC} $MASTER_URL"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Check node status: curl $MASTER_URL/api/master/nodes"
echo "2. View logs: docker compose logs -f backend"
echo "3. Node will auto-register and send heartbeat every 30s"
echo ""
