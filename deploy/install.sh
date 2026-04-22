#!/usr/bin/env bash
# ============================================================
# ZapAI CRM — ONE COMMAND DEPLOY
# Tested on: Ubuntu 22.04 / 24.04 LTS
#
# Usage (run as root or with sudo):
#   bash deploy/install.sh
#   bash deploy/install.sh yourdomain.com
#
# Idempotent — safe to re-run.
# ============================================================
set -euo pipefail

# ── Colours ─────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'
ok()   { echo -e "${GREEN}[OK]${RESET}  $*"; }
info() { echo -e "${BLUE}[--]${RESET}  $*"; }
warn() { echo -e "${YELLOW}[!!]${RESET}  $*"; }
die()  { echo -e "${RED}[ERR]${RESET} $*" >&2; exit 1; }
step() { echo -e "\n${BOLD}${BLUE}══ $* ${RESET}"; }

# ── Config ───────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
DEPLOY_DIR="$APP_DIR/deploy"
LOG_DIR="$APP_DIR/logs"

DOMAIN="${1:-}"
BACKEND_PORT=4025
PM2_PROCESS="zapai-backend"
NODE_MIN_VERSION=20

# ── Banner ───────────────────────────────────────────────────
echo -e "${BOLD}"
echo "  ╔═══════════════════════════════════════════════╗"
echo "  ║       ZapAI CRM — VPS Auto Deploy             ║"
echo "  ║       $(date '+%Y-%m-%d %H:%M:%S')                    ║"
echo "  ╚═══════════════════════════════════════════════╝"
echo -e "${RESET}"
info "Project root : $APP_DIR"
info "Domain       : ${DOMAIN:-'(HTTP only, no domain set)'}"
info "Backend port : $BACKEND_PORT"
echo ""

# ── Require root ─────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  die "Run as root or with sudo:  sudo bash deploy/install.sh"
fi

# ── Step 1 — System packages ─────────────────────────────────
step "1/10  System packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
  curl wget git unzip build-essential \
  nginx \
  postgresql postgresql-contrib \
  > /dev/null
ok "System packages ready"

# ── Step 2 — Node.js ≥ 20 ───────────────────────────────────
step "2/10  Node.js"
INSTALLED_NODE=0
if command -v node &>/dev/null; then
  INSTALLED_NODE=$(node -e "process.stdout.write(process.version.slice(1).split('.')[0])")
fi

if [[ "$INSTALLED_NODE" -lt "$NODE_MIN_VERSION" ]]; then
  info "Installing Node.js $NODE_MIN_VERSION LTS via NodeSource..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MIN_VERSION}.x" | bash - > /dev/null
  apt-get install -y -qq nodejs > /dev/null
fi
ok "Node $(node -v)  |  npm $(npm -v)"

# ── Step 3 — PM2 ─────────────────────────────────────────────
step "3/10  PM2"
if ! command -v pm2 &>/dev/null; then
  npm install -g pm2 --quiet
fi
ok "PM2 $(pm2 -v)"

# ── Step 4 — PostgreSQL database ─────────────────────────────
step "4/10  PostgreSQL"
DB_NAME="zapai_crm"
DB_USER="zapai"
# Generate a random password if database doesn't exist yet
DB_PASS_FILE="/opt/zapai_db_password"
if [[ -f "$DB_PASS_FILE" ]]; then
  DB_PASS=$(cat "$DB_PASS_FILE")
  info "Reusing existing DB password from $DB_PASS_FILE"
else
  DB_PASS=$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32)
  echo "$DB_PASS" > "$DB_PASS_FILE"
  chmod 600 "$DB_PASS_FILE"
  info "New DB password saved to $DB_PASS_FILE (keep this safe)"
fi

systemctl is-active postgresql &>/dev/null || systemctl start postgresql

# Create user if not exists
sudo -u postgres psql -tAc \
  "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"

# Create database if not exists
sudo -u postgres psql -tAc \
  "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || \
  sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"

ok "PostgreSQL: database=$DB_NAME  user=$DB_USER"

# ── Step 5 — Environment files ───────────────────────────────
step "5/10  Environment files"
mkdir -p "$LOG_DIR"

