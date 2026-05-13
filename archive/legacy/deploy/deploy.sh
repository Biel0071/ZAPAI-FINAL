#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$APP_DIR/docker-compose.production.yml"
ENV_FILE="$APP_DIR/.env.production"
ENV_EXAMPLE="$APP_DIR/.env.production.example"
LOG_DIR="$APP_DIR/logs/deploy"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
DEPLOY_LOG="$LOG_DIR/deploy_${TIMESTAMP}.log"
ROLLBACK_BACKEND_TAG="zapai/backend:rollback-${TIMESTAMP}"
ROLLBACK_FRONTEND_TAG="zapai/frontend:rollback-${TIMESTAMP}"

mkdir -p "$LOG_DIR"
exec > >(tee -a "$DEPLOY_LOG") 2>&1

info() { echo "[DEPLOY][INFO] $*"; }
ok() { echo "[DEPLOY][OK]   $*"; }
warn() { echo "[DEPLOY][WARN] $*"; }
fail() { echo "[DEPLOY][ERR]  $*"; exit 1; }

ROLLBACK_ARMED=0
rollback_on_failure() {
  if [ "$ROLLBACK_ARMED" -ne 1 ]; then
    return
  fi

  warn "Deploy falhou. Iniciando rollback automático..."

  if docker image inspect "$ROLLBACK_BACKEND_TAG" >/dev/null 2>&1; then
    docker tag "$ROLLBACK_BACKEND_TAG" zapai/backend:prod || true
  fi

  if docker image inspect "$ROLLBACK_FRONTEND_TAG" >/dev/null 2>&1; then
    docker tag "$ROLLBACK_FRONTEND_TAG" zapai/frontend:prod || true
  fi

  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d postgres redis backend frontend || true
  docker rm -f zapai-backend-canary >/dev/null 2>&1 || true
  warn "Rollback automático concluído. Verifique os logs em $DEPLOY_LOG"
}

trap rollback_on_failure ERR

require_cmd() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || fail "Comando obrigatório ausente: $cmd"
}

wait_http() {
  local url="$1"
  local timeout="$2"
  local label="$3"
  local start
  start="$(date +%s)"

  until curl -fsS "$url" >/dev/null 2>&1; do
    local now elapsed
    now="$(date +%s)"
    elapsed=$((now - start))
    if [ "$elapsed" -ge "$timeout" ]; then
      fail "$label não ficou saudável em ${timeout}s ($url)"
    fi
    sleep 2
  done
}

wait_container_health() {
  local container="$1"
  local timeout="$2"
  local start
  start="$(date +%s)"

  while true; do
    local state
    state="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container" 2>/dev/null || true)"

    if [ "$state" = "healthy" ] || [ "$state" = "running" ]; then
      return 0
    fi
    if [ "$state" = "unhealthy" ] || [ "$state" = "exited" ] || [ "$state" = "dead" ]; then
      fail "Container $container está em estado inválido: $state"
    fi

    local now elapsed
    now="$(date +%s)"
    elapsed=$((now - start))
    if [ "$elapsed" -ge "$timeout" ]; then
      fail "Timeout aguardando container $container ficar saudável"
    fi
    sleep 2
  done
}

ensure_docker() {
  if command -v docker >/dev/null 2>&1; then
    ok "Docker já instalado"
    return
  fi

  info "Docker não encontrado. Instalando automaticamente..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
}

ensure_compose_plugin() {
  docker compose version >/dev/null 2>&1 && return
  fail "Docker Compose plugin não disponível. Instale o docker compose plugin na VPS"
}

ensure_env_file() {
  if [ -f "$ENV_FILE" ]; then
    ok ".env.production encontrado"
    return
  fi

  [ -f "$ENV_EXAMPLE" ] || fail "Arquivo $ENV_EXAMPLE não encontrado"
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  warn "Criado $ENV_FILE a partir do exemplo. Ajuste secrets e domínio antes de novo deploy"
}

