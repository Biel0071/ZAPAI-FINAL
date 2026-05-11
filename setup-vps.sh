#!/bin/bash
# ==============================================================================
# ZAPFLOW AI — ENTERPRISE ZERO-CONFIG INSTALLER
# Deterministic, idempotent, self-healing.
# ==============================================================================

set -e

# ── Absolute path anchor — never lose context ─────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

# ── Compose helper — single source of truth for every call ────
DC="docker compose --env-file $SCRIPT_DIR/.env.production -f $SCRIPT_DIR/docker-compose.production.yml"

# ── Colors ────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✔] $1${NC}"; }
warn() { echo -e "${YELLOW}[⚠] $1${NC}"; }
err()  { echo -e "${RED}[✖] $1${NC}"; }
step() { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }

step "0. LIMPEZA E DESCONFLITO DO HOST"
# ──────────────────────────────────────────────────────────────
systemctl stop nginx 2>/dev/null || true
systemctl stop apache2 2>/dev/null || true
systemctl disable nginx 2>/dev/null || true
systemctl disable apache2 2>/dev/null || true

rm -rf "$SCRIPT_DIR/frontend/node_modules" "$SCRIPT_DIR/frontend/dist" 2>/dev/null || true

if command -v docker &>/dev/null; then
    docker system prune -af --volumes 2>/dev/null || true
fi
log "Host limpo."

step "1. DEPENDÊNCIAS DO SISTEMA"
# ──────────────────────────────────────────────────────────────
apt-get update && apt-get upgrade -y
apt-get install -y curl wget git jq ufw htop software-properties-common gettext-base

if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
    sh /tmp/get-docker.sh
    rm /tmp/get-docker.sh
fi

if ! command -v node &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
log "Docker $(docker --version | cut -d' ' -f3) | Node $(node --version)"

step "2. FIREWALL"
# ──────────────────────────────────────────────────────────────
ufw allow OpenSSH
ufw allow 3000/tcp   # App
ufw allow 8080/tcp   # Dozzle
ufw allow 19999/tcp  # Netdata
ufw --force enable
log "UFW ativo."

step "3. AUTO-GERAÇÃO DO .env.production"
# ──────────────────────────────────────────────────────────────
if [ ! -f "$SCRIPT_DIR/.env.production" ]; then
    PUBLIC_IP=$(curl -4 -s ifconfig.me || curl -4 -s icanhazip.com || echo "127.0.0.1")
    PG_PASS=$(openssl rand -hex 16)
    JWT=$(openssl rand -hex 32)
    SESSION=$(openssl rand -hex 32)
    PANEL_TOKEN=$(openssl rand -hex 24)
    NODE_TOKEN=$(openssl rand -hex 24)

    cat > "$SCRIPT_DIR/.env.production" <<ENVEOF
NODE_ENV=production
PORT=4025

POSTGRES_DB=zapai_crm
POSTGRES_USER=zapai
POSTGRES_PASSWORD=${PG_PASS}
DATABASE_URL=postgresql://zapai:${PG_PASS}@postgres:5432/zapai_crm

REDIS_URL=redis://redis:6379

FRONTEND_URL=http://${PUBLIC_IP}:3000
CORS_ALLOWED_ORIGINS=http://${PUBLIC_IP}:3000

JWT_SECRET=${JWT}
AUTH_JWT_SECRET=${JWT}
SESSION_SECRET=${SESSION}
MASTER_PANEL_TOKEN=${PANEL_TOKEN}
NODE_REGISTRATION_TOKEN=${NODE_TOKEN}

MASTER=true
MASTER_HOSTNAME=ZAP-AICRM
MASTER_VPS_IP=${PUBLIC_IP}

AUTH_DEFAULT_USERNAME=zapadmin
AUTH_DEFAULT_EMAIL=admin@admin.com
AUTH_DEFAULT_PASSWORD=zapadmin123
AUTH_DEFAULT_ROLE=master_admin
AUTH_DEFAULT_TENANT_ID=default

DB_WAIT_TIMEOUT_SECONDS=120
DB_WAIT_INTERVAL_SECONDS=2
PGSSLMODE=disable
DB_SSL=false

TZ=America/Sao_Paulo
ENVEOF
    log ".env.production gerado (IP: ${PUBLIC_IP})."
else
    log ".env.production já existe — mantendo."
fi

step "4. BUILD DO FRONTEND"
# ──────────────────────────────────────────────────────────────
cd "$SCRIPT_DIR/frontend"
npm ci
npm run build
cd "$SCRIPT_DIR"

if [ ! -d "$SCRIPT_DIR/frontend/dist" ] || [ -z "$(ls -A "$SCRIPT_DIR/frontend/dist")" ]; then
    err "Build do frontend falhou (dist vazio). Abortando."
    exit 1
