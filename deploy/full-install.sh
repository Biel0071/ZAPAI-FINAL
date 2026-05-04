#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$APP_DIR/docker-compose.production.yml"
ENV_FILE="$APP_DIR/.env.production"
BACKEND_ENV_FILE="$APP_DIR/backend/.env.production"
FRONTEND_ENV_FILE="$APP_DIR/frontend/.env.production"
CREDENTIALS_FILE="$APP_DIR/admin-credentials.txt"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info() { echo -e "${BLUE}[FULL-INSTALL]${NC} $*"; }
ok() { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail() { echo -e "${RED}[ERR]${NC} $*" >&2; exit 1; }

require_root() {
  if [ "${EUID:-$(id -u)}" -ne 0 ]; then
    fail "Execute como root: sudo bash deploy/full-install.sh"
  fi
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Comando obrigatório ausente: $1"
}

detect_public_ip() {
  local ip
  ip="$(curl -fsS --connect-timeout 8 ifconfig.me 2>/dev/null || true)"
  [ -n "$ip" ] || ip="$(curl -fsS --connect-timeout 8 https://api.ipify.org 2>/dev/null || true)"
  [ -n "$ip" ] || ip="$(curl -fsS --connect-timeout 8 https://checkip.amazonaws.com 2>/dev/null | tr -d '[:space:]' || true)"
  [ -n "$ip" ] || ip="$(hostname -I 2>/dev/null | awk '{print $1}')"

  if ! printf '%s' "$ip" | grep -Eq '^([0-9]{1,3}\.){3}[0-9]{1,3}$'; then
    fail "Não foi possível detectar IP público válido"
  fi

  printf '%s' "$ip"
}

random_hex() {
  openssl rand -hex "$1"
}

random_b64() {
  openssl rand -base64 "$1" | tr -d '\n'
}

escape_env_value() {
  local value="${1:-}"
  value="${value//$'\r'/}"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//\$/\\\$}"
  value="${value//\`/\\\`}"
  value="${value//$'\n'/\\n}"
  printf '%s' "$value"
}

write_env_line() {
  local file="$1"
  local key="$2"
  local value="${3:-}"
  printf '%s="%s"\n' "$key" "$(escape_env_value "$value")" >> "$file"
}

install_dependencies() {
  info "Instalando dependências do sistema"
  apt-get update -y
  apt-get install -y curl git ca-certificates openssl jq
}

ensure_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    info "Docker não encontrado. Instalando Docker"
    curl -fsSL https://get.docker.com | sh
  fi

  systemctl enable docker
  systemctl start docker
  docker compose version >/dev/null 2>&1 || fail "Docker Compose plugin ausente"
}

stop_existing_stack() {
  info "Detectando instalação existente"
  if docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps >/dev/null 2>&1; then
    warn "Instalação existente detectada. Parando containers"
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" down --remove-orphans || true
  else
    docker compose -f "$COMPOSE_FILE" down --remove-orphans || true
  fi
}

prepare_paths() {
  mkdir -p "$APP_DIR/logs/backend" "$APP_DIR/backups/postgres" "$APP_DIR/backend/sessions" "$APP_DIR/backend/uploads"
}

