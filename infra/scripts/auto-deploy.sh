#!/bin/bash
set -uo pipefail

# ============================================================
# ZAPAI AUTO-DEPLOY PRO — Deploy idempotente com rollback
# Roda diretamente na VPS Ubuntu
# Uso: bash infra/scripts/auto-deploy.sh [--debug|-d] [--status|-s] [--skip-build] [--no-rollback]
# ============================================================

# ── Argument parsing ───────────────────────────────────────────────
DEBUG=false
STATUS_MODE=false
SKIP_BUILD=false
NO_ROLLBACK=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --debug|-d)       DEBUG=true; shift ;;
    --status|-s)      STATUS_MODE=true; shift ;;
    --skip-build)     SKIP_BUILD=true; shift ;;
    --no-rollback)    NO_ROLLBACK=true; shift ;;
    *)                shift ;;
  esac
done

# ── Paths & globals ──────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env.production"
NGINX_CONF="${PROJECT_ROOT}/infra/nginx/nginx.conf"
BACKUP_DIR="${PROJECT_ROOT}/backups/rollback"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
CURRENT_BACKUP="${BACKUP_DIR}/${TIMESTAMP}"
ERRORS=0
WARNINGS=0
DEPLOY_SUCCESS=false

# ── Logging ──────────────────────────────────────────────────────
log_info()  { echo -e "\033[34m[INFO]\033[0m  $*"; }
log_ok()    { echo -e "\033[32m[OK]\033[0m    $*"; }
log_warn()  { echo -e "\033[33m[WARN]\033[0m  $*"; ((WARNINGS++)) || true; }
log_error() { echo -e "\033[31m[ERROR]\033[0m $*"; ((ERRORS++)) || true; }
log_debug() { [[ "$DEBUG" == "true" ]] && echo -e "\033[35m[DEBUG]\033[0m $*"; }
log_section() { echo -e "\n\033[36m━━━ $* ━━━\033[0m"; }

# ── Trap: rollback on failure ────────────────────────────────────
cleanup_on_exit() {
  if [[ "$DEPLOY_SUCCESS" == "false" && "$NO_ROLLBACK" == "false" && "$STATUS_MODE" == "false" ]]; then
    log_error "Deploy falhou. Executando rollback..."
    execute_rollback
  fi
}
trap cleanup_on_exit EXIT

# ═══════════════════════════════════════════════════════════════
# STATUS MODE
# ═══════════════════════════════════════════════════════════════
show_status() {
  log_section "STATUS DO SISTEMA"
  local domain="" public_ip=""
  
  # Detect IP
  public_ip=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || echo "n/a")
  
  # Detect domain
  if [[ -f "$ENV_FILE" ]]; then
    domain=$(grep '^DOMAIN=' "$ENV_FILE" | cut -d'=' -f2 | tr -d '"' | xargs 2>/dev/null || true)
    [[ "$domain" == "your-domain.com" ]] && domain=""
  fi
  
  echo "  VPS IP:        $public_ip"
  echo "  Domínio:       ${domain:-(não configurado)}"
  echo "  Nginx Docker:  $(docker inspect -f '{{.State.Status}}' zapai-nginx 2>/dev/null || echo 'inativo')"
  echo "  SSL:           $([ -d "/etc/letsencrypt/live/${domain:-}" ] 2>/dev/null && echo 'ativo' || echo 'inativo / n/a')"
  echo ""
  
  echo "  Containers Docker:"
  docker compose -f "${PROJECT_ROOT}/docker-compose.production.yml" ps --format table 2>/dev/null || echo "    (compose não rodando)"
  
  echo ""
  echo "  URLs:"
  if [[ -n "$domain" ]]; then
    echo "    https://${domain}"
  fi
  echo "    http://${public_ip}"
  
  # Quick health check
  echo ""
  local health_url="http://localhost/health"
  local code=$(curl -s -o /dev/null -w "%{http_code}" "$health_url" 2>/dev/null || echo "000")
  if [[ "$code" == "200" ]]; then
    log_ok "Health check: HTTP $code"
  else
    log_warn "Health check: HTTP $code"
  fi
}

