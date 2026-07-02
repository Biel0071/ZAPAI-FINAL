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

# ─── Global Configuration Variables ──────────────────────────────────────────
DOMAIN=""
SKIP_POSTGRES=false
SKIP_REDIS=false
APP_USER=""
APP_DIR=""
NODE_VERSION="20"
REPO_URL=""
BACKEND_DIR=""
FRONTEND_DIR=""
LOGS_DIR=""
DEPLOY_DIR=""
RELEASES_DIR=""
OS_FAMILY="debian"
OS_NAME="Debian/Ubuntu"
PUBLIC_IP=""
PUBLIC_URL=""
PANEL_SAFE_MODE=false
DETECTED_PANEL=""
PREFERRED_PORT="4025"
BACKEND_PORT="4025"
DB_PASS="zapai123"
ADMIN_USERNAME="zapadmin"
ADMIN_PASSWORD="zapadmin1010"
ADMIN_EMAIL="zapadmin@zapai.local"
REDIS_SVC="redis-server"
JWT_SECRET=""
SESSION_SECRET=""

# Colors for log formatting
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
  exit "$exit_code"
}
trap 'error_handler ${LINENO} "$BASH_COMMAND"' ERR

# ─── Root Check ────────────────────────────────────────────────────────────────
check_root() {
  [[ $EUID -eq 0 ]] || err "Run as root: sudo bash deploy/install.sh"
}

# ─── Parse arguments ───────────────────────────────────────────────────────────
parse_args() {
  local SCRIPT_SELF_DIR
  SCRIPT_SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd)"
  local REPO_ROOT
  REPO_ROOT="$(cd "$SCRIPT_SELF_DIR/.." 2>/dev/null && pwd)"

  APP_USER="$(logname 2>/dev/null || echo 'zapai')"
  APP_DIR="$REPO_ROOT"
  REPO_URL="https://github.com/Biel0071/ZAPAI-FINAL.git"

  local arg
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
}

# ─── OS Detection & EPEL Setup ────────────────────────────────────────────────
detect_os() {
  if [ -f /etc/os-release ]; then
    local ID=""
    local NAME=""
    local VERSION_ID=""
    local ID_LIKE=""
    eval "$(grep -E '^(ID|NAME|VERSION_ID|ID_LIKE)=' /etc/os-release)"
    OS_NAME="$NAME $VERSION_ID"
    if [[ "$ID" == "almalinux" || "$ID" == "rocky" || "$ID" == "rhel" || "$ID" == "centos" || "$ID_LIKE" =~ "rhel" || "$ID_LIKE" =~ "fedora" ]]; then
      OS_FAMILY="rhel"
    fi
  fi
  log "Detectado: $OS_NAME ($OS_FAMILY)"

  if [ "$OS_FAMILY" = "rhel" ]; then
    if ! dnf repolist | grep -q "epel"; then
      log "Instalando repositório EPEL para suporte a pacotes de produção..."
      dnf install -y epel-release -q || true
    fi
  fi
}

# ─── PANEL DETECTION (SAFE MODE) ─────────────────────────────────────────────
detect_panel() {
  if [ -d "/usr/local/hestia" ] || command -v hestia >/dev/null 2>&1; then
    DETECTED_PANEL="HestiaCP"; PANEL_SAFE_MODE=true; return
  fi
  if [ -d "/usr/local/CyberCP" ] || command -v cyberpanel >/dev/null 2>&1; then
    DETECTED_PANEL="CyberPanel"; PANEL_SAFE_MODE=true; return
  fi
  if [ -d "/www/server/panel" ] || command -v bt >/dev/null 2>&1; then
    DETECTED_PANEL="aaPanel/BT"; PANEL_SAFE_MODE=true; return
  fi
  if [ -d "/opt/psa" ] || command -v plesk >/dev/null 2>&1; then
    DETECTED_PANEL="Plesk"; PANEL_SAFE_MODE=true; return
  fi
  if [ -d "/etc/webmin" ] || command -v webmin >/dev/null 2>&1; then
    DETECTED_PANEL="Webmin"; PANEL_SAFE_MODE=true; return
  fi
  if [ -d "/usr/local/directadmin" ]; then
    DETECTED_PANEL="DirectAdmin"; PANEL_SAFE_MODE=true; return
  fi
  if [ -d "/usr/local/ispconfig" ]; then
    DETECTED_PANEL="ISPConfig"; PANEL_SAFE_MODE=true; return
  fi
}

