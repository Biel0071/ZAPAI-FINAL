#!/bin/bash
# ==============================================================================
# ZAPAI — Full VPS Install Script
# Instala e configura tudo do zero: Node, PM2, Nginx, PostgreSQL, Redis,
# certbot, UFW, pastas, PM2 startup, logrotate e cron.
#
# Uso (como root no VPS):
#   sudo bash deploy/install.sh
#   sudo bash deploy/install.sh --domain=seu-dominio.com
#   sudo bash deploy/install.sh --skip-postgres   (se usar Docker Postgres)
#   sudo bash deploy/install.sh --skip-redis      (se usar Docker Redis)
# ==============================================================================

set -euo pipefail

# ─── Parse args ───────────────────────────────────────────────────────────────
DOMAIN=""
SKIP_POSTGRES=false
SKIP_REDIS=false
APP_USER="${APP_USER:-$(logname 2>/dev/null || echo 'zapai')}"
APP_DIR="${APP_DIR:-/opt/zapai}"
NODE_VERSION="${NODE_VERSION:-20}"

for arg in "$@"; do
  case $arg in
    --domain=*)      DOMAIN="${arg#*=}" ;;
    --user=*)        APP_USER="${arg#*=}" ;;
    --app-dir=*)     APP_DIR="${arg#*=}" ;;
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

echo "============================================================"
echo "  ZAPAI VPS INSTALL — $(date)"
echo "  User: $APP_USER | Dir: $APP_DIR"
echo "  Node: v${NODE_VERSION} | Domain: ${DOMAIN:-<none>}"
echo "============================================================"

# Must run as root
[[ $EUID -eq 0 ]] || err "Run as root: sudo bash deploy/install.sh"

# ─── 1. System packages ───────────────────────────────────────────────────────
step "1. SYSTEM PACKAGES"
apt-get update -qq
apt-get install -y -qq \
  curl wget git build-essential \
  nginx certbot python3-certbot-nginx \
  ufw fail2ban \
  htop iotop \
  logrotate cron \
  ca-certificates gnupg lsb-release \
  2>&1 | tail -3
log "Base packages installed"

# ─── 2. Node.js ───────────────────────────────────────────────────────────────
step "2. NODE.JS v${NODE_VERSION}"
if command -v node >/dev/null 2>&1 && node --version | grep -q "^v${NODE_VERSION}"; then
  log "Node.js $(node --version) already installed"
else
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash - 2>&1 | tail -3
  apt-get install -y -qq nodejs 2>&1 | tail -3
  log "Node.js $(node --version) installed"
fi

# ─── 3. PM2 ───────────────────────────────────────────────────────────────────
step "3. PM2"
if command -v pm2 >/dev/null 2>&1; then
  log "PM2 $(pm2 --version) already installed"
else
  npm install -g pm2 --quiet
  log "PM2 $(pm2 --version) installed"
fi

# PM2 Logrotate
pm2 install pm2-logrotate 2>/dev/null || true
pm2 set pm2-logrotate:max_size 50M 2>/dev/null || true
pm2 set pm2-logrotate:retain 14 2>/dev/null || true
pm2 set pm2-logrotate:compress true 2>/dev/null || true
log "PM2 logrotate configured"

# ─── 4. PostgreSQL (native) ───────────────────────────────────────────────────
step "4. POSTGRESQL"
if $SKIP_POSTGRES; then
  warn "PostgreSQL install skipped (--skip-postgres) — using Docker"
elif command -v psql >/dev/null 2>&1; then
  log "PostgreSQL $(psql --version) already installed"
else
  apt-get install -y -qq postgresql postgresql-contrib 2>&1 | tail -3
  systemctl enable postgresql
  systemctl start postgresql
  log "PostgreSQL installed and started"

  # Create database and user
  DB_PASS="${DB_PASSWORD:-$(openssl rand -hex 16)}"
  sudo -u postgres psql -c "CREATE USER zapai WITH PASSWORD '$DB_PASS';" 2>/dev/null || true
  sudo -u postgres psql -c "CREATE DATABASE zapai_crm OWNER zapai;" 2>/dev/null || true
  sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE zapai_crm TO zapai;" 2>/dev/null || true
  log "PostgreSQL database 'zapai_crm' and user 'zapai' created"
  warn "DB password: $DB_PASS — save this in .env.production!"
