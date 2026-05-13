#!/bin/bash
# ==============================================================================
# ZAPFLOW AI — RUNTIME DOCTOR
# Diagnoses production issues and suggests fixes.
# Usage: bash runtime-doctor.sh [BASE_URL]
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

BASE_URL="${1:-http://localhost:3000}"
ENV_FILE="$SCRIPT_DIR/.env.production"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.production.yml"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${GREEN}  ✔ $1${NC}"; }
warn() { echo -e "${YELLOW}  ⚠ $1${NC}"; }
err()  { echo -e "${RED}  ✖ $1${NC}"; }
fix()  { echo -e "${CYAN}    → FIX: $1${NC}"; }
step() { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }

echo ""
echo "============================================================"
echo -e "${CYAN}  ZAPFLOW AI — RUNTIME DOCTOR${NC}"
echo "  $(date -u +'%Y-%m-%d %H:%M:%S UTC')"
echo "============================================================"

# ──────────────────────────────────────────────────────────────
step "1. DOCKER SERVICES"
# ──────────────────────────────────────────────────────────────

if ! command -v docker &>/dev/null; then
    err "Docker not installed"
    fix "curl -fsSL https://get.docker.com | sh"
else
    BACKEND_STATUS=$(docker inspect -f '{{.State.Status}}' zapai-backend 2>/dev/null || echo "missing")
    POSTGRES_STATUS=$(docker inspect -f '{{.State.Status}}' zapai-postgres 2>/dev/null || echo "missing")
    REDIS_STATUS=$(docker inspect -f '{{.State.Status}}' zapai-redis 2>/dev/null || echo "missing")
    NGINX_STATUS=$(docker inspect -f '{{.State.Status}}' zapai-nginx 2>/dev/null || echo "missing")

    for svc in backend:$BACKEND_STATUS postgres:$POSTGRES_STATUS redis:$REDIS_STATUS nginx:$NGINX_STATUS; do
        name="${svc%%:*}"; status="${svc##*:}"
        if [ "$status" = "running" ]; then log "$name: running"
        elif [ "$status" = "missing" ]; then err "$name: container not found"; fix "docker compose -f $COMPOSE_FILE up -d"
        else err "$name: $status"; fix "docker compose -f $COMPOSE_FILE restart $name"
        fi
    done
fi

# ──────────────────────────────────────────────────────────────
step "2. BACKEND HEALTH"
# ──────────────────────────────────────────────────────────────

HEALTH=$(curl -s --max-time 5 "$BASE_URL/health" 2>/dev/null || echo "")
if echo "$HEALTH" | grep -qi "ok\|healthy\|alive"; then
    log "Backend: healthy"
else
    err "Backend: not responding at $BASE_URL/health"
    fix "docker logs zapai-backend --tail=50"
    fix "docker compose -f $COMPOSE_FILE restart backend"
fi

READY=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$BASE_URL/ready" 2>/dev/null || echo "000")
if [ "$READY" = "200" ]; then log "Readiness: OK"
else warn "Readiness probe failed ($READY)"; fix "Check database connection"
fi

# ──────────────────────────────────────────────────────────────
step "3. MEMORY & CPU"
# ──────────────────────────────────────────────────────────────

if command -v docker &>/dev/null; then
    STATS=$(docker stats --no-stream --format "{{.MemUsage}}|{{.CPUPerc}}|{{.MemPerc}}" zapai-backend 2>/dev/null || echo "N/A|N/A|N/A")
    MEM_USAGE=$(echo "$STATS" | cut -d'|' -f1)
    CPU_USAGE=$(echo "$STATS" | cut -d'|' -f2)
    MEM_PERC=$(echo "$STATS" | cut -d'|' -f3)

    log "Memory: $MEM_USAGE ($MEM_PERC)"
    log "CPU: $CPU_USAGE"

    # Parse memory percentage
    MEM_NUM=$(echo "$MEM_PERC" | tr -dc '0-9.' | head -c5)
    if [ -n "$MEM_NUM" ]; then
        MEM_INT=${MEM_NUM%.*}
        if [ "${MEM_INT:-0}" -gt 80 ]; then
            err "Memory usage > 80% — risk of OOM"
            fix "docker compose -f $COMPOSE_FILE restart backend"
        fi
    fi