if [[ "$STATUS_MODE" == "true" ]]; then
  show_status
  exit 0
fi

# ═══════════════════════════════════════════════════════════════
# ROLLBACK FUNCTIONS
# ═══════════════════════════════════════════════════════════════
backup_current_state() {
  log_section "BACKUP PRÉ-DEPLOY"
  mkdir -p "$CURRENT_BACKUP"
  
  # 1. Nginx config
  if [[ -f "$NGINX_CONF" ]]; then
    cp "$NGINX_CONF" "$CURRENT_BACKUP/nginx.conf"
    log_debug "nginx.conf backup: $CURRENT_BACKUP/nginx.conf"
  fi
  
  # 2. Frontend dist
  if [[ -d "${PROJECT_ROOT}/frontend/dist" ]]; then
    cp -a "${PROJECT_ROOT}/frontend/dist" "$CURRENT_BACKUP/dist"
    log_debug "frontend/dist backup: $CURRENT_BACKUP/dist"
  fi
  
  # 3. Docker image tags (only our custom image)
  if docker image inspect zapai/backend:prod &>/dev/null; then
    docker tag zapai/backend:prod "zapai/backend:rollback-${TIMESTAMP}"
    log_debug "Imagem backend taggeada: zapai/backend:rollback-${TIMESTAMP}"
  fi
  
  # 4. Save running container IDs
  docker compose -f "${PROJECT_ROOT}/docker-compose.production.yml" ps -q > "$CURRENT_BACKUP/containers.txt" 2>/dev/null || true
  
  # 5. Env file
  [[ -f "$ENV_FILE" ]] && cp "$ENV_FILE" "$CURRENT_BACKUP/env"
  
  # 6. Mark backup
  echo "$TIMESTAMP" > "$BACKUP_DIR/last-deploy"
  
  log_ok "Backup criado: $CURRENT_BACKUP"
  
  # Cleanup old backups (keep last 5)
  ls -1d "$BACKUP_DIR"/20* 2>/dev/null | sort -r | tail -n +6 | xargs -r rm -rf 2>/dev/null || true
}

execute_rollback() {
  log_section "ROLLBACK"
  local backup="$CURRENT_BACKUP"
  
  if [[ ! -d "$backup" ]]; then
    log_warn "Nenhum backup de deploy encontrado. Rollback manual necessário."
    return 1
  fi
  
  # 1. Restore nginx
  if [[ -f "$backup/nginx.conf" ]]; then
    cp "$backup/nginx.conf" "$NGINX_CONF"
    docker compose -f "${PROJECT_ROOT}/docker-compose.production.yml" --env-file "${ENV_FILE}" up -d nginx || true
    log_ok "nginx.conf restaurado"
  fi
  
  # 2. Restore frontend dist
  if [[ -d "$backup/dist" ]]; then
    rm -rf "${PROJECT_ROOT}/frontend/dist"
    cp -a "$backup/dist" "${PROJECT_ROOT}/frontend/dist"
    log_ok "frontend/dist restaurado"
  fi
  
  # 3. Restore backend image
  local rollback_img="zapai/backend:rollback-${TIMESTAMP}"
  if docker image inspect "$rollback_img" &>/dev/null; then
    docker tag "$rollback_img" zapai/backend:prod
    log_ok "Imagem Docker backend restaurada"
  fi
  
  # 4. Restart containers (without --build, using restored image)
  cd "$PROJECT_ROOT"
  docker compose -f docker-compose.production.yml --env-file .env.production down --timeout 30 || true
  docker compose -f docker-compose.production.yml --env-file .env.production up -d || true
  
  log_warn "Rollback concluído. Sistema pode estar instável — verifique os logs."
  log_info "Backup salvo em: $backup"
}