# ─── AUTO DETECT PUBLIC IP ────────────────────────────────────────────────────
detect_ip() {
  if [ -n "$DOMAIN" ]; then
    PUBLIC_IP="$DOMAIN"
    PUBLIC_URL="https://$DOMAIN"
  else
    PUBLIC_IP=$(
      curl -s --max-time 5 https://api.ipify.org 2>/dev/null ||
      curl -s --max-time 5 http://checkip.amazonaws.com 2>/dev/null ||
      curl -s --max-time 5 http://ifconfig.me 2>/dev/null ||
      hostname -I 2>/dev/null | awk '{print $1}'
    )
    PUBLIC_IP="${PUBLIC_IP// /}"
    PUBLIC_URL="http://${PUBLIC_IP}"
  fi

  if [ -z "$PUBLIC_IP" ]; then
    warn "Could not detect public IP — using 127.0.0.1 (configure FRONTEND_URL manually)"
    PUBLIC_IP="127.0.0.1"
    PUBLIC_URL="http://127.0.0.1"
  fi
}

# ─── AUTO PORT DETECTION ──────────────────────────────────────────────────────
find_free_port() {
  local start=$1
  local port=$start
  while [ "$port" -lt $((start + 100)) ]; do
    if ! ss -tlnp 2>/dev/null | grep -q ":${port} " && \
       ! lsof -i ":${port}" >/dev/null 2>&1; then
      BACKEND_PORT="$port"
      return 0
    fi
    port=$((port + 1))
  done
  BACKEND_PORT="$start"
}

# ─── 0. CLEANUP OLD INSTALLATIONS ────────────────────────────────────────────
cleanup_old_installations() {
  step "0. CLEANUP OLD INSTALLATIONS"
  local dead_path
  local DEAD_PATHS=(
    "/opt/zapai-frontend"
    "/var/www/zapai"
    "/var/www/html/zapai"
    "/opt/zapai-old"
  )
  for dead_path in "${DEAD_PATHS[@]}"; do
    if [ -d "$dead_path" ] && \
       [ "$dead_path" != "$APP_DIR" ] && \
       [ "$dead_path" != "$DEPLOY_DIR" ] && \
       [ "$dead_path" != "$BACKEND_DIR" ] && \
       [ "$dead_path" != "$FRONTEND_DIR" ]; then
      warn "Dead installation: $dead_path — archiving"
      mkdir -p /opt/zapai-archive
      mv "$dead_path" "/opt/zapai-archive/$(basename "$dead_path")_$(date +%Y%m%d_%H%M%S)" 2>/dev/null || true
      log "Archived: $dead_path"
    fi
  done

  if command -v pm2 >/dev/null 2>&1; then
    local running_apps
    running_apps=$(pm2 jlist 2>/dev/null | python3 -c \
      "import sys,json; procs=json.load(sys.stdin); print(len(procs))" 2>/dev/null || echo '0')
    if [ "$running_apps" -gt 0 ]; then
      warn "PM2: $running_apps app(s) running — checking for orphans"
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
}