generate_env_files() {
  local public_ip="$1"
  local domain="${2:-${DOMAIN:-}}"
  local postgres_user="zapai"
  local postgres_password
  local postgres_db="zapai_crm"
  local jwt_secret
  local auth_jwt_secret
  local master_panel_token
  local node_registration_token
  local admin_email="admin@admin.com"
  local admin_password
  local frontend_url
  local api_url
  local cors_origins

  if [ -n "$domain" ]; then
    frontend_url="https://${domain}"
    api_url="https://${domain}"
    cors_origins="${frontend_url},http://${public_ip}:3000,http://${public_ip}:8080,https://swift-wa-assist.lovable.app,https://*.lovable.app"
  else
    frontend_url="http://${public_ip}"
    api_url="http://${public_ip}:4025"
    cors_origins="${frontend_url},http://${public_ip}:3000,http://${public_ip}:8080,https://swift-wa-assist.lovable.app,https://*.lovable.app"
  fi

  postgres_password="$(random_b64 32)"
  jwt_secret="$(random_b64 64)"
  auth_jwt_secret="$jwt_secret"
  master_panel_token="$(random_hex 32)"
  node_registration_token="$(random_hex 32)"
  admin_password="$(random_b64 18)"

  info "Gerando .env.production automático"
  : > "$ENV_FILE"
  write_env_line "$ENV_FILE" POSTGRES_USER "$postgres_user"
  write_env_line "$ENV_FILE" POSTGRES_PASSWORD "$postgres_password"
  write_env_line "$ENV_FILE" POSTGRES_DB "$postgres_db"
  write_env_line "$ENV_FILE" POSTGRES_PUBLIC_PORT "127.0.0.1:5432"
  write_env_line "$ENV_FILE" REDIS_PUBLIC_PORT "127.0.0.1:6379"
  write_env_line "$ENV_FILE" JWT_SECRET "$jwt_secret"
  write_env_line "$ENV_FILE" AUTH_JWT_SECRET "$auth_jwt_secret"
  write_env_line "$ENV_FILE" AUTH_DEFAULT_USERNAME "$admin_email"
  write_env_line "$ENV_FILE" AUTH_DEFAULT_EMAIL "$admin_email"
  write_env_line "$ENV_FILE" AUTH_DEFAULT_PASSWORD "$admin_password"
  write_env_line "$ENV_FILE" AUTH_DEFAULT_ROLE "master_admin"
  write_env_line "$ENV_FILE" AUTH_DEFAULT_TENANT_ID "default"
  write_env_line "$ENV_FILE" FRONTEND_URL "$frontend_url"
  write_env_line "$ENV_FILE" CORS_ALLOWED_ORIGINS "$cors_origins"
  write_env_line "$ENV_FILE" VITE_API_URL "$api_url"
  write_env_line "$ENV_FILE" MASTER_PANEL_TOKEN "$master_panel_token"
  write_env_line "$ENV_FILE" NODE_REGISTRATION_TOKEN "$node_registration_token"
  write_env_line "$ENV_FILE" MASTER "true"
  write_env_line "$ENV_FILE" NODE_ROLE "master"
  write_env_line "$ENV_FILE" DOMAIN "$domain"
  write_env_line "$ENV_FILE" MASTER_HOSTNAME "ZAP-AICRM"
  write_env_line "$ENV_FILE" MASTER_VPS_IP "$public_ip"
  write_env_line "$ENV_FILE" FEATURE_ADMIN_MASTER "true"
  write_env_line "$ENV_FILE" FEATURE_NODE_MASTER_API "true"
  write_env_line "$ENV_FILE" FEATURE_NODE_AUTO_REGISTER "false"
  write_env_line "$ENV_FILE" FRONTEND_PUBLIC_PORT "80"
  write_env_line "$ENV_FILE" NODE_ENV "production"
  write_env_line "$ENV_FILE" LOG_LEVEL "info"
  write_env_line "$ENV_FILE" CRASH_EXIT_ON_UNHANDLED "true"
  write_env_line "$ENV_FILE" DB_WAIT_TIMEOUT_SECONDS "120"
  write_env_line "$ENV_FILE" DB_WAIT_INTERVAL_SECONDS "2"
  write_env_line "$ENV_FILE" BACKUP_SCHEDULE "@daily"
  write_env_line "$ENV_FILE" BACKUP_KEEP_DAYS "7"
  write_env_line "$ENV_FILE" BACKUP_KEEP_WEEKS "4"
  write_env_line "$ENV_FILE" BACKUP_KEEP_MONTHS "6"

  : > "$BACKEND_ENV_FILE"
  write_env_line "$BACKEND_ENV_FILE" NODE_ENV "production"
  write_env_line "$BACKEND_ENV_FILE" PORT "4025"
  write_env_line "$BACKEND_ENV_FILE" HOST "0.0.0.0"
  write_env_line "$BACKEND_ENV_FILE" DATABASE_URL "postgresql://${postgres_user}:${postgres_password}@postgres:5432/${postgres_db}"
  write_env_line "$BACKEND_ENV_FILE" PGSSLMODE "disable"
  write_env_line "$BACKEND_ENV_FILE" POSTGRES_HOST "postgres"
  write_env_line "$BACKEND_ENV_FILE" POSTGRES_PORT "5432"
  write_env_line "$BACKEND_ENV_FILE" POSTGRES_USER "$postgres_user"
  write_env_line "$BACKEND_ENV_FILE" POSTGRES_PASSWORD "$postgres_password"
  write_env_line "$BACKEND_ENV_FILE" POSTGRES_DB "$postgres_db"
  write_env_line "$BACKEND_ENV_FILE" JWT_SECRET "$jwt_secret"
  write_env_line "$BACKEND_ENV_FILE" AUTH_JWT_SECRET "$auth_jwt_secret"
  write_env_line "$BACKEND_ENV_FILE" AUTH_DEFAULT_USERNAME "$admin_email"
  write_env_line "$BACKEND_ENV_FILE" AUTH_DEFAULT_EMAIL "$admin_email"
  write_env_line "$BACKEND_ENV_FILE" AUTH_DEFAULT_PASSWORD "$admin_password"
  write_env_line "$BACKEND_ENV_FILE" AUTH_DEFAULT_ROLE "master_admin"
  write_env_line "$BACKEND_ENV_FILE" AUTH_DEFAULT_TENANT_ID "default"
  write_env_line "$BACKEND_ENV_FILE" MASTER_PANEL_TOKEN "$master_panel_token"
  write_env_line "$BACKEND_ENV_FILE" NODE_REGISTRATION_TOKEN "$node_registration_token"
  write_env_line "$BACKEND_ENV_FILE" MASTER_API_URL "$api_url"
  write_env_line "$BACKEND_ENV_FILE" MASTER "true"
  write_env_line "$BACKEND_ENV_FILE" NODE_ROLE "master"
  write_env_line "$BACKEND_ENV_FILE" MASTER_HOSTNAME "ZAP-AICRM"
  write_env_line "$BACKEND_ENV_FILE" MASTER_VPS_IP "$public_ip"
  write_env_line "$BACKEND_ENV_FILE" FEATURE_ADMIN_MASTER "true"
  write_env_line "$BACKEND_ENV_FILE" FEATURE_NODE_MASTER_API "true"
  write_env_line "$BACKEND_ENV_FILE" FEATURE_NODE_AUTO_REGISTER "false"
  write_env_line "$BACKEND_ENV_FILE" FRONTEND_URL "$frontend_url"
  write_env_line "$BACKEND_ENV_FILE" CORS_ALLOWED_ORIGINS "$cors_origins"
  write_env_line "$BACKEND_ENV_FILE" LOG_LEVEL "info"
  write_env_line "$BACKEND_ENV_FILE" CRASH_EXIT_ON_UNHANDLED "true"

  : > "$FRONTEND_ENV_FILE"
  write_env_line "$FRONTEND_ENV_FILE" VITE_API_URL "$api_url"

  cat > "$CREDENTIALS_FILE" <<EOF_CREDS
ZAPAI MASTER INSTALL
URL: ${frontend_url}
API: ${api_url}
ADMIN_EMAIL: ${admin_email}
ADMIN_PASSWORD: ${admin_password}
MASTER_PANEL_TOKEN: ${master_panel_token}
NODE_REGISTRATION_TOKEN: ${node_registration_token}
GENERATED_AT: $(date -u +'%Y-%m-%dT%H:%M:%SZ')
EOF_CREDS
  chmod 600 "$ENV_FILE" "$BACKEND_ENV_FILE" "$FRONTEND_ENV_FILE" "$CREDENTIALS_FILE"
}

