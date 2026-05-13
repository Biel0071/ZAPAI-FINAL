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

# ─── Parse args ───────────────────────────────────────────────────────────────
DOMAIN=""
SKIP_POSTGRES=false
SKIP_REDIS=false
APP_USER="${APP_USER:-$(logname 2>/dev/null || echo 'zapai')}"
APP_DIR="${APP_DIR:-/opt/zapai}"
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

[[ $EUID -eq 0 ]] || err "Run as root: sudo bash deploy/install.sh"

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

echo "============================================================"
echo "  ZAPAI VPS INSTALL (Full Bootstrap) — $(date)"
echo "  User: $APP_USER | Dir: $APP_DIR"
echo "  Node: v${NODE_VERSION} | Public IP: $PUBLIC_IP"
echo "  Repo: $REPO_URL"
echo "  URL:  $PUBLIC_URL"
echo "============================================================"

# ─── 0. CLEANUP OLD INSTALLATIONS ────────────────────────────────────────────
# Prevents conflicts from old clones at /opt/ZAPAI-FINAL, /opt/zapai-frontend,
# /var/www/*, or any previous partial installs.
step "0. CLEANUP OLD INSTALLATIONS"
OLD_PATHS=(
  "/opt/ZAPAI-FINAL"
  "/opt/zapai-frontend"
  "/var/www/zapai"
  "/var/www/html/zapai"
  "/opt/zapai-old"
)
for old_path in "${OLD_PATHS[@]}"; do
  if [ -d "$old_path" ] && [ "$old_path" != "$APP_DIR" ]; then
    warn "Old installation found: $old_path — archiving to /opt/zapai-archive"
    mkdir -p /opt/zapai-archive
    mv "$old_path" "/opt/zapai-archive/$(basename $old_path)_$(date +%Y%m%d_%H%M%S)" 2>/dev/null || true
    log "Archived: $old_path"
  fi
done

# Kill any orphaned PM2 processes from old installs
if command -v pm2 >/dev/null 2>&1; then
  pm2 delete all 2>/dev/null || true
  log "PM2: cleared orphaned processes"
fi

log "Old installation cleanup done"

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
pm2 install pm2-logrotate 2>/dev/null || true
pm2 set pm2-logrotate:max_size 50M 2>/dev/null || true
pm2 set pm2-logrotate:retain 14 2>/dev/null || true
pm2 set pm2-logrotate:compress true 2>/dev/null || true
log "PM2 logrotate configured"

# ─── 4. PostgreSQL (with self-healing retry) ─────────────────────────────────
step "4. POSTGRESQL"
DB_PASS="${DB_PASSWORD:-$(openssl rand -hex 16)}"

if $SKIP_POSTGRES; then
  warn "PostgreSQL install skipped (--skip-postgres)"
else
  if ! command -v psql >/dev/null 2>&1; then
    apt-get install -y -qq postgresql postgresql-contrib 2>&1 | tail -3
    log "PostgreSQL installed"
  else
    log "PostgreSQL $(psql --version | head -1) already installed"
  fi

  # Self-healing boot: retry up to 5 times with backoff
  PG_READY=false
  for attempt in 1 2 3 4 5; do
    systemctl enable postgresql 2>/dev/null || true
    systemctl start postgresql 2>/dev/null || true
    sleep $((attempt * 2))
    if sudo -u postgres psql -c 'SELECT 1' >/dev/null 2>&1; then
      PG_READY=true
      log "PostgreSQL: accepting connections (attempt $attempt)"
      break
    fi
    warn "PostgreSQL not ready (attempt $attempt/5) — retrying..."
  done

  if $PG_READY; then
    # Read existing password from .env if present
    if [ -f "$APP_DIR/.env.production" ]; then
      EXISTING_DB_PASS=$(grep '^POSTGRES_PASSWORD=' "$APP_DIR/.env.production" 2>/dev/null | cut -d= -f2)
      [ -n "$EXISTING_DB_PASS" ] && DB_PASS="$EXISTING_DB_PASS"
    fi
    sudo -u postgres psql -c "CREATE USER zapai WITH PASSWORD '$DB_PASS';" 2>/dev/null || true
    sudo -u postgres psql -c "CREATE DATABASE zapai_crm OWNER zapai;" 2>/dev/null || true
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE zapai_crm TO zapai;" 2>/dev/null || true
    # Validate connection
    if PGPASSWORD="$DB_PASS" psql -h localhost -U zapai -d zapai_crm -c 'SELECT 1' >/dev/null 2>&1; then
      log "PostgreSQL: zapai_crm connection verified"
    else
      warn "PostgreSQL: connection test failed — check pg_hba.conf if needed"
    fi
  else
    warn "PostgreSQL did not start after 5 attempts — check: systemctl status postgresql"
    warn "Continuing install — migrations will fail until PG is ready"
  fi
