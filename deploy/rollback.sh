#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$APP_DIR/docker-compose.production.yml"
ENV_FILE="$APP_DIR/.env.production"

info() { echo "[ROLLBACK][INFO] $*"; }
ok() { echo "[ROLLBACK][OK]   $*"; }
fail() { echo "[ROLLBACK][ERR]  $*"; exit 1; }

BACKEND_TAG="${1:-}"
FRONTEND_TAG="${2:-}"

if [ -z "$BACKEND_TAG" ]; then
  BACKEND_TAG="$(docker images --format '{{.Repository}}:{{.Tag}}' | grep '^zapai/backend:rollback-' | sort | tail -1 || true)"
fi

if [ -z "$FRONTEND_TAG" ]; then
  FRONTEND_TAG="$(docker images --format '{{.Repository}}:{{.Tag}}' | grep '^zapai/frontend:rollback-' | sort | tail -1 || true)"
fi

[ -n "$BACKEND_TAG" ] || fail "Nenhuma imagem de rollback backend encontrada"
[ -n "$FRONTEND_TAG" ] || fail "Nenhuma imagem de rollback frontend encontrada"

docker image inspect "$BACKEND_TAG" >/dev/null 2>&1 || fail "Imagem backend não encontrada: $BACKEND_TAG"
docker image inspect "$FRONTEND_TAG" >/dev/null 2>&1 || fail "Imagem frontend não encontrada: $FRONTEND_TAG"

info "Reapontando imagens de produção"
docker tag "$BACKEND_TAG" zapai/backend:prod
docker tag "$FRONTEND_TAG" zapai/frontend:prod

info "Recriando serviços de app"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d backend frontend

info "Validando health"
for _ in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:4025/health >/dev/null 2>&1 && curl -fsS http://127.0.0.1:3000 >/dev/null 2>&1; then
    ok "Rollback concluído com sucesso"
    exit 0
  fi
  sleep 2
done

fail "Rollback aplicado, mas healthchecks não estabilizaram"
