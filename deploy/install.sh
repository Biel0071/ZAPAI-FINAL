#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-master}"
MODE="${MODE,,}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$APP_DIR/.env.production"
COMPOSE_FILE="$APP_DIR/docker-compose.production.yml"

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${BLUE}[INSTALL]${NC} $*"; }
ok() { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail() { echo -e "${RED}[ERR]${NC} $*"; exit 1; }

detect_public_ip() {
  local ip
  ip="$(curl -s --connect-timeout 4 https://api.ipify.org 2>/dev/null || true)"
  [ -n "$ip" ] || ip="$(curl -s --connect-timeout 4 https://checkip.amazonaws.com 2>/dev/null || true)"
  [ -n "$ip" ] || ip="$(curl -s --connect-timeout 4 ifconfig.me 2>/dev/null || true)"
  [ -n "$ip" ] || ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  ip="${ip// /}"

  if ! echo "$ip" | grep -Eq '^([0-9]{1,3}\.){3}[0-9]{1,3}$'; then
    ip="127.0.0.1"
  fi
  echo "$ip"
}

require_root() {
  if [ "${EUID:-0}" -ne 0 ]; then
    fail "Execute como root: sudo bash deploy/install.sh ..."
  fi
}

ensure_os_dependencies() {
  log "Instalando dependências de sistema"
  apt-get update -y
  apt-get install -y curl jq git ca-certificates openssl ufw
}

ensure_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    log "Instalando Docker"
    curl -fsSL https://get.docker.com | sh
  fi
  systemctl enable docker
  systemctl start docker

  docker compose version >/dev/null 2>&1 || fail "Docker Compose plugin ausente"
}

env_get() {
  local key="$1"
  local file="$2"
  [ -f "$file" ] || return 1
  grep -E "^${key}=" "$file" | tail -n1 | cut -d'=' -f2-
}

existing_or_default() {
  local key="$1"
  local default_value="$2"
  local value=""
  value="$(env_get "$key" "$ENV_FILE" || true)"
  if [ -n "$value" ]; then
    echo "$value"
  else
    echo "$default_value"
  fi
}

wait_http() {
  local url="$1"
  local timeout="$2"
  local start now elapsed
  start="$(date +%s)"

  until curl -fsS "$url" >/dev/null 2>&1; do
    now="$(date +%s)"
    elapsed=$((now - start))
    if [ "$elapsed" -ge "$timeout" ]; then
      return 1
    fi
    sleep 2
  done
}

prepare_folders() {
  log "Preparando pastas persistentes"
  mkdir -p "$APP_DIR/logs/backend" "$APP_DIR/backups/postgres" "$APP_DIR/backend/sessions" "$APP_DIR/backend/uploads"
}

write_master_env_files() {
  local public_ip="$1"
  local domain="${DOMAIN:-}"
  local ssl_email="${LETSENCRYPT_EMAIL:-}"
  local master_ip="${MASTER_VPS_IP:-209.50.229.68}"
  local master_hostname="${MASTER_HOSTNAME:-ZAP-AICRM}"

  local frontend_url
  local api_url
  local cors_origins

  if [ -n "$domain" ]; then
    frontend_url="https://${domain}"
    api_url="http://${master_ip}:4025"
    cors_origins="${frontend_url},http://${master_ip}:3000,http://${public_ip}:3000"
  else
    frontend_url="http://${master_ip}:3000"
    api_url="http://${master_ip}:4025"
    cors_origins="${frontend_url},http://${public_ip}:3000"
  fi

  local postgres_user
  local postgres_password
  local postgres_db
  local jwt_secret
  local auth_jwt_secret
  local admin_user
  local admin_password
  local master_panel_token
  local node_registration_token

  postgres_user="$(existing_or_default POSTGRES_USER zapai)"
  postgres_password="$(existing_or_default POSTGRES_PASSWORD "$(openssl rand -base64 32)")"
  postgres_db="$(existing_or_default POSTGRES_DB zapai_crm)"
  jwt_secret="$(existing_or_default JWT_SECRET "$(openssl rand -base64 64)")"
  auth_jwt_secret="$(existing_or_default AUTH_JWT_SECRET "$jwt_secret")"
  admin_user="$(existing_or_default AUTH_DEFAULT_USERNAME admin)"
  admin_password="$(existing_or_default AUTH_DEFAULT_PASSWORD admin123)"
  master_panel_token="$(existing_or_default MASTER_PANEL_TOKEN "$(openssl rand -hex 32)")"
  node_registration_token="$(existing_or_default NODE_REGISTRATION_TOKEN "$(openssl rand -hex 32)")"

  cat > "$ENV_FILE" <<EOF
POSTGRES_USER=${postgres_user}
POSTGRES_PASSWORD=${postgres_password}
POSTGRES_DB=${postgres_db}
JWT_SECRET=${jwt_secret}
AUTH_JWT_SECRET=${auth_jwt_secret}
AUTH_DEFAULT_USERNAME=${admin_user}
AUTH_DEFAULT_PASSWORD=${admin_password}
FRONTEND_URL=${frontend_url}
CORS_ALLOWED_ORIGINS=${cors_origins}
VITE_API_URL=${api_url}
MASTER_PANEL_TOKEN=${master_panel_token}
NODE_REGISTRATION_TOKEN=${node_registration_token}
MASTER=true
MASTER_HOSTNAME=${master_hostname}
MASTER_VPS_IP=${master_ip}
DOMAIN=${domain}
LETSENCRYPT_EMAIL=${ssl_email}
BACKUP_SCHEDULE=@daily
BACKUP_KEEP_DAYS=7
BACKUP_KEEP_WEEKS=4
BACKUP_KEEP_MONTHS=6
EOF

  cat > "$APP_DIR/backend/.env.production" <<EOF
NODE_ENV=production
PORT=4025
HOST=0.0.0.0
DATABASE_URL=postgresql://${postgres_user}:${postgres_password}@postgres:5432/${postgres_db}
POSTGRES_HOST=postgres
POSTGRES_USER=${postgres_user}
POSTGRES_PASSWORD=${postgres_password}
POSTGRES_DB=${postgres_db}
JWT_SECRET=${jwt_secret}
AUTH_JWT_SECRET=${auth_jwt_secret}
AUTH_DEFAULT_USERNAME=${admin_user}
AUTH_DEFAULT_PASSWORD=${admin_password}
MASTER_PANEL_TOKEN=${master_panel_token}
NODE_REGISTRATION_TOKEN=${node_registration_token}
MASTER_API_URL=${api_url}
MASTER=true
MASTER_HOSTNAME=${master_hostname}
MASTER_VPS_IP=${master_ip}
CRASH_EXIT_ON_UNHANDLED=true
LOG_LEVEL=info
FRONTEND_URL=${frontend_url}
CORS_ALLOWED_ORIGINS=${cors_origins}
EOF

  cat > "$APP_DIR/frontend/.env.production" <<EOF
VITE_API_URL=${api_url}
VITE_WHATSAPP_API_BASE_URL=${api_url}
EOF

  echo
  ok "MASTER NODE configurado"
  echo "MASTER=true"
  echo "MASTER_HOSTNAME=${master_hostname}"
  echo "MASTER_VPS_IP=${master_ip}"
  echo "NODE_REGISTRATION_TOKEN=${node_registration_token}"
  echo

  ok "Arquivos .env gerados automaticamente"
}