# Backend .env
if [[ ! -f "$BACKEND_DIR/.env" ]]; then
  info "Creating backend/.env from .env.example..."
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"

  # Auto-fill generated values
  JWT_SECRET=$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 64)
  DB_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"

  sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|g"                    "$BACKEND_DIR/.env"
  sed -i "s|AUTH_JWT_SECRET=.*|AUTH_JWT_SECRET=$JWT_SECRET|g"           "$BACKEND_DIR/.env"
  sed -i "s|DATABASE_URL=.*|DATABASE_URL=$DB_URL|g"                    "$BACKEND_DIR/.env"
  sed -i "s|AUTH_DEFAULT_PASSWORD=.*|AUTH_DEFAULT_PASSWORD=admin123|g" "$BACKEND_DIR/.env"
  sed -i "s|NODE_ENV=.*|NODE_ENV=production|g"                         "$BACKEND_DIR/.env"

  if [[ -n "$DOMAIN" ]]; then
    sed -i "s|FRONTEND_URL=.*|FRONTEND_URL=https://$DOMAIN|g"              "$BACKEND_DIR/.env"
    sed -i "s|CORS_ALLOWED_ORIGINS=.*|CORS_ALLOWED_ORIGINS=https://$DOMAIN|g" "$BACKEND_DIR/.env"
  fi
  ok "backend/.env created (JWT auto-generated, DB configured)"
  warn "Edit $BACKEND_DIR/.env to set your OPENAI_API_KEY and other secrets"
else
  ok "backend/.env already exists — skipping"
fi

# Frontend .env.production
if [[ ! -f "$FRONTEND_DIR/.env.production" ]]; then
  info "Creating frontend/.env.production..."
  if [[ -n "$DOMAIN" ]]; then
    cat > "$FRONTEND_DIR/.env.production" <<EOF
VITE_API_URL=https://$DOMAIN
VITE_WHATSAPP_API_BASE_URL=https://$DOMAIN
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
EOF
  else
    cat > "$FRONTEND_DIR/.env.production" <<EOF
VITE_API_URL=http://localhost:$BACKEND_PORT
VITE_WHATSAPP_API_BASE_URL=http://localhost:$BACKEND_PORT
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
EOF
  fi
  ok "frontend/.env.production created"
else
  ok "frontend/.env.production already exists — skipping"
fi

# ── Step 6 — Backend dependencies ────────────────────────────
step "6/10  Backend npm install"
cd "$BACKEND_DIR"
npm ci --omit=dev --no-audit --no-fund --prefer-offline 2>&1 | tail -3
ok "Backend dependencies installed"

# ── Step 7 — Frontend build ───────────────────────────────────
step "7/10  Frontend build"
cd "$FRONTEND_DIR"
npm ci --no-audit --no-fund --prefer-offline 2>&1 | tail -3
npm run build 2>&1 | grep -E "built in|error|warning" | tail -5
ok "Frontend built → $FRONTEND_DIR/dist"

# ── Step 8 — Nginx ───────────────────────────────────────────
step "8/10  Nginx"
NGINX_SITE="/etc/nginx/sites-available/zapai"
NGINX_ENABLED="/etc/nginx/sites-enabled/zapai"
DIST_DIR="$FRONTEND_DIR/dist"

if [[ -n "$DOMAIN" ]]; then
  # HTTPS config (Certbot will fill cert paths later)
  info "Installing HTTPS nginx config for $DOMAIN"
  sed "s|YOUR_DOMAIN|$DOMAIN|g; s|/opt/zapai/frontend/dist|$DIST_DIR|g" \
    "$DEPLOY_DIR/nginx.conf" > "$NGINX_SITE"
else
  # HTTP-only fallback (no domain)
  info "Installing HTTP-only nginx config (no domain provided)"
  cat > "$NGINX_SITE" <<NGINX
server {
    listen 80 default_server;
    server_name _;

    root $DIST_DIR;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass         http://127.0.0.1:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_read_timeout 30s;
        client_max_body_size 25M;
    }

    location /auth/ {
        proxy_pass         http://127.0.0.1:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
    }

    location /system/ {
        proxy_pass         http://127.0.0.1:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header   Host \$host;
    }

    location ~ ^/(health|status-whatsapp|diagnostics)$ {
        proxy_pass         http://127.0.0.1:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header   Host \$host;
    }

    location /socket.io/ {
        proxy_pass              http://127.0.0.1:$BACKEND_PORT;
        proxy_http_version      1.1;
        proxy_set_header        Upgrade    \$http_upgrade;
        proxy_set_header        Connection "upgrade";
        proxy_set_header        Host       \$host;
        proxy_read_timeout      86400s;
        proxy_buffering         off;
    }

    location /send-media {
        proxy_pass           http://127.0.0.1:$BACKEND_PORT;
        proxy_http_version   1.1;
        client_max_body_size 25M;
        proxy_read_timeout   60s;
    }

    location ~* \.(js|css|woff2|woff|png|ico|svg|webp)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
    gzip_min_length 1000;
}
NGINX
fi

