#!/bin/bash

# ============================================================================
# ZAPAI MASTER NODE - INSTALL SCRIPT (1-CLIQUE)
# ============================================================================
# 
# Este script instala automaticamente:
# - Docker e Docker Compose
# - Backend ZapAI
# - Frontend ZapAI
# - Agent Master Node
# - SSL automático (Let's Encrypt)
# - PM2 para gerenciamento de processos
#
# Zero mock. Tudo produção real.
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MASTER_API_URL="${MASTER_API_URL:-https://your-master-api.com/api}"
NODE_NAME="${NODE_NAME:-$(hostname)}"
DOMAIN="${DOMAIN:-}"
API_PORT="${API_PORT:-4025}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}ZAPAI MASTER NODE - INSTALL SCRIPT${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}Este script deve ser executado como root${NC}"
   exit 1
fi

# Update system
echo -e "${YELLOW}[1/10] Atualizando sistema...${NC}"
apt-get update -y
apt-get upgrade -y

# Install Docker
echo -e "${YELLOW}[2/10] Instalando Docker...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    systemctl enable docker
    systemctl start docker
    rm get-docker.sh
else
    echo -e "${GREEN}Docker já instalado${NC}"
fi

# Install Docker Compose
echo -e "${YELLOW}[3/10] Instalando Docker Compose...${NC}"
if ! command -v docker-compose &> /dev/null; then
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
else
    echo -e "${GREEN}Docker Compose já instalado${NC}"
fi

# Install Node.js
echo -e "${YELLOW}[4/10] Instalando Node.js...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
else
    echo -e "${GREEN}Node.js já instalado${NC}"
fi

# Install PM2
echo -e "${YELLOW}[5/10] Instalando PM2...${NC}"
npm install -g pm2

# Install Git
echo -e "${YELLOW}[6/10] Instalando Git...${NC}"
if ! command -v git &> /dev/null; then
    apt-get install -y git
else
    echo -e "${GREEN}Git já instalado${NC}"
fi

# Create directory structure
echo -e "${YELLOW}[7/10] Criando estrutura de diretórios...${NC}"
mkdir -p /opt/zapai
mkdir -p /opt/zapai/backend
mkdir -p /opt/zapai/frontend
mkdir -p /opt/zapai/agent
mkdir -p /opt/zapai/data
mkdir -p /opt/zapai/sessions
mkdir -p /opt/zapai/backups
mkdir -p /opt/zapai/logs
mkdir -p /opt/zapai/ssl

# Clone repository (replace with your actual repo)
echo -e "${YELLOW}[8/10] Clonando repositório...${NC}"
if [ -d "/opt/zapai/.git" ]; then
    cd /opt/zapai
    git pull
else
    # Replace with your actual repository URL
    git clone https://github.com/your-repo/zapai.git /opt/zapai
fi

# Setup environment files
echo -e "${YELLOW}[9/10] Configurando variáveis de ambiente...${NC}"

# Backend .env
cat > /opt/zapai/backend/.env << EOF
NODE_ENV=production
PORT=4025
FRONTEND_URL=https://${DOMAIN:-localhost}
CORS_ALLOWED_ORIGINS=https://${DOMAIN:-localhost},http://localhost:8080
DATABASE_URL=postgresql://postgres:\${POSTGRES_PASSWORD}@postgres:5432/zapai_crm
JWT_SECRET=\$(openssl rand -hex 32)
AUTH_JWT_SECRET=\$(openssl rand -hex 32)
AUTH_DEFAULT_USERNAME=admin
AUTH_DEFAULT_PASSWORD=\$(openssl rand -hex 16)
AUTH_DEFAULT_TENANT_ID=default
AUTH_DEFAULT_ROLE=master_admin
DEFAULT_COMPANY_ID=default
OPENAI_API_KEY=
USE_NGROK=false
LOG_LEVEL=info
CRASH_EXIT_ON_UNHANDLED=false
EOF