fi
log "Frontend compilado."

step "5. TEMPLATE NGINX (envsubst)"
# ──────────────────────────────────────────────────────────────
BACKEND_SERVICE=$(docker compose -f "$SCRIPT_DIR/docker-compose.production.yml" config --services 2>/dev/null | grep -E 'backend|api|server' | head -n1 || true)
if [ -z "$BACKEND_SERVICE" ]; then BACKEND_SERVICE=backend; fi
export BACKEND_SERVICE

envsubst '${BACKEND_SERVICE}' \
  < "$SCRIPT_DIR/infrastructure/nginx/nginx.conf.template" \
  > "$SCRIPT_DIR/infrastructure/nginx/nginx.conf"

log "nginx.conf gerado (upstream: ${BACKEND_SERVICE})."

step "6. VALIDAÇÃO DO DOCKER COMPOSE"
# ──────────────────────────────────────────────────────────────
$DC config > /dev/null || { err "docker-compose.production.yml inválido!"; exit 1; }
log "Compose válido."

step "7. DIRETÓRIOS PERSISTENTES"
# ──────────────────────────────────────────────────────────────
mkdir -p "$SCRIPT_DIR"/{backups/postgres,logs/backend,backend/sessions,backend/uploads}
chmod -R 777 "$SCRIPT_DIR/backups" "$SCRIPT_DIR/logs" "$SCRIPT_DIR/backend/sessions" "$SCRIPT_DIR/backend/uploads"

step "8. SUBIR STACK"
# ──────────────────────────────────────────────────────────────
$DC down --remove-orphans 2>/dev/null || true

# Subir infra primeiro para DNS resolver
$DC up -d postgres redis
echo -e "${YELLOW}⏳ Aguardando Postgres e Redis (10s)...${NC}"
sleep 10

# Validar nginx dentro da network
NGINX_TEST=$($DC run --rm nginx nginx -t 2>&1 || true)
if echo "$NGINX_TEST" | grep -qi "failed"; then
    err "Nginx inválido dentro da network!"
    echo "$NGINX_TEST"
    $DC down
    exit 1
fi
log "nginx -t OK dentro da network Docker."

# Subir tudo
$DC up -d --build
log "Stack subindo."

step "9. HEALTHCHECK + AUTO-RECOVERY"
# ──────────────────────────────────────────────────────────────
echo -e "${YELLOW}⏳ Aguardando serviços estabilizarem (20s)...${NC}"
sleep 20

MAX_RETRIES=5
for i in $(seq 1 $MAX_RETRIES); do
    echo -e "  🧪 Tentativa $i/$MAX_RETRIES..."

    HTTP_FRONT=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://127.0.0.1:3000 2>/dev/null || echo "000")
    HTTP_API=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://127.0.0.1:3000/api/health 2>/dev/null || echo "000")

    echo -e "     Frontend: ${HTTP_FRONT} | API: ${HTTP_API}"

    if [ "$HTTP_FRONT" = "200" ] && [ "$HTTP_API" = "200" ]; then
        log "Healthchecks OK! Frontend 200 | API 200"
        ALL_HEALTHY=true
        break
    fi

    warn "Serviço não pronto. Reiniciando backend + nginx..."
    $DC restart backend nginx 2>/dev/null || true
    sleep 10
done

if [ "${ALL_HEALTHY}" != "true" ]; then
    err "Stack NÃO ficou saudável após $MAX_RETRIES tentativas."
    echo -e "${RED}─── LOGS DO BACKEND ───${NC}"
    $DC logs --tail=30 backend 2>/dev/null || true
    echo -e "${RED}─── LOGS DO NGINX ───${NC}"
    $DC logs --tail=30 nginx 2>/dev/null || true
    exit 1
fi

step "10. RESULTADO FINAL"
# ──────────────────────────────────────────────────────────────
PUBLIC_IP=$(curl -4 -s ifconfig.me 2>/dev/null || echo "IP_DA_VPS")

echo ""
echo "============================================================"
echo -e "${GREEN}  ✨ ZAPFLOW AI — DEPLOY ENTERPRISE CONCLUÍDO ✨${NC}"
echo "============================================================"
echo -e "  Frontend:  ${CYAN}http://${PUBLIC_IP}:3000${NC}"
echo -e "  API:       ${CYAN}http://${PUBLIC_IP}:3000/api/health${NC}"
echo -e "  Dozzle:    ${CYAN}http://${PUBLIC_IP}:8080${NC}"
echo -e "  Netdata:   ${CYAN}http://${PUBLIC_IP}:19999${NC}"
echo "============================================================"
echo -e "  Compose:   docker compose --env-file .env.production -f docker-compose.production.yml logs -f"
echo -e "  Status:    docker ps --format 'table {{.Names}}\t{{.Status}}'"
echo "============================================================"
