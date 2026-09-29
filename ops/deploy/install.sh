#!/bin/bash
# ==============================================================================
# ZAPAI — Full VPS Install Script  (v3 — Modular Enterprise Layout)
# Instala TUDO do zero e coloca o sistema ONLINE automaticamente.
#
# Uso:
#   sudo bash deploy/install.sh
#   sudo bash deploy/install.sh --domain=meudominio.com
#   sudo bash deploy/install.sh --skip-postgres   (usa Docker Postgres)
#   sudo bash deploy/install.sh --skip-redis      (usa Docker Redis)
# ==============================================================================

set -euo pipefail

# ─── Global Configuration Variables ──────────────────────────────────────────
DOMAIN=""
SKIP_POSTGRES=false
SKIP_REDIS=false
APP_USER=""
APP_DIR=""
NODE_VERSION="20"
REPO_URL=""
BACKEND_DIR=""
FRONTEND_DIR=""
LOGS_DIR=""
DEPLOY_DIR=""
RELEASES_DIR=""
OS_FAMILY="debian"
OS_NAME="Debian/Ubuntu"
PUBLIC_IP=""
PUBLIC_URL=""
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

# Get script self path and lib directory
SCRIPT_SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd)"
LIB_DIR="$SCRIPT_SELF_DIR/lib"

# ─── Source Modules ───────────────────────────────────────────────────────────
# shellcheck disable=SC1091
source "$LIB_DIR/common.sh"
# shellcheck disable=SC1091
source "$LIB_DIR/os.sh"
# shellcheck disable=SC1091
source "$LIB_DIR/packages.sh"
# shellcheck disable=SC1091
source "$LIB_DIR/node.sh"
# shellcheck disable=SC1091
source "$LIB_DIR/postgres.sh"
# shellcheck disable=SC1091
source "$LIB_DIR/redis.sh"
# shellcheck disable=SC1091
source "$LIB_DIR/nginx.sh"
# shellcheck disable=SC1091
source "$LIB_DIR/pm2.sh"
# shellcheck disable=SC1091
source "$LIB_DIR/firewall.sh"
# shellcheck disable=SC1091
source "$LIB_DIR/env.sh"
# shellcheck disable=SC1091
source "$LIB_DIR/health.sh"
# shellcheck disable=SC1091
source "$LIB_DIR/utils.sh"
# shellcheck disable=SC1091
source "$LIB_DIR/validate.sh"

# Trap errors using error_handler from common.sh
trap 'error_handler ${LINENO} "$BASH_COMMAND"' ERR

# ─── Main Orchestrator Function ───────────────────────────────────────────────
main() {
  # 1. Self-audit of expected functions (fail-fast architecture)
  validate_all_functions_exist

  # 2. Check requirements, parameters, OS parameters and VPS audit
  check_requirements
  parse_args "$@"
  detect_os
  detect_panel
  detect_ip
  find_free_port "$PREFERRED_PORT"
  vps_environment_audit
  cleanup_old_installations

  # 3. Step execution in exact order
  install_packages
  install_node
  install_pm2
  install_postgres
  configure_postgres
  install_redis
  install_nginx
  configure_firewall
  generate_env
  install_backend
  run_migrations
  build_frontend
  configure_nginx
  configure_pm2
  health_checks
  show_summary
}

# Execute main
main "$@"
