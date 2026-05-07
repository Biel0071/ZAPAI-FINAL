#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
ECOSYSTEM_FILE="$APP_DIR/deploy/ecosystem.config.js"
BRANCH="${1:-main}"
BACKEND_PORT="${BACKEND_PORT:-4025}"
PM2_PROCESS="${PM2_PROCESS:-zapai-backend}"
LOG_DIR="$APP_DIR/logs"
DEPLOY_LOG="$LOG_DIR/deploy.log"

mkdir -p "$LOG_DIR"
touch "$DEPLOY_LOG"

exec > >(tee -a "$DEPLOY_LOG") 2>&1

info() { echo "[DEPLOY][INFO] $*"; }
ok() { echo "[DEPLOY][OK]   $*"; }
warn() { echo "[DEPLOY][WARN] $*"; }
fail() { echo "[DEPLOY][ERR]  $*"; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Comando obrigatório ausente: $1"
}

smoke_check() {
  local health_status full_health_status socket_payload
  health_status="$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${BACKEND_PORT}/health" || true)"
  [ "$health_status" = "200" ] || return 1

  full_health_status="$(curl -s -o /tmp/zapai-health-full.out -w "%{http_code}" "http://127.0.0.1:${BACKEND_PORT}/health/full" || true)"
  [ "$full_health_status" = "200" ] || return 1

  socket_payload="$(curl -fsS "http://127.0.0.1:${BACKEND_PORT}/socket.io/?EIO=4&transport=polling" || true)"
  printf '%s' "$socket_payload" | grep -q '"sid"' || return 1
  return 0
}

PREV_COMMIT="$(git -C "$APP_DIR" rev-parse HEAD)"
ROLLBACK_ARMED=1
rollback_on_error() {
  if [ "$ROLLBACK_ARMED" -ne 1 ]; then
    return
  fi
  warn "Falha detectada. Iniciando rollback automático para $PREV_COMMIT"
  bash "$APP_DIR/rollback.sh" "$PREV_COMMIT" "$BRANCH" || true
}
trap rollback_on_error ERR

require_cmd git
require_cmd npm
require_cmd pm2
require_cmd curl

info "============================================================"
info "Deploy iniciado em $(date '+%Y-%m-%d %H:%M:%S')"
info "Branch alvo: $BRANCH"
info "Snapshot atual: $PREV_COMMIT"

git -C "$APP_DIR" fetch origin "$BRANCH"
git -C "$APP_DIR" checkout "$BRANCH"
git -C "$APP_DIR" pull --rebase origin "$BRANCH"

info "Instalando dependências backend"
npm --prefix "$BACKEND_DIR" ci --omit=dev --no-audit --no-fund

info "Instalando dependências frontend"
npm --prefix "$FRONTEND_DIR" ci --no-audit --no-fund

info "Build frontend (produção)"
if npm --prefix "$FRONTEND_DIR" run | grep -q '^  build:prod'; then
  npm --prefix "$FRONTEND_DIR" run build:prod
else
  npm --prefix "$FRONTEND_DIR" run build
fi

if pm2 describe "$PM2_PROCESS" >/dev/null 2>&1; then
  info "Recarregando PM2 ($PM2_PROCESS)"
  APP_DIR="$APP_DIR" pm2 reload "$ECOSYSTEM_FILE" --env production --update-env --only "$PM2_PROCESS"
else
  info "Iniciando PM2 ($PM2_PROCESS)"
  APP_DIR="$APP_DIR" pm2 start "$ECOSYSTEM_FILE" --env production --only "$PM2_PROCESS"
fi
pm2 save

info "Executando smoke tests"
for _ in $(seq 1 20); do
  if smoke_check; then
    ROLLBACK_ARMED=0
    ok "Deploy concluído com sucesso"
    info "Deploy finalizado em $(date '+%Y-%m-%d %H:%M:%S')"
    info "============================================================"
    exit 0
  fi
  sleep 2
done

fail "Smoke tests falharam após restart PM2"
