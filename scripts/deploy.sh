#!/usr/bin/env bash
# ============================================================
# ZAPFLOW AI — deploy.sh
# Deploy/update production: git pull → backup → build → up
# Usage: ./scripts/deploy.sh
# ============================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/docker-compose.production.yml"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[DEPLOY]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }

info "========================================"
info "  ZAPFLOW AI — Deploy"
info "  $(date '+%Y-%m-%d %H:%M:%S')"
info "========================================"

cd "$REPO_ROOT"

# ── 1. Git pull ──────────────────────────────────────────────
info "Atualizando código..."
git pull origin main || { warn "git pull falhou — continuando com código atual."; }

# ── 2. Backup antes do deploy ────────────────────────────────
info "Fazendo backup pré-deploy..."
"$REPO_ROOT/scripts/backup.sh" || warn "Backup falhou — continuando deploy."

# ── 3. Build frontend if needed ─────────────────────────────
FRONTEND_DIST="$REPO_ROOT/frontend-official/dist"
if [[ ! -f "$FRONTEND_DIST/index.html" ]]; then
  info "Rebuilding frontend..."
  cd "$REPO_ROOT/frontend-official"
  npm ci --prefer-offline 2>/dev/null || npm install
  VITE_API_URL=/api npm run build
  cd "$REPO_ROOT"
fi

# ── 4. Deploy containers ─────────────────────────────────────
info "Fazendo deploy dos containers..."
docker compose -f "$COMPOSE_FILE" up -d --build

info "Status pós-deploy:"
docker compose -f "$COMPOSE_FILE" ps

# ── 5. Health check ──────────────────────────────────────────
info "Verificando saúde do sistema..."
sleep 10

MAX_WAIT=90
ELAPSED=0
until curl -sf "http://localhost/api/health" >/dev/null 2>&1; do
  if [[ $ELAPSED -ge $MAX_WAIT ]]; then
    error "Backend não respondeu após ${MAX_WAIT}s!"
    info "=== Logs do backend ==="
    docker compose -f "$COMPOSE_FILE" logs --tail=30 backend
    info "=== Logs do nginx ==="
    docker compose -f "$COMPOSE_FILE" logs --tail=15 nginx
    exit 1
  fi
  sleep 5
  ELAPSED=$((ELAPSED + 5))
  echo -n "."
done
echo ""

HEALTH=$(curl -sf "http://localhost/api/health" 2>/dev/null | python3 -m json.tool 2>/dev/null || curl -sf "http://localhost/api/health")
info "Healthcheck: $HEALTH"

info "Deploy concluído com sucesso! ✓"
