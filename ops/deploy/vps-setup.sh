#!/bin/bash
# ==============================================================================
# ZAPAI — VPS Setup & Boot Hardening
# Configura o servidor VPS para boot automático, logs rotativos e cron jobs.
#
# Uso (executar uma vez como root/sudo no VPS):
#   sudo bash deploy/vps-setup.sh
# ==============================================================================

set -euo pipefail

APP_USER="${APP_USER:-zapai}"
APP_DIR="${APP_DIR:-/opt/zapai}"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend-official"
LOGS_DIR="$APP_DIR/logs"
SCRIPTS_DIR="$BACKEND_DIR/scripts"
DOMAIN="${DOMAIN:-}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${GREEN}[VPS-SETUP] $*${NC}"; }
warn() { echo -e "${YELLOW}[VPS-SETUP] ⚠ $*${NC}"; }
err()  { echo -e "${RED}[VPS-SETUP] ✖ $*${NC}"; }
step() { echo -e "\n${CYAN}━━━ $* ━━━${NC}"; }

echo "============================================================"
echo "  ZAPAI VPS Setup — $(date)"
echo "  APP_DIR: $APP_DIR | USER: $APP_USER"
echo "============================================================"

# ─── 1. Directories ───────────────────────────────────────────────────────────
step "1. Directories"
for dir in \
  "$APP_DIR" \
  "$LOGS_DIR/backend" \
  "$LOGS_DIR/frontend" \
  "$LOGS_DIR/deploy" \
  "$LOGS_DIR/nginx" \
  "$APP_DIR/backups" \
  "$APP_DIR/releases" \
  "$BACKEND_DIR/sessions" \
  "$BACKEND_DIR/uploads"; do
  mkdir -p "$dir"
  log "  Created: $dir"
done

# Set ownership if user exists
if id "$APP_USER" >/dev/null 2>&1; then
  chown -R "$APP_USER:$APP_USER" "$APP_DIR"
  log "  Owner: $APP_USER"
fi

# ─── 2. PM2 startup ───────────────────────────────────────────────────────────
step "2. PM2 Auto-start"
if command -v pm2 >/dev/null 2>&1; then
  # Generate startup command for current user
  PM2_CMD=$(su -s /bin/bash -c "pm2 startup systemd --no-daemon" "$APP_USER" 2>/dev/null \
    | grep "sudo" | head -1 || echo "")
  if [ -n "$PM2_CMD" ]; then
    log "Running: $PM2_CMD"
    eval "$PM2_CMD" 2>/dev/null || warn "PM2 startup command failed — run manually"
  fi
  # Save current process list
  su -s /bin/bash -c "cd $BACKEND_DIR && pm2 save --force" "$APP_USER" 2>/dev/null || true
  log "PM2 startup configured"
else
  warn "PM2 not found — install with: npm install -g pm2"
fi

# ─── 3. Nginx auto-start ──────────────────────────────────────────────────────
step "3. Nginx Auto-start"
if command -v nginx >/dev/null 2>&1; then
  systemctl enable nginx 2>/dev/null || true
  log "Nginx enabled at boot"
else
  warn "Nginx not found"
fi

# ─── 4. Docker auto-start ─────────────────────────────────────────────────────
step "4. Docker Auto-start"
if command -v docker >/dev/null 2>&1; then
  systemctl enable docker 2>/dev/null || true
  log "Docker enabled at boot"
  if [ -f "$APP_DIR/docker-compose.production.yml" ]; then
    # Create systemd service for docker-compose
    cat > /etc/systemd/system/zapai-docker.service << EOF
[Unit]
Description=ZAPAI Docker Compose Services
Requires=docker.service
After=docker.service network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/docker compose -f docker-compose.production.yml up -d --remove-orphans
ExecStop=/usr/bin/docker compose -f docker-compose.production.yml down
TimeoutStartSec=120
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload
    systemctl enable zapai-docker.service 2>/dev/null || true
    log "Docker Compose systemd service: zapai-docker.service"
  fi
else
  warn "Docker not found"
fi

# ─── 5. Log rotation ──────────────────────────────────────────────────────────
step "5. Log Rotation"
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
  delaycompress
  notifempty
  create 0640 $APP_USER $APP_USER
}