# ─── 0.5. VPS ENVIRONMENT AUDIT ───────────────────────────────────────────────
vps_environment_audit() {
  step "0.5. VPS ENVIRONMENT AUDIT"
  echo ""
  echo "  ── System ──────────────────────────────────────────"
  local os_name
  os_name=$(. /etc/os-release 2>/dev/null && echo "$NAME $VERSION_ID" || uname -s)
  local kernel
  kernel=$(uname -r)
  local arch
  arch=$(uname -m)
  echo "  OS:       $os_name ($arch)"
  echo "  Kernel:   $kernel"

  local cpu_cores
  cpu_cores=$(nproc 2>/dev/null || grep -c processor /proc/cpuinfo 2>/dev/null || echo '?')
  local cpu_model
  cpu_model=$(grep 'model name' /proc/cpuinfo 2>/dev/null | head -1 | cut -d: -f2 | xargs || echo 'unknown')
  echo "  CPU:      $cpu_cores core(s) — $cpu_model"

  local ram_total
  ram_total=$(free -m 2>/dev/null | awk '/^Mem/{print $2}' || echo '?')
  local ram_free
  ram_free=$(free -m 2>/dev/null | awk '/^Mem/{print $4}' || echo '?')
  echo "  RAM:      ${ram_total}MB total / ${ram_free}MB free"

  local disk_total
  disk_total=$(df -h "$APP_DIR" 2>/dev/null | awk 'NR==2{print $2}' || echo '?')
  local disk_free
  disk_free=$(df -h "$APP_DIR" 2>/dev/null | awk 'NR==2{print $4}' || echo '?')
  local disk_pct
  disk_pct=$(df -h "$APP_DIR" 2>/dev/null | awk 'NR==2{print $5}' || echo '?')
  echo "  Disk:     ${disk_total} total / ${disk_free} free (${disk_pct} used)"

  local disk_used_int
  disk_used_int=$(df "$APP_DIR" 2>/dev/null | awk 'NR==2{gsub(/%/,"",$5); print $5}' || echo '0')
  if [ "${disk_used_int:-0}" -gt 90 ] 2>/dev/null; then
    warn "Disk usage >90% — install may fail. Free up space first."
  fi

  echo ""
  echo "  ── Network ──────────────────────────────────────────"
  if curl -s --max-time 3 https://github.com -o /dev/null; then
    log "Internet: reachable ✔"
  else
    warn "Internet: unreachable — apt-get and git clone may fail"
  fi
  echo "  Public IP: $PUBLIC_IP"

  echo "  Listening ports (40xx range):"
  ss -tlnp 2>/dev/null | grep -E ':40[0-9]{2}' | awk '{print "    "$1,$4,$NF}' || echo "    none"

  echo ""
  echo "  ── Tools already installed ──────────────────────────"
  local tool
  local AUDIT_TOOLS=(git curl wget nginx psql redis-cli node npm pm2 python3 openssl unzip build-essential)
  for tool in "${AUDIT_TOOLS[@]}"; do
    if command -v "$tool" >/dev/null 2>&1; then
      local ver
      ver=$(${tool} --version 2>/dev/null | head -1 | sed 's/^[^0-9]*//' | cut -c1-20 || echo 'ok')
      printf "  ✔ %-16s %s\n" "$tool" "$ver"
    else
      printf "  ✖ %-16s (missing — will install)\n" "$tool"
    fi
  done

  echo ""
  echo "  ── Current project directory ────────────────────────"
  if [ -d "$APP_DIR/.git" ]; then
    local current_branch
    current_branch=$(git -C "$APP_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')
    local current_commit
    current_commit=$(git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null || echo 'unknown')
    echo "  Repo:     $APP_DIR"
    echo "  Branch:   $current_branch @ $current_commit"
  else
    echo "  Repo:     $APP_DIR (not yet cloned)"
  fi
  echo ""
}

# ─── NGINX CONFIG GENERATOR ──────────────────────────────────────────────────
write_nginx_config() {
  local domain="$1"
  local enable_ssl="$2"
  local dest="/etc/nginx/sites-available/zapai"

  log "Gerando configuração do Nginx (domain: ${domain:-none}, SSL: ${enable_ssl})..."

  # Header & Limits
  cat > "$dest" << NGINX_EOF
limit_req_zone \$binary_remote_addr zone=auth_limit:10m rate=5r/s;
limit_req_zone \$binary_remote_addr zone=api_limit:10m  rate=30r/s;
NGINX_EOF

  # Port 80 Block
  cat >> "$dest" << NGINX_EOF

server {
    listen 80 default_server;
    server_name ${domain:-_} _;

    client_max_body_size 50m;
    gzip on;
    gzip_types text/plain application/json application/javascript text/css;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
NGINX_EOF

  if [ "$enable_ssl" = "true" ] && [ -n "$domain" ]; then
    cat >> "$dest" << NGINX_EOF

    # Smart HTTPS redirect (prevents loops under reverse proxies/Cloudflare Flexible SSL and IP access)
    set \$redirect_to_https 0;
    if (\$scheme != "https") {
        set \$redirect_to_https 1;
    }
    if (\$http_x_forwarded_proto = "https") {
        set \$redirect_to_https 0;
    }
    if (\$host ~* ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+\$) {
        set \$redirect_to_https 0;
    }
    if (\$request_uri ~* ^/\\.well-known/acme-challenge/) {
        set \$redirect_to_https 0;
    }

    if (\$redirect_to_https = 1) {
        return 301 https://\$host\$request_uri;
    }
NGINX_EOF
  fi

  cat >> "$dest" << NGINX_EOF

    # Frontend
    root ${FRONTEND_DIR}/dist;
    index index.html;

    location / {
        location = /index.html {
            add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";
            add_header Pragma "no-cache";
            add_header Expires "0";
        }
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        limit_req zone=api_limit burst=60 nodelay;
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

    location ~ ^/(health|ready|api/health|api/ready)\$ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_read_timeout 10s;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT}/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_buffering off;
    }

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
}
NGINX_EOF

  # SSL Port 443 Block (only if SSL is active)
  if [ "$enable_ssl" = "true" ] && [ -n "$domain" ]; then
    cat >> "$dest" << NGINX_EOF

server {
    listen 443 ssl http2 default_server;
    server_name ${domain} _;

    ssl_certificate     /etc/letsencrypt/live/${domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${domain}/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    client_max_body_size 50m;
    gzip on;
    gzip_types text/plain application/json application/javascript text/css;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Frontend
    root ${FRONTEND_DIR}/dist;
    index index.html;

    location / {
        location = /index.html {
            add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";
            add_header Pragma "no-cache";
            add_header Expires "0";
        }
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        limit_req zone=api_limit burst=60 nodelay;
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

    location ~ ^/(health|ready|api/health|api/ready)\$ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_read_timeout 10s;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT}/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_buffering off;
    }
}
NGINX_EOF
  fi

  ln -sf /etc/nginx/sites-available/zapai /etc/nginx/sites-enabled/zapai 2>/dev/null || true
  rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
}

