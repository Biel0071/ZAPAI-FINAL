#!/bin/bash

# ============================================================================
# ZAPAI MASTER NODE - SSL AUTOMÁTICO (LET'S ENCRYPT)
# ============================================================================
# 
# Configura SSL automático usando Let's Encrypt.
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
DOMAIN="${DOMAIN:-}"
EMAIL="${EMAIL:-admin@${DOMAIN}}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}ZAPAI - SSL AUTOMÁTICO${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

if [ -z "$DOMAIN" ]; then
    echo -e "${RED}Erro: DOMAIN não definido${NC}"
    echo -e "${YELLOW}Uso: DOMAIN=seu-dominio.com EMAIL=admin@seu-dominio.com ./setup-ssl.sh${NC}"
    exit 1
fi

echo -e "${YELLOW}Domain: ${DOMAIN}${NC}"
echo -e "${YELLOW}Email: ${EMAIL}${NC}"
echo ""

# Install required packages
echo -e "${YELLOW}[1/5] Instalando pacotes necessários...${NC}"
apt-get update -y
apt-get install -y certbot python3-certbot-nginx nginx

# Create SSL directory
echo -e "${YELLOW}[2/5] Criando diretório SSL...${NC}"
mkdir -p /opt/zapai/ssl

# Configure Nginx for HTTP (for ACME challenge)
echo -e "${YELLOW}[3/5] Configurando Nginx para HTTP...${NC}"
cat > /etc/nginx/sites-available/zapai-http << EOF
server {
    listen 80;
    server_name ${DOMAIN};
    
    # ACME challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    # Redirect to HTTPS (temporary, will be HTTPS after SSL)
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

ln -sf /etc/nginx/sites-available/zapai-http /etc/nginx/sites-enabled/zapai
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

# Create ACME challenge directory
mkdir -p /var/www/html/.well-known/acme-challenge

# Obtain SSL certificate
echo -e "${YELLOW}[4/5] Obtendo certificado SSL...${NC}"
certbot certonly --webroot \
  --webroot-path=/var/www/html \
  --email ${EMAIL} \
  --agree-tos \
  --no-eff-email \
  -d ${DOMAIN}

# Configure Nginx for HTTPS
echo -e "${YELLOW}[5/5] Configurando Nginx para HTTPS...${NC}"
cat > /etc/nginx/sites-available/zapai-https << EOF
server {
    listen 80;
    server_name ${DOMAIN};
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ${DOMAIN};
    
    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Frontend
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
    
    # Backend API
    location /api {
        proxy_pass http://localhost:4025;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # WebSocket
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

ln -sf /etc/nginx/sites-available/zapai-https /etc/nginx/sites-enabled/zapai
nginx -t
systemctl restart nginx

# Copy certificates to ZapAI directory
cp /etc/letsencrypt/live/${DOMAIN}/fullchain.pem /opt/zapai/ssl/
cp /etc/letsencrypt/live/${DOMAIN}/privkey.pem /opt/zapai/ssl/

# Setup auto-renewal
echo -e "${GREEN}Configurando renovação automática...${NC}"
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --post-hook 'systemctl reload nginx'") | crontab -

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}SSL CONFIGURADO COM SUCESSO!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Domain: https://${DOMAIN}${NC}"
echo -e "${BLUE}Certificado: /etc/letsencrypt/live/${DOMAIN}/${NC}"
echo -e "${BLUE}Backup: /opt/zapai/ssl/${NC}"
echo ""
echo -e "${YELLOW}Certificados configurados para renovação automática${NC}"
echo ""