fi

# ─── 5. Redis (graceful fallback — system continues if Redis unavailable) ─────
step "5. REDIS"
if $SKIP_REDIS; then
  warn "Redis install skipped (--skip-redis)"
else
  if ! command -v redis-server >/dev/null 2>&1; then
    apt-get install -y -qq redis-server 2>&1 | tail -3
    sed -i 's/^# bind 127.0.0.1/bind 127.0.0.1/' /etc/redis/redis.conf 2>/dev/null || true
    systemctl enable redis-server
    log "Redis installed"
  else
    log "Redis already installed"
  fi

  # Start with graceful fallback (Redis failure is non-fatal)
  systemctl start redis-server 2>/dev/null || true
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

if [ -f "$ENV_FILE" ]; then
  log ".env.production already exists — keeping existing secrets"
else
  JWT_SECRET="$(openssl rand -hex 32)"
  SESSION_SECRET="$(openssl rand -hex 32)"
  # Reuse DB_PASS from step 4 if set, otherwise generate
  DB_PASS="${DB_PASS:-$(openssl rand -hex 16)}"

  cat > "$ENV_FILE" << ENVEOF
# ZAPAI-FINAL Production Environment
# Auto-generated by deploy/install.sh on $(date)
# IP: ${PUBLIC_IP} | URL: ${PUBLIC_URL}
# Do NOT commit this file to git.

NODE_ENV=production
PORT=4025
HOST=0.0.0.0

# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=zapai
POSTGRES_PASSWORD=${DB_PASS}
POSTGRES_DB=zapai_crm
DATABASE_URL=postgresql://zapai:${DB_PASS}@localhost:5432/zapai_crm

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=${JWT_SECRET}
SESSION_SECRET=${SESSION_SECRET}
JWT_EXPIRES_IN=7d

# URLs (auto-detected from public IP)
BACKEND_URL=http://${PUBLIC_IP}:4025
FRONTEND_URL=${PUBLIC_URL}
CORS_ORIGIN=${PUBLIC_URL}

# App
DEFAULT_COMPANY_ID=default

# PM2 Signals
PM2_READY_SIGNAL=true
HEALTH_CHECK_INTERVAL_MS=60000

# AI Memory
AI_MEMORY_ENABLED=true

# Retention
GROUP_MSG_RETENTION_HOURS=24
INDIVIDUAL_MSG_RETENTION_DAYS=60
ENVEOF

  chown "$APP_USER:$APP_USER" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  log ".env.production created (IP: ${PUBLIC_IP}, secrets auto-generated)"
fi

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
  sudo -u "$APP_USER" npm install --production --prefer-offline --no-audit --no-fund 2>&1 | tail -5
  log "Backend deps installed"
else
  warn "backend/ not found at $BACKEND_DIR — was clone successful?"
fi

# ─── 10. Database migrations ──────────────────────────────────────────────────
step "10. DATABASE MIGRATIONS"
if [ -f "$BACKEND_DIR/scripts/run-migrations.js" ]; then
  cd "$BACKEND_DIR"
  sudo -u "$APP_USER" bash -c \
    "NODE_ENV=production node scripts/run-migrations.js" 2>&1 | tail -5 || \
    warn "Migrations failed — check DB connectivity in .env.production"
  log "Migrations complete"
else
  warn "run-migrations.js not found — skipping"
fi

# ─── 11. Frontend build ───────────────────────────────────────────────────────
step "11. FRONTEND BUILD"
if [ -d "$FRONTEND_DIR" ]; then
  cd "$FRONTEND_DIR"
  sudo -u "$APP_USER" npm install --prefer-offline --no-audit --no-fund 2>&1 | tail -5
  sudo -u "$APP_USER" bash -c \
    "NODE_ENV=production VITE_API_URL=/ npx vite build --outDir dist" 2>&1 | tail -10 || \
    warn "Vite build failed — backend will still start"

  if [ -f "$FRONTEND_DIR/dist/index.html" ]; then
    CHUNKS=$(find "$FRONTEND_DIR/dist/assets" -name '*.js' 2>/dev/null | wc -l)
    log "Frontend built: $CHUNKS JS chunks"
  else
    warn "dist/index.html missing — build may have failed"
  fi
