#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PORT="${BACKEND_PORT:-4025}"
PM2_PROCESS="${PM2_PROCESS:-zapai-backend}"

info() { echo "[DOCTOR][INFO] $*"; }
ok() { echo "[DOCTOR][OK]   $*"; }
warn() { echo "[DOCTOR][WARN] $*"; }
fail() { echo "[DOCTOR][ERR]  $*"; exit 1; }

check_cmd() {
  if command -v "$1" >/dev/null 2>&1; then
    ok "$1 disponível"
  else
    fail "$1 ausente"
  fi
}

check_http() {
  local url="$1"
  local expected="$2"
  local code
  code="$(curl -s -o /dev/null -w "%{http_code}" "$url" || true)"
  if [ "$code" = "$expected" ]; then
    ok "$url -> $code"
  else
    fail "$url -> $code (esperado $expected)"
  fi
}

check_cmd git
check_cmd node
check_cmd npm
check_cmd pm2
check_cmd curl

info "Node: $(node -v)"
info "NPM: $(npm -v)"
info "PM2: $(pm2 -v | tail -n 1)"
info "Commit atual: $(git -C "$APP_DIR" rev-parse --short HEAD)"

if pm2 describe "$PM2_PROCESS" >/dev/null 2>&1; then
  ok "Processo PM2 '$PM2_PROCESS' registrado"
else
  warn "Processo PM2 '$PM2_PROCESS' não encontrado"
fi

check_http "http://127.0.0.1:${BACKEND_PORT}/health" "200"
check_http "http://127.0.0.1:${BACKEND_PORT}/api/health" "200"

socket_payload="$(curl -fsS "http://127.0.0.1:${BACKEND_PORT}/socket.io/?EIO=4&transport=polling" || true)"
if printf '%s' "$socket_payload" | grep -q '"sid"'; then
  ok "Socket.IO handshake OK"
else
  fail "Socket.IO handshake falhou"
fi

ok "Doctor concluído: ambiente saudável"
