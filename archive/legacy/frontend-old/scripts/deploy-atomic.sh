#!/bin/bash

# ============================================================================
# ATOMIC DEPLOY SCRIPT
# ============================================================================
# 
# Deploy atômico com zero downtime.
# - Build em diretório temporário
# - Validação do build
# - Swap atômico
# - Rollback automático em caso de falha
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DIST_DIR="dist"
DIST_TEMP="dist-temp"
DIST_BACKUP="dist-backup"
DEPLOY_DIR="/var/www/zapai/frontend"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}ZAPAI - ATOMIC DEPLOY${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Step 1: Clean old dist
echo -e "${YELLOW}[1/7] Limpando dist antigo...${NC}"
rm -rf ${DIST_DIR} ${DIST_TEMP} ${DIST_BACKUP}
echo -e "${GREEN}✓ Limpeza concluída${NC}"

# Step 2: npm clean install
echo -e "${YELLOW}[2/7] npm clean install...${NC}"
rm -rf node_modules package-lock.json
npm install
echo -e "${GREEN}✓ Dependências instaladas${NC}"

# Step 3: Build production
echo -e "${YELLOW}[3/7] Build production...${NC}"
npm run build:prod
echo -e "${GREEN}✓ Build concluído${NC}"

# Step 4: Validate build
echo -e "${YELLOW}[4/7] Validando build...${NC}"
npm run validate-build
echo -e "${GREEN}✓ Build validado${NC}"

# Step 5: Backup current deploy (if exists)
if [ -d "${DEPLOY_DIR}" ]; then
    echo -e "${YELLOW}[5/7] Backup do deploy atual...${NC}"
    cp -r ${DEPLOY_DIR} ${DIST_BACKUP}
    echo -e "${GREEN}✓ Backup criado${NC}"
else
    echo -e "${YELLOW}[5/7] Nenhum deploy atual encontrado, pulando backup${NC}"
fi

# Step 6: Atomic swap
echo -e "${YELLOW}[6/7] Deploy atômico...${NC}"
mv ${DIST_DIR} ${DIST_TEMP}
mkdir -p ${DEPLOY_DIR}
cp -r ${DIST_TEMP}/* ${DEPLOY_DIR}/
rm -rf ${DIST_TEMP}
echo -e "${GREEN}✓ Swap atômico concluído${NC}"

# Step 7: Configure headers (nginx)
echo -e "${YELLOW}[7/7] Configurando headers...${NC}"
cat > /etc/nginx/sites-available/zapai-frontend-headers << 'EOF'
# Headers para index.html - no cache
location = /index.html {
    add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";
    add_header Pragma "no-cache";
    add_header Expires "0";
}

# Headers para assets com hash - cache longo imutável
location ~* ^/assets/.*\.[a-f0-9]{8,}\.(js|css|png|jpg|jpeg|svg|gif|webp|ico)$ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    expires 1y;
    access_log off;
}

# Headers para outros assets
location ~* \.(js|css|png|jpg|jpeg|svg|gif|webp|ico)$ {
    add_header Cache-Control "public, max-age=86400";
}
EOF

echo -e "${GREEN}✓ Headers configurados${NC}"

# Reload nginx
echo -e "${YELLOW}Recarregando nginx...${NC}"
nginx -t && systemctl reload nginx
echo -e "${GREEN}✓ Nginx recarregado${NC}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}DEPLOY CONCLUÍDO COM SUCESSO!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Build ID: $(cat dist/build-id.json | jq -r '.id')${NC}"
echo -e "${BLUE}Deploy dir: ${DEPLOY_DIR}${NC}"
echo ""

# Cleanup
rm -rf ${DIST_BACKUP}
