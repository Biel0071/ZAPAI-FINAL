#!/bin/bash
# ==============================================================================
# ZAPFLOW AI — EMERGENCY RESTART
# Nuclear restart: stops everything, cleans up, restarts fresh.
# Usage: bash emergency-restart.sh
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

ENV_FILE="$SCRIPT_DIR/.env.production"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.production.yml"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✔] $1${NC}"; }
warn() { echo -e "${YELLOW}[⚠] $1${NC}"; }
err()  { echo -e "${RED}[✖] $1${NC}"; }
step() { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }
dc()   { docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"; }

[ -f "$ENV_FILE" ] || { err ".env.production not found. Run setup-vps.sh first."; exit 1; }

echo ""
echo "============================================================"
echo -e "${RED}  ⚠  ZAPFLOW AI — EMERGENCY RESTART  ⚠${NC}"
echo "  $(date -u +'%Y-%m-%d %H:%M:%S UTC')"
echo "============================================================"
echo ""
echo -e "${YELLOW}This will:${NC}"
echo "  1. Stop all containers"
echo "  2. Save backend logs"
echo "  3. Prune Docker cache"
echo "  4. Rebuild backend image"
echo "  5. Start all services"
echo "  6. Run health checks"
echo ""
echo -e "${YELLOW}Database volumes are PRESERVED (no data loss).${NC}"
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

# ──────────────────────────────────────────────────────────────
step "1. SAVE LOGS"
# ──────────────────────────────────────────────────────────────
mkdir -p "$SCRIPT_DIR/logs/emergency"
docker logs zapai-backend --tail=500 > "$SCRIPT_DIR/logs/emergency/backend_${TIMESTAMP}.log" 2>&1 || true
log "Logs saved to logs/emergency/backend_${TIMESTAMP}.log"

# ──────────────────────────────────────────────────────────────
step "2. STOP ALL CONTAINERS"
# ──────────────────────────────────────────────────────────────
dc down --timeout 15
log "All containers stopped."

# ──────────────────────────────────────────────────────────────
step "3. CLEANUP"
# ──────────────────────────────────────────────────────────────
docker system prune -f --volumes=false 2>/dev/null || true
log "Docker cache cleaned (volumes preserved)."

# ──────────────────────────────────────────────────────────────
step "4. REBUILD BACKEND"
# ──────────────────────────────────────────────────────────────
dc build --no-cache backend
log "Backend image rebuilt."

# ──────────────────────────────────────────────────────────────
step "5. START ALL SERVICES"
# ──────────────────────────────────────────────────────────────
dc up -d
log "All services started."

# ──────────────────────────────────────────────────────────────
step "6. HEALTH CHECK"
# ──────────────────────────────────────────────────────────────
echo -e "${YELLOW}Waiting 30s for startup...${NC}"
sleep 30

MAX_RETRIES=6
ALL_OK=false

for i in $(seq 1 $MAX_RETRIES); do
    HEALTH=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://127.0.0.1:3000/health 2>/dev/null || echo "000")
    API=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://127.0.0.1:3000/api/health 2>/dev/null || echo "000")

    echo "  Attempt $i/$MAX_RETRIES — Health: $HEALTH | API: $API"

    if [ "$HEALTH" = "200" ] && [ "$API" = "200" ]; then
        ALL_OK=true
        break
    fi
    sleep 10
done

echo ""
if [ "$ALL_OK" = "true" ]; then
    echo "============================================================"
    echo -e "${GREEN}  ✨ EMERGENCY RESTART SUCCESSFUL ✨${NC}"
    echo "============================================================"
    dc ps
else
    echo "============================================================"
    err "Services not healthy after restart."
    echo "  Check: docker logs zapai-backend --tail=50"
    echo "============================================================"
    exit 1
fi
