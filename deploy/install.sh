#!/bin/bash
# ==============================================================================
# ZAPAI — Full VPS Install Script  (v2 — Full Bootstrap)
# Instala TUDO do zero e coloca o sistema ONLINE automaticamente.
#
# Uso:
#   sudo bash deploy/install.sh
#   sudo bash deploy/install.sh --domain=meudominio.com
#   sudo bash deploy/install.sh --skip-postgres   (usa Docker Postgres)
#   sudo bash deploy/install.sh --skip-redis      (usa Docker Redis)
#
# Resultado: sistema ONLINE, PM2 rodando, watcher ativo, pronto para:
#   git push origin main → deploy automático
# ==============================================================================

set -euo pipefail

# ─── Parse args ─────────────────────────────────────────────────────────────
# APP_DIR auto-detects from the script's own location (the repo root).
# This means:
#   /opt/ZAPAI-FINAL/deploy/install.sh  → APP_DIR=/opt/ZAPAI-FINAL
#   /opt/zapai/deploy/install.sh         → APP_DIR=/opt/zapai
# Override with: APP_DIR=/custom/path sudo bash deploy/install.sh
SCRIPT_SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd)"
REPO_ROOT="$(cd "$SCRIPT_SELF_DIR/.." 2>/dev/null && pwd)"

DOMAIN=""
SKIP_POSTGRES=false
SKIP_REDIS=false
APP_USER="${APP_USER:-$(logname 2>/dev/null || echo 'zapai')}"
APP_DIR="${APP_DIR:-$REPO_ROOT}"
NODE_VERSION="${NODE_VERSION:-20}"
REPO_URL="${REPO_URL:-https://github.com/Biel0071/ZAPAI-FINAL.git}"

for arg in "$@"; do
  case $arg in
    --domain=*)      DOMAIN="${arg#*=}" ;;
    --user=*)        APP_USER="${arg#*=}" ;;
    --app-dir=*)     APP_DIR="${arg#*=}" ;;
    --repo=*)        REPO_URL="${arg#*=}" ;;
    --skip-postgres) SKIP_POSTGRES=true ;;
    --skip-redis)    SKIP_REDIS=true ;;
  esac
done

BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend-official"
LOGS_DIR="$APP_DIR/logs"
DEPLOY_DIR="$APP_DIR/deploy"
RELEASES_DIR="$APP_DIR/releases"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${GREEN}[INSTALL $(date +%H:%M:%S)] ✔ $*${NC}"; }
warn() { echo -e "${YELLOW}[INSTALL $(date +%H:%M:%S)] ⚠ $*${NC}"; }
err()  { echo -e "${RED}[INSTALL $(date +%H:%M:%S)] ✖ $*${NC}"; exit 1; }
step() { echo -e "\n${CYAN}━━━ $* ━━━${NC}"; }

# ─── Recovery & Error Handler ──────────────────────────────────────────────────
error_handler() {
  local exit_code=$?
  local line_no="$1"
  local bash_cmd="$2"
  echo -e "\n${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${RED}[ERRO CRÍTICO] FALHA NA INSTALAÇÃO!${NC}"
  echo -e "  Arquivo:      ${BASH_SOURCE[0]}"
  echo -e "  Linha:        ${line_no}"
  echo -e "  Comando:      ${bash_cmd}"
  echo -e "  Retorno:      ${exit_code}"
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
  exit $exit_code
}
trap 'error_handler ${LINENO} "$BASH_COMMAND"' ERR

[[ $EUID -eq 0 ]] || err "Run as root: sudo bash deploy/install.sh"

# ─── OS Detection & EPEL Setup ────────────────────────────────────────────────
OS_FAMILY="debian"
OS_NAME="Debian/Ubuntu"

if [ -f /etc/os-release ]; then
  . /etc/os-release
  OS_NAME="$NAME $VERSION_ID"
  if [[ "$ID" == "almalinux" || "$ID" == "rocky" || "$ID" == "rhel" || "$ID" == "centos" || "$ID_LIKE" =~ "rhel" || "$ID_LIKE" =~ "fedora" ]]; then
    OS_FAMILY="rhel"
  fi
fi

log "Detectado: $OS_NAME ($OS_FAMILY)"

# Enable EPEL repository on RHEL-based systems (EPEL is required for fail2ban, redis, htop, etc.)
if [ "$OS_FAMILY" = "rhel" ]; then
  if ! dnf repolist | grep -q "epel"; then
    log "Instalando repositório EPEL para suporte a pacotes de produção..."
    dnf install -y epel-release -q || true
  fi
fi

# ─── Package Manager Functions ───────────────────────────────────────────────
update_packages() {
  if [ "$OS_FAMILY" = "debian" ]; then
    apt-get update -qq
  else
    dnf check-update -q || true
  fi
}

install_packages() {
  if [ "$OS_FAMILY" = "debian" ]; then
    apt-get install -y -qq "$@" 2>&1 | tail -3
  else
    dnf install -y -q "$@" 2>&1 | tail -3
  fi
}

enable_service() {
  systemctl enable "$1" 2>/dev/null || true
}

start_service() {
  systemctl start "$1" 2>/dev/null || true
}

restart_service() {
  systemctl restart "$1" 2>/dev/null || true
}

# ─── AUTO-DETECT PUBLIC IP ────────────────────────────────────────────────────
# The public IP is used for BACKEND_URL, FRONTEND_URL, CORS_ORIGIN in .env
# and shown in the final output. Never hardcodes localhost.
if [ -n "$DOMAIN" ]; then
  PUBLIC_IP="$DOMAIN"     # use domain as the host if provided
  PUBLIC_URL="https://$DOMAIN"
else
  # Try multiple services in order of reliability
  PUBLIC_IP=$(
    curl -s --max-time 5 https://api.ipify.org 2>/dev/null ||
    curl -s --max-time 5 http://checkip.amazonaws.com 2>/dev/null ||
    curl -s --max-time 5 http://ifconfig.me 2>/dev/null ||
    hostname -I 2>/dev/null | awk '{print $1}'
  )
  PUBLIC_IP="${PUBLIC_IP// /}"   # strip whitespace
  PUBLIC_URL="http://${PUBLIC_IP}"
fi

if [ -z "$PUBLIC_IP" ]; then
  warn "Could not detect public IP — using 127.0.0.1 (configure FRONTEND_URL manually)"
  PUBLIC_IP="127.0.0.1"
  PUBLIC_URL="http://127.0.0.1"
fi

# ─── PANEL DETECTION (SAFE MODE) ─────────────────────────────────────────────
# Detects hosting control panels that manage nginx/ports globally.
# When detected, install.sh skips UFW reset and avoids breaking panel configs.
PANEL_SAFE_MODE=false
DETECTED_PANEL=""

