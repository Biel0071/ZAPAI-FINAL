# ZAPAI Install Library — os.sh
# Functions for operating system detection and control panel discovery.

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
