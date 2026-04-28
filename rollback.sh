#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PORT="${BACKEND_PORT:-4025}"
PM2_PROCESS="${PM2_PROCESS:-zapai-backend}"
TARGET_COMMIT="${1:-}"
TARGET_BRANCH="${2:-main}"

info() { echo "[ROLLBACK][INFO] $*"; }
ok() { echo "[ROLLBACK][OK]   $*"; }
fail() { echo "[ROLLBACK][ERR]  $*"; exit 1; }

[ -n "$TARGET_COMMIT" ] || fail "Uso: bash rollback.sh <commit> [branch]"

if ! git -C "$APP_DIR" cat-file -e "${TARGET_COMMIT}^{commit}" 2>/dev/null; then
  fail "Commit inválido para rollback: $TARGET_COMMIT"
fi

info "Aplicando rollback para $TARGET_COMMIT"
git -C "$APP_DIR" checkout "$TARGET_BRANCH"
git -C "$APP_DIR" reset --hard "$TARGET_COMMIT"

info "Reinstalando backend para garantir lock consistente"
npm --prefix "$APP_DIR/backend" ci --omit=dev --no-audit --no-fund

if pm2 describe "$PM2_PROCESS" >/dev/null 2>&1; then
  pm2 restart "$PM2_PROCESS" --update-env
else
  APP_DIR="$APP_DIR" pm2 start "$APP_DIR/deploy/ecosystem.config.js" --env production --only "$PM2_PROCESS"
fi
pm2 save

for _ in $(seq 1 20); do
  code="$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${BACKEND_PORT}/health" || true)"
  if [ "$code" = "200" ]; then
    ok "Rollback concluído e healthcheck OK"
    exit 0
  fi
  sleep 2
done

fail "Rollback aplicado, mas healthcheck não estabilizou"