detect_panel() {
  # Hestia CP
  if [ -d "/usr/local/hestia" ] || command -v hestia >/dev/null 2>&1; then
    DETECTED_PANEL="HestiaCP"; PANEL_SAFE_MODE=true; return
  fi
  # CyberPanel
  if [ -d "/usr/local/CyberCP" ] || command -v cyberpanel >/dev/null 2>&1; then
    DETECTED_PANEL="CyberPanel"; PANEL_SAFE_MODE=true; return
  fi
  # aaPanel / BT Panel
  if [ -d "/www/server/panel" ] || command -v bt >/dev/null 2>&1; then
    DETECTED_PANEL="aaPanel/BT"; PANEL_SAFE_MODE=true; return
  fi
  # Plesk
  if [ -d "/opt/psa" ] || command -v plesk >/dev/null 2>&1; then
    DETECTED_PANEL="Plesk"; PANEL_SAFE_MODE=true; return
  fi
  # Webmin
  if [ -d "/etc/webmin" ] || command -v webmin >/dev/null 2>&1; then
    DETECTED_PANEL="Webmin"; PANEL_SAFE_MODE=true; return
  fi
  # DirectAdmin
  if [ -d "/usr/local/directadmin" ]; then
    DETECTED_PANEL="DirectAdmin"; PANEL_SAFE_MODE=true; return
  fi
  # ISPConfig
  if [ -d "/usr/local/ispconfig" ]; then
    DETECTED_PANEL="ISPConfig"; PANEL_SAFE_MODE=true; return
  fi
}

detect_panel

if $PANEL_SAFE_MODE; then
  warn "═══════════════════════════════════════════════════"
  warn "  PANEL SAFE MODE ACTIVE — detected: $DETECTED_PANEL"
  warn "  → UFW will NOT be reset (panel manages firewall)"
  warn "  → /etc/nginx/nginx.conf will NOT be touched"
  warn "  → Only isolated site config will be created"
  warn "  → Panel-managed services will NOT be restarted"
  warn "═══════════════════════════════════════════════════"
else
  log "No hosting panel detected — standard install mode"
fi

# ─── AUTO PORT DETECTION ──────────────────────────────────────────────────────
# Find a free port starting from PREFERRED_PORT (default 4025).
# If 4025 is already occupied by another service, auto-select next free port.
PREFERRED_PORT="${PORT:-4025}"

find_free_port() {
  local start=$1
  local port=$start
  while [ $port -lt $((start + 100)) ]; do
    if ! ss -tlnp 2>/dev/null | grep -q ":${port} " && \
       ! lsof -i ":${port}" >/dev/null 2>&1; then
      echo "$port"
      return 0
    fi
    port=$((port + 1))
  done
  echo "$start"  # fallback to preferred if scan fails
}

BACKEND_PORT=$(find_free_port "$PREFERRED_PORT")

if [ "$BACKEND_PORT" != "$PREFERRED_PORT" ]; then
  warn "Port $PREFERRED_PORT is occupied — using port $BACKEND_PORT instead"
  warn "Update .env.production PORT=$BACKEND_PORT if needed"
else
  log "Backend port: $BACKEND_PORT (free)"
fi

echo "============================================================"
echo "  ZAPAI VPS INSTALL (Full Bootstrap) — $(date)"
echo "  User: $APP_USER | Dir: $APP_DIR"
echo "  Node: v${NODE_VERSION} | Public IP: $PUBLIC_IP"
echo "  Repo: $REPO_URL"
echo "  URL:  $PUBLIC_URL"
echo "============================================================"

# ─── 0. CLEANUP OLD INSTALLATIONS ────────────────────────────────────────────
# ─── 0. CLEANUP OLD INSTALLATIONS ────────────────────────────────────────────
# Archives DEAD install paths (not the current APP_DIR and not the repo root).
# NEVER archives /opt/ZAPAI-FINAL if that's where the script is running from.
step "0. CLEANUP OLD INSTALLATIONS"
DEAD_PATHS=(
  "/opt/zapai-frontend"
  "/var/www/zapai"
  "/var/www/html/zapai"
  "/opt/zapai-old"
)
for dead_path in "${DEAD_PATHS[@]}"; do
  if [ -d "$dead_path" ] && \
     [ "$dead_path" != "$APP_DIR" ] && \
     [ "$dead_path" != "$REPO_ROOT" ]; then
    warn "Dead installation: $dead_path — archiving"
    mkdir -p /opt/zapai-archive
    mv "$dead_path" "/opt/zapai-archive/$(basename $dead_path)_$(date +%Y%m%d_%H%M%S)" 2>/dev/null || true
    log "Archived: $dead_path"
  fi
done

# Kill orphaned PM2 daemons from other projects, but only if PM2 is managing
# something other than zapflow-api (avoids killing live sessions)
if command -v pm2 >/dev/null 2>&1; then
  RUNNING_APPS=$(pm2 jlist 2>/dev/null | python3 -c \
    "import sys,json; procs=json.load(sys.stdin); print(len(procs))" 2>/dev/null || echo '0')
  if [ "$RUNNING_APPS" -gt 0 ]; then
    warn "PM2: $RUNNING_APPS app(s) running — checking for orphans"
    # Only delete apps NOT named zapflow-api (preserve live sessions)
    pm2 jlist 2>/dev/null | python3 -c "
import sys, json, subprocess
procs = json.load(sys.stdin)
for p in procs:
    name = p.get('name', '')
    if name and name != 'zapflow-api':
        subprocess.run(['pm2', 'delete', name], capture_output=True)
        print(f'Removed orphan PM2 app: {name}')
" 2>/dev/null || pm2 delete all 2>/dev/null || true
  else
    log "PM2: no running apps — clean slate"
  fi
fi

log "Cleanup done — APP_DIR: $APP_DIR"

# ─── 0.5. VPS ENVIRONMENT AUDIT ───────────────────────────────────────────────
# Read-only. Detects what already exists before installing anything.
step "0.5. VPS ENVIRONMENT AUDIT"

echo ""
echo "  ── System ──────────────────────────────────────────"
OS_NAME=$(. /etc/os-release 2>/dev/null && echo "$NAME $VERSION_ID" || uname -s)
KERNEL=$(uname -r)
ARCH=$(uname -m)
echo "  OS:       $OS_NAME ($ARCH)"
echo "  Kernel:   $KERNEL"

# CPU
CPU_CORES=$(nproc 2>/dev/null || grep -c processor /proc/cpuinfo 2>/dev/null || echo '?')
CPU_MODEL=$(grep 'model name' /proc/cpuinfo 2>/dev/null | head -1 | cut -d: -f2 | xargs || echo 'unknown')
echo "  CPU:      $CPU_CORES core(s) — $CPU_MODEL"

# RAM
RAM_TOTAL=$(free -m 2>/dev/null | awk '/^Mem/{print $2}' || echo '?')
RAM_FREE=$(free -m 2>/dev/null | awk '/^Mem/{print $4}' || echo '?')
echo "  RAM:      ${RAM_TOTAL}MB total / ${RAM_FREE}MB free"

