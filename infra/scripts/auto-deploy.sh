#!/bin/bash
set -euo pipefail

# ============================================================
# ZAPAI AUTO-DEPLOY — Produção REAL com auto-detecção
# Roda diretamente na VPS Ubuntu
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env.production"
NGINX_CONF="${PROJECT_ROOT}/infra/nginx/nginx.conf"
NGINX_AVAILABLE="/etc/nginx/sites-available/zapai"
NGINX_ENABLED="/etc/nginx/sites-enabled/zapai"
NGINX_DEFAULT="/etc/nginx/sites-enabled/default"

ERRORS=0
WARNINGS=0

log_info()  { echo -e "\033[34m[INFO]\033[0m  $*"; }
log_ok()    { echo -e "\033[32m[OK]\033[0m    $*"; }
log_warn()  { echo -e "\033[33m[WARN]\033[0m  $*"; ((WARNINGS++)) || true; }
log_error() { echo -e "\033[31m[ERROR]\033[0m $*"; ((ERRORS++)) || true; }

# ── 1. AUTO-DETECÇÃO DO AMBIENTE ─────────────────────────────────
log_info "=== Auto-detecção do ambiente ==="

# Detectar IP público
PUBLIC_IP=$(curl -s --max-time 10 ifconfig.me || curl -s --max-time 10 icanhazip.com || echo "")
if [[ -z "$PUBLIC_IP" ]]; then
  PUBLIC_IP=$(hostname -I | awk '{print $1}')
  log_warn "Não foi possível detectar IP público via serviço externo. Usando IP local: $PUBLIC_IP"
else
  log_ok "IP público detectado: $PUBLIC_IP"
fi

# Detectar porta do backend
BACKEND_PORT=4025
if [[ -f "${PROJECT_ROOT}/docker-compose.production.yml" ]]; then
  DETECTED_PORT=$(grep -oP 'PORT:\s*\K[0-9]+' "${PROJECT_ROOT}/docker-compose.production.yml" | head -1)
  [[ -n "$DETECTED_PORT" ]] && BACKEND_PORT=$DETECTED_PORT
fi
log_info "Backend porta: $BACKEND_PORT"