fi

# ─── 5. Redis ─────────────────────────────────────────────────────────────────
step "5. REDIS"
if $SKIP_REDIS; then
  warn "Redis install skipped (--skip-redis) — using Docker"
elif command -v redis-server >/dev/null 2>&1; then
  log "Redis $(redis-server --version | head -1) already installed"
else
  apt-get install -y -qq redis-server 2>&1 | tail -3
  # Bind to localhost only
  sed -i 's/^# bind 127.0.0.1/bind 127.0.0.1/' /etc/redis/redis.conf 2>/dev/null || true
  systemctl enable redis-server
  systemctl start redis-server
  log "Redis installed (localhost-only binding)"
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
  "$BACKEND_DIR/sessions" \
  "$BACKEND_DIR/uploads" \
  "$BACKEND_DIR/logs"; do
  mkdir -p "$dir"
done

chown -R "$APP_USER:$APP_USER" "$APP_DIR"
log "Directories created under $APP_DIR"

# ─── 7. Clone/link repo ───────────────────────────────────────────────────────
step "7. REPOSITORY"
if [ -d "$APP_DIR/.git" ]; then
  log "Repository already exists at $APP_DIR"
elif [ -d "/opt/ZAPAI-FINAL/.git" ]; then
  # If repo was cloned to different path, symlink
  ln -sf /opt/ZAPAI-FINAL "$APP_DIR" 2>/dev/null || true
  warn "Linked /opt/ZAPAI-FINAL → $APP_DIR"
else
  warn "No repository at $APP_DIR — clone manually:"
  warn "  git clone https://github.com/Biel0071/ZAPAI-FINAL.git $APP_DIR"
fi

# ─── 8. Nginx ─────────────────────────────────────────────────────────────────
step "8. NGINX"
systemctl enable nginx 2>/dev/null || true

if [ -n "$DOMAIN" ]; then
  # Full HTTPS config
  cp "$DEPLOY_DIR/nginx.conf" /etc/nginx/sites-available/zapai 2>/dev/null || \
    warn "nginx.conf not found at $DEPLOY_DIR — copy manually"
  sed -i "s/YOUR_DOMAIN/$DOMAIN/g" /etc/nginx/sites-available/zapai 2>/dev/null || true
  log "Nginx configured for domain: $DOMAIN"
else
  # HTTP-only (IP-based, no SSL)
  cat > /etc/nginx/sites-available/zapai << 'NGINX_EOF'
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=5r/s;
limit_req_zone $binary_remote_addr zone=api_limit:10m  rate=30r/s;

