#!/usr/bin/env bash
# ============================================================
# ZAPFLOW AI — restart.sh
# Restart all containers or a specific service
# Usage: ./scripts/restart.sh [service]
# Examples:
#   ./scripts/restart.sh           # restart all
#   ./scripts/restart.sh backend   # restart only backend
#   ./scripts/restart.sh nginx     # restart only nginx
# ============================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/docker-compose.production.yml"
SERVICE="${1:-}"

GREEN='\033[0;32m'; NC='\033[0m'
info() { echo -e "${GREEN}[RESTART]${NC} $*"; }

cd "$REPO_ROOT"

if [[ -n "$SERVICE" ]]; then
  info "Reiniciando serviço: $SERVICE"
  docker compose -f "$COMPOSE_FILE" restart "$SERVICE"
else
  info "Reiniciando todos os serviços..."
  docker compose -f "$COMPOSE_FILE" restart
fi

info "Status após reinício:"
docker compose -f "$COMPOSE_FILE" ps

# Quick health check
sleep 5
if curl -sf "http://localhost/api/health" >/dev/null 2>&1; then
  info "Sistema saudável após reinício ✓"
else
  info "Sistema ainda inicializando — aguarde alguns segundos e verifique ./scripts/logs.sh backend"
fi
