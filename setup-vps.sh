#!/bin/bash
# ==============================================================================
# ZAPFLOW AI — AUTO-BOOTSTRAP ENTERPRISE SCRIPT
# VPS MASTER: 209.50.229.68
# ==============================================================================

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🚀 Iniciando Auto-Bootstrap Enterprise do Zapflow AI...${NC}"

# ==============================================================================
# 1. AUTO DETECÇÃO E PREPARAÇÃO DO SO
# ==============================================================================
echo -e "${YELLOW}📦 Instalando e Validando Dependências (Docker, Node, Curl, Git, UFW)...${NC}"
apt-get update && apt-get upgrade -y
apt-get install -y curl wget git jq ufw htop software-properties-common

if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
fi

if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# Configurar Firewall
echo -e "${YELLOW}🛡️ Configurando Firewall...${NC}"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp  # App pública
ufw allow 8080/tcp  # Dozzle Logs
ufw allow 19999/tcp # Netdata
ufw --force enable

# Netdata
if [ ! -d "/opt/netdata" ] && ! command -v netdata &> /dev/null; then
    wget -O /tmp/netdata-kickstart.sh https://get.netdata.cloud/kickstart.sh && sh /tmp/netdata-kickstart.sh --non-interactive || true
fi

# Auto-configurar .env se não existir
if [ ! -f ".env.production" ]; then
    cp .env.production.example .env.production
    sed -i "s/TROQUE_openssl_rand_hex_32/$(openssl rand -hex 32)/g" .env.production
    sed -i "s/TROQUE_openssl_rand_hex_24/$(openssl rand -hex 24)/g" .env.production
    sed -i "s/TROQUE_PARA_UMA_SENHA_FORTE/zapadmin123/g" .env.production
    sed -i "s/TROQUE_PARA_SENHA_FORTE/zapadmin123/g" .env.production
fi

# ==============================================================================
# 2. RUNTIME ENTERPRISE & FRONTEND BUILD
# ==============================================================================
echo -e "${YELLOW}🏗️ Validando Runtime e Compilando Frontend...${NC}"

if grep -qi "localhost:4025" frontend/src/config/runtime.ts || grep -qi "127.0.0.1" frontend/src/config/runtime.ts; then
    echo -e "${RED}❌ ERRO: Hardcode legado detectado no runtime.ts! Auto-corrigindo...${NC}"
    # Remove old fallback logics forcing origin
    cat << 'EOF' > frontend/src/config/runtime.ts
export const API_BASE_URL = (() => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '';
})();
export const WS_BASE_URL = (() => {
  const apiUrl = API_BASE_URL;
  return apiUrl.replace(/^http/, 'ws');
})();
export const BUILD_ID = 'prod-build';
export const APP_VERSION = '1.0.0';
export const ENV_NAME = 'production';
export const TENANT_ID = 'default';
EOF
fi

cd frontend
npm ci
npm run build
cd ..

if [ ! -d "frontend/dist" ] || [ -z "$(ls -A frontend/dist)" ]; then
    echo -e "${RED}❌ ERRO: Build do frontend falhou (dist vazio/inexistente). Abortando.${NC}"
    exit 1
fi

# ==============================================================================
# 3. AUTO DETECÇÃO DE UPSTREAM NGINX
# ==============================================================================
echo -e "${YELLOW}🔍 Auto-detectando Upstream Nginx...${NC}"
BACKEND_SERVICE=$(docker compose -f docker-compose.production.yml config --services | grep -E 'backend|api|server' | head -n1)
if [ -z "$BACKEND_SERVICE" ]; then BACKEND_SERVICE=backend; fi

ESCAPED_SERVICE=$(printf '%s\n' "$BACKEND_SERVICE" | sed 's/[\/&]/\\&/g')

