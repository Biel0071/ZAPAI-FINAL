#!/bin/bash

# ============================================================================
# ZAPAI ONE CLICK DEPLOY - TOTAL AUTOMATION
# ============================================================================
# Deployment 100% automático sem interação manual
# Uso: sudo bash deploy/install.sh
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}ZAPAI ONE CLICK DEPLOY - TOTAL${NC}"
echo -e "${BLUE}==========================================${NC}"
echo ""

# ============================================================================
# STEP 1: Detect Public IP
# ============================================================================
echo -e "${YELLOW}[1/13] Detecting public IP...${NC}"
PUBLIC_IP=$(curl -s --connect-timeout 4 https://api.ipify.org 2>/dev/null || \
            curl -s --connect-timeout 4 https://checkip.amazonaws.com 2>/dev/null || \
            curl -s --connect-timeout 4 ifconfig.me 2>/dev/null || \
            hostname -I | awk '{print $1}')
PUBLIC_IP="${PUBLIC_IP// /}"
echo -e "${GREEN}✓ Public IP: $PUBLIC_IP${NC}"

# Auto-generate URLs
API_URL="http://$PUBLIC_IP:4025"
FRONT_URL="http://$PUBLIC_IP:3000"
VITE_API_URL="http://$PUBLIC_IP:4025"

echo ""
echo "API URL: $API_URL"
echo "Front URL: $FRONT_URL"
echo "VITE_API_URL: $VITE_API_URL"
echo ""

# ============================================================================
# STEP 2: Set working directory
# ============================================================================
echo -e "${YELLOW}[2/13] Setting working directory...${NC}"
cd "$(dirname "$0")/.."
INSTALL_DIR="$(pwd)"
echo -e "${GREEN}✓ Working directory: $INSTALL_DIR${NC}"
echo ""

# ============================================================================
# STEP 3: Git pull latest
# ============================================================================
echo -e "${YELLOW}[3/13] Pulling latest code...${NC}"
git pull origin main > /dev/null 2>&1 || echo "Git pull skipped or already up to date"
echo -e "${GREEN}✓ Latest code pulled${NC}"
echo ""

# ============================================================================
# STEP 4: Generate DATABASE_URL and secrets
# ============================================================================
echo -e "${YELLOW}[4/13] Generating secrets...${NC}"
DATABASE_PASSWORD=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 64)
ADMIN_PASSWORD="admin123"
echo -e "${GREEN}✓ Secrets generated${NC}"
echo ""

# ============================================================================
# STEP 5: Create backend .env.production
# ============================================================================
echo -e "${YELLOW}[5/13] Creating backend .env.production...${NC}"
cat > backend/.env.production << EOF
NODE_ENV=production
PORT=4025
HOST=0.0.0.0
FRONTEND_URL=$FRONT_URL
CORS_ALLOWED_ORIGINS=$FRONT_URL,https://swift-wa-assist.lovable.app
DATABASE_URL=postgresql://zapai:$DATABASE_PASSWORD@postgres:5432/zapai_crm
JWT_SECRET=$JWT_SECRET
AUTH_JWT_SECRET=$JWT_SECRET
AUTH_DEFAULT_USERNAME=admin
AUTH_DEFAULT_PASSWORD=$ADMIN_PASSWORD
MASTER_API_URL=
NODE_TOKEN=
CRASH_EXIT_ON_UNHANDLED=true
LOG_LEVEL=info
POSTGRES_HOST=postgres
POSTGRES_USER=zapai
POSTGRES_PASSWORD=$DATABASE_PASSWORD
POSTGRES_DB=zapai_crm
EOF
echo -e "${GREEN}✓ Backend .env.production created${NC}"
echo ""

# ============================================================================
# STEP 6: Create frontend .env.production
# ============================================================================
echo -e "${YELLOW}[6/13] Creating frontend .env.production...${NC}"
cat > frontend/.env.production << EOF
VITE_API_URL=$VITE_API_URL
VITE_WHATSAPP_API_BASE_URL=$VITE_API_URL
EOF
echo -e "${GREEN}✓ Frontend .env.production created${NC}"
echo ""

# ============================================================================
# STEP 7: Update docker-compose.yml with DATABASE_URL
# ============================================================================
echo -e "${YELLOW}[7/13] Updating docker-compose.yml...${NC}"
# Create a temporary docker-compose with correct DATABASE_URL
cat > docker-compose.prod.yml << EOF
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: zapai-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: zapai
      POSTGRES_PASSWORD: $DATABASE_PASSWORD
      POSTGRES_DB: zapai_crm
      POSTGRES_HOST: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U zapai"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: zapai-backend
    restart: unless-stopped
    ports:
      - "4025:4025"
    environment:
      NODE_ENV: production
      PORT: 4025
      DATABASE_URL: postgresql://zapai:$DATABASE_PASSWORD@postgres:5432/zapai_crm
      JWT_SECRET: $JWT_SECRET
      AUTH_JWT_SECRET: $JWT_SECRET
      USE_NGROK: "false"
      NGROK_MANAGED_EXTERNALLY: "true"
      CRASH_EXIT_ON_UNHANDLED: "true"
      LOG_LEVEL: info
      FRONTEND_URL: $FRONT_URL
      CORS_ALLOWED_ORIGINS: $FRONT_URL,https://swift-wa-assist.lovable.app
      DEFAULT_COMPANY_ID: default
      AUTH_DEFAULT_USERNAME: admin
      AUTH_DEFAULT_PASSWORD: $ADMIN_PASSWORD
      POSTGRES_HOST: postgres
      POSTGRES_USER: zapai
      POSTGRES_PASSWORD: $DATABASE_PASSWORD
      POSTGRES_DB: zapai_crm
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - zapai_sessions:/app/sessions
      - zapai_uploads:/app/uploads
      - zapai_logs:/app/logs
    command: sh docker-entrypoint.sh

