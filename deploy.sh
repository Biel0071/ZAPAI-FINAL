#!/bin/bash
# ==============================================================================
# ZAPFLOW AI — DEPLOY (hot update, zero-downtime)
# Usage: bash deploy.sh
#
# This script pulls code, rebuilds frontend, rebuilds backend Docker image,
# and restarts services with health validation. Does NOT recreate DB volumes.
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

ENV_FILE="$SCRIPT_DIR/.env.production"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.production.yml"
NGINX_TEMPLATE="$SCRIPT_DIR/infrastructure/nginx/nginx.conf.template"
NGINX_CONF="$SCRIPT_DIR/infrastructure/nginx/nginx.conf"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
LOG_FILE="$SCRIPT_DIR/logs/deploy/deploy_${TIMESTAMP}.log"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✔] $1${NC}"; }
warn() { echo -e "${YELLOW}[⚠] $1${NC}"; }
err()  { echo -e "${RED}[✖] $1${NC}"; }
step() { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }
dc()   { docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"; }

[ -f "$ENV_FILE" ] || { err ".env.production não encontrado. Execute setup-vps.sh primeiro."; exit 1; }

mkdir -p "$SCRIPT_DIR/logs/deploy"
exec > >(tee -a "$LOG_FILE") 2>&1

echo ""
echo "============================================================"
echo -e "${CYAN}  ZAPFLOW AI — DEPLOY UPDATE${NC}"
echo "  $(date -u +'%Y-%m-%d %H:%M:%S UTC')"
echo "============================================================"

# Source env
set -a; . "$ENV_FILE"; set +a
PUBLIC_IP="${MASTER_VPS_IP:-$(curl -4 -s --max-time 5 ifconfig.me || echo '127.0.0.1')}"

# ──────────────────────────────────────────────────────────────
step "1. PULL CÓDIGO"
# ──────────────────────────────────────────────────────────────
if [ -d ".git" ]; then
    git pull --rebase origin main 2>/dev/null || warn "Git pull falhou (não-crítico)"
else
    warn "Não é um repositório git. Pulando pull."
fi

# ──────────────────────────────────────────────────────────────
step "2. SAVE ROLLBACK POINT"
# ──────────────────────────────────────────────────────────────
if docker ps --format '{{.Names}}' | grep -q '^zapai-backend$'; then
    CURRENT_IMG="$(docker inspect --format='{{.Image}}' zapai-backend 2>/dev/null || true)"
    if [ -n "$CURRENT_IMG" ]; then
        docker tag "$CURRENT_IMG" "zapai/backend:rollback-${TIMESTAMP}" 2>/dev/null || true
        log "Rollback point salvo: zapai/backend:rollback-${TIMESTAMP}"
    fi
fi

# ──────────────────────────────────────────────────────────────
step "3. BUILD FRONTEND"
# ──────────────────────────────────────────────────────────────
RELEASES_DIR="$SCRIPT_DIR/frontend-official/releases"
CURRENT_LINK="$SCRIPT_DIR/frontend-official/current"
BUILD_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "$(date +%s)")
RELEASE_NAME="release_${BUILD_HASH}_${TIMESTAMP}"
RELEASE_DIR="$RELEASES_DIR/$RELEASE_NAME"
mkdir -p "$RELEASES_DIR"

cd "$SCRIPT_DIR/frontend-official"
npm ci --legacy-peer-deps
VITE_API_URL="${VITE_API_URL:-http://${PUBLIC_IP}:3000}" npm run build
cd "$SCRIPT_DIR"

if [ ! -f "$SCRIPT_DIR/frontend-official/dist/index.html" ]; then
    err "Build falhou — index.html ausente."
    exit 1
fi

mv "$SCRIPT_DIR/frontend-official/dist" "$RELEASE_DIR"
rm -f "$CURRENT_LINK"
ln -sf "$RELEASE_DIR" "$CURRENT_LINK"
log "Release: $RELEASE_NAME"

# Cleanup old releases (keep last 5)
cd "$RELEASES_DIR"
RELEASE_COUNT=$(ls -1d release_* 2>/dev/null | wc -l)
if [ "$RELEASE_COUNT" -gt 5 ]; then
    ls -1dt release_* | tail -n +6 | xargs rm -rf
fi
cd "$SCRIPT_DIR"

# ──────────────────────────────────────────────────────────────
step "4. REBUILD & RESTART BACKEND"
# ──────────────────────────────────────────────────────────────
BACKEND_SERVICE=$(docker compose -f "$COMPOSE_FILE" config --services 2>/dev/null | grep -E 'backend|api|server' | head -n1 || true)
if [ -z "$BACKEND_SERVICE" ]; then BACKEND_SERVICE=backend; fi
export BACKEND_SERVICE
envsubst '${BACKEND_SERVICE}' < "$NGINX_TEMPLATE" > "$NGINX_CONF"

dc build --no-cache backend
dc up -d backend
log "Backend reiniciado."

# ──────────────────────────────────────────────────────────────
step "5. RELOAD NGINX"
# ──────────────────────────────────────────────────────────────
dc restart nginx
log "Nginx recarregado."

# ──────────────────────────────────────────────────────────────
step "6. HEALTH CHECK"
# ──────────────────────────────────────────────────────────────
echo -e "${YELLOW}⏳ Aguardando serviços...${NC}"
sleep 10

MAX_RETRIES=6
ALL_HEALTHY=false

for i in $(seq 1 $MAX_RETRIES); do
    HTTP_FRONT=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://127.0.0.1:3000 2>/dev/null || echo "000")
    HTTP_API=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://127.0.0.1:3000/api/health 2>/dev/null || echo "000")

    echo -e "  Tentativa $i/$MAX_RETRIES — Frontend: ${HTTP_FRONT} | API: ${HTTP_API}"

    if [ "$HTTP_FRONT" = "200" ] && [ "$HTTP_API" = "200" ]; then
        ALL_HEALTHY=true
        break
    fi
    sleep 10
done

if [ "$ALL_HEALTHY" = "true" ]; then
    echo ""
    echo "============================================================"
    echo -e "${GREEN}  ✨ DEPLOY CONCLUÍDO COM SUCESSO ✨${NC}"
    echo "============================================================"
    echo -e "  Frontend:  ${CYAN}http://${PUBLIC_IP}:3000${NC}"
    echo -e "  API:       ${CYAN}http://${PUBLIC_IP}:3000/api/health${NC}"
    echo -e "  Rollback:  ${CYAN}bash rollback.sh${NC}"
    echo "============================================================"
else
    err "Deploy falhou no healthcheck."
    echo -e "${YELLOW}Executando rollback automático...${NC}"
    bash "$SCRIPT_DIR/rollback.sh" 2>/dev/null || true
    exit 1
fi