sed -i "s|http://backend:4025|http://${ESCAPED_SERVICE}:4025|g" infra/nginx/nginx.conf
sed -i "s|http://zapai-backend:4025|http://${ESCAPED_SERVICE}:4025|g" infra/nginx/nginx.conf
sed -i "s|http://api:4025|http://${ESCAPED_SERVICE}:4025|g" infra/nginx/nginx.conf
sed -i "s|http://server:4025|http://${ESCAPED_SERVICE}:4025|g" infra/nginx/nginx.conf

# ==============================================================================
# 4. AUTO TESTE NGINX & DOCKER UP
# ==============================================================================
echo -e "${YELLOW}🐳 Subindo dependências Docker e validando Nginx na network interna...${NC}"
mkdir -p backups/postgres logs/backend backend/sessions backend/uploads
chmod -R 777 backups logs backend/sessions backend/uploads

docker compose --env-file .env.production -f docker-compose.production.yml down --remove-orphans || true

# Subir stack temporária (backend, redis, postgres) para resolução de DNS Docker
docker compose --env-file .env.production -f docker-compose.production.yml up -d backend redis postgres

# Testar nginx rodando container acoplado à rede usando run para ter DNS
NGINX_TEST=$(docker compose --env-file .env.production -f docker-compose.production.yml run --rm nginx nginx -t 2>&1 || true)
if echo "$NGINX_TEST" | grep -qi "failed"; then
    echo -e "${RED}❌ ERRO: Sintaxe do Nginx inválida! Logs:${NC}"
    echo "$NGINX_TEST"
    docker compose --env-file .env.production -f docker-compose.production.yml down
    exit 1
fi

docker compose --env-file .env.production -f docker-compose.production.yml up -d --build

# ==============================================================================
# 5. AUTO HEALTHCHECK COM AUTO-RECOVERY
# ==============================================================================
echo -e "${YELLOW}⏳ Aguardando serviços estabilizarem (15s)...${NC}"
sleep 15

MAX_RETRIES=3
RETRY_COUNT=0
ALL_HEALTHY=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    echo "🧪 Teste de Validação (Tentativa $((RETRY_COUNT+1))/$MAX_RETRIES)..."
    
    HTTP_FRONTEND=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000 || echo "000")
    HTTP_API=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/health || echo "000")
    WS_STATUS=$(curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Host: 127.0.0.1" -H "Origin: http://127.0.0.1:3000" http://127.0.0.1:3000/socket.io/?EIO=4\&transport=websocket 2>/dev/null | grep -i "101 Switching Protocols" || echo "FAIL")
    
    if [ "$HTTP_FRONTEND" == "200" ] && [ "$HTTP_API" == "200" ] && [ "$WS_STATUS" != "FAIL" ]; then
        ALL_HEALTHY=true
        break
    else
        echo -e "${RED}⚠️ Falha detectada (Front: $HTTP_FRONTEND | API: $HTTP_API | WS: $WS_STATUS). Reiniciando Backend e Nginx...${NC}"
        docker compose --env-file .env.production -f docker-compose.production.yml restart backend nginx
        sleep 10
        RETRY_COUNT=$((RETRY_COUNT+1))
    fi
done

if [ "$ALL_HEALTHY" = false ]; then
    echo -e "${RED}❌ ERRO FATAL: Stack não ficou saudável após $MAX_RETRIES tentativas.${NC}"
    docker compose --env-file .env.production -f docker-compose.production.yml logs --tail=50 backend nginx
    exit 1
fi

echo -e "${GREEN}✅ Healthchecks Aprovados: HTTP 200, API 200, WS 101 OK!${NC}"

# ==============================================================================
# 6. RESULTADO FINAL E ENTREGA
# ==============================================================================
echo ""
echo "============================================================"
echo -e "${GREEN}✨ ZAPFLOW AI DEPLOY ENTERPRISE CONCLUÍDO ✨${NC}"
echo "============================================================"
echo "Acesse a aplicação via http://209.50.229.68:3000"
echo "Painel Dozzle (Logs): http://209.50.229.68:8080"
echo "Painel Netdata: http://209.50.229.68:19999"
echo "============================================================"
