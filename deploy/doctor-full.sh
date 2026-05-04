#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$APP_DIR/docker-compose.production.yml"
ENV_FILE="$APP_DIR/.env.production"
TIMESTAMP="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
REPORT_FILE="$APP_DIR/logs/doctor-$(date +%Y%m%d_%H%M%S).log"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

mkdir -p "$APP_DIR/logs"

exec > >(tee -a "$REPORT_FILE") 2>&1

header() { echo -e "\n${BLUE}========================================${NC}"; echo -e "${BLUE}$*${NC}"; echo -e "${BLUE}========================================${NC}"; }
pass() { PASS=$((PASS + 1)); echo -e "  ${GREEN}[PASS]${NC} $*"; }
fail() { FAIL=$((FAIL + 1)); echo -e "  ${RED}[FAIL]${NC} $*"; }
warn() { WARN=$((WARN + 1)); echo -e "  ${YELLOW}[WARN]${NC} $*"; }

check_http() {
  local url="$1"
  local label="$2"
  local expected_code="${3:-200}"
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 5 "$url" 2>/dev/null || echo "000")"
  if [ "$code" = "$expected_code" ]; then
    pass "$label ($url → $code)"
  else
    fail "$label ($url → $code, expected $expected_code)"
  fi
}

check_http_json() {
  local url="$1"
  local label="$2"
  local body
  body="$(curl -fsS --connect-timeout 5 "$url" 2>/dev/null || true)"
  if [ -n "$body" ]; then
    pass "$label ($url → OK, $(echo "$body" | head -c 120))"
  else
    fail "$label ($url → no response)"
  fi
}

check_docker_container() {
  local name="$1"
  local label="$2"
  local state
  state="$(docker inspect --format='{{.State.Status}}' "$name" 2>/dev/null || echo "missing")"
  if [ "$state" = "running" ]; then
    local health
    health="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$name" 2>/dev/null || echo "unknown")"
    if [ "$health" = "healthy" ] || [ "$health" = "no-healthcheck" ]; then
      pass "$label ($name: $state, health=$health)"
    else
      warn "$label ($name: $state, health=$health)"
    fi
  else
    fail "$label ($name: $state)"
  fi
}

check_port() {
  local port="$1"
  local label="$2"
  if ss -lntp 2>/dev/null | grep -q ":$port " || netstat -lntp 2>/dev/null | grep -q ":$port "; then
    pass "$label (port $port listening)"
  else
    fail "$label (port $port NOT listening)"
  fi
}

check_dns() {
  local domain="$1"
  local label="$2"
  if host "$domain" >/dev/null 2>&1 || nslookup "$domain" >/dev/null 2>&1; then
    pass "$label ($domain resolves)"
  else
    warn "$label ($domain does NOT resolve)"
  fi
}

check_ssl() {
  local domain="$1"
  local label="$2"
  local expiry
  expiry="$(echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2 || true)"
  if [ -n "$expiry" ]; then
    pass "$label (SSL valid until $expiry)"
  else
    warn "$label (SSL not detected or unreachable)"
  fi
}

check_db() {
  local label="$1"
  if docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres pg_isready -U "${POSTGRES_USER:-zapai}" >/dev/null 2>&1; then
    pass "$label (PostgreSQL ready)"
  else
    fail "$label (PostgreSQL NOT ready)"
  fi
}

check_redis() {
  local label="$1"
  if docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T redis redis-cli ping 2>/dev/null | grep -q PONG; then
    pass "$label (Redis PONG)"
  else
    fail "$label (Redis NOT responding)"
  fi
}

check_migration_table() {
  local label="$1"
  local count
  count="$(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres psql -U "${POSTGRES_USER:-zapai}" -d "${POSTGRES_DB:-zapai_crm}" -tAc "SELECT COUNT(*) FROM schema_migrations" 2>/dev/null || echo "0")"
  if [ "$count" -gt 0 ] 2>/dev/null; then
    pass "$label ($count migrations applied)"
  else
    warn "$label (no migrations found)"
  fi
}

check_table_exists() {
  local table="$1"
  local label="$2"
  local exists
  exists="$(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres psql -U "${POSTGRES_USER:-zapai}" -d "${POSTGRES_DB:-zapai_crm}" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name='$table')" 2>/dev/null || echo "f")"
  if [ "$exists" = "t" ]; then
    pass "$label (table $table exists)"
  else
    warn "$label (table $table missing)"
  fi
}