wait_http() {
  local url="$1"
  local timeout="$2"
  local label="$3"
  local start
  start="$(date +%s)"

  until curl -fsS "$url" >/dev/null 2>&1; do
    if [ $(( $(date +%s) - start )) -ge "$timeout" ]; then
      fail "$label não ficou saudável em ${timeout}s: $url"
    fi
    sleep 2
  done
}

run_stack() {
  info "Validando docker compose"
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config >/dev/null

  info "Subindo Docker completo do zero"
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build postgres redis postgres-backup backend frontend

  info "Aguardando backend"
  wait_http "http://127.0.0.1:4025/health" 240 "Backend /health"
  wait_http "http://127.0.0.1:4025/api/health" 120 "Backend /api/health"

  info "Rodando migrations e criando admin master"
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T backend node scripts/init-database.js
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T backend node scripts/seed-admin.js

  info "Aguardando frontend em http://IP"
  wait_http "http://127.0.0.1/health" 180 "Frontend"
}

main() {
  require_root
  require_cmd curl
  require_cmd openssl
  install_dependencies
  ensure_docker

  local public_ip
  public_ip="$(detect_public_ip)"
  ok "IP público detectado: $public_ip"

  local domain="${DOMAIN:-}"
  if [ -n "$domain" ]; then
    ok "Domínio configurado: $domain"
  else
    warn "Nenhum DOMAIN informado. Sistema usará IP ($public_ip)."
    warn "Para usar domínio: DOMAIN=app.seudominio.com bash deploy/full-install.sh"
  fi

  prepare_paths
  stop_existing_stack
  generate_env_files "$public_ip" "$domain"
  run_stack

  echo
  ok "INSTALAÇÃO COMPLETA"
  if [ -n "$domain" ]; then
    echo "URL: https://${domain}"
    echo "API: https://${domain}/api"
  else
    echo "URL: http://${public_ip}"
    echo "API: http://${public_ip}:4025"
  fi
  echo "Admin: admin@admin.com"
  echo "Senha: $(grep '^ADMIN_PASSWORD:' "$CREDENTIALS_FILE" | cut -d' ' -f2-)"
  echo "Credenciais salvas em: $CREDENTIALS_FILE"

  info "Rodando doctor-full para validação final"
  bash "$SCRIPT_DIR/doctor-full.sh" || warn "Algumas verificações do doctor reportaram warnings"
}

main "$@"