# ─── 1. SYSTEM PACKAGES ───────────────────────────────────────────────────────
install_packages() {
  step "1. SYSTEM PACKAGES"
  if [ "$OS_FAMILY" = "debian" ]; then
    apt-get update -qq
    apt-get install -y -qq \
      curl wget git build-essential \
      nginx certbot python3-certbot-nginx \
      ufw fail2ban \
      htop iotop \
      logrotate cron \
      ca-certificates gnupg lsb-release 2>&1 | tail -3
  else
    dnf check-update -q || true
    dnf install -y -q \
      curl wget git gcc gcc-c++ make \
      nginx certbot python3-certbot-nginx \
      fail2ban \
      htop iotop \
      logrotate cronie 2>&1 | tail -3
  fi
  log "Base packages installed"
}

# ─── 2. NODE.JS v20 ───────────────────────────────────────────────────────────
install_node() {
  step "2. NODE.JS v${NODE_VERSION}"
  if command -v node >/dev/null 2>&1 && node --version | grep -q "^v${NODE_VERSION}"; then
    log "Node.js $(node --version) already installed"
  else
    log "Instalando Node.js v${NODE_VERSION}..."
    if [ "$OS_FAMILY" = "debian" ]; then
      curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash - 2>&1 | tail -3
      apt-get install -y -qq nodejs 2>&1 | tail -3
    else
      dnf module reset nodejs -y -q || true
      dnf module enable nodejs:20 -y -q || true
      dnf install -y nodejs -q
    fi
    corepack enable 2>/dev/null || true
    log "Node.js $(node --version) instalado"
  fi
}

# ─── 4. POSTGRESQL ────────────────────────────────────────────────────────────
install_postgres() {
  step "4. POSTGRESQL"
  if $SKIP_POSTGRES; then
    warn "PostgreSQL install skipped (--skip-postgres)"
    return 0
  fi

  if ! command -v psql >/dev/null 2>&1; then
    if [ "$OS_FAMILY" = "debian" ]; then
      apt-get install -y -qq postgresql postgresql-contrib 2>&1 | tail -3
    else
      dnf install -y -q postgresql-server postgresql-contrib 2>&1 | tail -3
    fi
    log "PostgreSQL installed"
  else
    log "PostgreSQL $(psql --version | head -1) already installed"
  fi
}