write_node_env_files() {
  local public_ip="$1"
  local master_url_raw="$2"
  local node_registration_token="$3"

  local master_api_url="${master_url_raw%/}"
  master_api_url="${master_api_url%/api}"

  local postgres_user
  local postgres_password
  local postgres_db
  local jwt_secret
  local auth_jwt_secret

  postgres_user="$(existing_or_default POSTGRES_USER zapai)"
  postgres_password="$(existing_or_default POSTGRES_PASSWORD "$(openssl rand -base64 32)")"
  postgres_db="$(existing_or_default POSTGRES_DB zapai_crm)"
  jwt_secret="$(existing_or_default JWT_SECRET "$(openssl rand -base64 64)")"
  auth_jwt_secret="$(existing_or_default AUTH_JWT_SECRET "$jwt_secret")"

  cat > "$ENV_FILE" <<EOF
POSTGRES_USER=${postgres_user}
POSTGRES_PASSWORD=${postgres_password}
POSTGRES_DB=${postgres_db}
JWT_SECRET=${jwt_secret}
AUTH_JWT_SECRET=${auth_jwt_secret}
AUTH_DEFAULT_USERNAME=admin
AUTH_DEFAULT_PASSWORD=admin123
FRONTEND_URL=http://${public_ip}:3000
CORS_ALLOWED_ORIGINS=http://${public_ip}:3000
VITE_API_URL=${master_api_url}
MASTER_PANEL_TOKEN=
NODE_REGISTRATION_TOKEN=${node_registration_token}
DOMAIN=
LETSENCRYPT_EMAIL=
BACKUP_SCHEDULE=@daily
BACKUP_KEEP_DAYS=7
BACKUP_KEEP_WEEKS=4
BACKUP_KEEP_MONTHS=6
EOF

  cat > "$APP_DIR/backend/.env.production" <<EOF
NODE_ENV=production
PORT=4025
HOST=0.0.0.0
DATABASE_URL=postgresql://${postgres_user}:${postgres_password}@postgres:5432/${postgres_db}
POSTGRES_HOST=postgres
POSTGRES_USER=${postgres_user}
POSTGRES_PASSWORD=${postgres_password}
POSTGRES_DB=${postgres_db}
JWT_SECRET=${jwt_secret}
AUTH_JWT_SECRET=${auth_jwt_secret}
AUTH_DEFAULT_USERNAME=admin
AUTH_DEFAULT_PASSWORD=admin123
MASTER_API_URL=${master_api_url}
NODE_REGISTRATION_TOKEN=${node_registration_token}
NODE_ID=node-$(hostname)-${public_ip//./-}
CRASH_EXIT_ON_UNHANDLED=true
LOG_LEVEL=info
FRONTEND_URL=http://${public_ip}:3000
CORS_ALLOWED_ORIGINS=http://${public_ip}:3000
EOF

  cat > "$APP_DIR/frontend/.env.production" <<EOF
VITE_API_URL=${master_api_url}
VITE_WHATSAPP_API_BASE_URL=${master_api_url}
EOF

  ok "Arquivos .env do NODE gerados automaticamente"
}

bring_up_stack() {
  local mode="$1"
  log "Subindo stack Docker (postgres, redis, backend, frontend, backup)"
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" down || true
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build postgres redis postgres-backup backend frontend

  log "Aguardando healthchecks"
  wait_http "http://127.0.0.1:4025/health" 240 || wait_http "http://127.0.0.1:4025/api/health" 240 || fail "Backend healthcheck falhou"
  wait_http "http://127.0.0.1:3000" 240 || fail "Frontend healthcheck falhou"

  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T backend node scripts/init-database.js >/dev/null 2>&1 || true
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T backend node scripts/seed-admin.js >/dev/null 2>&1 || true

  if [ "$mode" = "master" ]; then
    ok "MASTER pronto: banco, redis, backend, frontend e backup ativos"
  else
    ok "NODE pronto: backend iniciou e fará auto-registro + heartbeat"
  fi
}

configure_ssl_if_possible() {
  local domain
  domain="$(existing_or_default DOMAIN "")"
  if [ -z "$domain" ]; then
    warn "DOMAIN não informado, SSL automático ignorado (mantendo HTTP)"
    return 0
  fi

  local email
  email="$(existing_or_default LETSENCRYPT_EMAIL "")"
  if [ -z "$email" ]; then
    warn "LETSENCRYPT_EMAIL ausente, SSL automático ignorado"
    return 0
  fi

  log "Configurando Nginx + SSL automático"
  bash "$SCRIPT_DIR/configure-nginx.sh" "$ENV_FILE"
  bash "$SCRIPT_DIR/ssl-certbot.sh" "$ENV_FILE" || warn "Falha no Certbot; mantendo serviço online"
}

enable_boot_restart() {
  log "Habilitando restart automático no boot"
  systemctl enable docker
  ok "Containers já estão com restart=unless-stopped no compose"
}

final_health_report() {
  local mode="$1"
  local backend_up="false"
  local frontend_up="false"
  local db_ok="false"

  if curl -fsS http://127.0.0.1:4025/health >/dev/null 2>&1 || curl -fsS http://127.0.0.1:4025/api/health >/dev/null 2>&1; then
    backend_up="true"
  fi
  if curl -fsS http://127.0.0.1:3000 >/dev/null 2>&1; then
    frontend_up="true"
  fi
  if docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres pg_isready -U "$(existing_or_default POSTGRES_USER zapai)" >/dev/null 2>&1; then
    db_ok="true"
  fi

  echo
  echo "========== HEALTHCHECK GERAL =========="
  echo "MODE: $mode"
  echo "BACKEND: $backend_up"
  echo "FRONTEND: $frontend_up"
  echo "POSTGRES: $db_ok"
  echo "REDIS: $(docker inspect --format='{{.State.Health.Status}}' zapai-redis 2>/dev/null || echo unknown)"
  echo "BACKUP SERVICE: $(docker inspect --format='{{.State.Status}}' zapai-postgres-backup 2>/dev/null || echo unknown)"
  echo "======================================="

  if [ "$backend_up" != "true" ] || [ "$db_ok" != "true" ]; then
    fail "Healthcheck final falhou"
  fi
}

run_master() {
  local public_ip="$1"
  write_master_env_files "$public_ip"
  bring_up_stack "master"
  configure_ssl_if_possible
  enable_boot_restart
  final_health_report "master"
  ok "Comando único concluído. MASTER pronto para produção"
}

run_node() {
  local public_ip="$1"
  local master_url="${2:-${MASTER_URL:-}}"
  local registration_token="${3:-${NODE_REGISTRATION_TOKEN:-}}"

  [ -n "$master_url" ] || fail "Uso: sudo bash deploy/install.sh node <MASTER_URL> <NODE_REGISTRATION_TOKEN>"
  [ -n "$registration_token" ] || fail "Uso: sudo bash deploy/install.sh node <MASTER_URL> <NODE_REGISTRATION_TOKEN>"

  write_node_env_files "$public_ip" "$master_url" "$registration_token"
  bring_up_stack "node"
  enable_boot_restart
  final_health_report "node"
  ok "Comando único concluído. NODE pronto e registrando no master"
}

main() {
  require_root
  ensure_os_dependencies
  ensure_docker

  cd "$APP_DIR"
  if [ -d .git ]; then
    log "Atualizando código"
    git pull --rebase origin main || warn "Git pull falhou, seguindo com código atual"
  fi

  prepare_folders

  local public_ip
  public_ip="$(detect_public_ip)"
  log "IP público detectado: $public_ip"

  case "$MODE" in
    master)
      run_master "$public_ip"
      ;;
    node)
      run_node "$public_ip" "${2:-}" "${3:-}"
      ;;
    *)
      fail "Modo inválido: $MODE (use master|node)"
      ;;
  esac
}

main "$@"