# Disk
DISK_TOTAL=$(df -h "$APP_DIR" 2>/dev/null | awk 'NR==2{print $2}' || echo '?')
DISK_FREE=$(df -h "$APP_DIR" 2>/dev/null | awk 'NR==2{print $4}' || echo '?')
DISK_PCT=$(df -h "$APP_DIR" 2>/dev/null | awk 'NR==2{print $5}' || echo '?')
echo "  Disk:     ${DISK_TOTAL} total / ${DISK_FREE} free (${DISK_PCT} used)"

# Check if disk is critically full
DISK_USED_INT=$(df "$APP_DIR" 2>/dev/null | awk 'NR==2{gsub(/%/,"",$5); print $5}' || echo '0')
if [ "${DISK_USED_INT:-0}" -gt 90 ] 2>/dev/null; then
  warn "Disk usage >90% — install may fail. Free up space first."
fi

echo ""
echo "  ── Network ──────────────────────────────────────────"
# Internet check (silent, 3s timeout)
if curl -s --max-time 3 https://github.com -o /dev/null; then
  log "Internet: reachable ✔"
else
  warn "Internet: unreachable — apt-get and git clone may fail"
fi
echo "  Public IP: $PUBLIC_IP"

# Open ports
echo "  Listening ports (40xx range):"
ss -tlnp 2>/dev/null | grep -E ':40[0-9]{2}' | awk '{print "    "$1,$4,$NF}' || echo "    none"

echo ""
echo "  ── Tools already installed ──────────────────────────"
AUDIT_TOOLS=(git curl wget nginx psql redis-cli node npm pm2 python3 openssl unzip build-essential)
MISSING_TOOLS=()
for tool in "${AUDIT_TOOLS[@]}"; do
  if command -v "$tool" >/dev/null 2>&1; then
    VER=$(${tool} --version 2>/dev/null | head -1 | sed 's/^[^0-9]*//' | cut -c1-20 || echo 'ok')
    printf "  ✔ %-16s %s\n" "$tool" "$VER"
  else
    printf "  ✖ %-16s (missing — will install)\n" "$tool"
    MISSING_TOOLS+=("$tool")
  fi
done

