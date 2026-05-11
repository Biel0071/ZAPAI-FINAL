#!/bin/bash
# ==============================================================================
# ZAPFLOW AI — ENTERPRISE ZERO-CONFIG INSTALLER v3
# Deterministic, idempotent, self-healing.
# ==============================================================================

set -e

# ── Absolute path anchor ─────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

ENV_FILE="$SCRIPT_DIR/.env.production"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.production.yml"
NGINX_TEMPLATE="$SCRIPT_DIR/infrastructure/nginx/nginx.conf.template"
NGINX_CONF="$SCRIPT_DIR/infrastructure/nginx/nginx.conf"

# ── Colors ────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✔] $1${NC}"; }
warn() { echo -e "${YELLOW}[⚠] $1${NC}"; }
err()  { echo -e "${RED}[✖] $1${NC}"; }
step() { echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }

# ── Compose shorthand (defined as function so env-file is checked at call time)
dc() { docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"; }

# ==============================================================================
step "0. LIMPEZA DO HOST"
# ==============================================================================
systemctl stop nginx 2>/dev/null || true
systemctl stop apache2 2>/dev/null || true
systemctl disable nginx 2>/dev/null || true
systemctl disable apache2 2>/dev/null || true

rm -rf "$SCRIPT_DIR/frontend/node_modules" "$SCRIPT_DIR/frontend/dist" 2>/dev/null || true
log "Conflitos do host eliminados."

# ==============================================================================
step "1. DEPENDÊNCIAS DO SISTEMA"
# ==============================================================================
apt-get update && apt-get upgrade -y
apt-get install -y curl wget git jq ufw htop software-properties-common gettext-base

if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
    sh /tmp/get-docker.sh && rm /tmp/get-docker.sh
fi

if ! command -v node &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
log "Docker $(docker --version | cut -d' ' -f3) | Node $(node --version)"

# ==============================================================================
step "2. FIREWALL"
# ==============================================================================
ufw allow OpenSSH
ufw allow 3000/tcp
ufw allow 8080/tcp
ufw allow 19999/tcp
ufw --force enable
log "UFW ativo."

# ==============================================================================
step "3. .env.production"
# ==============================================================================
# Detect public IP once — used everywhere
PUBLIC_IP=$(curl -4 -s --max-time 5 ifconfig.me || curl -4 -s --max-time 5 icanhazip.com || echo "127.0.0.1")

if [ ! -f "$ENV_FILE" ]; then
    PG_PASS=$(openssl rand -hex 16)
    JWT=$(openssl rand -hex 32)
    SESSION=$(openssl rand -hex 32)
    PANEL_TOKEN=$(openssl rand -hex 24)
    NODE_TOKEN=$(openssl rand -hex 24)

    cat > "$ENV_FILE" <<ENVEOF
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
    log ".env.production CRIADO (IP: ${PUBLIC_IP}, senha DB gerada)."
    ENV_IS_NEW=true
else
    log ".env.production já existe — mantendo."
    ENV_IS_NEW=false
fi

# ==============================================================================
step "4. LIMPEZA DO DOCKER"
# ==============================================================================
# Parar stack existente + remover volumes SÓ se o env acabou de ser criado
# (evita mismatch de senha postgres com volume antigo)
dc down --remove-orphans 2>/dev/null || true

if [ "$ENV_IS_NEW" = "true" ]; then
    warn "Env novo — removendo volumes Docker antigos para evitar mismatch de credenciais..."
    dc down -v 2>/dev/null || true
    docker system prune -af 2>/dev/null || true
else
    docker image prune -af 2>/dev/null || true
fi
log "Docker limpo."

# ==============================================================================
step "5. BUILD DO FRONTEND"
# ==============================================================================
cd "$SCRIPT_DIR/frontend"
npm ci
npm run build
cd "$SCRIPT_DIR"

if [ ! -d "$SCRIPT_DIR/frontend/dist" ] || [ -z "$(ls -A "$SCRIPT_DIR/frontend/dist")" ]; then
    err "Build do frontend falhou. Abortando."
    exit 1
fi
log "Frontend compilado."

# ==============================================================================
step "6. NGINX TEMPLATE (envsubst)"
# ==============================================================================
BACKEND_SERVICE=$(docker compose -f "$COMPOSE_FILE" config --services 2>/dev/null | grep -E 'backend|api|server' | head -n1 || true)
if [ -z "$BACKEND_SERVICE" ]; then BACKEND_SERVICE=backend; fi
export BACKEND_SERVICE

envsubst '${BACKEND_SERVICE}' < "$NGINX_TEMPLATE" > "$NGINX_CONF"
log "nginx.conf gerado (upstream → ${BACKEND_SERVICE})."

# ==============================================================================
step "7. VALIDAÇÃO DO COMPOSE"
# ==============================================================================
dc config > /dev/null || { err "Compose inválido!"; exit 1; }
log "Compose válido."

# ==============================================================================
step "8. DIRETÓRIOS"
# ==============================================================================
mkdir -p "$SCRIPT_DIR"/{backups/postgres,logs/backend,backend/sessions,backend/uploads}
chmod -R 777 "$SCRIPT_DIR/backups" "$SCRIPT_DIR/logs" "$SCRIPT_DIR/backend/sessions" "$SCRIPT_DIR/backend/uploads"

# ==============================================================================
step "9. SUBIR STACK"
# ==============================================================================
# Subir infra primeiro — postgres e redis precisam estar healthy antes do backend
dc up -d postgres redis
echo -e "${YELLOW}⏳ Aguardando Postgres + Redis ficarem healthy...${NC}"

for i in $(seq 1 30); do
    PG_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' zapai-postgres 2>/dev/null || echo "starting")
    RD_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' zapai-redis 2>/dev/null || echo "starting")
    if [ "$PG_HEALTH" = "healthy" ] && [ "$RD_HEALTH" = "healthy" ]; then
        log "Postgres: healthy | Redis: healthy"
        break
    fi
    echo -e "  ⏳ Postgres: ${PG_HEALTH} | Redis: ${RD_HEALTH} (${i}/30)"
    sleep 2
done

# Validar nginx config dentro da network docker (DNS disponível)
NGINX_TEST=$(dc run --rm nginx nginx -t 2>&1 || true)
if echo "$NGINX_TEST" | grep -qi "failed"; then
    err "Nginx config inválida na network Docker!"
    echo "$NGINX_TEST"
    dc down
    exit 1
fi
log "nginx -t OK."

# Subir tudo (backend será buildado aqui)
dc up -d --build
log "Stack subindo."

# ==============================================================================
step "10. HEALTHCHECK + AUTO-RECOVERY"
# ==============================================================================
echo -e "${YELLOW}⏳ Aguardando backend ficar healthy (pode levar até 2min)...${NC}"
sleep 15

MAX_RETRIES=8
ALL_HEALTHY=false

for i in $(seq 1 $MAX_RETRIES); do
    echo -e "  🧪 Tentativa $i/$MAX_RETRIES..."

    # Check container health status directly
    BE_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' zapai-backend 2>/dev/null || echo "unknown")
    echo -e "     Backend container: ${BE_HEALTH}"

    HTTP_FRONT=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://127.0.0.1:3000 2>/dev/null || echo "000")
    HTTP_API=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://127.0.0.1:3000/api/health 2>/dev/null || echo "000")

    echo -e "     Frontend: ${HTTP_FRONT} | API: ${HTTP_API}"

    if [ "$HTTP_FRONT" = "200" ] && [ "$HTTP_API" = "200" ]; then
        ALL_HEALTHY=true
        break
    fi

    # If backend is starting, just wait; if unhealthy, restart it
    if [ "$BE_HEALTH" = "unhealthy" ]; then
        warn "Backend unhealthy — reiniciando..."
        dc restart backend 2>/dev/null || true
    fi

    sleep 15
done

if [ "$ALL_HEALTHY" != "true" ]; then
    err "Stack NÃO ficou saudável após $MAX_RETRIES tentativas."
    echo ""
    echo -e "${RED}─── LOGS BACKEND ───${NC}"
    dc logs --tail=40 backend 2>/dev/null || true
    echo -e "${RED}─── LOGS NGINX ───${NC}"
    dc logs --tail=20 nginx 2>/dev/null || true
    echo -e "${RED}─── DOCKER PS ───${NC}"
    docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || true
    exit 1
fi

log "Todos os serviços estão online!"

# ==============================================================================
step "11. MASTER SELF-REGISTRATION"
# ==============================================================================
HOSTNAME_LOCAL=$(hostname 2>/dev/null || echo "master")
BUILD_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

REGISTER_RESULT=$(curl -s --max-time 10 \
  -X POST "http://127.0.0.1:3000/api/master/register-node" \
  -H "Content-Type: application/json" \
  -d "{
    \"node_id\": \"master\",
    \"hostname\": \"${HOSTNAME_LOCAL}\",
    \"ip\": \"${PUBLIC_IP}\",
    \"version\": \"${BUILD_HASH}\",
    \"port\": 4025
  }" 2>/dev/null || echo '{"success":false}')

if echo "$REGISTER_RESULT" | grep -q '"success":true'; then
    log "Master registrado no cluster."
else
    warn "Auto-registro do master falhou (não-crítico)."
fi

# ==============================================================================
step "12. RESULTADO FINAL"
# ==============================================================================
echo ""
echo "============================================================"
echo -e "${GREEN}  ✨ ZAPFLOW AI — DEPLOY CONCLUÍDO ✨${NC}"
echo "============================================================"
echo ""
echo -e "  Frontend:  ${CYAN}http://${PUBLIC_IP}:3000${NC}"
echo -e "  API:       ${CYAN}http://${PUBLIC_IP}:3000/api/health${NC}"
echo -e "  Cluster:   ${CYAN}http://${PUBLIC_IP}:3000/api/cluster/overview${NC}"
echo -e "  Dozzle:    ${CYAN}http://${PUBLIC_IP}:8080${NC}"
echo ""
echo -e "  Login:     ${CYAN}zapadmin / zapadmin123${NC}"
echo ""
echo -e "  Logs:      docker compose --env-file .env.production -f docker-compose.production.yml logs -f"
echo -e "  Agent:     ZAPAI_MASTER_URL=http://${PUBLIC_IP}:3000 bash scripts/zapai-agent.sh"
echo "============================================================"

