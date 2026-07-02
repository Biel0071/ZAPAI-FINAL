# ZAPAI Install Library — packages.sh
# Package managers wrappers and installation step.

enable_service() {
  systemctl enable "$1" 2>/dev/null || true
}

start_service() {
  systemctl start "$1" 2>/dev/null || true
}

restart_service() {
  systemctl restart "$1" 2>/dev/null || true
}

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