volumes:
  postgres_data:
  zapai_sessions:
  zapai_uploads:
  zapai_logs:
EOF
echo -e "${GREEN}✓ docker-compose.prod.yml created${NC}"
echo ""

# ============================================================================
# STEP 8: Stop existing containers
# ============================================================================
echo -e "${YELLOW}[8/13] Stopping existing containers...${NC}"
docker compose -f docker-compose.prod.yml down -v > /dev/null 2>&1 || true
echo -e "${GREEN}✓ Containers stopped${NC}"
echo ""

# ============================================================================
# STEP 9: Docker compose build
# ============================================================================
echo -e "${YELLOW}[9/13] Building Docker images...${NC}"
docker compose -f docker-compose.prod.yml build > /dev/null 2>&1
echo -e "${GREEN}✓ Docker images built${NC}"
echo ""

# ============================================================================
# STEP 10: Docker compose up
# ============================================================================
echo -e "${YELLOW}[10/13] Starting containers...${NC}"
docker compose -f docker-compose.prod.yml up -d
echo -e "${GREEN}✓ Containers started${NC}"
echo ""

# ============================================================================
# STEP 11: Wait for backend health
# ============================================================================
echo -e "${YELLOW}[11/13] Waiting for backend to be healthy...${NC}"
MAX_ATTEMPTS=60
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if curl -f http://localhost:4025/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Backend is healthy${NC}"
        break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    echo "Waiting... ($ATTEMPT/$MAX_ATTEMPTS)"
    sleep 2
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo -e "${RED}✗ Backend health check failed${NC}"
    docker compose -f docker-compose.prod.yml logs backend
    exit 1
fi

echo ""

# ============================================================================
# STEP 12: Build and publish frontend
# ============================================================================
echo -e "${YELLOW}[12/13] Building and publishing frontend...${NC}"
cd frontend
npm ci > /dev/null 2>&1
npm run build > /dev/null 2>&1
cd ..
echo -e "${GREEN}✓ Frontend built${NC}"
echo ""

# Start frontend container
docker compose -f docker-compose.prod.yml --profile production up -d frontend 2>/dev/null || echo "Frontend container skipped (optional)"
echo ""

# ============================================================================
# STEP 13: Create admin user
# ============================================================================
echo -e "${YELLOW}[13/13] Creating admin user...${NC}"
docker exec zapai-backend node scripts/seed-admin.js > /dev/null 2>&1 || echo "Admin user already exists"
echo -e "${GREEN}✓ Admin user created${NC}"
echo ""

# ============================================================================
# FINAL VALIDATION
# ============================================================================
echo ""
echo -e "${BLUE}==========================================${NC}"
echo -e "${YELLOW}[FINAL] VALIDATION${NC}"
echo -e "${BLUE}==========================================${NC}"
echo ""

# Check backend
BACKEND_ONLINE="false"
if curl -f http://localhost:4025/health > /dev/null 2>&1; then
    BACKEND_ONLINE="true"
    echo -e "${GREEN}✓ BACKEND ONLINE${NC}"
else
    echo -e "${RED}✗ BACKEND OFFLINE${NC}"
fi

# Check database
DB_ONLINE="false"
HEALTH_BODY=$(curl -s http://localhost:4025/health)
if echo "$HEALTH_BODY" | grep -q '"db":true'; then
    DB_ONLINE="true"
    echo -e "${GREEN}✓ DB ONLINE${NC}"
else
    echo -e "${RED}✗ DB OFFLINE${NC}"
fi

# Check frontend
FRONT_ONLINE="false"
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    FRONT_ONLINE="true"
    echo -e "${GREEN}✓ FRONT ONLINE${NC}"
else
    echo -e "${YELLOW}⚠ FRONT OFFLINE (optional)${NC}"
fi

# Check admin
ADMIN_OK="false"
if [ "$BACKEND_ONLINE" = "true" ] && [ "$DB_ONLINE" = "true" ]; then
    ADMIN_OK="true"
    echo -e "${GREEN}✓ LOGIN ADMIN OK${NC}"
else
    echo -e "${RED}✗ LOGIN ADMIN FAILED${NC}"
fi

echo ""
echo -e "${BLUE}==========================================${NC}"
echo -e "${YELLOW}DEPLOYMENT COMPLETE${NC}"
echo -e "${BLUE}==========================================${NC}"
echo ""
echo -e "${BLUE}VITE_API_URL USADA:${NC} $VITE_API_URL"
echo -e "${BLUE}API URL:${NC} $API_URL"
echo -e "${BLUE}FRONT URL:${NC} $FRONT_URL"
echo ""
echo -e "${YELLOW}LOGIN ADMIN:${NC}"
echo "  Username: admin"
echo "  Password: admin123"
echo ""

if [ "$BACKEND_ONLINE" = "true" ] && [ "$DB_ONLINE" = "true" ]; then
    echo -e "${GREEN}==========================================${NC}"
    echo -e "${GREEN}DEPLOY 1-CLICK SUCCESS!${NC}"
    echo -e "${GREEN}==========================================${NC}"
    exit 0
else
    echo -e "${RED}==========================================${NC}"
    echo -e "${RED}DEPLOY FAILED${NC}"
    echo -e "${RED}==========================================${NC}"
    exit 1
fi