validate_required_env() {
  set -a
  . "$ENV_FILE"
  set +a

  [ -n "${POSTGRES_USER:-}" ] || fail "POSTGRES_USER não definido em .env.production"
  [ -n "${POSTGRES_PASSWORD:-}" ] || fail "POSTGRES_PASSWORD não definido em .env.production"
  [ -n "${POSTGRES_DB:-}" ] || fail "POSTGRES_DB não definido em .env.production"
  [ -n "${JWT_SECRET:-}" ] || fail "JWT_SECRET não definido em .env.production"
  [ -n "${AUTH_JWT_SECRET:-}" ] || fail "AUTH_JWT_SECRET não definido em .env.production"
  [ -n "${DOMAIN:-}" ] || fail "DOMAIN não definido em .env.production"
}

prepare_system_paths() {
  info "Preparando pastas e permissões"
  mkdir -p "$APP_DIR/logs" "$APP_DIR/logs/deploy" "$APP_DIR/backups"
  mkdir -p "$APP_DIR/backend/sessions" "$APP_DIR/backend/uploads" "$APP_DIR/backend/logs"
  chmod -R 755 "$APP_DIR/deploy"
}

validate_ports() {
  info "Validando portas expostas"
  ss -lnt | awk 'NR==1 || /:80 |:443 |:3000 |:4025 |:5432 /'
}

configure_nginx() {
  info "Configurando Nginx automaticamente"
  bash "$SCRIPT_DIR/configure-nginx.sh" "$ENV_FILE"
}

configure_ssl() {
  info "Configurando SSL (Certbot)"
  bash "$SCRIPT_DIR/ssl-certbot.sh" "$ENV_FILE" || warn "SSL automático falhou. Mantendo tráfego HTTP e prosseguindo"
}

run_deploy() {
  info "========== ZAPAI ONE DEPLOY =========="
  info "Log de deploy: $DEPLOY_LOG"

  require_cmd curl
  require_cmd awk
  require_cmd git
  require_cmd ss

  ensure_docker
  ensure_compose_plugin
  ensure_env_file
  validate_required_env
  prepare_system_paths

  info "Atualizando código (git pull)"
  git -C "$APP_DIR" pull --rebase origin main

  if docker ps --format '{{.Names}}' | grep -q '^zapai-backend$'; then
    local current_backend_image
    current_backend_image="$(docker inspect --format='{{.Image}}' zapai-backend)"
    docker tag "$current_backend_image" "$ROLLBACK_BACKEND_TAG" || true
  fi

  if docker ps --format '{{.Names}}' | grep -q '^zapai-frontend$'; then
    local current_frontend_image
    current_frontend_image="$(docker inspect --format='{{.Image}}' zapai-frontend)"
    docker tag "$current_frontend_image" "$ROLLBACK_FRONTEND_TAG" || true
  fi

  ROLLBACK_ARMED=1

  info "Build das imagens de produção"
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build --pull

  info "Subindo banco e redis"
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d postgres redis
  wait_container_health zapai-postgres 120
  wait_container_health zapai-redis 60

  info "Canary backend (sem derrubar o atual)"
  docker rm -f zapai-backend-canary >/dev/null 2>&1 || true
  docker run -d \
    --name zapai-backend-canary \
    --network zapai-production_default \
    --env-file "$ENV_FILE" \
    -e NODE_ENV=production \
    -e PORT=4025 \
    -e POSTGRES_HOST=postgres \
    -e POSTGRES_PORT=5432 \
    zapai/backend:prod >/dev/null
  wait_container_health zapai-backend-canary 180
  docker rm -f zapai-backend-canary >/dev/null

  info "Promovendo backend"
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d backend
  wait_http "http://127.0.0.1:4025/health" 180 "Backend"

  info "Executando migrations explícitas"
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T backend node scripts/init-database.js || warn "Migrations já aplicadas ou indisponíveis"

  info "Promovendo frontend"
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d frontend
  wait_http "http://127.0.0.1:3000" 120 "Frontend"

  configure_nginx
  configure_ssl

  info "Restart seguro do Nginx"
  nginx -t
  systemctl restart nginx

  info "Readiness checks finais"
  wait_http "http://127.0.0.1:4025/health" 60 "Backend"
  wait_http "http://127.0.0.1:3000" 60 "Frontend"
  if ! curl -fsS "https://${DOMAIN}" >/dev/null 2>&1; then
    wait_http "http://${DOMAIN}" 120 "Domínio"
  fi
  validate_ports

  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps

  ROLLBACK_ARMED=0
  ok "Deploy finalizado com sucesso (ONE COMMAND)"
}

run_deploy