# Remove default site
rm -f /etc/nginx/sites-enabled/default

# Enable zapai site
ln -sf "$NGINX_SITE" "$NGINX_ENABLED"

nginx -t
systemctl enable nginx
systemctl restart nginx
ok "Nginx configured and running"

# ── Step 9 — PM2 start ───────────────────────────────────────
step "9/10  PM2 — start backend"
cd "$DEPLOY_DIR"

# Update ecosystem cwd to actual app dir
sed "s|/opt/zapai|$APP_DIR|g" "$DEPLOY_DIR/ecosystem.config.js" > /tmp/zapai_ecosystem.js

if pm2 describe "$PM2_PROCESS" &>/dev/null; then
  info "Process exists — reloading..."
  pm2 reload /tmp/zapai_ecosystem.js --env production --update-env
else
  info "Starting fresh process..."
  pm2 start /tmp/zapai_ecosystem.js --env production
fi

pm2 save
# Register PM2 to start on boot
pm2 startup systemd -u "$(logname 2>/dev/null || echo root)" --hp "/root" | \
  grep "^sudo" | bash || true

ok "PM2 process '$PM2_PROCESS' running"

# ── Step 10 — Health check ───────────────────────────────────
step "10/10  Health check"
sleep 4
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:$BACKEND_PORT/health || echo "000")

if [[ "$HEALTH_STATUS" == "200" ]]; then
  ok "Backend health: HTTP $HEALTH_STATUS ✓"
  HEALTH_BODY=$(curl -s http://127.0.0.1:$BACKEND_PORT/health)
  DB_STATUS=$(echo "$HEALTH_BODY" | grep -o '"database":"[^"]*"' | cut -d'"' -f4)
  ok "Database     : $DB_STATUS"
else
  warn "Backend health returned HTTP $HEALTH_STATUS"
  warn "Check logs: pm2 logs $PM2_PROCESS --lines 30"
fi

NGINX_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1/ || echo "000")
if [[ "$NGINX_STATUS" =~ ^(200|301|302)$ ]]; then
  ok "Nginx frontend: HTTP $NGINX_STATUS ✓"
else
  warn "Nginx returned HTTP $NGINX_STATUS (may be normal if domain not set)"
fi

# ── Summary ──────────────────────────────────────────────────
SERVER_IP=$(curl -s https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
echo ""
echo -e "${BOLD}${GREEN}"
echo "  ╔═══════════════════════════════════════════════════════╗"
echo "  ║   ✓  ZapAI CRM DEPLOYED SUCCESSFULLY                  ║"
echo "  ╚═══════════════════════════════════════════════════════╝"
echo -e "${RESET}"
echo -e "  ${BOLD}Access URLs:${RESET}"
if [[ -n "$DOMAIN" ]]; then
  echo "    Frontend  → https://$DOMAIN"
  echo "    API       → https://$DOMAIN/api"
  echo "    Health    → https://$DOMAIN/health"
else
  echo "    Frontend  → http://$SERVER_IP"
  echo "    API       → http://$SERVER_IP/api"
  echo "    Health    → http://$SERVER_IP/health"
fi
echo ""
echo -e "  ${BOLD}Backend direct:${RESET}  http://127.0.0.1:$BACKEND_PORT/health"
echo -e "  ${BOLD}PM2 status:${RESET}      pm2 status"
echo -e "  ${BOLD}Backend logs:${RESET}    pm2 logs $PM2_PROCESS"
echo ""
echo -e "  ${BOLD}Default login:${RESET}"
echo "    User     : admin"
echo "    Password : admin123  ← CHANGE THIS in backend/.env"
echo ""
if [[ -n "$DOMAIN" ]]; then
  echo -e "  ${YELLOW}${BOLD}Next step — enable HTTPS:${RESET}"
  echo "    apt install certbot python3-certbot-nginx"
  echo "    certbot --nginx -d $DOMAIN"
  echo ""
fi
echo -e "  ${BOLD}Update later:${RESET}    bash $DEPLOY_DIR/update.sh"
echo -e "  ${BOLD}Rollback:${RESET}        bash $DEPLOY_DIR/rollback.sh"
echo -e "  ${BOLD}Health check:${RESET}    bash $DEPLOY_DIR/check.sh"
echo ""
