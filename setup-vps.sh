#!/bin/bash
# ==============================================================================
# ZAPFLOW AI — ENTERPRISE AUTO-RECOVERY INSTALLER v4
# Deterministic, idempotent, self-healing.
#
# Handles: fresh install, re-deploy, merge recovery, password mismatch,
# stale volumes, partial failures, and broken migrations.
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

# ── Compose shorthand ─────────────────────────────────────────
dc() { docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"; }

# ── Helper: read a key from .env.production ───────────────────
env_val() {
    grep -E "^${1}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'"
}

# ==============================================================================
step "0. LIMPEZA DO HOST"
# ==============================================================================
systemctl stop nginx 2>/dev/null || true
systemctl stop apache2 2>/dev/null || true
systemctl disable nginx 2>/dev/null || true
systemctl disable apache2 2>/dev/null || true

rm -rf "$SCRIPT_DIR/frontend-official/node_modules" "$SCRIPT_DIR/frontend-official/dist" 2>/dev/null || true
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
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp
ufw allow 8080/tcp
ufw allow 19999/tcp
ufw --force enable
log "UFW ativo."

# ==============================================================================
step "3. .env.production — AUTO-SYNC ENGINE"
# ==============================================================================
# Detect public IP once — used everywhere
PUBLIC_IP=$(curl -4 -s --max-time 5 ifconfig.me || curl -4 -s --max-time 5 icanhazip.com || echo "127.0.0.1")

# ── Check if postgres volume already has data ─────────────────
# This is the key to avoiding password mismatch on re-deploy.
PG_VOLUME_EXISTS=false
if docker volume inspect zapai-production_postgres_data &>/dev/null; then
    PG_VOLUME_EXISTS=true
fi

if [ -f "$ENV_FILE" ]; then
    # ── CASE 1: Env exists — preserve it, just patch missing vars ──
    log ".env.production encontrado — preservando credenciais."
    ENV_IS_NEW=false

    # Ensure all required vars exist (add missing ones from merge)
    ensure_env_var() {
        local key="$1" default="$2"
        if ! grep -qE "^${key}=" "$ENV_FILE" 2>/dev/null; then
            echo "${key}=${default}" >> "$ENV_FILE"
            warn "Variável ${key} adicionada ao .env.production"
        fi
    }

    # Patch any vars added in recent merges
    ensure_env_var "DEFAULT_COMPANY_ID" "default"
    ensure_env_var "DB_RUN_MIGRATIONS_ON_BOOT" "true"
    ensure_env_var "LOG_LEVEL" "info"
    ensure_env_var "CRASH_EXIT_ON_UNHANDLED" "true"
    ensure_env_var "DOMAIN" "${PUBLIC_IP}"
    ensure_env_var "LETSENCRYPT_EMAIL" "admin@zapflow.app"
    ensure_env_var "VITE_API_URL" "http://${PUBLIC_IP}:3000"
    ensure_env_var "CORS_ALLOWED_ORIGINS" "http://${PUBLIC_IP}:3000,http://${PUBLIC_IP},https://${PUBLIC_IP}"

    # Ensure CORS includes current IP (IP may have changed)
    CURRENT_CORS=$(env_val "CORS_ALLOWED_ORIGINS")
    if ! echo "$CURRENT_CORS" | grep -q "$PUBLIC_IP"; then
        sed -i "s|^CORS_ALLOWED_ORIGINS=.*|CORS_ALLOWED_ORIGINS=${CURRENT_CORS},http://${PUBLIC_IP}:3000,http://${PUBLIC_IP}|" "$ENV_FILE"
        warn "IP público atualizado no CORS: ${PUBLIC_IP}"
    fi

    # Read the password that's in the env (needed for volume sync)
    PG_PASS=$(env_val "POSTGRES_PASSWORD")

elif [ "$PG_VOLUME_EXISTS" = "true" ]; then
    # ── CASE 2: No env BUT volume exists — RECOVERY MODE ──────────
    # This is the dangerous scenario: old volume + no env file.
    # We CANNOT know the old password, so we must reset the volume.
    warn "⚠️  RECOVERY: .env.production ausente MAS volume postgres existe!"
    warn "    Impossível recuperar senha antiga. Volume será recriado."
    warn "    BACKUP: Tentando salvar dump antes de destruir..."

    # Try to dump data before destroying (best-effort)
    dc up -d postgres 2>/dev/null || true
    sleep 5
    mkdir -p "$SCRIPT_DIR/backups/recovery"
    docker exec zapai-postgres pg_dumpall -U zapai \
        > "$SCRIPT_DIR/backups/recovery/pre_recovery_$(date +%Y%m%d_%H%M%S).sql" 2>/dev/null || true
    dc down -v 2>/dev/null || true

    PG_PASS=$(openssl rand -hex 16)
    ENV_IS_NEW=true
    # Fall through to fresh env generation below

else
    # ── CASE 3: Fresh install — generate everything ────────────────
    PG_PASS=$(openssl rand -hex 16)
    ENV_IS_NEW=true
fi

# Generate fresh env file if needed
if [ "$ENV_IS_NEW" = "true" ]; then
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

# Domain — set to your real domain once DNS is configured
DOMAIN=${PUBLIC_IP}
LETSENCRYPT_EMAIL=admin@zapflow.app

# URLs — Nginx serves on port 3000 by default
FRONTEND_URL=http://${PUBLIC_IP}:3000
CORS_ALLOWED_ORIGINS=http://${PUBLIC_IP}:3000,http://${PUBLIC_IP},https://${PUBLIC_IP}
VITE_API_URL=http://${PUBLIC_IP}:3000

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
DEFAULT_COMPANY_ID=default

DB_WAIT_TIMEOUT_SECONDS=120
DB_WAIT_INTERVAL_SECONDS=2
DB_RUN_MIGRATIONS_ON_BOOT=true
PGSSLMODE=disable
DB_SSL=false

LOG_LEVEL=info
CRASH_EXIT_ON_UNHANDLED=true

TZ=America/Sao_Paulo
ENVEOF
    log ".env.production CRIADO (IP: ${PUBLIC_IP}, senha DB: gerada)."
fi

# Re-read the final password (may have been preserved or generated)
PG_PASS=$(env_val "POSTGRES_PASSWORD")
PG_USER=$(env_val "POSTGRES_USER")
PG_DB=$(env_val "POSTGRES_DB")

# Ensure DATABASE_URL is in sync with individual vars
EXPECTED_DB_URL="postgresql://${PG_USER}:${PG_PASS}@postgres:5432/${PG_DB}"
CURRENT_DB_URL=$(env_val "DATABASE_URL")
if [ "$CURRENT_DB_URL" != "$EXPECTED_DB_URL" ]; then
    sed -i "s|^DATABASE_URL=.*|DATABASE_URL=${EXPECTED_DB_URL}|" "$ENV_FILE"
    warn "DATABASE_URL sincronizado com POSTGRES_PASSWORD."
fi

log "Env sync completo. (PG_USER=${PG_USER}, DB=${PG_DB})"

# ==============================================================================
step "4. DOCKER CLEANUP"
# ==============================================================================
dc down --remove-orphans 2>/dev/null || true

if [ "$ENV_IS_NEW" = "true" ]; then
    warn "Env novo — removendo volumes Docker antigos para evitar mismatch..."
    dc down -v 2>/dev/null || true
    docker system prune -af 2>/dev/null || true
else
    docker image prune -af 2>/dev/null || true
fi
log "Docker limpo."

# ==============================================================================
step "5. POSTGRES AUTH RECOVERY"
# ==============================================================================
# Start ONLY postgres to test authentication BEFORE building anything else.
# This catches the "password authentication failed" error early.
dc up -d postgres
echo -e "${YELLOW}⏳ Aguardando Postgres iniciar...${NC}"

PG_READY=false
for i in $(seq 1 20); do
    PG_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' zapai-postgres 2>/dev/null || echo "starting")
    if [ "$PG_HEALTH" = "healthy" ]; then
        PG_READY=true
        break
    fi
    echo -e "  ⏳ Postgres: ${PG_HEALTH} (${i}/20)"
    sleep 3
done

if [ "$PG_READY" != "true" ]; then
    warn "Postgres não ficou healthy. Verificando logs..."
    docker logs zapai-postgres --tail=10 2>/dev/null || true
fi

# ── Test actual auth connectivity ──────────────────────────────
echo -e "${YELLOW}🔑 Testando autenticação PostgreSQL...${NC}"
PG_AUTH_OK=false

if docker exec zapai-postgres psql -U "$PG_USER" -d "$PG_DB" -c "SELECT 1;" &>/dev/null; then
    PG_AUTH_OK=true
    log "Autenticação PostgreSQL OK."
else
    warn "⚠️  FALHA de autenticação PostgreSQL! Iniciando auto-recovery..."

    # Strategy 1: Try to ALTER ROLE with the password from env
    # This works if postgres started with a different password but pg_hba allows local trust
    if docker exec zapai-postgres psql -U postgres -c "ALTER ROLE ${PG_USER} WITH PASSWORD '${PG_PASS}';" &>/dev/null; then
        log "Senha do PostgreSQL sincronizada via ALTER ROLE."
        PG_AUTH_OK=true
    else
        # Strategy 2: Force pg_hba to trust, then fix password
        warn "ALTER ROLE via postgres user falhou. Tentando trust override..."

        # Temporarily allow trust auth
        docker exec zapai-postgres bash -c "
            PG_HBA=\$(find /var/lib/postgresql -name pg_hba.conf 2>/dev/null | head -1)
            if [ -n \"\$PG_HBA\" ]; then
                cp \"\$PG_HBA\" \"\${PG_HBA}.bak\"
                echo 'local all all trust' > \"\$PG_HBA\"
                echo 'host all all 0.0.0.0/0 trust' >> \"\$PG_HBA\"
                pg_ctl reload -D /var/lib/postgresql/data 2>/dev/null || true
            fi
        " 2>/dev/null || true

        sleep 2

        if docker exec zapai-postgres psql -U "$PG_USER" -d "$PG_DB" -c "ALTER ROLE ${PG_USER} WITH PASSWORD '${PG_PASS}';" &>/dev/null; then
            log "Senha sincronizada via trust override."
            PG_AUTH_OK=true
        elif docker exec zapai-postgres psql -U postgres -c "
            DO \$\$
            BEGIN
                IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${PG_USER}') THEN
                    CREATE ROLE ${PG_USER} WITH LOGIN PASSWORD '${PG_PASS}';
                ELSE
                    ALTER ROLE ${PG_USER} WITH PASSWORD '${PG_PASS}';
                END IF;
            END
            \$\$;
            CREATE DATABASE ${PG_DB} OWNER ${PG_USER};
        " &>/dev/null; then
            log "Usuário e banco recriados com sucesso."
            PG_AUTH_OK=true
        fi

        # Restore original pg_hba
        docker exec zapai-postgres bash -c "
            PG_HBA=\$(find /var/lib/postgresql -name pg_hba.conf.bak 2>/dev/null | head -1)
            if [ -n \"\$PG_HBA\" ]; then
                mv \"\$PG_HBA\" \"\${PG_HBA%.bak}\"
                pg_ctl reload -D /var/lib/postgresql/data 2>/dev/null || true
            fi
        " 2>/dev/null || true
    fi

    # Strategy 3: Nuclear — destroy volume and start fresh
    if [ "$PG_AUTH_OK" != "true" ]; then
        err "Todas as estratégias de recovery falharam."
        warn "⚠️  ÚLTIMO RECURSO: Recriando volume PostgreSQL do zero..."
        warn "    Dados anteriores serão perdidos."

        mkdir -p "$SCRIPT_DIR/backups/recovery"
        docker exec zapai-postgres pg_dumpall -U postgres \
            > "$SCRIPT_DIR/backups/recovery/last_resort_$(date +%Y%m%d_%H%M%S).sql" 2>/dev/null || true

        dc down -v 2>/dev/null || true
        docker volume rm zapai-production_postgres_data 2>/dev/null || true

        dc up -d postgres
        sleep 10

        if docker exec zapai-postgres psql -U "$PG_USER" -d "$PG_DB" -c "SELECT 1;" &>/dev/null; then
            PG_AUTH_OK=true
            log "Volume recriado. PostgreSQL funcional."
        else
            err "CRÍTICO: PostgreSQL não funciona mesmo após recreate. Abortando."
            docker logs zapai-postgres --tail=20 2>/dev/null || true
            exit 1
        fi
    fi
fi

# ==============================================================================
step "6. REDIS + WAIT"
# ==============================================================================
dc up -d redis
echo -e "${YELLOW}⏳ Aguardando Redis...${NC}"

for i in $(seq 1 15); do
    RD_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' zapai-redis 2>/dev/null || echo "starting")
    if [ "$RD_HEALTH" = "healthy" ]; then
        log "Redis: healthy"
        break
    fi
    echo -e "  ⏳ Redis: ${RD_HEALTH} (${i}/15)"
    sleep 2
done

# ==============================================================================
step "7. ATOMIC FRONTEND BUILD"
# ==============================================================================
RELEASES_DIR="$SCRIPT_DIR/frontend-official/releases"
CURRENT_LINK="$SCRIPT_DIR/frontend-official/current"
BUILD_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "$(date +%s)")
RELEASE_NAME="release_${BUILD_HASH}_$(date +%Y%m%d_%H%M%S)"
RELEASE_DIR="$RELEASES_DIR/$RELEASE_NAME"

mkdir -p "$RELEASES_DIR"

# Source env ONLY for VITE_API_URL — do NOT let NODE_ENV=production
# leak into npm ci, or it will skip devDependencies (vite, typescript, etc.)
VITE_API_URL=$(grep '^VITE_API_URL=' "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- || echo "http://${PUBLIC_IP}:3000")
export VITE_API_URL

cd "$SCRIPT_DIR/frontend-official"

# Install ALL dependencies (including devDependencies like vite, typescript, postcss)
# NODE_ENV must NOT be "production" here, or npm ci skips devDependencies.
NODE_ENV=development npm ci --legacy-peer-deps

# Validate vite is actually installed before attempting build
if [ ! -f "node_modules/.bin/vite" ]; then
    warn "vite não encontrado após npm ci. Tentando install explícito..."
    npm install --legacy-peer-deps
fi

if [ ! -f "node_modules/.bin/vite" ]; then
    warn "vite ainda ausente. Instalando diretamente..."
    npm install vite@^5.4.19 @vitejs/plugin-react-swc --legacy-peer-deps
fi

if [ ! -f "node_modules/.bin/vite" ]; then
    err "FALHA CRÍTICA: vite não pode ser instalado. Abortando."
    exit 1
fi

log "Dependências instaladas: $(ls node_modules | wc -l) pacotes | vite: $(npx vite --version 2>/dev/null || echo 'ok')"

# Build with production optimizations
NODE_ENV=production npx vite build
cd "$SCRIPT_DIR"

# Validate build output
if [ ! -f "$SCRIPT_DIR/frontend-official/dist/index.html" ]; then
    err "Build falhou — index.html ausente. Abortando."
    exit 1
fi

JS_COUNT=$(find "$SCRIPT_DIR/frontend-official/dist/assets" -name "*.js" 2>/dev/null | wc -l)
CSS_COUNT=$(find "$SCRIPT_DIR/frontend-official/dist/assets" -name "*.css" 2>/dev/null | wc -l)

if [ "$JS_COUNT" -lt 3 ]; then
    err "Build inválido — apenas $JS_COUNT chunks JS encontrados. Abortando."
    exit 1
fi

# Save release backup (copy, don't move — dist/ is the Docker mount source)
cp -r "$SCRIPT_DIR/frontend-official/dist" "$RELEASE_DIR"

log "Build OK: $RELEASE_NAME ($JS_COUNT JS + $CSS_COUNT CSS chunks). dist/ pronto para nginx."

# Cleanup old releases (keep last 3)
cd "$RELEASES_DIR"
RELEASE_COUNT=$(ls -1d release_* 2>/dev/null | wc -l)
if [ "$RELEASE_COUNT" -gt 3 ]; then
    ls -1dt release_* | tail -n +4 | xargs rm -rf
    log "Releases antigas limpas (mantidas: 3)."
fi
cd "$SCRIPT_DIR"

# ==============================================================================
step "8. NGINX TEMPLATE (envsubst)"
# ==============================================================================
BACKEND_SERVICE=$(docker compose -f "$COMPOSE_FILE" config --services 2>/dev/null | grep -E 'backend|api|server' | head -n1 || true)
if [ -z "$BACKEND_SERVICE" ]; then BACKEND_SERVICE=backend; fi
export BACKEND_SERVICE

envsubst '${BACKEND_SERVICE}' < "$NGINX_TEMPLATE" > "$NGINX_CONF"
log "nginx.conf gerado (upstream → ${BACKEND_SERVICE})."

# ==============================================================================
step "9. VALIDAÇÃO DO COMPOSE"
# ==============================================================================
dc config > /dev/null || { err "Compose inválido!"; exit 1; }
log "Compose válido."

# ==============================================================================
step "10. DIRETÓRIOS"
# ==============================================================================
mkdir -p "$SCRIPT_DIR"/{backups/postgres,backups/recovery,logs/backend,logs/deploy,backend/sessions,backend/uploads}
chmod -R 777 "$SCRIPT_DIR/backups" "$SCRIPT_DIR/logs" "$SCRIPT_DIR/backend/sessions" "$SCRIPT_DIR/backend/uploads"

# ==============================================================================
step "11. SUBIR STACK COMPLETA"
# ==============================================================================
# Validate nginx config inside docker network (DNS available)
NGINX_TEST=$(dc run --rm nginx nginx -t 2>&1 || true)
if echo "$NGINX_TEST" | grep -qi "failed"; then
    err "Nginx config inválida na network Docker!"
    echo "$NGINX_TEST"
    dc down
    exit 1
fi
log "nginx -t OK."

# Build and start everything (postgres + redis already up)
dc up -d --build
log "Stack subindo."

# ==============================================================================
step "12. HEALTHCHECK + AUTO-RECOVERY"
# ==============================================================================
echo -e "${YELLOW}⏳ Aguardando backend ficar healthy (pode levar até 2min)...${NC}"
sleep 15

MAX_RETRIES=10
ALL_HEALTHY=false
PG_AUTH_FIXED=false

for i in $(seq 1 $MAX_RETRIES); do
    echo -e "  🧪 Tentativa $i/$MAX_RETRIES..."

    # Check container health status directly
    BE_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' zapai-backend 2>/dev/null || echo "unknown")
    echo -e "     Backend: ${BE_HEALTH}"

    # Check for postgres auth failure in backend logs (the exact error)
    if docker logs zapai-backend --tail=5 2>&1 | grep -qi "password authentication failed"; then
        if [ "$PG_AUTH_FIXED" != "true" ]; then
            warn "Detectado 'password authentication failed' nos logs do backend!"
            warn "Tentando sincronizar senha PostgreSQL..."

            # Re-read password from env
            PG_PASS=$(env_val "POSTGRES_PASSWORD")
            PG_USER=$(env_val "POSTGRES_USER")

            # Fix it live
            docker exec zapai-postgres psql -U postgres -c \
                "ALTER ROLE ${PG_USER} WITH PASSWORD '${PG_PASS}';" 2>/dev/null || true

            PG_AUTH_FIXED=true
            dc restart backend 2>/dev/null || true
            sleep 10
            continue
        fi
    fi

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
    echo -e "${RED}─── LOGS POSTGRES ───${NC}"
    dc logs --tail=20 postgres 2>/dev/null || true
    echo -e "${RED}─── DOCKER PS ───${NC}"
    docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || true
    exit 1
fi

log "Todos os serviços estão online!"

# ==============================================================================
step "13. VALIDAÇÃO DE LOGIN"
# ==============================================================================
AUTH_USER=$(env_val "AUTH_DEFAULT_USERNAME")
AUTH_PASS=$(env_val "AUTH_DEFAULT_PASSWORD")

LOGIN_RESULT=$(curl -s --max-time 10 \
    -X POST "http://127.0.0.1:3000/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"${AUTH_USER}\",\"password\":\"${AUTH_PASS}\"}" 2>/dev/null || echo '{}')

if echo "$LOGIN_RESULT" | grep -q '"token"'; then
    log "Login validado: ${AUTH_USER} → token OK"
else
    warn "Login não retornou token (primeiro boot pode precisar de seed)."
    warn "Resposta: $(echo "$LOGIN_RESULT" | head -c 200)"
fi

# ==============================================================================
step "14. SYSTEMD SERVICES"
# ==============================================================================

cat <<EOF > /etc/systemd/system/zapai-backend.service
[Unit]
Description=ZAPFLOW AI Backend (Docker Compose)
Requires=docker.service
After=docker.service network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$SCRIPT_DIR
ExecStart=/usr/bin/docker compose --env-file $ENV_FILE -f $COMPOSE_FILE up -d
ExecStop=/usr/bin/docker compose --env-file $ENV_FILE -f $COMPOSE_FILE down

[Install]
WantedBy=multi-user.target
EOF

cat <<EOF > /etc/systemd/system/zapai-agent.service
[Unit]
Description=ZAPFLOW AI Worker Agent
After=docker.service network-online.target zapai-backend.service

[Service]
Type=simple
User=root
WorkingDirectory=$SCRIPT_DIR
Environment="ZAPAI_MASTER_URL=http://127.0.0.1:3000"
Environment="ZAPAI_NODE_ID=master"
EnvironmentFile=$ENV_FILE
ExecStart=/bin/bash $SCRIPT_DIR/scripts/zapai-agent.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload 2>/dev/null || true
systemctl enable zapai-backend.service zapai-agent.service 2>/dev/null || true
systemctl start zapai-agent.service 2>/dev/null || true

log "Systemd services configurados."

# ==============================================================================
step "15. MASTER SELF-REGISTRATION"
# ==============================================================================
HOSTNAME_LOCAL=$(hostname 2>/dev/null || echo "master")
BUILD_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
REG_TOKEN=$(env_val "NODE_REGISTRATION_TOKEN")

REGISTER_RESULT=$(curl -s --max-time 10 \
  -X POST "http://127.0.0.1:3000/api/master/register-node" \
  -H "Content-Type: application/json" \
  -H "x-registration-token: ${REG_TOKEN}" \
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
step "16. RESULTADO FINAL"
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
echo -e "  Login:     ${CYAN}${AUTH_USER} / ${AUTH_PASS}${NC}"
echo ""
echo -e "  Logs:      docker compose --env-file .env.production -f docker-compose.production.yml logs -f"
echo -e "  Rollback:  bash rollback.sh"
echo -e "  Update:    bash deploy.sh"
echo "============================================================"