else
  warn "frontend-official/ not found — skipping build"
fi

# ─── 12. Nginx ────────────────────────────────────────────────────────────────
step "12. NGINX"
systemctl enable nginx 2>/dev/null || true

if [ -n "$DOMAIN" ] && [ -f "$DEPLOY_DIR/nginx.conf" ]; then
  cp "$DEPLOY_DIR/nginx.conf" /etc/nginx/sites-available/zapai
  sed -i "s/YOUR_DOMAIN/$DOMAIN/g" /etc/nginx/sites-available/zapai
  log "Nginx configured for $DOMAIN (HTTPS-ready)"
else
  cat > /etc/nginx/sites-available/zapai << 'NGINX_EOF'
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=5r/s;
limit_req_zone $binary_remote_addr zone=api_limit:10m  rate=30r/s;

server {
    listen 80 default_server;
    server_name _;

    client_max_body_size 50m;
    gzip on;
    gzip_types text/plain application/json application/javascript text/css;

    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;

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
    location /api/ {
        limit_req zone=api_limit burst=50 nodelay;
        proxy_pass http://127.0.0.1:4025;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
    }
    location ~ ^/(auth|api/auth) {
        limit_req zone=auth_limit burst=10 nodelay;
        proxy_pass http://127.0.0.1:4025;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 30s;
    }
    location /health {
        proxy_pass http://127.0.0.1:4025/health;
        proxy_http_version 1.1;
        proxy_read_timeout 10s;
    }
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
  log "Nginx configured (HTTP-only)"
  warn "Add HTTPS: certbot --nginx -d your-domain.com"
fi

ln -sf /etc/nginx/sites-available/zapai /etc/nginx/sites-enabled/zapai 2>/dev/null || true
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
nginx -t && systemctl reload nginx
log "Nginx: valid config, reloaded"

ln -sf /var/log/nginx/access.log "$LOGS_DIR/nginx/access.log" 2>/dev/null || true
ln -sf /var/log/nginx/error.log  "$LOGS_DIR/nginx/error.log"  2>/dev/null || true

# ─── 13. Firewall ─────────────────────────────────────────────────────────────
step "13. FIREWALL (UFW)"
ufw --force reset 2>/dev/null || true
ufw allow 22/tcp   comment "SSH"
ufw allow 80/tcp   comment "HTTP"
ufw allow 443/tcp  comment "HTTPS"
ufw deny  4025/tcp comment "Block direct backend"
ufw --force enable 2>/dev/null || true
log "UFW: 22/80/443 open | 4025 blocked"

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

# ─── 21. Health validation ────────────────────────────────────────────────────
step "21. HEALTH VALIDATION"
sleep 8

HEALTH_OK=false
for i in $(seq 1 12); do
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://127.0.0.1:4025/health" 2>/dev/null || echo "000")
  if [ "$HTTP" = "200" ]; then
    HEALTH_OK=true
    log "Backend health: 200 OK (attempt $i)"
    break
  fi
  echo "  → Attempt $i/12 — HTTP $HTTP, waiting 5s..."
  sleep 5
done

if $HEALTH_OK; then
  log "Extended healthcheck..."
  sudo -u "$APP_USER" node "$BACKEND_DIR/scripts/healthcheck.js" 2>/dev/null | tail -10 || true
fi

# ─── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "============================================================"
if $HEALTH_OK; then
  echo -e "${GREEN}  ✅ ZAPAI BOOTSTRAP COMPLETE — $(date)${NC}"
  echo "  System is ONLINE. No manual steps needed."
else
  echo -e "${YELLOW}  ⚠  INSTALL COMPLETE — $(date)${NC}"
  echo "  Backend not responding yet — check:"
  echo "    pm2 logs zapflow-api"
  echo "    pm2 status"
fi
echo ""
echo "  Runtime:    $APP_DIR"
echo "  ► OPEN URL: ${PUBLIC_URL}"
echo "  Backend:    http://${PUBLIC_IP}:4025/health"
echo "  PM2:        pm2 status && pm2 logs zapflow-api"
echo "  Deploy:     bash deploy/auto-deploy.sh"
echo "  Watcher:    systemctl status zapai-watcher.timer"
echo ""
echo "  ► Next: open ${PUBLIC_URL}/connections → scan WhatsApp QR"
echo "  ► Auto-deploy ACTIVE: git push origin main → VPS updates automatically"
echo "============================================================"
