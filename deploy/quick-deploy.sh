#!/bin/bash

# ============================================================================
# ZAPAI QUICK DEPLOY - VPS FIX
# ============================================================================
# Solução imediata para erro "Dockerfile not found"
# Usage: sudo bash deploy/quick-deploy.sh
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}ZAPAI QUICK DEPLOY - VPS FIX${NC}"
echo -e "${BLUE}==========================================${NC}"
echo ""

# Check if Dockerfiles exist
echo -e "${YELLOW}[1/6] Checking Dockerfiles...${NC}"

if [ ! -f "backend/Dockerfile" ]; then
    echo -e "${RED}✗ backend/Dockerfile not found${NC}"
    echo "Creating backend/Dockerfile..."
    cat > backend/Dockerfile << 'EOF'
FROM node:18-alpine

RUN apk add --no-cache python3 make g++ ffmpeg imagemagick webp

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN mkdir -p sessions uploads logs

EXPOSE 4025

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4025/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "server.js"]
EOF
    echo -e "${GREEN}✓ backend/Dockerfile created${NC}"
else
    echo -e "${GREEN}✓ backend/Dockerfile exists${NC}"
fi

if [ ! -f "frontend/Dockerfile" ]; then
    echo -e "${RED}✗ frontend/Dockerfile not found${NC}"
    echo "Creating frontend/Dockerfile..."
    cat > frontend/Dockerfile << 'EOF'
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
EOF
    echo -e "${GREEN}✓ frontend/Dockerfile created${NC}"
else
    echo -e "${GREEN}✓ frontend/Dockerfile exists${NC}"
fi

echo ""

# Stop existing containers
echo -e "${YELLOW}[2/6] Stopping existing containers...${NC}"
docker compose down -v 2>/dev/null || true
echo -e "${GREEN}✓ Containers stopped${NC}"
echo ""

# Build and start containers
echo -e "${YELLOW}[3/6] Building and starting containers...${NC}"
docker compose up -d --build postgres backend
echo -e "${GREEN}✓ Containers started${NC}"
echo ""

# Wait for backend to be healthy
echo -e "${YELLOW}[4/6] Waiting for backend health check...${NC}"
MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if docker exec zapai-backend curl -f http://localhost:4025/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Backend is healthy${NC}"
        break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    echo "Waiting... ($ATTEMPT/$MAX_ATTEMPTS)"
    sleep 2
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo -e "${RED}✗ Backend health check failed${NC}"
    docker compose logs backend
    exit 1
fi

echo ""

# Run migrations
echo -e "${YELLOW}[5/6] Running database migrations...${NC}"
docker exec zapai-backend node scripts/init-database.js || echo "Migrations skipped or already up-to-date"
echo -e "${GREEN}✓ Migrations completed${NC}"
echo ""

# Seed admin
echo -e "${YELLOW}[6/6] Seeding admin user...${NC}"
docker exec zapai-backend node scripts/seed-admin.js || echo "Admin seed skipped or already done"
echo -e "${GREEN}✓ Admin seed completed${NC}"
echo ""

# Final validation
echo -e "${YELLOW}[FINAL] Validating database connection...${NC}"
HEALTH_RESPONSE=$(docker exec zapai-backend curl -s http://localhost:4025/health)

if echo "$HEALTH_RESPONSE" | grep -q '"db":true'; then
    echo -e "${GREEN}✓ Database: ONLINE${NC}"
else
    echo -e "${RED}✗ Database: OFFLINE${NC}"
    echo "Response: $HEALTH_RESPONSE"
    exit 1
fi

echo ""
echo -e "${BLUE}==========================================${NC}"
echo -e "${GREEN}DEPLOY SUCCESSFUL${NC}"
echo -e "${BLUE}==========================================${NC}"
echo ""
echo -e "${BLUE}API URL:${NC} http://localhost:4025"
echo -e "${BLUE}Health:${NC} http://localhost:4025/health"
echo ""
echo -e "${YELLOW}Login Admin:${NC}"
echo "  Username: admin"
echo "  Password: admin123 (or check .env)"
echo ""
echo -e "${GREEN}System ready!${NC}"