server {
    listen 80 default_server;
    server_name _;

    client_max_body_size 50m;
    gzip on;
    gzip_types text/plain application/json application/javascript text/css;

    # Security headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Frontend SPA
    root /opt/zapai/frontend-official/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
        expires -1;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Backend API
    location /api/ {
        limit_req zone=api_limit burst=50 nodelay;
        proxy_pass http://127.0.0.1:4025;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
        proxy_connect_timeout 10s;
    }

    # Auth rate limit
    location ~ ^/(auth|api/auth) {
        limit_req zone=auth_limit burst=10 nodelay;
        proxy_pass http://127.0.0.1:4025;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 30s;
    }

    # Health (no rate limit)
    location /health {
        proxy_pass http://127.0.0.1:4025/health;
        proxy_http_version 1.1;
        proxy_read_timeout 10s;
    }

    # WebSocket
    location /socket.io/ {
        proxy_pass http://127.0.0.1:4025;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
NGINX_EOF
  log "Nginx configured (HTTP-only, IP-based)"
  warn "To add HTTPS: certbot --nginx -d your-domain.com"
fi

ln -sf /etc/nginx/sites-available/zapai /etc/nginx/sites-enabled/zapai 2>/dev/null || true
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
nginx -t && systemctl reload nginx
log "Nginx: config valid, reloaded"

# Link nginx logs to $LOGS_DIR
ln -sf /var/log/nginx/access.log "$LOGS_DIR/nginx/access.log" 2>/dev/null || true
ln -sf /var/log/nginx/error.log  "$LOGS_DIR/nginx/error.log"  2>/dev/null || true

# ─── 9. Firewall ──────────────────────────────────────────────────────────────
step "9. FIREWALL (UFW)"
ufw --force reset 2>/dev/null || true
ufw allow 22/tcp   comment "SSH"
ufw allow 80/tcp   comment "HTTP"
ufw allow 443/tcp  comment "HTTPS"
ufw deny  4025/tcp comment "Block direct backend"
ufw --force enable 2>/dev/null || true
log "UFW: 22/80/443 open | 4025 blocked from public"

# Fail2ban for SSH
systemctl enable fail2ban 2>/dev/null || true
systemctl start fail2ban 2>/dev/null || true
log "fail2ban enabled"

# ─── 10. Logrotate ────────────────────────────────────────────────────────────
step "10. LOGROTATE"
cat > /etc/logrotate.d/zapai << EOF
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
EOF
log "logrotate: /etc/logrotate.d/zapai"

# ─── 11. Cron jobs ────────────────────────────────────────────────────────────
step "11. CRON JOBS"
cat > /etc/cron.d/zapai << EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin:/usr/local/bin

# Git watcher: check for new commits every 2 minutes
*/2 * * * * $APP_USER bash $DEPLOY_DIR/watcher.sh >> $LOGS_DIR/deploy/watcher.log 2>&1

# Auto-recovery: every 5 minutes
*/5 * * * * $APP_USER bash $BACKEND_DIR/scripts/recovery.sh --dry-run >> $LOGS_DIR/backend/recovery.log 2>&1

# Daily healthcheck at 07:00
0 7 * * * $APP_USER node $BACKEND_DIR/scripts/healthcheck.js --json >> $LOGS_DIR/backend/healthcheck_daily.log 2>&1

# Session backup: daily at 03:00
0 3 * * * $APP_USER bash $BACKEND_DIR/scripts/backup-sessions.sh 2>/dev/null || true

# DB maintenance: weekly Sunday 04:00
0 4 * * 0 $APP_USER node $BACKEND_DIR/scripts/db-performance-maintenance.js 2>/dev/null || true
EOF
chmod 644 /etc/cron.d/zapai
log "Cron: /etc/cron.d/zapai (watcher every 2min, recovery every 5min)"

# ─── 12. PM2 startup ──────────────────────────────────────────────────────────
step "12. PM2 STARTUP"
env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" 2>/dev/null | \
  grep "sudo" | bash 2>/dev/null || true
log "PM2 startup configured"

# ─── 13. Watcher systemd service (alternative to cron) ───────────────────────
step "13. WATCHER SYSTEMD SERVICE"
cat > /etc/systemd/system/zapai-watcher.service << EOF
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
EOF

cat > /etc/systemd/system/zapai-watcher.timer << EOF
[Unit]
Description=ZAPAI Watcher — run every 2 minutes

[Timer]
OnBootSec=30s
OnUnitActiveSec=2min
AccuracySec=10s

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable zapai-watcher.timer
systemctl start zapai-watcher.timer
log "systemd timer: zapai-watcher.timer (every 2min)"

# ─── Done ────────────────────────────────────────────────────────────────────
echo ""
echo "============================================================"
echo -e "${GREEN}  VPS INSTALL COMPLETE — $(date)${NC}"
echo ""
echo "  Next steps:"
echo "  1. Copy .env.production to $APP_DIR/.env.production"
echo "  2. cd $APP_DIR && bash deploy/auto-deploy.sh"
echo "  3. node backend/scripts/healthcheck.js"
echo "  4. Access /connections → scan QR"
if [ -n "$DOMAIN" ]; then
  echo "  5. certbot --nginx -d $DOMAIN"
fi
echo "============================================================"
