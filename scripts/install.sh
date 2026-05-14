#!/usr/bin/env bash
# ============================================================
# ZAPFLOW AI — install.sh
# Fresh VPS installation script
# Usage: ./scripts/install.sh
# Idempotent: safe to run multiple times
# ============================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/docker-compose.production.yml"
LOG_FILE="$REPO_ROOT/logs/install.log"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INSTALL]${NC} $*" | tee -a "$LOG_FILE"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"   | tee -a "$LOG_FILE"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"     | tee -a "$LOG_FILE"; }

mkdir -p "$REPO_ROOT/logs"

info "========================================"
info "  ZAPFLOW AI — Instalação VPS"
info "  $(date '+%Y-%m-%d %H:%M:%S')"
info "========================================"

# ── 1. Check OS ──────────────────────────────────────────────
if [[ ! -f /etc/os-release ]]; then
  warn "Não foi possível detectar o sistema operacional."
fi

# ── 2. Install dependencies ──────────────────────────────────
info "Verificando dependências..."

install_if_missing() {
  local cmd="$1"; local pkg="${2:-$1}"
  if ! command -v "$cmd" &>/dev/null; then
    info "Instalando $pkg..."
    if command -v apt-get &>/dev/null; then
      apt-get update -qq && apt-get install -y -qq "$pkg"
    elif command -v yum &>/dev/null; then
      yum install -y "$pkg"
    else
      error "Gerenciador de pacotes não suportado. Instale $pkg manualmente."
      exit 1
    fi
  else
    info "$cmd já está instalado."
  fi
}

install_if_missing git
install_if_missing curl
install_if_missing wget

# Docker
if ! command -v docker &>/dev/null; then
  info "Instalando Docker..."
  curl -fsSL https://get.docker.com | bash
  systemctl enable docker --now || true
else
  info "Docker já está instalado: $(docker --version)"
fi

# Docker Compose plugin
if ! docker compose version &>/dev/null 2>&1; then
  info "Instalando Docker Compose plugin..."
  mkdir -p /usr/local/lib/docker/cli-plugins
  COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep '"tag_name"' | cut -d'"' -f4)
  curl -SL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-$(uname -m)" \
    -o /usr/local/lib/docker/cli-plugins/docker-compose
  chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
else
  info "Docker Compose já está instalado: $(docker compose version)"
fi

# ── 3. Create directories ────────────────────────────────────
info "Criando diretórios necessários..."
mkdir -p "$REPO_ROOT"/{data,logs,uploads,backups,backups/postgres}
mkdir -p "$REPO_ROOT/logs/backend"

# ── 4. Setup .env ────────────────────────────────────────────
info "Configurando variáveis de ambiente..."
if [[ ! -f "$REPO_ROOT/.env" ]]; then
  if [[ -f "$REPO_ROOT/.env.example" ]]; then
    cp "$REPO_ROOT/.env.example" "$REPO_ROOT/.env"
    info ".env criado a partir de .env.example"
  else
    warn ".env.example não encontrado — crie o .env manualmente antes de continuar."
  fi
else
  info ".env já existe, mantendo."
fi

# Auto-generate secrets if empty
generate_secret() {
  local key="$1"
  local current
  current=$(grep -E "^${key}=" "$REPO_ROOT/.env" 2>/dev/null | cut -d'=' -f2- | tr -d '"' | xargs || true)
  if [[ -z "$current" ]] || echo "$current" | grep -qi "CHANGE_ME"; then
    local secret
    secret=$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1)
    if grep -q "^${key}=" "$REPO_ROOT/.env" 2>/dev/null; then
      sed -i "s|^${key}=.*|${key}=${secret}|" "$REPO_ROOT/.env"
    else
      echo "${key}=${secret}" >> "$REPO_ROOT/.env"
    fi
    info "Gerado: $key"
  fi
}

generate_secret JWT_SECRET
generate_secret AUTH_JWT_SECRET
generate_secret MASTER_PANEL_TOKEN
generate_secret NODE_REGISTRATION_TOKEN

# ── 5. Build frontend ────────────────────────────────────────
info "Verificando build do frontend..."
FRONTEND_DIST="$REPO_ROOT/frontend-official/dist"
if [[ ! -d "$FRONTEND_DIST" ]] || [[ ! -f "$FRONTEND_DIST/index.html" ]]; then
  info "Build do frontend necessário..."
  if command -v node &>/dev/null; then
    cd "$REPO_ROOT/frontend-official"
    npm install --prefer-offline 2>/dev/null || npm install
    VITE_API_URL=/api npm run build
    cd "$REPO_ROOT"
    info "Frontend buildado com sucesso!"
  else
    warn "Node.js não disponível fora do Docker. O build será feito no container."
  fi
else
  info "Build do frontend encontrado."
fi

# ── 6. Start containers ──────────────────────────────────────
info "Iniciando containers..."
cd "$REPO_ROOT"
docker compose -f "$COMPOSE_FILE" pull --quiet 2>/dev/null || true
docker compose -f "$COMPOSE_FILE" up -d --build

# ── 7. Wait for backend ──────────────────────────────────────
info "Aguardando backend ficar online..."
MAX_WAIT=120
ELAPSED=0
until curl -sf "http://localhost/api/health" >/dev/null 2>&1; do
  if [[ $ELAPSED -ge $MAX_WAIT ]]; then
    warn "Backend não respondeu em ${MAX_WAIT}s. Verificando logs..."
    docker compose -f "$COMPOSE_FILE" logs --tail=30 backend
    error "Backend não iniciou. Verifique os logs acima."
    exit 1
  fi
  sleep 5
  ELAPSED=$((ELAPSED + 5))
  echo -n "."
done
echo ""

# ── 8. Health check ──────────────────────────────────────────
info "Testando healthcheck..."
HEALTH=$(curl -sf "http://localhost/api/health" 2>/dev/null || echo '{}')
info "Response: $HEALTH"

# ── 9. Show status ───────────────────────────────────────────
info "Status dos containers:"
docker compose -f "$COMPOSE_FILE" ps

info "========================================"
info "  ZAPFLOW AI instalado com sucesso!"
info ""
info "  URL: http://$(curl -sf4 ifconfig.io 2>/dev/null || echo 'SEU_IP')"
info "  Saúde: curl http://localhost/api/health"
info "  Logs:  ./scripts/logs.sh"
info "========================================"
