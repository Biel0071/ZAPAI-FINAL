# ZAPAI Install Library — node.sh
# Node.js installer logic.

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