# ─── 4.1. POSTGRESQL CONFIGURATION ────────────────────────────────────────────
configure_postgres() {
  step "4.1. POSTGRESQL CONFIGURATION"
  if $SKIP_POSTGRES; then
    return 0
  fi

  if [ "$OS_FAMILY" = "rhel" ]; then
    if [ ! -f /var/lib/pgsql/data/PG_VERSION ]; then
      postgresql-setup --initdb || true
    fi
  fi
  enable_service postgresql
  start_service postgresql
  sleep 3

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
    sed -i '/# ZAPAI-FINAL/d' "$hba_file" 2>/dev/null || true
    
    local temp_hba
    temp_hba=$(mktemp)
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
  sleep 3

  if [ -f "$APP_DIR/.env.production" ]; then
    local existing_pass
    existing_pass=$(grep '^POSTGRES_PASSWORD=' "$APP_DIR/.env.production" 2>/dev/null | cut -d= -f2 || echo "")
    [ -n "$existing_pass" ] && DB_PASS="$existing_pass"
  fi

  if sudo -u postgres psql -t -A -c "SELECT 1 FROM pg_roles WHERE rolname='zapai';" 2>/dev/null | grep -q "1"; then
    log "✔ Usuário 'zapai' já existe. Atualizando senha..."
    sudo -u postgres psql -c "ALTER USER zapai WITH PASSWORD '$DB_PASS';" >/dev/null 2>&1 || true
  else
    log "Criando usuário 'zapai'..."
    sudo -u postgres psql -c "CREATE USER zapai WITH PASSWORD '$DB_PASS';" >/dev/null 2>&1 || true
    log "✔ Usuário 'zapai' criado"
  fi

  if sudo -u postgres psql -t -A -c "SELECT 1 FROM pg_database WHERE datname='zapai_crm';" 2>/dev/null | grep -q "1"; then
    log "✔ Banco de dados 'zapai_crm' já existe."
  else
    log "Criando banco de dados 'zapai_crm'..."
    sudo -u postgres psql -c "CREATE DATABASE zapai_crm OWNER zapai;" >/dev/null 2>&1 || true
    log "✔ Banco de dados 'zapai_crm' criado"
  fi

  sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE zapai_crm TO zapai;" 2>/dev/null || true
}

# ─── 4.2. WAIT FOR POSTGRES ───────────────────────────────────────────────────
wait_postgres() {
  step "4.2. WAIT FOR POSTGRES"
  if $SKIP_POSTGRES; then
    return 0
  fi

  local pg_ready=false
  local attempt
  for attempt in $(seq 1 12); do
    if PGPASSWORD="$DB_PASS" psql -h localhost -U zapai -d zapai_crm -c 'SELECT 1' >/dev/null 2>&1; then
      pg_ready=true
      log "✔ PostgreSQL respondendo a conexões locais!"
      break
    fi
    warn "PostgreSQL ainda não disponível (tentativa $attempt/12)... aguardando 5s"
    sleep 5
  done

  if [ "$pg_ready" != "true" ]; then
    err "PostgreSQL indisponível para conexões TCP locais. Verifique o status do banco (systemctl status postgresql) ou pg_hba.conf."
  fi
}

# ─── 5. REDIS ─────────────────────────────────────────────────────────────────
install_redis() {
  step "5. REDIS"
  if [ "$OS_FAMILY" = "rhel" ]; then
    REDIS_SVC="redis"
  else
    REDIS_SVC="redis-server"
  fi

  if $SKIP_REDIS; then
    warn "Redis install skipped (--skip-redis)"
    return 0
  fi

  if ! command -v redis-server >/dev/null 2>&1 && ! command -v redis-cli >/dev/null 2>&1; then
    if [ "$OS_FAMILY" = "debian" ]; then
      apt-get install -y -qq redis-server 2>&1 | tail -3
    else
      dnf install -y -q redis 2>&1 | tail -3
    fi
    sed -i 's/^# bind 127.0.0.1/bind 127.0.0.1/' /etc/redis/redis.conf 2>/dev/null || true
    sed -i 's/^# bind 127.0.0.1/bind 127.0.0.1/' /etc/redis.conf 2>/dev/null || true
    enable_service "$REDIS_SVC"
    log "Redis installed"
  else
    log "Redis already installed"
  fi

  start_service "$REDIS_SVC"
  sleep 2
  if redis-cli ping 2>/dev/null | grep -q PONG; then
    log "Redis: PONG received — online"
  else
    warn "Redis not responding — system will continue without caching layer"
  fi
}

# ─── 8. ENVIRONMENT FILE (.env.production) ────────────────────────────────────
generate_env() {
  step "8. ENVIRONMENT FILE (.env.production)"
  
  if ! id "$APP_USER" >/dev/null 2>&1; then
    useradd -m -s /bin/bash "$APP_USER"
    log "User '$APP_USER' created"
  fi

  local dir
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

  local ENV_FILE="$APP_DIR/.env.production"
  
  if [ -f "$ENV_FILE" ]; then
    log ".env.production already exists — refreshing variables"
    local existing_jwt
    existing_jwt=$(grep '^JWT_SECRET=' "$ENV_FILE" 2>/dev/null | cut -d= -f2 || echo "")
    local existing_session
    existing_session=$(grep '^SESSION_SECRET=' "$ENV_FILE" 2>/dev/null | cut -d= -f2 || echo "")
    [ -n "$existing_jwt" ] && JWT_SECRET="$existing_jwt"
    [ -n "$existing_session" ] && SESSION_SECRET="$existing_session"
    rm -f "$ENV_FILE"
  fi

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

  local FRONTEND_ENV="$FRONTEND_DIR/.env.production"
  if [ -d "$FRONTEND_DIR" ]; then
    echo "VITE_API_URL=/" > "$FRONTEND_ENV"
    chown "$APP_USER:$APP_USER" "$FRONTEND_ENV" 2>/dev/null || true
    log "frontend-official/.env.production: VITE_API_URL=/ (nginx proxies /api)"
  fi
}

