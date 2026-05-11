#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/ZAPAI-FINAL"
LOG_FILE="/var/log/zapai-deploy.log"
NODE_MAJOR="20"

log() {
  echo "[INSTALL][$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

require_root() {
  if [ "${EUID:-$(id -u)}" -ne 0 ]; then
    echo "Execute como root: sudo bash install.sh"
    exit 1
  fi
}

install_node_lts() {
  if command -v node >/dev/null 2>&1; then
    current_major="$(node -v | sed 's/^v//' | cut -d. -f1)"
    if [ "$current_major" -ge "$NODE_MAJOR" ]; then
      log "Node.js já instalado: $(node -v)"
      return 0
    fi
  fi

  log "Instalando Node.js LTS ${NODE_MAJOR}.x"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
}

setup_pm2_boot() {
  log "Instalando/validando PM2"
  if ! command -v pm2 >/dev/null 2>&1; then
    npm install -g pm2
  fi

  log "Configurando PM2 no boot"
  pm2 startup systemd -u root --hp /root >/tmp/zapai-pm2-startup.txt 2>&1 || true
  systemctl enable pm2-root >/dev/null 2>&1 || true
}

main() {
  require_root

  log "Atualizando sistema"
  apt-get update -y
  DEBIAN_FRONTEND=noninteractive apt-get upgrade -y

  log "Instalando pacotes base"
  DEBIAN_FRONTEND=noninteractive apt-get install -y git curl ca-certificates nginx build-essential

  install_node_lts
  setup_pm2_boot

  log "Criando diretório do projeto"
  mkdir -p "$APP_DIR"
  chown -R root:root "$APP_DIR"
  chmod 755 "$APP_DIR"

  log "Criando log de deploy"
  touch "$LOG_FILE"
  chown root:root "$LOG_FILE"
  chmod 664 "$LOG_FILE"

  log "Configurando git safe.directory"
  git config --global --add safe.directory "$APP_DIR" || true

  log "Versões instaladas"
  git --version
  node -v
  npm -v
  pm2 -v
  nginx -v 2>&1

  log "Install concluído com sucesso"
}

main "$@"