# ═══════════════════════════════════════════════════════════════
# VALIDATION
# ═══════════════════════════════════════════════════════════════
validate_deployment() {
  local base_url=$1
  local max_wait=${2:-90}
  local interval=5
  local attempts=$((max_wait / interval))
  local i
  local all_ok=true
  
  log_section "VALIDAÇÃO DO DEPLOY"
  
  # 1. Nginx container
  if docker inspect -f '{{.State.Running}}' zapai-nginx 2>/dev/null | grep -q true; then
    log_ok "Nginx container: ATIVO"
  else
    log_error "Nginx container: INATIVO"
    all_ok=false
  fi
  
  # 2. Health endpoint (retry loop)
  log_info "Testando /health (até ${max_wait}s)..."
  local health_ok=false
  for ((i=1; i<=attempts; i++)); do
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" "${base_url}/health" 2>/dev/null || echo "000")
    log_debug "  Tentativa $i/$attempts: HTTP $code"
    if [[ "$code" == "200" ]]; then
      log_ok "API Health: HTTP 200"
      health_ok=true
      break
    fi
    sleep $interval
  done
  if [[ "$health_ok" == "false" ]]; then
    log_error "API Health: falhou após ${max_wait}s"
    all_ok=false
  fi
  
  # 3. Frontend HTTP
  local frontend_code
  frontend_code=$(curl -s -o /dev/null -w "%{http_code}" "${base_url}" 2>/dev/null || echo "000")
  if [[ "$frontend_code" == "200" || "$frontend_code" == "301" || "$frontend_code" == "302" ]]; then
    log_ok "Frontend: HTTP $frontend_code"
  else
    log_error "Frontend: HTTP $frontend_code"
    all_ok=false
  fi
  
  # 4. API endpoint
  local api_code
  api_code=$(curl -s -o /dev/null -w "%{http_code}" "${base_url}/api/health" 2>/dev/null || echo "000")
  if [[ "$api_code" == "200" ]]; then
    log_ok "API /api/health: HTTP 200"
  else
    log_warn "API /api/health: HTTP $api_code (pode ser normal se ainda subindo)"
  fi
  
  # 5. WebSocket handshake (we expect 400 without proper WS handshake, or 200)
  local ws_code
  ws_code=$(curl -s -o /dev/null -w "%{http_code}" -N \
    -H "Upgrade: websocket" -H "Connection: Upgrade" \
    "${base_url}/socket.io/?EIO=4&transport=websocket" 2>/dev/null || echo "000")
  if [[ "$ws_code" == "200" || "$ws_code" == "400" || "$ws_code" == "101" ]]; then
    log_ok "WebSocket: responde (HTTP $ws_code)"
  else
    log_warn "WebSocket: HTTP $ws_code"
  fi
  
  # 6. Docker containers
  local running
  running=$(docker compose -f "${PROJECT_ROOT}/docker-compose.production.yml" ps --format json 2>/dev/null | grep -c '"State":"running"' || echo "0")
  if [[ "$running" -ge 4 ]]; then
    log_ok "Containers Docker: $running rodando"
  else
    log_warn "Containers Docker: apenas $running rodando (esperado 4+)"
  fi
  
  # 7. Backend healthy status
  local backend_state
  backend_state=$(docker compose -f "${PROJECT_ROOT}/docker-compose.production.yml" ps backend --format json 2>/dev/null | grep -o '"Health":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
  if [[ "$backend_state" == "healthy" ]]; then
    log_ok "Backend health: $backend_state"
  else
    log_warn "Backend health: $backend_state"
  fi
  
  if [[ "$all_ok" == "true" ]]; then
    log_ok "TODAS AS VALIDAÇÕES PASSARAM"
    return 0
  else
    log_error "VALIDAÇÃO FALHOU"
    return 1
  fi
}

# ═══════════════════════════════════════════════════════════════
# AUTO-DETECTION
# ═══════════════════════════════════════════════════════════════
detect_environment() {
  log_section "AUTO-DETECÇÃO"
  
  # IP público
  PUBLIC_IP=$(curl -s --max-time 10 ifconfig.me 2>/dev/null || curl -s --max-time 10 icanhazip.com 2>/dev/null || echo "")
  if [[ -z "$PUBLIC_IP" ]]; then
    PUBLIC_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
    log_warn "IP público não detectado via serviço externo. Usando local: $PUBLIC_IP"
  else
    log_ok "IP público: $PUBLIC_IP"
  fi
  
  # Porta backend
  BACKEND_PORT=4025
  if [[ -f "${PROJECT_ROOT}/docker-compose.production.yml" ]]; then
    local detected
    detected=$(grep -oP 'PORT:\s*\K[0-9]+' "${PROJECT_ROOT}/docker-compose.production.yml" 2>/dev/null | head -1)
    [[ -n "$detected" ]] && BACKEND_PORT=$detected
  fi
  log_info "Backend porta: $BACKEND_PORT"
  
  # Domínio
  DOMAIN=""
  if [[ -f "$ENV_FILE" ]]; then
    local env_domain
    env_domain=$(grep '^DOMAIN=' "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | xargs || true)
    [[ "$env_domain" != "your-domain.com" && -n "$env_domain" ]] && DOMAIN="$env_domain"
    
    if [[ -z "$DOMAIN" ]]; then
      local env_frontend
      env_frontend=$(grep '^FRONTEND_URL=' "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | xargs || true)
      if [[ "$env_frontend" == https://* ]]; then
        DOMAIN=$(echo "$env_frontend" | sed 's|https://||')
        [[ "$DOMAIN" == SEU_* ]] && DOMAIN=""
      fi
    fi
  fi
  
  if [[ -n "$DOMAIN" ]]; then
    log_ok "Domínio: $DOMAIN"
  else
    log_warn "Nenhum domínio configurado. Usando IP ($PUBLIC_IP) para HTTP."
  fi
  
  # OS check
  if ! grep -qi 'ubuntu' /etc/os-release 2>/dev/null; then
    log_warn "Sistema não é Ubuntu. Pode haver incompatibilidades."
  else
    log_ok "OS: Ubuntu detectado"
  fi
  
  # API URL for final report
  if [[ -n "$DOMAIN" ]]; then
    API_URL="https://${DOMAIN}"
  else
    API_URL="http://${PUBLIC_IP}"
  fi
}

# ═══════════════════════════════════════════════════════════════
# SYSTEM PREP (idempotent)
# ═══════════════════════════════════════════════════════════════
prepare_system() {
  log_section "PREPARAÇÃO DO SISTEMA (idempotente)"
  
  # Update only if apt hasn't been updated recently (>24h)
  local apt_cache="/var/cache/apt/pkgcache.bin"
  if [[ ! -f "$apt_cache" ]] || [[ $(find "$apt_cache" -mtime +0 2>/dev/null) ]]; then
    log_info "Atualizando apt..."
    apt-get update -qq
  else
    log_ok "apt já atualizado recentemente (pulando)"
  fi
  
  # Host nginx must not bind 80/443; production uses Docker nginx.
  if command -v nginx &>/dev/null && systemctl is-active --quiet nginx 2>/dev/null; then
    log_warn "Nginx do host está ativo. Parando para liberar portas 80/443 ao container."
    systemctl stop nginx || true
  fi
  
  # Certbot
  if ! command -v certbot &>/dev/null; then
    log_info "Instalando certbot..."
    apt-get install -y -qq certbot python3-certbot-nginx
    log_ok "certbot instalado"
  else
    log_ok "certbot: já instalado"
  fi
  
  # Docker
  if ! command -v docker &>/dev/null; then
    log_info "Instalando Docker..."
    curl -fsSL https://get.docker.com | sh
    usermod -aG docker root 2>/dev/null || true
    log_ok "Docker instalado"
  else
    log_ok "Docker: $(docker --version)"
  fi
  
  # Docker Compose plugin
  if ! docker compose version &>/dev/null; then
    log_info "Instalando Docker Compose plugin..."
    apt-get install -y -qq docker-compose-plugin
    log_ok "Docker Compose plugin instalado"
  else
    log_ok "Docker Compose: $(docker compose version --short)"
  fi
  
  # Node.js
  if ! command -v node &>/dev/null; then
    log_info "Instalando Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
    log_ok "Node.js: $(node --version)"
  else
    log_ok "Node.js: $(node --version)"
  fi
  
  # UFW (if installed, ensure http/https are open)
  if command -v ufw &>/dev/null; then
    ufw status 2>/dev/null | grep -q "Status: active" && {
      ufw allow 80/tcp 2>/dev/null || true
      ufw allow 443/tcp 2>/dev/null || true
      log_ok "UFW: portas 80/443 liberadas"
    } || log_debug "UFW inativo — ignorando"
  fi
}

# ═══════════════════════════════════════════════════════════════
# NGINX CONFIG (idempotent)
# ═══════════════════════════════════════════════════════════════
configure_nginx() {
  log_section "NGINX"
  mkdir -p "${PROJECT_ROOT}/infra/nginx"

  local new_conf
  local ssl_ready=false
  [[ -n "$DOMAIN" && -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" && -f "/etc/letsencrypt/live/${DOMAIN}/privkey.pem" ]] && ssl_ready=true

  if [[ -n "$DOMAIN" && "$ssl_ready" == "true" ]]; then
    new_conf=$(cat <<EOF
server {
    listen 80;
    server_name ${DOMAIN};
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://\$host\$request_uri; }
}
server {
    listen 443 ssl;
    server_name ${DOMAIN};
    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    client_max_body_size 50m;
    location /api/ {
        proxy_pass http://backend:${BACKEND_PORT};
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
        proxy_pass http://backend:${BACKEND_PORT};
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
        proxy_pass http://backend:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }
    location / {
        root /usr/share/nginx/html;
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
)
  elif [[ -n "$DOMAIN" ]]; then
    new_conf=$(cat <<EOF
server {
    listen 80;
    server_name ${DOMAIN};
    client_max_body_size 50m;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location /api/ {
        proxy_pass http://backend:${BACKEND_PORT};
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
        proxy_pass http://backend:${BACKEND_PORT};
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
        proxy_pass http://backend:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }
    location / {
        root /usr/share/nginx/html;
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
)
  else
    new_conf=$(cat <<EOF
server {
    listen 80;
    server_name ${PUBLIC_IP};
    client_max_body_size 50m;
    location /api/ {
        proxy_pass http://backend:${BACKEND_PORT};
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
        proxy_pass http://backend:${BACKEND_PORT};
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
        proxy_pass http://backend:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }
    location / {
        root /usr/share/nginx/html;
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
)
  fi
  
  # Only write if changed (idempotent)
  if [[ -f "$NGINX_CONF" ]] && diff -q <(echo "$new_conf") "$NGINX_CONF" &>/dev/null; then
    log_ok "nginx.conf já está atualizado (sem alterações)"
  else
    echo "$new_conf" > "$NGINX_CONF"
    log_ok "nginx.conf atualizado"
  fi
  
  if docker run --rm -v "${NGINX_CONF}:/etc/nginx/conf.d/default.conf:ro" nginx:alpine nginx -t &>/tmp/zapai-nginx-test.log; then
    log_ok "nginx.conf válido para container"
  else
    log_error "nginx.conf inválido para container"
    cat /tmp/zapai-nginx-test.log || true
    return 1
  fi
}

# ═══════════════════════════════════════════════════════════════
# SSL (smart — avoid rate limits)
# ═══════════════════════════════════════════════════════════════
configure_ssl() {
  log_section "SSL / HTTPS"
  
  if [[ -z "$DOMAIN" ]]; then
    log_warn "Nenhum domínio configurado — SSL ignorado"
    return 0
  fi
  
  mkdir -p /var/www/certbot
  
  # Check if cert already exists and is valid
  if [[ -d "/etc/letsencrypt/live/$DOMAIN" ]]; then
    local expiry
    expiry=$(openssl x509 -in "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" -noout -dates 2>/dev/null | grep notAfter | cut -d= -f2)
    if [[ -n "$expiry" ]]; then
      log_ok "Certificado SSL existente válido até: $expiry"
    else
      log_warn "Certificado existe mas não pôde ser validado"
    fi
  else
    log_info "Solicitando certificado Let's Encrypt..."
    # Dry-run first to avoid rate limits on failure. Uses Docker nginx webroot.
    if certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" --non-interactive --agree-tos \
         -m "${LETSENCRYPT_EMAIL:-admin@${DOMAIN}}" --dry-run &>/dev/null; then
      log_ok "Dry-run certbot: OK"
      # Real request
      certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" --non-interactive --agree-tos \
        -m "${LETSENCRYPT_EMAIL:-admin@${DOMAIN}}" 2>/dev/null || {
        log_warn "Falha ao obter certificado SSL. nginx continuará com HTTP fallback."
        log_warn "Verifique se o domínio $DOMAIN aponta para este IP: $PUBLIC_IP"
      }
    else
      log_warn "Dry-run certbot falhou — pulando para evitar rate limit"
      log_warn "Verifique se o DNS de $DOMAIN aponta para $PUBLIC_IP"
    fi
  fi
  
  # Auto-renew cron (idempotent)
  if ! grep -q "certbot renew" /etc/crontab 2>/dev/null; then
    echo "0 3 * * * root certbot renew --quiet --nginx >> /var/log/letsencrypt-renew.log 2>&1" >> /etc/crontab
    log_ok "Cron auto-renovação SSL adicionado"
  else
    log_ok "Cron auto-renovação SSL já existe"
  fi
}

# ═══════════════════════════════════════════════════════════════
# ENV CONFIG
# ═══════════════════════════════════════════════════════════════
configure_env() {
  log_section "ENVIRONMENT"
  
  if [[ ! -f "$ENV_FILE" ]]; then
    if [[ -f "${PROJECT_ROOT}/.env.production.example" ]]; then
      cp "${PROJECT_ROOT}/.env.production.example" "$ENV_FILE"
      log_warn ".env.production criado do template. EDITE COM SUAS CREDENCIAIS!"
    else
      log_error "Template .env.production.example não encontrado!"
      return 1
    fi
  fi
  
  # Update placeholders (idempotent — only if present)
  local changed=false
  if grep -q "SEU_IP_DA_VPS\|SEU_DOMINIO\|your-domain.com" "$ENV_FILE" 2>/dev/null; then
    sed -i "s/SEU_IP_DA_VPS/${PUBLIC_IP}/g" "$ENV_FILE"
    sed -i "s/SEU_DOMINIO\.com/${DOMAIN:-$PUBLIC_IP}/g" "$ENV_FILE"
    sed -i "s/your-domain\.com/${DOMAIN:-$PUBLIC_IP}/g" "$ENV_FILE"
    changed=true
  fi
  
  # Ensure FRONTEND_URL is set
  if ! grep -q "^FRONTEND_URL=" "$ENV_FILE" 2>/dev/null; then
    echo "FRONTEND_URL=${API_URL}" >> "$ENV_FILE"
    changed=true
  fi
  
  if [[ "$changed" == "true" ]]; then
    log_ok ".env.production atualizado (placeholders preenchidos)"
  else
    log_ok ".env.production: OK"
  fi
}

# ═══════════════════════════════════════════════════════════════
# FRONTEND BUILD
# ═══════════════════════════════════════════════════════════════
build_frontend() {
  log_section "FRONTEND BUILD"
  
  cd "${PROJECT_ROOT}/frontend"
  
  # Package manager detection (idempotent — node_modules check)
  if [[ ! -d "node_modules" ]]; then
    log_info "Instalando dependências do frontend..."
    if [[ -f "package-lock.json" ]]; then
      npm ci
    elif [[ -f "yarn.lock" ]]; then
      yarn install --frozen-lockfile
    elif [[ -f "pnpm-lock.yaml" ]]; then
      pnpm install --frozen-lockfile
    else
      npm install
    fi
  else
    log_ok "node_modules já existe (pulando install)"
  fi
  
  # Set VITE_API_URL
  FRONTEND_ENV="${PROJECT_ROOT}/frontend/.env.production"
  echo "VITE_API_URL=${API_URL}" > "$FRONTEND_ENV"
  log_info "VITE_API_URL=${API_URL}"
  
  # Build
  log_info "Compilando frontend..."
  if npm run build 2>&1 | tee /tmp/zapai-frontend-build.log | tail -n 10; then
    if [[ -d "${PROJECT_ROOT}/frontend/dist" ]] && [[ -f "${PROJECT_ROOT}/frontend/dist/index.html" ]]; then
      log_ok "Frontend buildado com sucesso"
    else
      log_error "Build falhou — dist/index.html não encontrado"
      return 1
    fi
  else
    log_error "Build do frontend falhou"
    cat /tmp/zapai-frontend-build.log | tail -n 20
    return 1
  fi
}

# ═══════════════════════════════════════════════════════════════
# DOCKER DEPLOY
# ═══════════════════════════════════════════════════════════════
deploy_docker() {
  log_section "DOCKER DEPLOY"
  cd "$PROJECT_ROOT"
  
  # Ensure volume dirs exist
  mkdir -p logs/backend backups/postgres
  
  # Pre-build images (non-destructive)
  if [[ "$SKIP_BUILD" == "false" ]]; then
    log_info "Buildando imagens Docker..."
    if ! docker compose -f docker-compose.production.yml --env-file .env.production build --pull=false; then
      log_error "Falha no build Docker"
      return 1
    fi
    log_ok "Imagens Docker buildadas"
  fi
  
  # Down old containers
  log_info "Parando containers antigos..."
  docker compose -f docker-compose.production.yml --env-file .env.production down --timeout 30 || true
  
  # Up new containers
  log_info "Subindo novos containers..."
  if ! docker compose -f docker-compose.production.yml --env-file .env.production up -d --remove-orphans; then
    log_error "Falha ao subir containers"
    return 1
  fi
  
  # Wait for backend healthy
  log_info "Aguardando backend healthy (até 120s)..."
  local healthy=false
  for ((i=1; i<=24; i++)); do
    local state
    state=$(docker compose -f docker-compose.production.yml ps backend --format json 2>/dev/null | grep -o '"Health":"[^"]*"' | cut -d'"' -f4 || echo "starting")
    if [[ "$state" == "healthy" ]]; then
      healthy=true
      log_ok "Backend healthy ($((i*5))s)"
      break
    fi
    echo -n "."
    sleep 5
  done
  echo ""
  
  if [[ "$healthy" == "false" ]]; then
    log_warn "Backend não ficou healthy em 120s"
    log_info "Últimos logs do backend:"
    docker compose -f docker-compose.production.yml logs --tail=15 backend || true
  fi
  
  return 0
}

# ═══════════════════════════════════════════════════════════════
# FINAL REPORT
# ═══════════════════════════════════════════════════════════════
show_final_report() {
  log_section "RELATÓRIO FINAL"
  
  echo ""
  echo "============================================================"
  echo "           ZAPAI DEPLOY PRO — CONCLUÍDO"
  echo "============================================================"
  echo ""
  
  # URL
  echo -e "\033[1mURL de acesso:\033[0m"
  if [[ -n "$DOMAIN" && -d "/etc/letsencrypt/live/$DOMAIN" ]]; then
    echo -e "  🌐 \033[32mhttps://${DOMAIN}\033[0m  ← principal"
    echo -e "  🔓 Certificado SSL: Let's Encrypt"
  elif [[ -n "$DOMAIN" ]]; then
    echo -e "  🔶 \033[33mhttp://${DOMAIN}\033[0m  ← domínio sem SSL (verifique DNS/Certbot)"
  else
    echo -e "  🔶 \033[33mhttp://${PUBLIC_IP}\033[0m  ← IP (sem domínio)"
    echo -e "     Configure DOMAIN=seu-dominio.com no .env.production para HTTPS"
  fi
  echo ""
  
  # Service status table
  echo -e "\033[1mStatus dos serviços:\033[0m"
  printf "  %-12s %s\n" "Nginx:" "$(docker inspect -f '{{.State.Status}}' zapai-nginx 2>/dev/null || echo 'inativo')"
  
  local services=(backend postgres redis nginx certbot postgres-backup)
  for svc in "${services[@]}"; do
    local state health
    state=$(docker compose -f "${PROJECT_ROOT}/docker-compose.production.yml" ps "$svc" --format json 2>/dev/null | grep -o '"State":"[^"]*"' | cut -d'"' -f4 || echo "-")
    health=$(docker compose -f "${PROJECT_ROOT}/docker-compose.production.yml" ps "$svc" --format json 2>/dev/null | grep -o '"Health":"[^"]*"' | cut -d'"' -f4 || echo "")
    [[ -n "$health" ]] && state="$state ($health)"
    printf "  %-12s %s\n" "${svc}:" "$state"
  done
  
  echo ""
  echo -e "\033[1mPróximos passos:\033[0m"
  if [[ -z "$DOMAIN" ]]; then
    echo "  1. Compre/aponte um domínio para: ${PUBLIC_IP}"
    echo "  2. Configure DOMAIN=seu-dominio.com no .env.production"
    echo "  3. Rode: bash infra/scripts/auto-deploy.sh"
  fi
  echo "  4. Teste o login em: ${API_URL}/login"
  echo "  5. Configure o WhatsApp em: ${API_URL}/connections"
  echo ""
  
  # Health summary
  local h_code
  h_code=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/health" 2>/dev/null || echo "000")
  if [[ "$h_code" == "200" ]]; then
    echo -e "\033[32m✅ SISTEMA ONLINE — Health check OK\033[0m"
  else
    echo -e "\033[33m⚠️  Health check: HTTP $h_code — aguarde mais alguns segundos\033[0m"
  fi
  
  echo ""
  echo "  Backup do deploy: $CURRENT_BACKUP"
  echo "  Para status:      bash infra/scripts/auto-deploy.sh --status"
  echo "  Para rollback:    Restaure manualmente ou rode backup em $CURRENT_BACKUP"
  echo ""
  echo "============================================================"
}

# ═══════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════
main() {
  log_info "Iniciando deploy ZAPAI — $(date)"
  log_info "Modo: debug=$DEBUG, skip-build=$SKIP_BUILD, no-rollback=$NO_ROLLBACK"
  
  detect_environment
  backup_current_state
  prepare_system
  configure_nginx || { log_error "Nginx config falhou"; exit 1; }
  configure_env || { log_error "Env config falhou"; exit 1; }
  
  if [[ "$SKIP_BUILD" == "false" ]]; then
    build_frontend || { log_error "Frontend build falhou"; exit 1; }
  else
    log_warn "Frontend build pulado (--skip-build)"
  fi
  
  deploy_docker || { log_error "Docker deploy falhou"; exit 1; }
  configure_ssl
  configure_nginx || { log_error "Nginx config pós-SSL falhou"; exit 1; }
  docker compose -f docker-compose.production.yml --env-file .env.production up -d nginx
  
  # Validation
  if validate_deployment "$API_URL" 90; then
    DEPLOY_SUCCESS=true
    show_final_report
    exit 0
  else
    log_error "VALIDAÇÃO FALHOU — Rollback será executado"
    exit 1
  fi
}

main "$@"