# ─── 9. BACKEND DEPENDENCIES ──────────────────────────────────────────────────
install_backend() {
  step "9. BACKEND DEPENDENCIES"
  if [ -d "$BACKEND_DIR" ]; then
    cd "$BACKEND_DIR"
    if [ -d node_modules ] && [ ! -f node_modules/.install_ok ]; then
      warn "Removing possibly broken node_modules..."
      rm -rf node_modules
    fi
    sudo -u "$APP_USER" npm install \
      --production \
      --legacy-peer-deps \
      --prefer-offline \
      --no-audit \
      --no-fund 2>&1 | tail -5
    touch node_modules/.install_ok 2>/dev/null || true
    log "Backend deps installed"
  else
    err "backend/ not found at $BACKEND_DIR — clone may have failed"
  fi
}

# ─── 10. DATABASE MIGRATIONS ──────────────────────────────────────────────────
run_migrations() {
  step "10. DATABASE MIGRATIONS"
  if [ -f "$BACKEND_DIR/scripts/run-migrations.js" ]; then
    cd "$BACKEND_DIR"

    if [ -f "$APP_DIR/.env.production" ]; then
      set -a
      # shellcheck disable=SC1091
      source "$APP_DIR/.env.production" 2>/dev/null || true
      set +a
    fi

    log "Testando conexão real utilizando a URL de conexão..."
    if ! PGPASSWORD="${POSTGRES_PASSWORD:-}" psql "$DATABASE_URL" -c 'SELECT 1' >/dev/null 2>&1; then
      err "Falha ao conectar usando a DATABASE_URL: $DATABASE_URL. Verifique as credenciais no arquivo .env.production."
    fi
    log "✔ Conexão real com DATABASE_URL validada com sucesso! (SELECT 1 ok)"

    log "Executando migrations no banco de dados..."
    if ! sudo -u "$APP_USER" bash -c \
        "set -a; source '$APP_DIR/.env.production' 2>/dev/null; set +a; NODE_ENV=production node scripts/run-migrations.js"; then
      err "Migrations FALHARAM! O comando de migração falhou. Verifique os erros acima e o stack de execução."
    fi
    log "✔ Migrations executadas com sucesso!"
  else
    warn "run-migrations.js não encontrado — pulando etapa de migrations"
  fi

  step "10.5. ADMIN MASTER SEED (zapadmin / zapadmin1010)"
  cd "$BACKEND_DIR"
  if [ -f "$BACKEND_DIR/scripts/seed-admin.js" ]; then
    if ! sudo -u "$APP_USER" bash -c \
        "set -a; source '$APP_DIR/.env.production' 2>/dev/null; set +a; \
         AUTH_DEFAULT_USERNAME=zapadmin \
         AUTH_DEFAULT_PASSWORD=zapadmin1010 \
         AUTH_DEFAULT_EMAIL=zapadmin@zapai.local \
         AUTH_DEFAULT_ROLE=master \
         AUTH_DEFAULT_TENANT_ID=default \
         NODE_ENV=production \
         node scripts/seed-admin.js" 2>&1 | tail -8; then
      warn "Admin seed failed — login may require manual setup"
    else
      log "Admin user ready: zapadmin / zapadmin1010 ✔"
    fi
  else
    warn "seed-admin.js not found — admin user not auto-created"
  fi
}

# ─── 11. FRONTEND BUILD ───────────────────────────────────────────────────────
build_frontend() {
  step "11. FRONTEND BUILD"
  if [ -d "$FRONTEND_DIR" ]; then
    cd "$FRONTEND_DIR"
    rm -rf dist 2>/dev/null || true

    sudo -u "$APP_USER" npm install \
      --legacy-peer-deps \
      --prefer-offline \
      --no-audit \
      --no-fund 2>&1 | tail -5

    if ! sudo -u "$APP_USER" bash -c \
        "NODE_ENV=production VITE_API_URL=/ npx vite build --outDir dist" 2>&1 | tail -10; then
      err "Frontend build FAILED — aborting install. Fix build errors and retry."
    fi

    if [ -f "$FRONTEND_DIR/dist/index.html" ]; then
      local chunks
      chunks=$(find "$FRONTEND_DIR/dist/assets" -name '*.js' 2>/dev/null | wc -l)
      log "Frontend built: $chunks JS chunks ✔"
    else
      err "dist/index.html missing after build — unexpected failure"
    fi
  else
    err "frontend-official/ not found — clone may have failed"
  fi
}

