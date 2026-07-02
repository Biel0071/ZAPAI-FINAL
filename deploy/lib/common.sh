# ZAPAI Install Library — common.sh
# Functions for logging, error handling, and parameter parsing.

# Colors for log formatting
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

log()  {
  echo -e "${GREEN}[INSTALL $(date +%H:%M:%S)] ✔ $*${NC}"
}

warn() {
  echo -e "${YELLOW}[INSTALL $(date +%H:%M:%S)] ⚠ $*${NC}"
}

err()  {
  echo -e "${RED}[INSTALL $(date +%H:%M:%S)] ✖ $*${NC}"
  exit 1
}

step() {
  echo -e "\n${CYAN}━━━ $* ━━━${NC}"
}

error_handler() {
  local exit_code=$?
  local line_no="$1"
  local bash_cmd="$2"
  echo -e "\n${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${RED}[ERRO CRÍTICO] FALHA NA INSTALAÇÃO!${NC}"
  echo -e "  Arquivo:      ${BASH_SOURCE[0]}"
  echo -e "  Linha:        ${line_no}"
  echo -e "  Comando:      ${bash_cmd}"
  echo -e "  Retorno:      ${exit_code}"
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
  exit "$exit_code"
}

check_requirements() {
  [[ $EUID -eq 0 ]] || err "Run as root: sudo bash deploy/install.sh"
}

parse_args() {
  local SCRIPT_SELF_DIR
  SCRIPT_SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd)"
  local REPO_ROOT
  REPO_ROOT="$(cd "$SCRIPT_SELF_DIR/../.." 2>/dev/null && pwd)"

  APP_USER="$(logname 2>/dev/null || echo 'zapai')"
  APP_DIR="$REPO_ROOT"
  REPO_URL="https://github.com/Biel0071/ZAPAI-FINAL.git"

  local arg
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
}
