#!/bin/bash
# ==============================================================================
# ZAPFLOW AI — VALIDADOR DE PRODUÇÃO (MISSÃO FINAL)
# Executa testes reais de integração HTTP, NGINX, Build e Socket na VPS.
# ==============================================================================

set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✔] $1${NC}"; }
warn() { echo -e "${YELLOW}[⚠] $1${NC}"; }
err()  { echo -e "${RED}[✖] $1${NC}"; }
step() { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }

cd "$(dirname "${BASH_SOURCE[0]}")"

step "ETAPA 1 — VALIDAR SERVIÇOS VPS"
docker compose --env-file .env.production -f docker-compose.production.yml ps | grep "Up"

HTTP_FRONT=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3000 || echo "000")
HTTP_API=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3000/api/health || echo "000")

if [ "$HTTP_FRONT" = "200" ]; then log "Frontend responde 200 OK"; else err "Frontend falhou ($HTTP_FRONT)"; fi
if [ "$HTTP_API" = "200" ]; then log "API Health responde 200 OK"; else err "API Health falhou ($HTTP_API)"; fi


step "ETAPA 2 — VALIDAR BUILD FRONTEND"
if [ -f "frontend-official/dist/index.html" ]; then
    log "index.html existe no dist"
else
    err "index.html AUSENTE no dist!"
fi

JS_CHUNKS=$(find frontend-official/dist/assets -name "*.js" 2>/dev/null | wc -l)
CSS_CHUNKS=$(find frontend-official/dist/assets -name "*.css" 2>/dev/null | wc -l)

if [ "$JS_CHUNKS" -gt 0 ] && [ "$CSS_CHUNKS" -gt 0 ]; then
    log "Assets gerados: $JS_CHUNKS JS chunks, $CSS_CHUNKS CSS chunks"
else
    err "Chunks JS/CSS ausentes no dist/assets!"
fi


step "ETAPA 3 — VALIDAR NGINX & CACHE"
HEADERS=$(curl -I -s http://localhost:3000)
if echo "$HEADERS" | grep -qi "no-cache"; then
    log "Header 'no-cache' detectado no index.html (SPA Fallback OK)"
else
    err "Header 'no-cache' AUSENTE no NGINX!"
fi


step "ETAPA 5 — TESTAR LOGIN REAL"
AUTH_USER=$(grep "^AUTH_DEFAULT_USERNAME=" .env.production | cut -d'=' -f2- || echo "zapadmin")
AUTH_PASS=$(grep "^AUTH_DEFAULT_PASSWORD=" .env.production | cut -d'=' -f2- || echo "zapadmin123")

LOGIN_RES=$(curl -s -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$AUTH_USER\",\"password\":\"$AUTH_PASS\"}")

if echo "$LOGIN_RES" | grep -q '"token"'; then
    log "Login OK — Token recebido com sucesso!"
else
    err "Falha no Login da API. Resposta: $LOGIN_RES"
fi


step "ETAPA 7 — VALIDAR SOCKET.IO UPGRADE"
SOCKET_RES=$(curl -i -s -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Host: localhost:3000" http://localhost:3000/socket.io/?EIO=4\&transport=websocket --max-time 3 || true)

if echo "$SOCKET_RES" | grep -qi "101 Switching Protocols"; then
    log "WebSocket Upgrade: 101 OK"
elif echo "$SOCKET_RES" | grep -qi "400 Bad Request"; then
    # 400 is expected if we didn't pass valid Socket.IO handshake sessions, but means NGINX reached the backend
    log "WebSocket Route acessível (Nginx Proxy OK)"
else
    warn "Verifique o WebSocket no navegador (Nginx pode estar bloqueando Upgrade)."
fi

echo ""
echo -e "${GREEN}✨ Validação de Servidor Concluída. Prossiga para os testes no Navegador!${NC}"