echo ""
echo "  ── Current project directory ────────────────────────"
if [ -d "$APP_DIR/.git" ]; then
  CURRENT_BRANCH=$(git -C "$APP_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')
  CURRENT_COMMIT=$(git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null || echo 'unknown')
  echo "  Repo:     $APP_DIR"
  echo "  Branch:   $CURRENT_BRANCH @ $CURRENT_COMMIT"
else
  echo "  Repo:     $APP_DIR (not yet cloned)"
fi

if [ -f "$BACKEND_DIR/package.json" ]; then
  BE_VER=$(node -e "try{console.log(require('$BACKEND_DIR/package.json').version)}catch(e){}" 2>/dev/null || echo '?')
  echo "  Backend:  $BACKEND_DIR (v$BE_VER)"
fi
if [ -f "$FRONTEND_DIR/package.json" ]; then
  FE_VER=$(node -e "try{console.log(require('$FRONTEND_DIR/package.json').version)}catch(e){}" 2>/dev/null || echo '?')
  echo "  Frontend: $FRONTEND_DIR (v$FE_VER)"
fi
if [ -f "$BACKEND_DIR/ecosystem.config.js" ]; then
  echo "  PM2 eco:  $BACKEND_DIR/ecosystem.config.js ✔"
fi
if [ -f "$APP_DIR/.env.production" ]; then
  echo "  .env:     $APP_DIR/.env.production ✔ ($(wc -l < "$APP_DIR/.env.production") lines)"
else
  echo "  .env:     not found — will auto-generate"
fi

echo ""
echo "  ── Nginx status ─────────────────────────────────────"
if systemctl is-active --quiet nginx 2>/dev/null; then
  echo "  Nginx: active ✔"
  NGINX_SITES=$(ls /etc/nginx/sites-enabled/ 2>/dev/null | tr '\n' ' ' || echo 'none')
  echo "  Enabled sites: $NGINX_SITES"
else
  echo "  Nginx: not running (will start)"
fi

echo ""
echo "  ── PM2 status ───────────────────────────────────────"
if command -v pm2 >/dev/null 2>&1; then
  pm2 status 2>/dev/null | grep -E 'zapflow|pm2' || echo "  No PM2 apps running"
else
  echo "  PM2: not installed (will install)"
fi

echo ""
log "Audit complete — proceeding to install"
echo ""

# ─── 1. System packages ───────────────────────────────────────────────────────
step "1. SYSTEM PACKAGES"
update_packages
if [ "$OS_FAMILY" = "debian" ]; then
  install_packages \
    curl wget git build-essential \
    nginx certbot python3-certbot-nginx \
    ufw fail2ban \
    htop iotop \
    logrotate cron \
    ca-certificates gnupg lsb-release
else
  install_packages \
    curl wget git gcc gcc-c++ make \
    nginx certbot python3-certbot-nginx \
    fail2ban \
    htop iotop \
    logrotate cronie
fi
log "Base packages installed"

# ─── 2. Node.js ───────────────────────────────────────────────────────────────
step "2. NODE.JS v${NODE_VERSION}"
if command -v node >/dev/null 2>&1 && node --version | grep -q "^v${NODE_VERSION}"; then
  log "Node.js $(node --version) already installed"
else
  log "Instalando Node.js v${NODE_VERSION}..."
  if [ "$OS_FAMILY" = "debian" ]; then
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash - 2>&1 | tail -3
    install_packages nodejs
  else
    dnf module reset nodejs -y -q || true
    dnf module enable nodejs:20 -y -q || true
    dnf install -y nodejs -q
  fi
  # Enable corepack for npm/pnpm/yarn management
  corepack enable 2>/dev/null || true
  log "Node.js $(node --version) instalado"
fi

# ─── 3. PM2 ───────────────────────────────────────────────────────────────────
step "3. PM2"
if command -v pm2 >/dev/null 2>&1; then
  log "PM2 $(pm2 --version) already installed"
else
  npm install -g pm2 --quiet
  log "PM2 $(pm2 --version) installed"
fi
pm2 install pm2-logrotate 2>/dev/null || true
pm2 set pm2-logrotate:max_size 50M 2>/dev/null || true
pm2 set pm2-logrotate:retain 14 2>/dev/null || true
pm2 set pm2-logrotate:compress true 2>/dev/null || true
log "PM2 logrotate configured"

# ─── 4. PostgreSQL (with self-healing retry) ─────────────────────────────────
step "4. POSTGRESQL"
# Fixed password — must match .env.production (zapai123)
DB_PASS="${DB_PASSWORD:-zapai123}"

if $SKIP_POSTGRES; then
  warn "PostgreSQL install skipped (--skip-postgres)"
else
  if ! command -v psql >/dev/null 2>&1; then
    if [ "$OS_FAMILY" = "debian" ]; then
      install_packages postgresql postgresql-contrib
    else
      install_packages postgresql-server postgresql-contrib
    fi
    log "PostgreSQL installed"
  else
    log "PostgreSQL $(psql --version | head -1) already installed"
  fi

  # Self-healing boot: retry up to 5 times with backoff
  PG_READY=false
  for attempt in 1 2 3 4 5; do
    if [ "$OS_FAMILY" = "rhel" ]; then
      if [ ! -f /var/lib/pgsql/data/PG_VERSION ]; then
        postgresql-setup --initdb || true
      fi
    fi
    enable_service postgresql
    start_service postgresql
    sleep $((attempt * 2))
    if sudo -u postgres psql -c 'SELECT 1' >/dev/null 2>&1; then
      PG_READY=true
      log "PostgreSQL: accepting connections (attempt $attempt)"
      break
    fi
    warn "PostgreSQL not ready (attempt $attempt/5) — retrying..."
  done

  # Helper to configure pg_hba.conf and postgresql.conf dynamically
  configure_postgres_auth() {
    log "Configurando pg_hba.conf e postgresql.conf para acesso local..."
    local hba_file=""
    local conf_file=""
    
    if sudo -u postgres psql -c 'SELECT 1' >/dev/null 2>&1; then
      hba_file=$(sudo -u postgres psql -t -A -c "SHOW hba_file;" 2>/dev/null || true)
      conf_file=$(sudo -u postgres psql -t -A -c "SHOW config_file;" 2>/dev/null || true)
    fi
    
    if [ -z "$hba_file" ]; then
      if [ "$OS_FAMILY" = "debian" ]; then
        hba_file=$(ls /etc/postgresql/*/main/pg_hba.conf 2>/dev/null | head -1 || true)
      else
        hba_file="/var/lib/pgsql/data/pg_hba.conf"
      fi
    fi

    if [ -z "$conf_file" ]; then
      if [ "$OS_FAMILY" = "debian" ]; then
        conf_file=$(ls /etc/postgresql/*/main/postgresql.conf 2>/dev/null | head -1 || true)
      else
        conf_file="/var/lib/pgsql/data/postgresql.conf"
      fi
    fi

    if [ -f "$hba_file" ]; then
      log "pg_hba.conf encontrado: $hba_file"
      cp "$hba_file" "${hba_file}.bak" 2>/dev/null || true
      
      # Clean old autoconfigured rules if any to prevent duplicates
      sed -i '/# ZAPAI-FINAL/d' "$hba_file" 2>/dev/null || true
      
      # Prepend trust rules to the top of pg_hba.conf so they take precedence
      local temp_hba=$(mktemp)
      cat > "$temp_hba" << HBAEOF
# ZAPAI-FINAL Auto-configured rules
local   all             all                                     trust
host    all             all             127.0.0.1/32            trust
host    all             all             ::1/128                 trust
HBAEOF
      cat "$hba_file" >> "$temp_hba"
      mv "$temp_hba" "$hba_file"
      chown postgres:postgres "$hba_file" 2>/dev/null || true
      chmod 600 "$hba_file" 2>/dev/null || true
      log "✔ pg_hba.conf atualizado com regras de trust local"
    else
      warn "pg_hba.conf não encontrado em $hba_file"
    fi

    if [ -f "$conf_file" ]; then
      log "postgresql.conf encontrado: $conf_file"
      cp "$conf_file" "${conf_file}.bak" 2>/dev/null || true
      # Ensure listen_addresses is set
      sed -i "s|^#listen_addresses =.*|listen_addresses = '*'|" "$conf_file" 2>/dev/null || true
      sed -i "s|^listen_addresses =.*|listen_addresses = '*'|" "$conf_file" 2>/dev/null || true
      if ! grep -q "^listen_addresses" "$conf_file"; then
        echo "listen_addresses = '*'" >> "$conf_file"
      fi
      log "✔ postgresql.conf atualizado (listen_addresses = '*')"
    else
      warn "postgresql.conf não encontrado em $conf_file"
    fi

    restart_service postgresql
  }

  if $PG_READY; then
    # Configure authentication rules first
    configure_postgres_auth

    # Read existing password from .env if present
    if [ -f "$APP_DIR/.env.production" ]; then
      EXISTING_DB_PASS=$(grep '^POSTGRES_PASSWORD=' "$APP_DIR/.env.production" 2>/dev/null | cut -d= -f2)
      [ -n "$EXISTING_DB_PASS" ] && DB_PASS="$EXISTING_DB_PASS"
    fi

    # Create role safely
    if sudo -u postgres psql -t -A -c "SELECT 1 FROM pg_roles WHERE rolname='zapai';" 2>/dev/null | grep -q "1"; then
      log "✔ Usuário 'zapai' já existe. Atualizando senha..."
      sudo -u postgres psql -c "ALTER USER zapai WITH PASSWORD '$DB_PASS';" >/dev/null 2>&1 || true
    else
      log "Criando usuário 'zapai'..."
      sudo -u postgres psql -c "CREATE USER zapai WITH PASSWORD '$DB_PASS';" >/dev/null 2>&1 || true
      log "✔ Usuário 'zapai' criado"
    fi

    # Create database safely
    if sudo -u postgres psql -t -A -c "SELECT 1 FROM pg_database WHERE datname='zapai_crm';" 2>/dev/null | grep -q "1"; then
      log "✔ Banco de dados 'zapai_crm' já existe."
    else
      log "Criando banco de dados 'zapai_crm'..."
      sudo -u postgres psql -c "CREATE DATABASE zapai_crm OWNER zapai;" >/dev/null 2>&1 || true
      log "✔ Banco de dados 'zapai_crm' criado"
    fi

    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE zapai_crm TO zapai;" 2>/dev/null || true

    # Validate connection test with retries
    VAL_READY=false
    for val_attempt in 1 2 3; do
      if PGPASSWORD="$DB_PASS" psql -h localhost -U zapai -d zapai_crm -c 'SELECT 1' >/dev/null 2>&1; then
        VAL_READY=true
        log "✔ Conexão zapai_crm verificada com sucesso via psql (SELECT 1 ok)"
        break
      fi
      warn "Falha na conexão de teste (tentativa $val_attempt/3). Re-aplicando privilégios..."
      sudo -u postgres psql -c "ALTER USER zapai WITH PASSWORD '$DB_PASS';" >/dev/null 2>&1 || true
      sudo -u postgres psql -c "ALTER DATABASE zapai_crm OWNER TO zapai;" >/dev/null 2>&1 || true
      sleep 2
    done

    if ! $VAL_READY; then
      warn "Falha na verificação da conexão TCP com zapai_crm. O instalador prosseguirá."
    fi
  else
    warn "PostgreSQL não iniciou após 5 tentativas — verifique: systemctl status postgresql"
    warn "O instalador prosseguirá, mas as migrations falharão se o banco não estiver disponível."
  fi
fi

# ─── 5. Redis (graceful fallback — system continues if Redis unavailable) ─────
step "5. REDIS"
REDIS_SVC="redis-server"
if [ "$OS_FAMILY" = "rhel" ]; then
  REDIS_SVC="redis"
fi

if $SKIP_REDIS; then
  warn "Redis install skipped (--skip-redis)"
else
  if ! command -v redis-server >/dev/null 2>&1 && ! command -v redis-cli >/dev/null 2>&1; then
    if [ "$OS_FAMILY" = "debian" ]; then
      install_packages redis-server
    else
      install_packages redis
    fi
    sed -i 's/^# bind 127.0.0.1/bind 127.0.0.1/' /etc/redis/redis.conf 2>/dev/null || true
    sed -i 's/^# bind 127.0.0.1/bind 127.0.0.1/' /etc/redis.conf 2>/dev/null || true
    enable_service "$REDIS_SVC"
    log "Redis installed"
  else
    log "Redis already installed"
  fi

  # Start with graceful fallback (Redis failure is non-fatal)
  start_service "$REDIS_SVC"
  sleep 2
  if redis-cli ping 2>/dev/null | grep -q PONG; then
    log "Redis: PONG received — online"
  else
    warn "Redis not responding — system will continue without caching layer"
    warn "Fix: systemctl restart redis-server"
  fi
fi

# ─── 6. App user & directories ────────────────────────────────────────────────
step "6. APP USER & DIRECTORIES"
if ! id "$APP_USER" >/dev/null 2>&1; then
  useradd -m -s /bin/bash "$APP_USER"
  log "User '$APP_USER' created"
fi

for dir in \
  "$APP_DIR" \
  "$LOGS_DIR/backend" \
  "$LOGS_DIR/deploy" \
  "$LOGS_DIR/nginx" \
  "$APP_DIR/backups/postgres" \
  "$APP_DIR/backups/sessions" \
  "$RELEASES_DIR/timestamps" \
  "$RELEASES_DIR/current" \
  "$RELEASES_DIR/previous"; do
  mkdir -p "$dir"
done
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
log "Directories created"

# ─── 7. Clone repository ──────────────────────────────────────────────────────
step "7. REPOSITORY (auto-clone from GitHub)"
if [ -d "$APP_DIR/.git" ]; then
  log "Repository already at $APP_DIR — pulling latest"
  sudo -u "$APP_USER" git -C "$APP_DIR" fetch origin main --quiet 2>/dev/null || true
  sudo -u "$APP_USER" git -C "$APP_DIR" reset --hard origin/main 2>/dev/null || true
elif [ -d "/opt/ZAPAI-FINAL/.git" ]; then
  cp -r /opt/ZAPAI-FINAL/. "$APP_DIR/"
  chown -R "$APP_USER:$APP_USER" "$APP_DIR"
  warn "Copied from /opt/ZAPAI-FINAL"
else
  log "Cloning $REPO_URL → $APP_DIR"
  sudo -u "$APP_USER" git clone "$REPO_URL" "$APP_DIR" 2>&1 | tail -5
  log "Repository cloned"
fi


# ─── 8. Create .env.production ────────────────────────────────────────────────
step "8. ENVIRONMENT FILE (.env.production)"
ENV_FILE="$APP_DIR/.env.production"

# Fixed credentials — same on every install for zero-config login
# DB password is fixed (not random) so re-installs don't lose access
DB_PASS="zapai123"
ADMIN_USERNAME="zapadmin"
ADMIN_PASSWORD="zapadmin1010"
ADMIN_EMAIL="zapadmin@zapai.local"

if [ -f "$ENV_FILE" ]; then
  log ".env.production already exists — refreshing variables"
  # Read existing variables so we preserve them
  EXISTING_JWT=$(grep '^JWT_SECRET=' "$ENV_FILE" 2>/dev/null | cut -d= -f2 || echo "")
  EXISTING_SESSION=$(grep '^SESSION_SECRET=' "$ENV_FILE" 2>/dev/null | cut -d= -f2 || echo "")
  [ -n "$EXISTING_JWT" ] && JWT_SECRET="$EXISTING_JWT"
  [ -n "$EXISTING_SESSION" ] && SESSION_SECRET="$EXISTING_SESSION"
  
  # Remove old file to write a clean complete env with updated public URL/IP but keeping secrets
  rm -f "$ENV_FILE"
fi

# Ensure secrets are generated
[ -z "${JWT_SECRET:-}" ] && JWT_SECRET="$(openssl rand -hex 32)"
[ -z "${SESSION_SECRET:-}" ] && SESSION_SECRET="$(openssl rand -hex 32)"

cat > "$ENV_FILE" <<ENVEOF
# ZAPAI-FINAL Production Environment
# Auto-generated by deploy/install.sh on $(date)
# IP: ${PUBLIC_IP} | URL: ${PUBLIC_URL}
# Do NOT commit this file to git.

NODE_ENV=production
PORT=${BACKEND_PORT}
HOST=0.0.0.0

# Single source of truth for CORS and Socket.IO
APP_PUBLIC_URL=${PUBLIC_URL}

# PostgreSQL (Standard)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=zapai
POSTGRES_PASSWORD=${DB_PASS}
POSTGRES_DB=zapai_crm
DATABASE_URL=postgresql://zapai:${DB_PASS}@localhost:5432/zapai_crm

# PostgreSQL (Legacy/Alternative Aliases)
DB_HOST=localhost
DB_PORT=5432
DB_USER=zapai
DB_PASSWORD=${DB_PASS}
DB_NAME=zapai_crm

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=${JWT_SECRET}
AUTH_JWT_SECRET=${JWT_SECRET}
SESSION_SECRET=${SESSION_SECRET}
JWT_EXPIRES_IN=7d

# URLs
APP_URL=${PUBLIC_URL}
PUBLIC_URL=${PUBLIC_URL}
BACKEND_URL=http://${PUBLIC_IP}:4025
FRONTEND_URL=${PUBLIC_URL}
CORS_ALLOWED_ORIGINS=${PUBLIC_URL}
ALLOWED_ORIGINS=${PUBLIC_URL}
CORS_ORIGIN=${PUBLIC_URL}

# Admin Default Credentials
AUTH_DEFAULT_USERNAME=${ADMIN_USERNAME}
AUTH_DEFAULT_EMAIL=${ADMIN_EMAIL}
AUTH_DEFAULT_PASSWORD=${ADMIN_PASSWORD}
AUTH_DEFAULT_ROLE=master
AUTH_DEFAULT_TENANT_ID=default

# App Features
DEFAULT_COMPANY_ID=default
NODE_ROLE=master
MASTER=true
FEATURE_ADMIN_MASTER=true
FEATURE_NODE_MASTER_API=true
FEATURE_NODE_AUTO_REGISTER=false

# PM2
PM2_READY_SIGNAL=true
HEALTH_CHECK_INTERVAL_MS=60000

# Logging
LOG_LEVEL=info
CRASH_EXIT_ON_UNHANDLED=true

# Optional
AI_MEMORY_ENABLED=true
ENVEOF

chown "$APP_USER:$APP_USER" "$ENV_FILE"
chmod 600 "$ENV_FILE"
log ".env.production created/updated (IP: ${PUBLIC_IP}, admin: ${ADMIN_USERNAME})"

# Frontend .env.production
# VITE_API_URL=/ means 'use same origin as the page'
# Nginx proxies /api/* → localhost:4025 so this always resolves to the correct IP.
# No hardcoded localhost or IP needed in frontend build.
FRONTEND_ENV="$FRONTEND_DIR/.env.production"
if [ -d "$FRONTEND_DIR" ]; then
  echo "VITE_API_URL=/" > "$FRONTEND_ENV"
  chown "$APP_USER:$APP_USER" "$FRONTEND_ENV" 2>/dev/null || true
  log "frontend-official/.env.production: VITE_API_URL=/ (nginx proxies /api)"
fi

# ─── 9. Backend dependencies ──────────────────────────────────────────────────
step "9. BACKEND DEPENDENCIES"
if [ -d "$BACKEND_DIR" ]; then
  cd "$BACKEND_DIR"
  # Clean broken node_modules + npm cache before install to avoid peer dep conflicts
  if [ -d node_modules ] && [ ! -f node_modules/.install_ok ]; then
    warn "Removing possibly broken node_modules..."
    rm -rf node_modules
  fi
  sudo -u "$APP_USER" npm install \
    --production \
    --legacy-peer-deps \
    --prefer-offline \
    --no-audit \
    --no-fund \
    2>&1 | tail -5
  touch node_modules/.install_ok 2>/dev/null || true
  log "Backend deps installed"
else
  err "backend/ not found at $BACKEND_DIR — clone may have failed"
fi

# ─── 10. Database migrations ──────────────────────────────────────────────────
step "10. DATABASE MIGRATIONS"
if [ -f "$BACKEND_DIR/scripts/run-migrations.js" ]; then
  cd "$BACKEND_DIR"

  # Source .env.production so DATABASE_URL / POSTGRES_* vars are available
  if [ -f "$APP_DIR/.env.production" ]; then
    set -a
    # shellcheck disable=SC1091
    source "$APP_DIR/.env.production" 2>/dev/null || true
    set +a
  fi

  # 1. Wait-for-postgres routine
  log "Aguardando o PostgreSQL ficar disponível..."
  local pg_ready=false
  for attempt in $(seq 1 12); do
    if PGPASSWORD="${POSTGRES_PASSWORD:-}" psql \
        -h "${POSTGRES_HOST:-localhost}" \
        -U "${POSTGRES_USER:-zapai}" \
        -d "${POSTGRES_DB:-zapai_crm}" \
        -c 'SELECT 1' >/dev/null 2>&1; then
      pg_ready=true
      log "✔ PostgreSQL respondendo a conexões locais!"
      break
    fi
    warn "PostgreSQL ainda não disponível (tentativa $attempt/12)... aguardando 5s"
    sleep 5
  done

  if [ "$pg_ready" != "true" ]; then
    err "PostgreSQL indisponível para conexões TCP locais. Por favor, verifique o status do banco de dados (systemctl status postgresql) ou as regras de autenticação no pg_hba.conf."
    exit 1
  fi

  # 2. Test real connection using DATABASE_URL
  log "Testando conexão real utilizando a URL de conexão..."
  if ! PGPASSWORD="${POSTGRES_PASSWORD:-}" psql "$DATABASE_URL" -c 'SELECT 1' >/dev/null 2>&1; then
    err "Falha ao conectar usando a DATABASE_URL: $DATABASE_URL. Verifique as credenciais no arquivo .env.production."
    exit 1
  fi
  log "✔ Conexão real com DATABASE_URL validada com sucesso! (SELECT 1 ok)"

  # 3. Run migrations and print detailed errors on failure
  log "Executando migrations no banco de dados..."
  if ! sudo -u "$APP_USER" bash -c \
      "set -a; source '$APP_DIR/.env.production' 2>/dev/null; set +a; NODE_ENV=production node scripts/run-migrations.js"; then
    err "Migrations FALHARAM! O comando de migração falhou. Verifique os erros acima e o stack de execução."
    exit 1
  fi
  log "✔ Migrations executadas com sucesso!"
else
  warn "run-migrations.js não encontrado — pulando etapa de migrations"
fi

# ─── 10.5. SEED ADMIN MASTER ──────────────────────────────────────────────────
step "10.5. ADMIN MASTER SEED (zapadmin / zapadmin1010)"
cd "$BACKEND_DIR"

# Source env so seed-admin.js can connect
set -a
# shellcheck disable=SC1091
source "$APP_DIR/.env.production" 2>/dev/null || true
set +a

if [ -f "$BACKEND_DIR/scripts/seed-admin.js" ]; then
  if ! sudo -u "$APP_USER" bash -c \
      "set -a; source '$APP_DIR/.env.production' 2>/dev/null; set +a; \
       AUTH_DEFAULT_USERNAME=zapadmin \
       AUTH_DEFAULT_PASSWORD=zapadmin1010 \
       AUTH_DEFAULT_EMAIL=zapadmin@zapai.local \
       AUTH_DEFAULT_ROLE=master \
       AUTH_DEFAULT_TENANT_ID=default \
       NODE_ENV=production \
       node scripts/seed-admin.js" \
      2>&1 | tail -8; then
    warn "Admin seed failed — login may require manual setup"
  else
    log "Admin user ready: zapadmin / zapadmin1010 ✔"
  fi
else
  warn "seed-admin.js not found — admin user not auto-created"
fi

# ─── 11. Frontend build ───────────────────────────────────────────────────────
step "11. FRONTEND BUILD"
if [ -d "$FRONTEND_DIR" ]; then
  cd "$FRONTEND_DIR"

  # Remove stale dist to avoid serving old chunks after a failed build
  rm -rf dist 2>/dev/null || true

  # --legacy-peer-deps handles react/vite peer-dependency conflicts on Ubuntu
  sudo -u "$APP_USER" npm install \
    --legacy-peer-deps \
    --prefer-offline \
    --no-audit \
    --no-fund \
    2>&1 | tail -5

  # Build is fatal — a broken frontend serves the white screen of death
  if ! sudo -u "$APP_USER" bash -c \
      "NODE_ENV=production VITE_API_URL=/ npx vite build --outDir dist" \
      2>&1 | tail -10; then
    err "Frontend build FAILED — aborting install. Fix build errors and retry."
    exit 1
  fi

  if [ -f "$FRONTEND_DIR/dist/index.html" ]; then
    CHUNKS=$(find "$FRONTEND_DIR/dist/assets" -name '*.js' 2>/dev/null | wc -l)
    log "Frontend built: $CHUNKS JS chunks ✔"
  else
    err "dist/index.html missing after build — unexpected failure"
    exit 1
  fi
else
  err "frontend-official/ not found — clone may have failed"
  exit 1
fi


# ─── 12. Nginx ────────────────────────────────────────────────────────────────
step "12. NGINX"
enable_service nginx
start_service nginx

# Ensure Debian-style site directories exist (compatibility layer for RHEL)
if [ ! -d /etc/nginx/sites-available ]; then
  mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
  if [ -f /etc/nginx/nginx.conf ] && ! grep -q "sites-enabled" /etc/nginx/nginx.conf; then
    # Inject sites-enabled config inside the http block of nginx.conf
    sed -i 's|include /etc/nginx/conf.d/\*\.conf;|include /etc/nginx/conf.d/*.conf;\n    include /etc/nginx/sites-enabled/*;|' /etc/nginx/nginx.conf
    log "Configurada diretiva sites-enabled no nginx.conf"
  fi
fi

if [ -n "$DOMAIN" ] && [ -f "$DEPLOY_DIR/nginx.conf" ]; then
  cp "$DEPLOY_DIR/nginx.conf" /etc/nginx/sites-available/zapai
  sed -i "s/YOUR_DOMAIN/$DOMAIN/g" /etc/nginx/sites-available/zapai
  # Also update the frontend path in case the template has a wrong path
  sed -i "s|/opt/ZAPAI-FINAL/frontend/dist|${FRONTEND_DIR}/dist|g" /etc/nginx/sites-available/zapai
  log "Nginx configured for $DOMAIN (HTTPS-ready)"
else
  # Build inline nginx config (HTTP-only, no domain)
  # NGINX_EOF is unquoted so FRONTEND_DIR and BACKEND_PORT are expanded.
  # Nginx special chars ($, \) are escaped with backslash.
  cat > /etc/nginx/sites-available/zapai <<NGINX_EOF
limit_req_zone \$binary_remote_addr zone=auth_limit:10m rate=5r/s;
limit_req_zone \$binary_remote_addr zone=api_limit:10m  rate=30r/s;

server {
    listen 80 default_server;
    server_name _;

    client_max_body_size 50m;
    gzip on;
    gzip_types text/plain application/json application/javascript text/css;

    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Frontend — built from frontend-official/
    root ${FRONTEND_DIR}/dist;
    index index.html;

    # SPA fallback: all routes → index.html (refresh support)
    location / {
        try_files \$uri \$uri/ /index.html;
        expires -1;
    }

    # Static assets — long cache (content-hashed filenames)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot)\$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Backend API — /api/* passes through to backend with /api/ prefix preserved
    location /api/ {
        limit_req zone=api_limit burst=50 nodelay;
        proxy_pass http://127.0.0.1:${BACKEND_PORT}/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 30s;
        proxy_connect_timeout 10s;
        client_max_body_size 25M;
    }

    # Auth endpoints — tighter rate limit (brute-force protection)
    location ~ ^/auth/ {
        limit_req zone=auth_limit burst=10 nodelay;
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 30s;
    }

    # Health + readiness endpoints (public, no rate limit)
    location ~ ^/(health|ready|api/health|api/ready)\$ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_read_timeout 10s;
    }

    # Socket.IO (WebSocket upgrade — must have long timeout)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT}/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_buffering off;
    }
}
NGINX_EOF
  log "Nginx configured (HTTP-only, port 80)"
  warn "To add HTTPS: certbot --nginx -d your-domain.com"