# Frontend .env
cat > /opt/zapai/frontend/.env << EOF
VITE_API_URL=https://${DOMAIN:-localhost}
VITE_WHATSAPP_API_BASE_URL=https://${DOMAIN:-localhost}
EOF

# Agent .env
cat > /opt/zapai/agent/.env << EOF
MASTER_API_URL=${MASTER_API_URL}
NODE_ID=
NODE_TOKEN=
LOCAL_API_PORT=4025
HEARTBEAT_INTERVAL=30000
EOF

# Register node with master API
echo -e "${YELLOW}[10/10] Registrando nó no Master API...${NC}"
IP_ADDRESS=$(curl -s ifconfig.me)
REGISTER_RESPONSE=$(curl -s -X POST "${MASTER_API_URL}/nodes/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"${NODE_NAME}\",\"ip_address\":\"${IP_ADDRESS}\",\"domain\":\"${DOMAIN}\",\"api_port\":${API_PORT}}")

NODE_ID=$(echo $REGISTER_RESPONSE | jq -r '.data.node_id')
NODE_TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.data.token')

if [ -n "$NODE_ID" ] && [ "$NODE_ID" != "null" ]; then
    # Update agent .env with credentials
    sed -i "s/NODE_ID=.*/NODE_ID=${NODE_ID}/" /opt/zapai/agent/.env
    sed -i "s/NODE_TOKEN=.*/NODE_TOKEN=${NODE_TOKEN}/" /opt/zapai/agent/.env
    echo -e "${GREEN}Nó registrado com sucesso!${NC}"
    echo -e "${GREEN}Node ID: ${NODE_ID}${NC}"
else
    echo -e "${RED}Falha ao registrar nó${NC}"
    echo -e "${YELLOW}Response: ${REGISTER_RESPONSE}${NC}"
fi

# Setup SSL if domain provided
if [ -n "$DOMAIN" ]; then
    echo -e "${YELLOW}[SSL] Configurando SSL automático...${NC}"
    apt-get install -y certbot python3-certbot-nginx
    
    # Install Nginx for SSL
    apt-get install -y nginx
    
    # Configure Nginx
    cat > /etc/nginx/sites-available/zapai << EOF
server {
    listen 80;
    server_name ${DOMAIN};
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    location /api {
        proxy_pass http://localhost:4025;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    location /socket.io {
        proxy_pass http://localhost:4025;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF

    ln -s /etc/nginx/sites-available/zapai /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    nginx -t
    systemctl restart nginx
    
    # Get SSL certificate
    certbot --nginx -d ${DOMAIN} --non-interactive --agree-tos --email admin@${DOMAIN}
fi

# Start services
echo -e "${GREEN}Iniciando serviços...${NC}"

cd /opt/zapai/backend
npm install
pm2 start server.js --name zapai-backend

cd /opt/zapai/frontend
npm install
npm run build
pm2 start "npx serve -s build -l 8080" --name zapai-frontend

cd /opt/zapai/agent
npm install
pm2 start agent.js --name zapai-agent

# Save PM2 process list
pm2 save
pm2 startup

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}INSTALAÇÃO CONCLUÍDA COM SUCESSO!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Node ID: ${NODE_ID}${NC}"
echo -e "${BLUE}Node Token: ${NODE_TOKEN}${NC}"
echo -e "${BLUE}IP Address: ${IP_ADDRESS}${NC}"
echo -e "${BLUE}Domain: ${DOMAIN:-Não configurado}${NC}"
echo ""
echo -e "${YELLOW}Serviços rodando:${NC}"
pm2 status
echo ""
echo -e "${YELLOW}Logs:${NC}"
echo -e "  Backend: pm2 logs zapai-backend"
echo -e "  Frontend: pm2 logs zapai-frontend"
echo -e "  Agent: pm2 logs zapai-agent"
echo ""
echo -e "${YELLOW}Comandos úteis:${NC}"
echo -e "  Reiniciar tudo: pm2 restart all"
echo -e "  Parar tudo: pm2 stop all"
echo -e "  Ver status: pm2 status"
echo ""
