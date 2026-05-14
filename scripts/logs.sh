#!/usr/bin/env bash
# ============================================================
# ZAPFLOW AI — logs.sh
# Stream or view logs for any service
# Usage: ./scripts/logs.sh [service] [lines]
# Examples:
#   ./scripts/logs.sh              # all services, follow
#   ./scripts/logs.sh backend      # backend logs, follow
#   ./scripts/logs.sh nginx 50     # nginx, last 50 lines
#   ./scripts/logs.sh backend 100  # backend, last 100 lines
# ============================================================

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/docker-compose.production.yml"
SERVICE="${1:-}"
LINES="${2:-100}"

cd "$REPO_ROOT"

if [[ -n "$SERVICE" ]]; then
  echo "=== Logs do serviço: $SERVICE (últimas $LINES linhas) ==="
  docker compose -f "$COMPOSE_FILE" logs --tail="$LINES" -f "$SERVICE"
else
  echo "=== Logs de todos os serviços (últimas $LINES linhas) ==="
  docker compose -f "$COMPOSE_FILE" logs --tail="$LINES" -f
fi