fi

ln -sf /etc/nginx/sites-available/zapai /etc/nginx/sites-enabled/zapai 2>/dev/null || true
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
nginx -t && restart_service nginx
log "Nginx: valid config, reloaded/restarted"

ln -sf /var/log/nginx/access.log "$LOGS_DIR/nginx/access.log" 2>/dev/null || true
ln -sf /var/log/nginx/error.log  "$LOGS_DIR/nginx/error.log"  2>/dev/null || true

# ─── 13. Firewall ─────────────────────────────────────────────────────────────
step "13. FIREWALL"
if command -v ufw >/dev/null 2>&1; then
  if $PANEL_SAFE_MODE; then
    warn "PANEL SAFE MODE: skipping UFW reset ($DETECTED_PANEL manages firewall)"
    if ufw status 2>/dev/null | grep -q 'Status: active'; then
      ufw deny "${BACKEND_PORT}/tcp" comment "Block direct ZAPAI backend" 2>/dev/null || true
      log "UFW: blocked direct access to port $BACKEND_PORT"
    fi
  else
    ufw --force reset 2>/dev/null || true
    ufw allow 22/tcp   comment "SSH"
    ufw allow 80/tcp   comment "HTTP"
    ufw allow 443/tcp  comment "HTTPS"
    ufw deny  "${BACKEND_PORT}/tcp" comment "Block direct backend"
    ufw --force enable 2>/dev/null || true
    log "UFW: 22/80/443 open | ${BACKEND_PORT} blocked"
  fi
