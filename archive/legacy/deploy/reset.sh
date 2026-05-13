#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$APP_DIR/docker-compose.production.yml"
ENV_FILE="$APP_DIR/.env.production"

info() { echo "[RESET][INFO] $*"; }
warn() { echo "[RESET][WARN] $*"; }
fail() { echo "[RESET][ERR]  $*" >&2; exit 1; }

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  fail "Execute como root: sudo bash deploy/reset.sh"
fi

command -v docker >/dev/null 2>&1 || fail "docker ausente"
docker compose version >/dev/null 2>&1 || fail "docker compose plugin ausente"

warn "RESET COMPLETO: containers, volumes Docker e credenciais locais serão recriados."
if [ "${ZAPAI_RESET_CONFIRM:-}" != "YES" ]; then
  echo "Para confirmar: ZAPAI_RESET_CONFIRM=YES bash deploy/reset.sh"
  exit 1
fi

info "Parando stack e limpando volumes"
if [ -f "$ENV_FILE" ]; then
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" down -v --remove-orphans || true
else
  docker compose -f "$COMPOSE_FILE" down -v --remove-orphans || true
fi

rm -f "$APP_DIR/.env.production" "$APP_DIR/backend/.env.production" "$APP_DIR/frontend/.env.production" "$APP_DIR/admin-credentials.txt"
rm -rf "$APP_DIR/logs/backend" "$APP_DIR/backend/sessions" "$APP_DIR/backend/uploads"
mkdir -p "$APP_DIR/logs/backend" "$APP_DIR/backups/postgres" "$APP_DIR/backend/sessions" "$APP_DIR/backend/uploads"

info "Reinstalando do zero"
bash "$SCRIPT_DIR/full-install.sh"
