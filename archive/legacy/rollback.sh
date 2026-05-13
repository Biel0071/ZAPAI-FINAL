#!/bin/bash
# ==============================================================================
# ZAPFLOW AI — ROLLBACK
# Usage: bash rollback.sh
#
# Rolls back to the previous backend image and frontend release.
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

ENV_FILE="$SCRIPT_DIR/.env.production"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.production.yml"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✔] $1${NC}"; }
warn() { echo -e "${YELLOW}[⚠] $1${NC}"; }
err()  { echo -e "${RED}[✖] $1${NC}"; }
step() { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }
dc()   { docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"; }

[ -f "$ENV_FILE" ] || { err ".env.production não encontrado."; exit 1; }

echo ""
echo "============================================================"
echo -e "${YELLOW}  ZAPFLOW AI — ROLLBACK${NC}"
echo "============================================================"

# ──────────────────────────────────────────────────────────────
step "1. ROLLBACK BACKEND IMAGE"
# ──────────────────────────────────────────────────────────────
ROLLBACK_TAG="$(docker images --format '{{.Repository}}:{{.Tag}}' | grep '^zapai/backend:rollback-' | sort -r | head -1 || true)"

if [ -z "$ROLLBACK_TAG" ]; then
    err "Nenhuma imagem de rollback encontrada. Nada para reverter."
    exit 1
fi

log "Usando imagem: $ROLLBACK_TAG"
docker tag "$ROLLBACK_TAG" zapai/backend:prod
dc up -d backend
log "Backend revertido."

# ──────────────────────────────────────────────────────────────
step "2. ROLLBACK FRONTEND RELEASE"
# ──────────────────────────────────────────────────────────────
RELEASES_DIR="$SCRIPT_DIR/frontend-official/releases"
DIST_DIR="$SCRIPT_DIR/frontend-official/dist"

if [ -d "$RELEASES_DIR" ]; then
    # Current dist hash (from the release name embedded in dist)
    CURRENT_RELEASE="$(ls -1dt "$RELEASES_DIR"/release_* 2>/dev/null | head -1 || true)"

    # Find previous release (second newest)
    PREVIOUS_RELEASE="$(ls -1dt "$RELEASES_DIR"/release_* 2>/dev/null | sed -n '2p' || true)"

    if [ -n "$PREVIOUS_RELEASE" ] && [ -d "$PREVIOUS_RELEASE" ]; then
        rm -rf "$DIST_DIR"
        cp -r "$PREVIOUS_RELEASE" "$DIST_DIR"
        log "Frontend revertido para: $(basename "$PREVIOUS_RELEASE")"
    else
        warn "Nenhuma release anterior encontrada. Frontend mantido."
    fi
else
    warn "Diretório de releases não encontrado."
fi

# ──────────────────────────────────────────────────────────────
step "3. RELOAD NGINX"
# ──────────────────────────────────────────────────────────────
dc restart nginx
log "Nginx recarregado."

# ──────────────────────────────────────────────────────────────
step "4. HEALTH CHECK"
# ──────────────────────────────────────────────────────────────
sleep 10

for i in $(seq 1 12); do
    HTTP_FRONT=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://127.0.0.1:3000 2>/dev/null || echo "000")
    HTTP_API=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://127.0.0.1:3000/api/health 2>/dev/null || echo "000")

    if [ "$HTTP_FRONT" = "200" ] && [ "$HTTP_API" = "200" ]; then
        echo ""
        echo "============================================================"
        echo -e "${GREEN}  ✨ ROLLBACK CONCLUÍDO COM SUCESSO ✨${NC}"
        echo "============================================================"
        exit 0
    fi

    echo -e "  ⏳ Aguardando... ($i/12) Frontend: $HTTP_FRONT | API: $HTTP_API"
    sleep 5
done

err "Rollback aplicado mas healthcheck não estabilizou."
echo -e "${RED}Logs: docker compose logs -f backend${NC}"
exit 1
