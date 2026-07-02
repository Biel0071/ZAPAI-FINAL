# ZAPAI Install Library — firewall.sh
# Firewall configuration (UFW/Firewalld), fail2ban, logrotate configurations.

configure_firewall() {
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
