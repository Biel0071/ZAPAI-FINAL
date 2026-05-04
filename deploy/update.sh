#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$APP_DIR/docker-compose.production.yml"
ENV_FILE="$APP_DIR/.env.production"
TARGET="${1:-}"

info() { echo "[UPDATE][INFO] $*"; }
ok() { echo "[UPDATE][OK]   $*"; }
warn() { echo "[UPDATE][WARN] $*" >&2; }
fail() { echo "[UPDATE][ERR]  $*" >&2; exit 1; }

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

[ -f "$ENV_FILE" ] || fail "$ENV_FILE não encontrado. Rode bash deploy/full-install.sh primeiro."
command -v git >/dev/null 2>&1 || fail "git ausente"
command -v docker >/dev/null 2>&1 || fail "docker ausente"
docker compose version >/dev/null 2>&1 || fail "docker compose plugin ausente"

info "Atualizando código"
PREV_COMMIT="$(git -C "$APP_DIR" rev-parse HEAD 2>/dev/null || true)"
if [ -n "$TARGET" ]; then
  git -C "$APP_DIR" fetch --all --tags
  git -C "$APP_DIR" checkout "$TARGET"
else
  branch="$(git -C "$APP_DIR" rev-parse --abbrev-ref HEAD)"
  git -C "$APP_DIR" pull --rebase origin "$branch"
fi

info "Rebuild mantendo banco e volumes"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build postgres redis postgres-backup backend frontend

info "Rodando migrations/admin seed"
wait_http "http://127.0.0.1:4025/health" 240 "Backend"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T backend node scripts/init-database.js
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T backend node scripts/seed-admin.js

wait_http "http://127.0.0.1:4025/api/health" 120 "API health"
wait_http "http://127.0.0.1/health" 180 "Frontend"

info "Rodando doctor-full para validação"
if ! bash "$SCRIPT_DIR/doctor-full.sh"; then
  warn "Doctor reportou falhas. Iniciando rollback..."
  if [ -n "$PREV_COMMIT" ]; then
    git -C "$APP_DIR" checkout "$PREV_COMMIT"
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build backend frontend
    wait_http "http://127.0.0.1:4025/health" 120 "Backend (rollback)"
    ok "Rollback concluído para $PREV_COMMIT"
  else
    fail "Sem commit anterior para rollback. Intervenção manual necessária."
  fi
  exit 1
fi

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps
ok "Update concluído sem limpar banco"
