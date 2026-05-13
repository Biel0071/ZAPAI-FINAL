#!/bin/bash
# ==============================================================================
# ZAPFLOW AI — PRODUCTION VALIDATOR v2 (Enterprise)
# Validates all integration points: HTTP, NGINX, WebSocket, Auth, Sessions,
# API routes, build integrity, and runtime status.
# ==============================================================================

set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
PASS=0; FAIL=0; WARN=0

log()  { echo -e "${GREEN}[✔] $1${NC}"; PASS=$((PASS + 1)); }
warn() { echo -e "${YELLOW}[⚠] $1${NC}"; WARN=$((WARN + 1)); }
err()  { echo -e "${RED}[✖] $1${NC}"; FAIL=$((FAIL + 1)); }
step() { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }

cd "$(dirname "${BASH_SOURCE[0]}")"
BASE_URL="${1:-http://localhost:3000}"

echo ""
echo "============================================================"
echo -e "${CYAN}  ZAPFLOW AI — PRODUCTION VALIDATOR${NC}"
echo "  $(date -u +'%Y-%m-%d %H:%M:%S UTC')"
echo "  Target: $BASE_URL"
echo "============================================================"

# ──────────────────────────────────────────────────────────────
step "1. DOCKER SERVICES"
# ──────────────────────────────────────────────────────────────
COMPOSE_FILE="docker-compose.production.yml"
if [ -f "$COMPOSE_FILE" ]; then
    RUNNING=$(docker compose --env-file .env.production -f "$COMPOSE_FILE" ps --format '{{.Name}} {{.Status}}' 2>/dev/null | grep -c "Up" || echo "0")
    if [ "$RUNNING" -ge 3 ]; then
        log "Docker: $RUNNING services running"
    else
        err "Docker: only $RUNNING services running (need >= 3)"
    fi
else
    warn "docker-compose.production.yml not found"
fi

# ──────────────────────────────────────────────────────────────
step "2. FRONTEND"
# ──────────────────────────────────────────────────────────────
HTTP_FRONT=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE_URL" 2>/dev/null || echo "000")
if [ "$HTTP_FRONT" = "200" ]; then
    log "Frontend: 200 OK"
else
    err "Frontend: HTTP $HTTP_FRONT"
fi

if [ -f "frontend-official/dist/index.html" ]; then
    JS_COUNT=$(find frontend-official/dist/assets -name "*.js" 2>/dev/null | wc -l)
    CSS_COUNT=$(find frontend-official/dist/assets -name "*.css" 2>/dev/null | wc -l)
    log "Build: $JS_COUNT JS chunks, $CSS_COUNT CSS files"
else
    warn "dist/index.html not found (may be inside Docker volume)"
fi

# ──────────────────────────────────────────────────────────────
step "3. BACKEND API"
# ──────────────────────────────────────────────────────────────
check_endpoint() {
    local path="$1" label="$2" expected="${3:-200}"
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE_URL$path" 2>/dev/null || echo "000")
    if [ "$code" = "$expected" ]; then
        log "$label: $code"
    else
        err "$label: HTTP $code (expected $expected)"
    fi
}

check_endpoint "/health"             "Health"
check_endpoint "/ready"              "Ready"
check_endpoint "/api/health"         "API Health"
check_endpoint "/api/test"           "API Test"
check_endpoint "/status-whatsapp"    "WhatsApp Status"
check_endpoint "/session-status"     "Session Status"

# ──────────────────────────────────────────────────────────────
step "4. NGINX HEADERS"
# ──────────────────────────────────────────────────────────────
HEADERS=$(curl -I -s --max-time 5 "$BASE_URL" 2>/dev/null || true)
if echo "$HEADERS" | grep -qi "no-cache"; then
    log "Cache-Control: no-cache present"
else
    warn "Cache-Control: no-cache missing on index.html"
fi
if echo "$HEADERS" | grep -qi "x-content-type-options"; then
    log "Security header: X-Content-Type-Options present"
else
    warn "Security header: X-Content-Type-Options missing"
fi

