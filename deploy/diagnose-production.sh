#!/bin/bash

# ============================================================================
# ZAPAI PRODUCTION DIAGNOSTIC SCRIPT
# ============================================================================
# Comprehensive health check for production deployment
# Usage: sudo bash deploy/diagnose-production.sh
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}ZAPAI PRODUCTION DIAGNOSTIC${NC}"
echo -e "${BLUE}==========================================${NC}"
echo ""

# ============================================================================
# PHASE 1: BACKEND HEALTH
# ============================================================================
echo -e "${YELLOW}[PHASE 1/6] Backend Health${NC}"

BACKEND_ONLINE="false"
DB_ONLINE="false"
WPP_ONLINE="false"

if curl -f http://localhost:4025/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend: ONLINE${NC}"
    BACKEND_ONLINE="true"
    HEALTH_BODY=$(curl -s http://localhost:4025/health)
    
    # Check database status
    if echo "$HEALTH_BODY" | grep -q '"db":true'; then
        echo -e "${GREEN}✓ Database: ONLINE${NC}"
        DB_ONLINE="true"
    else
        echo -e "${RED}✗ Database: OFFLINE${NC}"
    fi
    
    # Check WhatsApp status
    if echo "$HEALTH_BODY" | grep -q '"whatsapp".*"status":"online"'; then
        echo -e "${GREEN}✓ WhatsApp: ONLINE${NC}"
        WPP_ONLINE="true"
    else
        echo -e "${YELLOW}⚠ WhatsApp: OFFLINE or QR pending${NC}"
    fi
else
    echo -e "${RED}✗ Backend: OFFLINE${NC}"
fi

# Check session-status endpoint
if curl -f http://localhost:4025/api/session-status > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Session Status: ONLINE${NC}"
else
    echo -e "${RED}✗ Session Status: OFFLINE${NC}"
fi

echo ""

# ============================================================================
# PHASE 2: DATABASE CONNECTION
# ============================================================================
echo -e "${YELLOW}[PHASE 2/6] Database Connection${NC}"

if [ "$DB_ONLINE" = "true" ]; then
    echo -e "${GREEN}✓ PostgreSQL connection established${NC}"
else
    echo -e "${RED}✗ PostgreSQL connection failed${NC}"
    echo "  Run: cd backend && node scripts/init-database.js"
fi

echo ""

# ============================================================================
# PHASE 3: DOCKER CONTAINERS
# ============================================================================
echo -e "${YELLOW}[PHASE 3/6] Docker Containers${NC}"

if command -v docker &> /dev/null; then
    if docker ps | grep -q "zapai-backend"; then
        echo -e "${GREEN}✓ Backend container: RUNNING${NC}"
    else
        echo -e "${RED}✗ Backend container: NOT RUNNING${NC}"
    fi
    
    if docker ps | grep -q "zapai-postgres"; then
        echo -e "${GREEN}✓ PostgreSQL container: RUNNING${NC}"
    else
        echo -e "${RED}✗ PostgreSQL container: NOT RUNNING${NC}"
    fi
    
    if docker ps | grep -q "zapai-redis"; then
        echo -e "${GREEN}✓ Redis container: RUNNING${NC}"
    else
        echo -e "${YELLOW}⚠ Redis container: NOT RUNNING (optional)${NC}"
    fi
else
    echo -e "${RED}✗ Docker not installed or not running${NC}"
fi

echo ""

# ============================================================================
# PHASE 4: FIREWALL & PORTS
# ============================================================================
echo -e "${YELLOW}[PHASE 4/6] Firewall & Ports${NC}"

if command -v ufw &> /dev/null; then
    if ufw status | grep -q "Status: active"; then
        echo -e "${GREEN}✓ Firewall: ACTIVE${NC}"
        
        if ufw status | grep -q "4025/tcp"; then
            echo -e "${GREEN}✓ Port 4025: ALLOWED${NC}"
        else
            echo -e "${YELLOW}⚠ Port 4025: NOT ALLOWED${NC}"
            echo "  Run: sudo ufw allow 4025/tcp"
        fi
        
        if ufw status | grep -q "22/tcp"; then
            echo -e "${GREEN}✓ Port 22: ALLOWED${NC}"
        else
            echo -e "${YELLOW}⚠ Port 22: NOT ALLOWED${NC}"
        fi
        
        if ufw status | grep -q "80/tcp"; then
            echo -e "${GREEN}✓ Port 80: ALLOWED${NC}"
        else
            echo -e "${YELLOW}⚠ Port 80: NOT ALLOWED${NC}"
        fi
        
        if ufw status | grep -q "443/tcp"; then
            echo -e "${GREEN}✓ Port 443: ALLOWED${NC}"
        else
            echo -e "${YELLOW}⚠ Port 443: NOT ALLOWED${NC}"
        fi
    else
        echo -e "${YELLOW}⚠ Firewall: INACTIVE${NC}"
        echo "  Run: sudo ufw enable"
    fi
else
    echo -e "${YELLOW}⚠ UFW not installed${NC}"
fi

echo ""

# ============================================================================
# PHASE 5: NGINX & SSL
# ============================================================================
echo -e "${YELLOW}[PHASE 5/6] Nginx & SSL${NC}"

if command -v nginx &> /dev/null; then
    if systemctl is-active --quiet nginx; then
        echo -e "${GREEN}✓ Nginx: RUNNING${NC}"
        
        if nginx -t > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Nginx config: VALID${NC}"
        else
            echo -e "${RED}✗ Nginx config: INVALID${NC}"
            echo "  Run: sudo nginx -t"
        fi
    else
        echo -e "${RED}✗ Nginx: NOT RUNNING${NC}"
        echo "  Run: sudo systemctl start nginx"
    fi
    
    # Check SSL certificates
    if [ -d "/etc/letsencrypt/live" ]; then
        echo -e "${GREEN}✓ SSL certificates: EXIST${NC}"
    else
        echo -e "${YELLOW}⚠ SSL certificates: NOT FOUND${NC}"
        echo "  Run: sudo certbot --nginx -d yourdomain.com"
    fi
else
    echo -e "${YELLOW}⚠ Nginx not installed${NC}"
fi

echo ""

# ============================================================================
# PHASE 6: SYSTEM RESOURCES
# ============================================================================
echo -e "${YELLOW}[PHASE 6/6] System Resources${NC}"

MEM_USAGE=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')
DISK_USAGE=$(df -h / | awk 'NR==2{print $5}')
CPU_COUNT=$(nproc)
UPTIME=$(uptime -p)

echo "Memory Usage: ${MEM_USAGE}%"
echo "Disk Usage: ${DISK_USAGE}"
echo "CPU Cores: ${CPU_COUNT}"
echo "System Uptime: ${UPTIME}"

if (( $(echo "$MEM_USAGE > 80" | bc -l) )); then
    echo -e "${YELLOW}⚠ High memory usage${NC}"
fi

if (( $(echo "${DISK_USAGE%?} > 80" | bc -l) )); then
    echo -e "${YELLOW}⚠ High disk usage${NC}"
fi

echo ""

# ============================================================================
# FINAL REPORT
# ============================================================================
echo -e "${BLUE}==========================================${NC}"
echo -e "${GREEN}FINAL REPORT${NC}"
echo -e "${BLUE}==========================================${NC}"
echo ""
echo -e "${BLUE}API ONLINE/OFFLINE:${NC} $BACKEND_ONLINE"
echo -e "${BLUE}DB ONLINE/OFFLINE:${NC} $DB_ONLINE"
echo -e "${BLUE}WPP ONLINE/OFFLINE:${NC} $WPP_ONLINE"
echo ""

# Get public IP
PUBLIC_IP=$(curl -s --connect-timeout 4 https://api.ipify.org 2>/dev/null || echo "unknown")
echo -e "${BLUE}URL FINAL:${NC} http://${PUBLIC_IP}:4025"

# Check if domain is configured
if [ -n "$DOMAIN" ]; then
    echo -e "${BLUE}URL DOMAIN:${NC} https://$DOMAIN"
fi

echo ""
echo -e "${BLUE}LOGIN ADMIN:${NC}"
echo "  Username: admin"
echo "  Password: (check backend/.env.production)"
echo ""

# Overall status
if [ "$BACKEND_ONLINE" = "true" ] && [ "$DB_ONLINE" = "true" ]; then
    echo -e "${GREEN}==========================================${NC}"
    echo -e "${GREEN}SISTEMA PRONTO PARA USO${NC}"
    echo -e "${GREEN}==========================================${NC}"
    exit 0
else
    echo -e "${RED}==========================================${NC}"
    echo -e "${RED}SISTEMA NÃO ESTÁ PRONTO${NC}"
    echo -e "${RED}==========================================${NC}"
    exit 1
fi