# ─── 12. NGINX INSTALL ────────────────────────────────────────────────────────
install_nginx() {
  step "12. NGINX INSTALL"
  enable_service nginx
  start_service nginx

  if [ ! -d /etc/nginx/sites-available ]; then
    mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
    if [ -f /etc/nginx/nginx.conf ] && ! grep -q "sites-enabled" /etc/nginx/nginx.conf; then
      sed -i 's|include /etc/nginx/conf.d/\*\.conf;|include /etc/nginx/conf.d/*.conf;\n    include /etc/nginx/sites-enabled/*;|' /etc/nginx/nginx.conf
      log "Configurada diretiva sites-enabled no nginx.conf"
    fi
  fi

  if [ -f /etc/nginx/nginx.conf ]; then
    sed -i 's/listen       80 default_server;/listen       80;/g' /etc/nginx/nginx.conf 2>/dev/null || true
    sed -i 's/listen       \[::\]:80 default_server;/listen       \[::\]:80;/g' /etc/nginx/nginx.conf 2>/dev/null || true
  fi

  local ssl_active=false
  if [ -n "$DOMAIN" ] && [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    ssl_active=true
  fi

  write_nginx_config "$DOMAIN" "$ssl_active"
  nginx -t && restart_service nginx
  log "Nginx: valid config, reloaded/restarted"

  ln -sf /var/log/nginx/access.log "$LOGS_DIR/nginx/access.log" 2>/dev/null || true
  ln -sf /var/log/nginx/error.log  "$LOGS_DIR/nginx/error.log"  2>/dev/null || true
}

# ─── 12.1. NGINX SSL & FIREWALL CONFIGURATION ─────────────────────────────────
configure_nginx() {
  step "12.1. NGINX SSL & FIREWALL CONFIGURATION"
  
  if [ -n "$DOMAIN" ]; then
    if command -v certbot >/dev/null 2>&1; then
      mkdir -p /var/www/certbot
      
      if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
        log "Requisitando novo certificado Let's Encrypt para $DOMAIN..."
        certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" --non-interactive --agree-tos \
          --email "admin@${DOMAIN}" 2>&1 | tail -5 || \
          warn "Certbot falhou ao gerar o certificado. Verifique os logs e DNS."
      else
        log "Certificado Let's Encrypt já existente encontrado para $DOMAIN."
      fi
      
      if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
        write_nginx_config "$DOMAIN" "true"
        nginx -t && restart_service nginx
        log "✔ SSL configurado com sucesso e Nginx reconfigurado!"
      else
        warn "SSL não pôde ser configurado. Nginx permanecerá em modo HTTP-only."
      fi
    else
      warn "certbot não encontrado — pulando configuração SSL automática"
    fi
  fi

  step "13. FIREWALL"
  if command -v ufw >/dev/null 2>&1; then
    if $PANEL_SAFE_MODE; then
      warn "PANEL SAFE MODE: skipping UFW reset"
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
      warn "PANEL SAFE MODE: skipping firewalld configuration"
    else
      enable_service firewalld
      start_service firewalld
      firewall-cmd --permanent --add-port=22/tcp 2>/dev/null || true
      firewall-cmd --permanent --add-port=80/tcp 2>/dev/null || true
      firewall-cmd --permanent --add-port=443/tcp 2>/dev/null || true
      firewall-cmd --permanent --remove-port="${BACKEND_PORT}/tcp" 2>/dev/null || true
      firewall-cmd --reload 2>/dev/null || true
      log "Firewalld: 22/80/443 open | ${BACKEND_PORT} blocked/removed"
    fi
  else
    warn "Nenhum firewall suportado (UFW/Firewalld) encontrado. Pulando regras de rede."
  fi

  enable_service fail2ban
  start_service fail2ban

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
}

# ─── PM2 STARTUP & SERVICE Timers ─────────────────────────────────────────────
configure_pm2() {
  step "3. PM2 NPM INSTALL"
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

  step "16. PM2 STARTUP"
  env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" 2>/dev/null | \
    grep "sudo" | bash 2>/dev/null || true
  log "PM2 startup configured"

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
  systemctl enable zapai-watcher.timer 2>/dev/null || true
  systemctl start zapai-watcher.timer 2>/dev/null || true
  log "zapai-watcher.timer: active"

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

  step "20. ROLLBACK SNAPSHOT"
  local snap_ts
  snap_ts="$(date +%Y%m%d_%H%M%S)"
  local snap_commit
  snap_commit="$(git -C "$APP_DIR" rev-parse HEAD 2>/dev/null || echo 'unknown')"
  echo "$snap_commit" > "$RELEASES_DIR/current/commit"
  echo "$snap_ts"     > "$RELEASES_DIR/current/timestamp"
  chown -R "$APP_USER:$APP_USER" "$RELEASES_DIR"
  log "Rollback snapshot: $snap_commit @ $snap_ts"
}

# ─── 21. HEALTH & SYSTEM VALIDATION TESTS ─────────────────────────────────────
health_checks() {
  step "21. SYSTEM VALIDATION TESTS"
  log "Executando testes finais de saúde e integridade do sistema..."
  sleep 5

  local validation_failed=false

  # 1. PostgreSQL status
  if ! systemctl is-active --quiet postgresql; then
    warn "PostgreSQL não está ativo!"
    validation_failed=true
  else
    log "✔ PostgreSQL ativo e respondendo"
  fi

  # 2. Redis status
  if ! systemctl is-active --quiet "$REDIS_SVC"; then
    warn "Redis ($REDIS_SVC) não está ativo!"
    validation_failed=true
  else
    log "✔ Redis ativo e respondendo"
  fi

  # 3. Nginx status
  if ! systemctl is-active --quiet nginx; then
    warn "Nginx não está ativo!"
    validation_failed=true
  else
    log "✔ Nginx ativo e respondendo"
  fi

  # 4. PM2 status and app running
  if ! pm2 show zapflow-api >/dev/null 2>&1; then
    warn "PM2 zapflow-api não está ativo/rodando!"
    validation_failed=true
  else
    log "✔ PM2 zapflow-api ativo e em execução"
  fi

  # 5. DB query test using DATABASE_URL from .env.production
  if [ -f "$APP_DIR/.env.production" ]; then
    set -a
    # shellcheck disable=SC1091
    source "$APP_DIR/.env.production" 2>/dev/null || true
    set +a
    
    if ! PGPASSWORD="$POSTGRES_PASSWORD" psql "$DATABASE_URL" -c 'SELECT 1' >/dev/null 2>&1; then
      warn "Teste de query psql usando DATABASE_URL falhou!"
      validation_failed=true
    else
      log "✔ Consulta ao banco de dados validada (SELECT 1 ok)"
    fi
  fi

  # 6. Backend API health endpoint check
  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://127.0.0.1:4025/health" 2>/dev/null || echo "000")
  if [ "$http_code" != "200" ]; then
    warn "Checagem do endpoint de saúde do backend falhou (HTTP $http_code)!"
    validation_failed=true
  else
    log "✔ Endpoint de saúde (/health) retornou HTTP 200 OK"
  fi

  if [ "$validation_failed" = "true" ]; then
    err "FALHA NOS TESTES DE INTEGRIDADE! Um ou mais serviços críticos não estão ativos."
  fi
  
  log "✔ Todos os testes de integridade passaram com sucesso!"
}

# ─── MAIN EXECUTION FLOW ──────────────────────────────────────────────────────
main() {
  check_root
  parse_args "$@"
  detect_os
  detect_panel
  detect_ip
  find_free_port "$PREFERRED_PORT"
  vps_environment_audit
  cleanup_old_installations
  
  install_packages
  install_node
  install_postgres
  configure_postgres
  wait_postgres
  install_redis
  
  generate_env
  install_backend
  run_migrations
  build_frontend
  
  install_nginx
  configure_nginx
  configure_pm2
  health_checks

  # Final Success Display
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
  echo "  Backend:   http://${PUBLIC_IP}:${BACKEND_PORT}/api/health"
  echo "  PM2:       pm2 status && pm2 logs zapflow-api"
  echo "  Deploy:    bash deploy/auto-deploy.sh"
  echo "  Watcher:   systemctl status zapai-watcher.timer"
  echo ""
  echo "  ► /connections → scan WhatsApp QR"
  echo "  ► Auto-deploy ACTIVE: git push origin main → VPS updates"
  echo "============================================================"
}

main "$@"
