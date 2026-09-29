# ZAPAI Install Library — pm2.sh
# PM2 installation, configuration, cron setups, PM2 backend start.

install_pm2() {
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
}

configure_pm2() {
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