$LOGS_DIR/nginx/*.log {
  daily
  missingok
  rotate 14
  compress
  delaycompress
  notifempty
  create 0640 www-data adm
  sharedscripts
  postrotate
    [ -f /run/nginx.pid ] && kill -USR1 \$(cat /run/nginx.pid) 2>/dev/null || true
  endscript
}
EOF
log "logrotate: /etc/logrotate.d/zapai"

# ─── 6. Cron jobs ─────────────────────────────────────────────────────────────
step "6. Cron Jobs"
CRONTAB_FILE="/etc/cron.d/zapai"
cat > "$CRONTAB_FILE" << EOF
# ZAPAI Production Cron Jobs
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

# Auto-recovery: check every 5 minutes
*/5 * * * * $APP_USER bash $SCRIPTS_DIR/recovery.sh --dry-run >> $LOGS_DIR/backend/recovery_cron.log 2>&1

# Daily healthcheck report at 07:00
0 7 * * * $APP_USER node $SCRIPTS_DIR/healthcheck.js --json >> $LOGS_DIR/backend/healthcheck_daily.log 2>&1

# Session backup: daily at 03:00
0 3 * * * $APP_USER bash $SCRIPTS_DIR/backup-sessions.sh 2>/dev/null || true

# DB maintenance: weekly Sunday 04:00
0 4 * * 0 $APP_USER node $SCRIPTS_DIR/db-performance-maintenance.js 2>/dev/null || true
EOF
chmod 644 "$CRONTAB_FILE"
log "Cron: $CRONTAB_FILE"

# ─── 7. Session backup script ─────────────────────────────────────────────────
step "7. Session Backup Script"
cat > "$SCRIPTS_DIR/backup-sessions.sh" << 'BKPEOF'
#!/bin/bash
# Backup Baileys session auth state
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SESSIONS_DIR="$ROOT_DIR/sessions"
BACKUPS_DIR="${APP_DIR:-/opt/zapai}/backups/sessions"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

mkdir -p "$BACKUPS_DIR"
if [ -d "$SESSIONS_DIR" ] && [ "$(ls -A $SESSIONS_DIR 2>/dev/null)" ]; then
  tar czf "$BACKUPS_DIR/sessions_${TIMESTAMP}.tar.gz" -C "$ROOT_DIR" sessions/ 2>/dev/null
  echo "[backup] Sessions backed up: sessions_${TIMESTAMP}.tar.gz"
  # Keep last 7 backups
  ls -1t "$BACKUPS_DIR"/sessions_*.tar.gz 2>/dev/null | tail -n +8 | xargs rm -f
else
  echo "[backup] Sessions directory empty — skipping"
fi
BKPEOF
chmod +x "$SCRIPTS_DIR/backup-sessions.sh"
log "Session backup script created"

# ─── 8. Nginx logs to /opt/zapai/logs/nginx ───────────────────────────────────
step "8. Nginx Log Symlinks"
if command -v nginx >/dev/null 2>&1; then
  NGINX_LOG_DIR="/var/log/nginx"
  if [ -d "$NGINX_LOG_DIR" ]; then
    ln -sf "$NGINX_LOG_DIR/access.log" "$LOGS_DIR/nginx/access.log" 2>/dev/null || true
    ln -sf "$NGINX_LOG_DIR/error.log"  "$LOGS_DIR/nginx/error.log"  2>/dev/null || true
    log "Nginx logs symlinked to $LOGS_DIR/nginx/"
  fi
fi

# ─── 9. UFW firewall ──────────────────────────────────────────────────────────
step "9. Firewall (UFW)"
if command -v ufw >/dev/null 2>&1; then
  ufw allow 22/tcp   comment "SSH"    2>/dev/null || true
  ufw allow 80/tcp   comment "HTTP"   2>/dev/null || true
  ufw allow 443/tcp  comment "HTTPS"  2>/dev/null || true
  # Block direct backend access from public (only nginx proxies)
  ufw deny 4025/tcp  comment "Block direct backend access" 2>/dev/null || true
  log "UFW: 22/80/443 open, 4025 blocked from public"
else
  warn "UFW not found — configure firewall manually"
fi

# ─── Done ────────────────────────────────────────────────────────────────────
echo ""
echo "============================================================"
echo -e "${GREEN}  VPS SETUP COMPLETE${NC}"
echo ""
echo "  Next steps:"
echo "  1. cd $APP_DIR"
echo "  2. git pull origin main"
echo "  3. bash deploy/auto-deploy.sh"
echo "  4. pm2 status"
echo "  5. node $SCRIPTS_DIR/healthcheck.js"
echo "============================================================"
