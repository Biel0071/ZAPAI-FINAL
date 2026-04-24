#!/bin/bash

# ============================================================================
# INSTALL.SH - DEPLOY AUTOMÁTICO VPS
# ============================================================================

set -e

echo "=========================================="
echo "ZAPAI FRONTEND - INSTALL VPS"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
APP_DIR="/opt/zapai-frontend"
BACKUP_DIR="/opt/zapai-backup"
DOMAIN=${DOMAIN:-"localhost"}
API_URL=${VITE_API_URL:-"http://localhost:4025"}
MASTER_API_URL=${MASTER_API_URL:-""}

# System update
echo -e "${YELLOW}[1/8] Updating system...${NC}"
apt update && apt upgrade -y
apt install -y curl wget git nginx certbot python3-certbot-nginx docker docker-compose

# Create directories
echo -e "${YELLOW}[2/8] Creating directories...${NC}"
mkdir -p $APP_DIR
mkdir -p $BACKUP_DIR
mkdir -p $APP_DIR/deploy

# Clone repository (if not exists)
if [ ! -d "$APP_DIR/.git" ]; then
    echo -e "${YELLOW}[3/8] Cloning repository...${NC}"
    git clone https://github.com/your-repo/zapai-frontend.git $APP_DIR
else
    echo -e "${YELLOW}[3/8] Pulling latest changes...${NC}"
    cd $APP_DIR
    git pull
fi

cd $APP_DIR

# Create .env
echo -e "${YELLOW}[4/8] Creating .env...${NC}"
cat > .env << EOF
VITE_API_URL=$API_URL
DOMAIN=$DOMAIN
MASTER_API_URL=$MASTER_API_URL
EOF

# Build Docker image
echo -e "${YELLOW}[5/8] Building Docker image...${NC}"
docker-compose -f deploy/docker-compose.yml build

# Stop existing container
echo -e "${YELLOW}[6/8] Stopping existing container...${NC}"
docker-compose -f deploy/docker-compose.yml down || true

# Start container
echo -e "${YELLOW}[7/8] Starting container...${NC}"
docker-compose -f deploy/docker-compose.yml up -d

# Configure SSL (if domain provided)
if [ "$DOMAIN" != "localhost" ]; then
    echo -e "${YELLOW}[8/8] Configuring SSL...${NC}"
    certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN
fi

# Register node in master admin
if [ -n "$MASTER_API_URL" ]; then
    echo -e "${YELLOW}[9/8] Registering node in master admin...${NC}"
    IP=$(curl -s ifconfig.me)
    HOSTNAME=$(hostname)
    
    curl -X POST $MASTER_API_URL/master/register-node \
        -H "Content-Type: application/json" \
        -d "{
            \"ip\": \"$IP\",
            \"hostname\": \"$HOSTNAME\",
            \"domain\": \"$DOMAIN\",
            \"status\": \"active\",
            \"cpu\": \"$(nproc)\",
            \"ram\": \"$(free -m | awk '/Mem:/ {print $2}')\",
            \"disk\": \"$(df -h / | awk 'NR==2 {print $2}' )\",
            \"version\": \"$(git rev-parse HEAD)\"
        }" || echo "Failed to register node"
fi

echo ""
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}INSTALLATION COMPLETE!${NC}"
echo -e "${GREEN}==========================================${NC}"
echo ""
echo "Frontend URL: http://$DOMAIN"
echo "API URL: $API_URL"
echo ""
echo "Commands:"
echo "  docker-compose -f deploy/docker-compose.yml logs -f"
echo "  docker-compose -f deploy/docker-compose.yml restart"
echo ""
echo -e "${GREEN}Done!${NC}"