elif command -v firewall-cmd >/dev/null 2>&1; then
  if $PANEL_SAFE_MODE; then
    warn "PANEL SAFE MODE: skipping firewalld configuration ($DETECTED_PANEL manages firewall)"
  else
    enable_service firewalld
    start_service firewalld
    firewall-cmd --permanent --add-port=22/tcp 2>/dev/null || true
    firewall-cmd --permanent --add-port=80/tcp 2>/dev/null || true
    firewall-cmd --permanent --add-port=443/tcp 2>/dev/null || true
    firewall-cmd --permanent --remove-port=${BACKEND_PORT}/tcp 2>/dev/null || true
    firewall-cmd --reload 2>/dev/null || true
    log "Firewalld: 22/80/443 open | ${BACKEND_PORT} blocked/removed"
  fi
else
  warn "Nenhum firewall suportado (UFW/Firewalld) encontrado. Pulando regras de rede."
fi

systemctl enable fail2ban 2>/dev/null || true
systemctl start fail2ban 2>/dev/null || true

# ─── 14. Logrotate ────────────────────────────────────────────────────────────
step "14. LOGROTATE"
cat > /etc/logrotate.d/zapai << LOGEOF
$LOGS_DIR/backend/*.log {
  daily
  missingok
  rotate 14
  compress
  delaycompress
  notifempty
  create 0640 $APP_USER $APP_USER
  sharedscripts
  postrotate
    pm2 reloadLogs 2>/dev/null || true
  endscript
}
$LOGS_DIR/deploy/*.log {
  weekly
  missingok
  rotate 8
  compress
  notifempty
}
LOGEOF
log "logrotate: /etc/logrotate.d/zapai"

# ─── 15. Cron jobs ────────────────────────────────────────────────────────────
step "15. CRON JOBS"
cat > /etc/cron.d/zapai << CRONEOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin:/usr/local/bin

# Auto-deploy watcher: every 2 minutes
*/2 * * * * $APP_USER bash $DEPLOY_DIR/watcher.sh >> $LOGS_DIR/deploy/watcher.log 2>&1