check_disk() {
  local label="$1"
  local usage
  usage="$(df -h / | awk 'NR==2 {print $5}' | tr -d '%')"
  if [ "$usage" -lt 85 ] 2>/dev/null; then
    pass "$label (disk ${usage}% used)"
  else
    warn "$label (disk ${usage}% used — near limit)"
  fi
}

check_memory() {
  local label="$1"
  local mem_available
  mem_available="$(free -m | awk 'NR==2 {print $7}')"
  if [ "$mem_available" -gt 200 ] 2>/dev/null; then
    pass "$label (${mem_available}MB available)"
  else
    warn "$label (${mem_available}MB available — low memory)"
  fi
}

header "ZAPAI DOCTOR FULL — $TIMESTAMP"
echo "Report: $REPORT_FILE"

# ── 1. Docker containers ──
header "1. Docker Containers"
check_docker_container "zapai-postgres" "PostgreSQL"
check_docker_container "zapai-redis" "Redis"
check_docker_container "zapai-backend" "Backend"
check_docker_container "zapai-frontend" "Frontend"
check_docker_container "zapai-postgres-backup" "Backup Service"

# ── 2. Ports ──
header "2. Ports"
check_port "4025" "Backend API"
check_port "80" "Frontend HTTP"
check_port "443" "Frontend HTTPS"

# ── 3. Health endpoints ──
header "3. Health Endpoints"
check_http_json "http://127.0.0.1:4025/health" "Backend /health"
check_http_json "http://127.0.0.1:4025/api/health" "Backend /api/health"
check_http "http://127.0.0.1/health" "Frontend /health"

# ── 4. API endpoints ──
header "4. API Endpoints"
check_http_json "http://127.0.0.1:4025/api/system/version" "System version"
check_http "http://127.0.0.1:4025/api/auth/login" "Auth login" "400"

# ── 5. Database ──
header "5. Database"
check_db "PostgreSQL connectivity"
check_redis "Redis connectivity"
check_migration_table "Schema migrations"
check_table_exists "nodes" "Nodes table"
check_table_exists "heartbeats" "Heartbeats table"
check_table_exists "remote_commands" "Remote commands table"
check_table_exists "users" "Users table"
check_table_exists "system_info" "System info table"

# ── 6. Domain & SSL ──
header "6. Domain & SSL"
DOMAIN="$(grep -E '^DOMAIN=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)"
if [ -n "$DOMAIN" ]; then
  check_dns "$DOMAIN" "DNS resolution"
  check_ssl "$DOMAIN" "SSL certificate"
  check_http "https://${DOMAIN}/health" "HTTPS frontend health" "200"
  check_http_json "https://${DOMAIN}/api/health" "HTTPS backend health"
else
  warn "DOMAIN not configured — using IP only"
fi

# ── 7. System resources ──
header "7. System Resources"
check_disk "Disk usage"
check_memory "Memory available"

# ── 8. Docker compose ps ──
header "8. Docker Compose Status"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps 2>/dev/null || docker compose -f "$COMPOSE_FILE" ps 2>/dev/null || warn "docker compose ps failed"

# ── 9. Recent backend logs (errors only) ──
header "9. Recent Backend Errors"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs --tail=80 backend 2>/dev/null | grep -iE "error|fail|crash|uncaught|fatal" | tail -20 || pass "No recent errors in backend logs"

# ── 10. Summary ──
header "10. Summary"
TOTAL=$((PASS + FAIL + WARN))
echo "  Total checks : $TOTAL"
echo -e "  ${GREEN}Passed       : $PASS${NC}"
echo -e "  ${RED}Failed       : $FAIL${NC}"
echo -e "  ${YELLOW}Warnings     : $WARN${NC}"
echo "  Report saved : $REPORT_FILE"

if [ "$FAIL" -gt 0 ]; then
  echo -e "\n${RED}DOCTOR: $FAIL failure(s) detected. Review report above.${NC}"
  exit 1
else
  echo -e "\n${GREEN}DOCTOR: All critical checks passed.${NC}"
  exit 0
fi