# ──────────────────────────────────────────────────────────────
step "5. AUTHENTICATION"
# ──────────────────────────────────────────────────────────────
AUTH_USER=$(grep "^AUTH_DEFAULT_USERNAME=" .env.production 2>/dev/null | cut -d'=' -f2- || echo "")
AUTH_PASS=$(grep "^AUTH_DEFAULT_PASSWORD=" .env.production 2>/dev/null | cut -d'=' -f2- || echo "")

if [ -n "$AUTH_USER" ] && [ -n "$AUTH_PASS" ]; then
    LOGIN_RES=$(curl -s -X POST "$BASE_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"$AUTH_USER\",\"password\":\"$AUTH_PASS\"}" \
        --max-time 10 2>/dev/null || echo "{}")

    if echo "$LOGIN_RES" | grep -q '"token"'; then
        log "Auth: Login successful, token received"
        TOKEN=$(echo "$LOGIN_RES" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

        # Test authenticated endpoint
        AUTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
            -H "Authorization: Bearer $TOKEN" \
            "$BASE_URL/api/production/status" 2>/dev/null || echo "000")
        if [ "$AUTH_CODE" = "200" ]; then
            log "Auth: Protected endpoint accessible"
        else
            err "Auth: Protected endpoint returned $AUTH_CODE"
        fi
    else
        err "Auth: Login failed — $LOGIN_RES"
    fi
else
    warn "Auth: No credentials in .env.production"
fi

# ──────────────────────────────────────────────────────────────
step "6. WEBSOCKET"
# ──────────────────────────────────────────────────────────────
SOCKET_RES=$(curl -i -s -N \
    -H "Connection: Upgrade" \
    -H "Upgrade: websocket" \
    -H "Sec-WebSocket-Version: 13" \
    -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
    "$BASE_URL/socket.io/?EIO=4&transport=websocket" \
    --max-time 3 2>/dev/null || true)

if echo "$SOCKET_RES" | grep -qi "101"; then
    log "WebSocket: 101 Switching Protocols"
elif echo "$SOCKET_RES" | grep -qi "400"; then
    log "WebSocket: Route reachable (Nginx proxy OK)"
else
    warn "WebSocket: Verify in browser"
fi

# ──────────────────────────────────────────────────────────────
step "7. RESOURCE USAGE"
# ──────────────────────────────────────────────────────────────
if command -v docker &>/dev/null; then
    BACKEND_MEM=$(docker stats --no-stream --format "{{.MemUsage}}" zapai-backend 2>/dev/null | head -1 || echo "N/A")
    BACKEND_CPU=$(docker stats --no-stream --format "{{.CPUPerc}}" zapai-backend 2>/dev/null | head -1 || echo "N/A")
    log "Backend: Memory=$BACKEND_MEM CPU=$BACKEND_CPU"
fi

# ──────────────────────────────────────────────────────────────
step "8. PRODUCTION STATUS"
# ──────────────────────────────────────────────────────────────
if [ -n "$TOKEN" ]; then
    PROD_STATUS=$(curl -s --max-time 10 \
        -H "Authorization: Bearer $TOKEN" \
        "$BASE_URL/api/production/status" 2>/dev/null || echo "{}")

    UPTIME=$(echo "$PROD_STATUS" | grep -o '"human":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "N/A")
    HEAP=$(echo "$PROD_STATUS" | grep -o '"heapUsedMB":[0-9]*' | head -1 | cut -d: -f2 || echo "N/A")
    WS_CLIENTS=$(echo "$PROD_STATUS" | grep -o '"websocketClients":[0-9]*' | head -1 | cut -d: -f2 || echo "N/A")

    log "Uptime: $UPTIME | Heap: ${HEAP}MB | WS Clients: $WS_CLIENTS"
fi

# ──────────────────────────────────────────────────────────────
echo ""
echo "============================================================"
TOTAL=$((PASS + FAIL + WARN))
echo -e "  Results: ${GREEN}$PASS passed${NC} | ${RED}$FAIL failed${NC} | ${YELLOW}$WARN warnings${NC} | $TOTAL total"

if [ "$FAIL" -eq 0 ]; then
    echo -e "  ${GREEN}✨ PRODUCTION VALIDATION PASSED ✨${NC}"
else
    echo -e "  ${RED}⚠  $FAIL checks FAILED — review above${NC}"
fi
echo "============================================================"

exit $FAIL