fi

# ──────────────────────────────────────────────────────────────
step "4. LOGS (last errors)"
# ──────────────────────────────────────────────────────────────

RECENT_ERRORS=$(docker logs zapai-backend --since=5m 2>&1 | grep -i "error\|fatal\|crash\|ECONNREFUSED\|EADDRINUSE" | tail -5 || true)
if [ -n "$RECENT_ERRORS" ]; then
    warn "Recent errors found:"
    echo "$RECENT_ERRORS" | head -5
else
    log "No recent errors in last 5 minutes"
fi

# Check for restart loops
RESTART_COUNT=$(docker inspect -f '{{.RestartCount}}' zapai-backend 2>/dev/null || echo "0")
if [ "${RESTART_COUNT:-0}" -gt 5 ]; then
    err "Backend has restarted $RESTART_COUNT times (possible crash loop)"
    fix "docker logs zapai-backend --tail=100"
else
    log "Restart count: $RESTART_COUNT"
fi

# ──────────────────────────────────────────────────────────────
step "5. WEBSOCKET"
# ──────────────────────────────────────────────────────────────

WS_CHECK=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 \
    -H "Connection: Upgrade" -H "Upgrade: websocket" \
    "$BASE_URL/socket.io/?EIO=4&transport=polling" 2>/dev/null || echo "000")

if [ "$WS_CHECK" = "200" ] || [ "$WS_CHECK" = "101" ]; then
    log "WebSocket/Socket.IO: reachable"
else
    err "WebSocket: HTTP $WS_CHECK"
    fix "Check nginx WebSocket proxy config"
fi

# ──────────────────────────────────────────────────────────────
step "6. DATABASE"
# ──────────────────────────────────────────────────────────────

DB_READY=$(docker exec zapai-postgres pg_isready -U zapai 2>/dev/null && echo "ok" || echo "fail")
if [ "$DB_READY" = "ok" ]; then
    log "PostgreSQL: accepting connections"
else
    err "PostgreSQL: not ready"
    fix "docker compose -f $COMPOSE_FILE restart postgres"
fi

REDIS_PING=$(docker exec zapai-redis redis-cli ping 2>/dev/null || echo "fail")
if [ "$REDIS_PING" = "PONG" ]; then
    log "Redis: responding"
else
    warn "Redis: not responding (non-critical for in-memory queue mode)"
fi

# ──────────────────────────────────────────────────────────────
step "7. DISK SPACE"
# ──────────────────────────────────────────────────────────────

DISK_USAGE=$(df -h / 2>/dev/null | awk 'NR==2{print $5}' | tr -d '%' || echo "0")
if [ "${DISK_USAGE:-0}" -gt 90 ]; then
    err "Disk usage ${DISK_USAGE}% — critical"
    fix "docker system prune -f"
elif [ "${DISK_USAGE:-0}" -gt 75 ]; then
    warn "Disk usage ${DISK_USAGE}%"
else
    log "Disk usage: ${DISK_USAGE}%"
fi

# ──────────────────────────────────────────────────────────────
step "8. NGINX"
# ──────────────────────────────────────────────────────────────

NGINX_TEST=$(docker exec zapai-nginx nginx -t 2>&1 || true)
if echo "$NGINX_TEST" | grep -q "successful"; then
    log "Nginx config: valid"
else
    err "Nginx config: invalid"
    echo "$NGINX_TEST"
fi

# ──────────────────────────────────────────────────────────────
echo ""
echo "============================================================"
echo -e "${CYAN}  QUICK COMMANDS:${NC}"
echo "  Restart all:     docker compose -f $COMPOSE_FILE restart"
echo "  Backend logs:    docker logs zapai-backend --tail=100 -f"
echo "  Rebuild:         bash deploy.sh"
echo "  Full validator:  bash validate-vps.sh"
echo "============================================================"