# Auto-recovery: every 5 minutes
*/5 * * * * $APP_USER bash $BACKEND_DIR/scripts/recovery.sh --dry-run >> $LOGS_DIR/backend/recovery.log 2>&1

# Daily healthcheck at 07:00
0 7 * * * $APP_USER node $BACKEND_DIR/scripts/healthcheck.js --json >> $LOGS_DIR/backend/healthcheck_daily.log 2>&1

# Session backup: daily at 03:00
0 3 * * * $APP_USER bash $BACKEND_DIR/scripts/backup-sessions.sh 2>/dev/null || true
CRONEOF
chmod 644 /etc/cron.d/zapai
log "Cron: watcher every 2min, recovery every 5min"

# ─── 16. PM2 startup ──────────────────────────────────────────────────────────
step "16. PM2 STARTUP (persist across reboots)"
env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" 2>/dev/null | \
  grep "sudo" | bash 2>/dev/null || true
log "PM2 startup configured"

# ─── 17. Watcher systemd timer ────────────────────────────────────────────────
step "17. WATCHER SYSTEMD TIMER"
cat > /etc/systemd/system/zapai-watcher.service << SVCEOF
[Unit]
Description=ZAPAI Git Watcher — Auto Deploy on Push
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=$APP_USER
WorkingDirectory=$APP_DIR
ExecStart=/bin/bash $DEPLOY_DIR/watcher.sh
StandardOutput=append:$LOGS_DIR/deploy/watcher.log
StandardError=append:$LOGS_DIR/deploy/watcher.log
SVCEOF