# Detectar domínio
DOMAIN=""
if [[ -f "$ENV_FILE" ]]; then
  ENV_DOMAIN=$(grep '^DOMAIN=' "$ENV_FILE" | cut -d'=' -f2 | tr -d '"' | xargs || true)
  [[ "$ENV_DOMAIN" != "your-domain.com" && -n "$ENV_DOMAIN" ]] && DOMAIN="$ENV_DOMAIN"

  ENV_FRONTEND=$(grep '^FRONTEND_URL=' "$ENV_FILE" | cut -d'=' -f2 | tr -d '"' | xargs || true)
  if [[ -z "$DOMAIN" && "$ENV_FRONTEND" == https://* ]]; then
    DOMAIN=$(echo "$ENV_FRONTEND" | sed 's|https://||')
    [[ "$DOMAIN" == SEU_* ]] && DOMAIN=""
  fi
fi

if [[ -n "$DOMAIN" ]]; then
  log_ok "Domínio detectado: $DOMAIN"
else
  log_warn "Nenhum domínio configurado. Usando IP ($PUBLIC_IP) para HTTP."
  log_warn "Para HTTPS, configure DOMAIN=seu-dominio.com no .env.production"
fi

# Validar Ubuntu
if ! grep -qi 'ubuntu' /etc/os-release 2>/dev/null; then
  log_warn "Sistema não é Ubuntu. Pode haver incompatibilidades."
else
  log_ok "Ubuntu detectado"
fi

# ── 2. PREPARAÇÃO DO SISTEMA ─────────────────────────────────────
log_info "=== Instalando dependências do sistema ==="

apt-get update -qq

# Nginx
if ! command -v nginx &>/dev/null; then
  log_info "Instalando nginx..."
  apt-get install -y -qq nginx
  log_ok "nginx instalado"
else
  log_ok "nginx já instalado ($(nginx -v 2>&1 | head -1))"
fi

# Certbot
if ! command -v certbot &>/dev/null; then
  log_info "Instalando certbot..."
  apt-get install -y -qq certbot python3-certbot-nginx
  log_ok "certbot instalado"
else
  log_ok "certbot já instalado"
fi

# Docker
if ! command -v docker &>/dev/null; then
  log_info "Instalando Docker..."
  curl -fsSL https://get.docker.com | sh
  usermod -aG docker root 2>/dev/null || true
  log_ok "Docker instalado"
else
  log_ok "Docker já instalado ($(docker --version))"
fi

# Docker Compose (plugin)
if ! docker compose version &>/dev/null; then
  log_info "Instalando Docker Compose plugin..."
  apt-get install -y -qq docker-compose-plugin
  log_ok "Docker Compose plugin instalado"
else
  log_ok "Docker Compose já instalado ($(docker compose version --short))"
fi

# Node.js (para build do frontend)
if ! command -v node &>/dev/null; then
  log_info "Instalando Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
  log_ok "Node.js instalado ($(node --version))"
else
  log_ok "Node.js já instalado ($(node --version))"
fi

# ── 3. GERAR NGINX CONFIG ────────────────────────────────────────
log_info "=== Gerando configuração do Nginx ==="

mkdir -p "${PROJECT_ROOT}/infra/nginx"

if [[ -n "$DOMAIN" ]]; then
  # Config com domínio + HTTPS redirect
  cat > "$NGINX_CONF" <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name ${DOMAIN};

    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;

    client_max_body_size 50m;

    # API + WebSocket
    location /api/ {
        proxy_pass http://localhost:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
    }

    location /socket.io/ {
        proxy_pass http://localhost:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    location /health {
        proxy_pass http://localhost:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }

    # Frontend static
    location / {
        root ${PROJECT_ROOT}/frontend/dist;
        try_files \$uri \$uri/ /index.html;

        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;
    gzip_min_length 1000;
}
EOF
  log_ok "nginx.conf gerado para domínio: $DOMAIN"
else
  # Config com IP apenas (HTTP)
  cat > "$NGINX_CONF" <<EOF
server {
    listen 80;
    server_name ${PUBLIC_IP};

    client_max_body_size 50m;

    # API + WebSocket
    location /api/ {
        proxy_pass http://localhost:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
    }

    location /socket.io/ {
        proxy_pass http://localhost:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    location /health {
        proxy_pass http://localhost:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }

    # Frontend static
    location / {
        root ${PROJECT_ROOT}/frontend/dist;
        try_files \$uri \$uri/ /index.html;

        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;
    gzip_min_length 1000;
}
EOF
  log_ok "nginx.conf gerado para IP: $PUBLIC_IP (HTTP apenas)"
fi

# ── 4. ATIVAR NGINX CONFIG ───────────────────────────────────────
log_info "=== Ativando configuração do Nginx ==="

# Remover default se existir
[[ -L "$NGINX_DEFAULT" ]] && rm "$NGINX_DEFAULT"
[[ -f "$NGINX_DEFAULT" ]] && rm "$NGINX_DEFAULT"

# Copiar config
mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
cp "$NGINX_CONF" "$NGINX_AVAILABLE"
ln -sf "$NGINX_AVAILABLE" "$NGINX_ENABLED"

# Testar config
if nginx -t 2>/dev/null; then
  log_ok "Configuração do nginx válida"
  systemctl reload nginx || systemctl restart nginx
  log_ok "nginx recarregado"
else
  log_error "Configuração do nginx inválida!"
  nginx -t || true
  exit 1
fi

# ── 5. SSL (se domínio configurado) ────────────────────────────────
if [[ -n "$DOMAIN" ]]; then
  log_info "=== Configurando SSL para $DOMAIN ==="

  # Criar diretório para ACME challenge
  mkdir -p /var/www/certbot

  # Verificar se certificado já existe
  if [[ -d "/etc/letsencrypt/live/$DOMAIN" ]]; then
    log_ok "Certificado SSL já existe para $DOMAIN"
  else
    log_info "Solicitando certificado Let's Encrypt..."
    certbot certonly --nginx -d "$DOMAIN" --non-interactive --agree-tos \
      -m "${LETSENCRYPT_EMAIL:-admin@${DOMAIN}}" \
      --webroot-path /var/www/certbot 2>/dev/null || \
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos \
      -m "${LETSENCRYPT_EMAIL:-admin@${DOMAIN}}" || {
      log_warn "Falha ao obter certificado SSL. nginx continuará com HTTP fallback."
      log_warn "Verifique se o domínio $DOMAIN aponta para este IP: $PUBLIC_IP"
    }
  fi

  # Auto-renew cron
  if ! grep -q "certbot renew" /etc/crontab 2>/dev/null; then
    echo "0 3 * * * root certbot renew --quiet --nginx >> /var/log/letsencrypt-renew.log 2>&1" >> /etc/crontab
    log_ok "Cron de auto-renovação SSL adicionado"
  fi
else
  log_warn "SSL ignorado — configure DOMAIN no .env.production para ativar HTTPS"
fi

# ── 6. CONFIGURAR ENV (fallback de IP se necessário) ─────────────
log_info "=== Validando .env.production ==="

if [[ ! -f "$ENV_FILE" ]]; then
  log_warn "Arquivo .env.production não encontrado. Criando a partir do template..."
  cp "${PROJECT_ROOT}/.env.production.example" "$ENV_FILE"
  log_warn "Edite ${ENV_FILE} com suas credenciais antes do próximo deploy!"
fi

# Atualizar IP no env se placeholder
if grep -q "SEU_IP_DA_VPS\|SEU_DOMINIO" "$ENV_FILE" 2>/dev/null; then
  log_info "Atualizando placeholders no .env.production..."
  sed -i "s/SEU_IP_DA_VPS/${PUBLIC_IP}/g" "$ENV_FILE"
  sed -i "s/SEU_DOMINIO\.com/${DOMAIN:-$PUBLIC_IP}/g" "$ENV_FILE"
  log_ok "Placeholders atualizados"
fi

# ── 7. BUILD DO FRONTEND ─────────────────────────────────────────
log_info "=== Buildando frontend ==="

cd "${PROJECT_ROOT}/frontend"

# Detectar package manager
if [[ -f "package-lock.json" ]]; then
  npm ci
elif [[ -f "yarn.lock" ]]; then
  yarn install --frozen-lockfile
elif [[ -f "pnpm-lock.yaml" ]]; then
  pnpm install --frozen-lockfile
else
  npm install
fi

# Atualizar VITE_API_URL no .env.production do frontend se necessário
FRONTEND_ENV="${PROJECT_ROOT}/frontend/.env.production"
API_BASE="${DOMAIN:+https://${DOMAIN}}"
API_BASE="${API_BASE:-http://${PUBLIC_IP}}"

echo "VITE_API_URL=${API_BASE}" > "$FRONTEND_ENV"
log_info "VITE_API_URL definido: $API_BASE"

npm run build 2>&1 | tail -n 5
if [[ -d "${PROJECT_ROOT}/frontend/dist" ]]; then
  log_ok "Frontend buildado com sucesso"
else
  log_error "Falha no build do frontend!"
  exit 1
fi

# ── 8. DOCKER COMPOSE ─────────────────────────────────────────────
log_info "=== Subindo Docker Compose ==="

cd "$PROJECT_ROOT"

# Garantir diretórios de volumes
mkdir -p logs/backend backups/postgres

# Parar containers antigos se existirem
docker compose -f docker-compose.production.yml --env-file .env.production down --timeout 30 2>/dev/null || true

# Subir
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build --remove-orphans

# Aguardar backend ficar saudável
log_info "Aguardando backend ficar saudável (até 120s)..."
for i in {1..24}; do
  if docker compose -f docker-compose.production.yml ps backend | grep -q "healthy"; then
    log_ok "Backend saudável"
    break
  fi
  sleep 5
  echo -n "."
done

if ! docker compose -f docker-compose.production.yml ps backend | grep -q "healthy"; then
  log_warn "Backend não reportou healthy ainda. Verificando logs..."
  docker compose -f docker-compose.production.yml logs --tail=20 backend || true
fi

# ── 9. VALIDAÇÃO ─────────────────────────────────────────────────
log_info "=== Validação final ==="

# Testar nginx
if systemctl is-active --quiet nginx; then
  log_ok "Nginx: ATIVO"
else
  log_error "Nginx: INATIVO"
fi

# Testar containers
RUNNING=$(docker compose -f docker-compose.production.yml ps --format json 2>/dev/null | grep -c '"State":"running"' || echo "0")
if [[ "$RUNNING" -ge 4 ]]; then
  log_ok "Containers Docker: $RUNNING rodando"
else
  log_warn "Containers Docker: apenas $RUNNING rodando (esperado: 5+)"
fi

# Testar API via nginx
if [[ -n "$DOMAIN" ]]; then
  API_URL="https://${DOMAIN}"
else
  API_URL="http://${PUBLIC_IP}"
fi

sleep 3
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/health" 2>/dev/null || echo "000")
if [[ "$HEALTH_STATUS" == "200" ]]; then
  log_ok "API health check: HTTP ${HEALTH_STATUS}"
else
  log_warn "API health check: HTTP ${HEALTH_STATUS} (pode levar mais alguns segundos)"
fi

# ── 10. RELATÓRIO FINAL ──────────────────────────────────────────
echo ""
echo "============================================================"
echo "           ZAPAI DEPLOY CONCLUÍDO"
echo "============================================================"
echo ""
echo -e "\033[1mURL de acesso:\033[0m"
if [[ -n "$DOMAIN" ]]; then
  echo -e "  \033[32mhttps://${DOMAIN}\033[0m"
  echo -e "  (Certificado SSL: Let's Encrypt)"
else
  echo -e "  \033[33mhttp://${PUBLIC_IP}\033[0m"
  echo -e "  \033[33m(Para HTTPS, configure DOMAIN no .env.production)\033[0m"
fi
echo ""
echo -e "\033[1mStatus dos serviços:\033[0m"
echo "  Nginx:    $(systemctl is-active nginx 2>/dev/null || echo 'unknown')"
echo "  Backend:  $(docker compose -f docker-compose.production.yml ps backend --format json 2>/dev/null | grep -o '"State":"[^"]*"' | cut -d'"' -f4 || echo 'unknown')"
echo "  Postgres: $(docker compose -f docker-compose.production.yml ps postgres --format json 2>/dev/null | grep -o '"State":"[^"]*"' | cut -d'"' -f4 || echo 'unknown')"
echo "  Redis:    $(docker compose -f docker-compose.production.yml ps redis --format json 2>/dev/null | grep -o '"State":"[^"]*"' | cut -d'"' -f4 || echo 'unknown')"
echo ""
echo -e "\033[1mPróximos passos:\033[0m"
if [[ -z "$DOMAIN" ]]; then
  echo "  1. Compre/aponte um domínio para: ${PUBLIC_IP}"
  echo "  2. Configure DOMAIN=seu-dominio.com no .env.production"
  echo "  3. Rode este script novamente para ativar HTTPS"
fi
echo "  4. Teste o login com as credenciais do .env.production"
echo "  5. Configure o WhatsApp em: ${API_URL}/connections"
echo ""

if [[ $ERRORS -eq 0 ]]; then
  echo -e "\033[32m✅ DEPLOY CONCLUÍDO COM SUCESSO\033[0m"
  exit 0
else
  echo -e "\033[31m❌ ${ERRORS} ERRO(S) ENCONTRADO(S)\033[0m"
  echo "Verifique os logs acima."
  exit 1
fi
