#!/bin/bash
# ==============================================================================
# ZAPAI — Installer Test Suite
# Valida a sintaxe e a integridade de todos os componentes de deploy.
# ==============================================================================

set -euo pipefail

SCRIPT_SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd)"
LIB_DIR="$SCRIPT_SELF_DIR/lib"

# Colors for log formatting
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${GREEN}[TEST-OK] ✔ $*${NC}"; }
warn() { echo -e "${YELLOW}[TEST-WARN] ⚠ $*${NC}"; }
err()  { echo -e "${RED}[TEST-FAIL] ✖ $*${NC}"; exit 1; }

log "Iniciando testes automatizados do instalador do ZapAI..."

# 1. Verificar existencia de todos os arquivos
echo "  ── Verificando arquivos da biblioteca ─────────────────"
MODULES=(
  "common.sh"
  "os.sh"
  "packages.sh"
  "node.sh"
  "postgres.sh"
  "redis.sh"
  "nginx.sh"
  "pm2.sh"
  "firewall.sh"
  "env.sh"
  "health.sh"
  "utils.sh"
  "validate.sh"
)

for mod in "${MODULES[@]}"; do
  file_path="$LIB_DIR/$mod"
  if [ ! -f "$file_path" ]; then
    err "Módulo ausente: $file_path"
  fi
  log "Módulo localizado: lib/$mod"
done

# 2. Verificar sintaxe de todos os arquivos bash
echo "  ── Verificando sintaxe Bash (bash -n) ──────────────────"
if ! bash -n "$SCRIPT_SELF_DIR/install.sh"; then
  err "Erro de sintaxe no arquivo install.sh"
fi
log "Sintaxe de install.sh OK"

for mod in "${MODULES[@]}"; do
  if ! bash -n "$LIB_DIR/$mod"; then
    err "Erro de sintaxe no módulo lib/$mod"
  fi
  log "Sintaxe de lib/$mod OK"
done

# 3. Simular e validar a arquitetura e imports do instalador
echo "  ── Simulando imports e declare de funções ──────────────"

# Definimos variáveis vazias globais necessárias para os scripts rodarem em modo teste
DOMAIN=""
SKIP_POSTGRES=false
SKIP_REDIS=false
APP_USER="zapai"
APP_DIR="/opt/zapai"
NODE_VERSION="20"
REPO_URL=""
BACKEND_DIR=""
FRONTEND_DIR=""
LOGS_DIR=""
DEPLOY_DIR=""
RELEASES_DIR=""
OS_FAMILY="debian"
OS_NAME="Debian/Ubuntu"
PUBLIC_IP="127.0.0.1"
PUBLIC_URL="http://127.0.0.1"
PANEL_SAFE_MODE=false
DETECTED_PANEL=""
PREFERRED_PORT="4025"
BACKEND_PORT="4025"
DB_PASS="zapai123"
ADMIN_USERNAME="zapadmin"
ADMIN_PASSWORD="zapadmin1010"
ADMIN_EMAIL="zapadmin@zapai.local"
REDIS_SVC="redis-server"
JWT_SECRET=""
SESSION_SECRET=""
START_TIME="$(date +%s)"

# Import helpers without executing them
for mod in "${MODULES[@]}"; do
  # shellcheck disable=SC1090
  source "$LIB_DIR/$mod"
done

# Run function validation check
validate_all_functions_exist

# 4. Validar os comandos requeridos de cada módulo (verificações locais)
echo "  ── Verificando ambiente actual ─────────────────────────"
local_os="debian"
if [ -f /etc/os-release ]; then
  local_os=$(. /etc/os-release && echo "$ID")
fi
log "Sistema operacional simulado localmente: $local_os"

echo "============================================================"
log "✅ TODOS OS TESTES PASSARAM COM SUCESSO!"
echo "============================================================"