cat > /etc/systemd/system/zapai-watcher.timer << TIMEREOF
[Unit]
Description=ZAPAI Watcher — run every 2 minutes

[Timer]
OnBootSec=30s
OnUnitActiveSec=2min
AccuracySec=10s

[Install]
WantedBy=timers.target
TIMEREOF

systemctl daemon-reload
systemctl enable zapai-watcher.timer
systemctl start zapai-watcher.timer
log "zapai-watcher.timer: active (every 2min)"

# ─── 18. Start PM2 ────────────────────────────────────────────────────────────
step "18. START PM2 (backend)"
if [ -f "$BACKEND_DIR/ecosystem.config.js" ]; then
  cd "$BACKEND_DIR"
  sudo -u "$APP_USER" bash -c "
    export NODE_ENV=production
    pm2 delete zapflow-api 2>/dev/null || true
    pm2 start ecosystem.config.js --env production
    pm2 save --force
  " 2>&1 | tail -8
  log "PM2: zapflow-api started"
else
  warn "ecosystem.config.js not found — PM2 not started"
fi

# ─── 19. SSL (if domain provided) ────────────────────────────────────────────
if [ -n "$DOMAIN" ]; then
  step "19. SSL (Let's Encrypt via certbot)"
  if command -v certbot >/dev/null 2>&1; then
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos \
      --email "admin@${DOMAIN}" --redirect 2>&1 | tail -5 || \
      warn "certbot failed — run: certbot --nginx -d $DOMAIN"
    log "SSL configured for $DOMAIN"
  else
    warn "certbot not available — run manually"
  fi
fi

# ─── 20. Rollback snapshot ────────────────────────────────────────────────────
step "20. ROLLBACK SNAPSHOT"
SNAP_TS="$(date +%Y%m%d_%H%M%S)"
SNAP_COMMIT="$(git -C "$APP_DIR" rev-parse HEAD 2>/dev/null || echo 'unknown')"
echo "$SNAP_COMMIT" > "$RELEASES_DIR/current/commit"
echo "$SNAP_TS"     > "$RELEASES_DIR/current/timestamp"
chown -R "$APP_USER:$APP_USER" "$RELEASES_DIR"
log "Rollback snapshot: $SNAP_COMMIT @ $SNAP_TS"

# ─── 21. Health and System Validation Tests ───────────────────────────────────
step "21. SYSTEM VALIDATION TESTS"
log "Executando testes finais de saúde e integridade do sistema..."
sleep 5

VALIDATION_FAILED=false

# 1. PostgreSQL status
if ! systemctl is-active --quiet postgresql; then
  warn "PostgreSQL não está ativo!"
  VALIDATION_FAILED=true
else
  log "✔ PostgreSQL ativo e respondendo"
fi

# 2. Redis status
if ! systemctl is-active --quiet "$REDIS_SVC"; then
  warn "Redis ($REDIS_SVC) não está ativo!"
  VALIDATION_FAILED=true
else
  log "✔ Redis ativo e respondendo"
fi

# 3. Nginx status
if ! systemctl is-active --quiet nginx; then
  warn "Nginx não está ativo!"
  VALIDATION_FAILED=true
else
  log "✔ Nginx ativo e respondendo"
fi

# 4. PM2 status and app running
if ! pm2 show zapflow-api >/dev/null 2>&1; then
  warn "PM2 zapflow-api não está ativo/rodando!"
  VALIDATION_FAILED=true
else
  log "✔ PM2 zapflow-api ativo e em execução"
fi

# 5. DB query test using DATABASE_URL from .env.production
if [ -f "$APP_DIR/.env.production" ]; then
  # Source vars
  set -a
  source "$APP_DIR/.env.production" 2>/dev/null || true
  set +a
  
  if ! PGPASSWORD="$POSTGRES_PASSWORD" psql "$DATABASE_URL" -c 'SELECT 1' >/dev/null 2>&1; then
    warn "Teste de query psql usando DATABASE_URL falhou!"
    VALIDATION_FAILED=true
  else
    log "✔ Consulta ao banco de dados validada (SELECT 1 ok)"
  fi
fi

# 6. Backend API health endpoint check
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://127.0.0.1:4025/health" 2>/dev/null || echo "000")
if [ "$HTTP" != "200" ]; then
  warn "Checagem do endpoint de saúde do backend falhou (HTTP $HTTP)!"
  VALIDATION_FAILED=true
else
  log "✔ Endpoint de saúde (/health) retornou HTTP 200 OK"
fi

if $VALIDATION_FAILED; then
  err "FALHA NOS TESTES DE INTEGRIDADE! Um ou mais serviços críticos não estão ativos."
  exit 1
else
  log "✔ Todos os testes de integridade passaram com sucesso!"
  HEALTH_OK=true
fi

# ─── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "============================================================"
echo -e "${GREEN}  ✅ ZAPAI BOOTSTRAP COMPLETE — $(date)${NC}"
echo "  System is ONLINE. No manual steps needed."
echo ""
echo -e "${CYAN}  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ► OPEN URL:  ${PUBLIC_URL}${NC}"
echo -e "${CYAN}  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}  ADMIN LOGIN${NC}"
echo "  Username:  zapadmin"
echo "  Password:  zapadmin1010"
echo ""
echo "  Backend:   http://${PUBLIC_IP}:4025/api/health"
echo "  PM2:       pm2 status && pm2 logs zapflow-api"
echo "  Deploy:    bash deploy/auto-deploy.sh"
echo "  Watcher:   systemctl status zapai-watcher.timer"
echo ""
echo "  ► /connections → scan WhatsApp QR"
echo "  ► Auto-deploy ACTIVE: git push origin main → VPS updates"
echo "============================================================"
