#!/usr/bin/env bash
# ============================================================
# ZAPFLOW AI — update.sh
# Update with migrations: backup → pull → migrate → rebuild
# Usage: ./scripts/update.sh
# ============================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/docker-compose.production.yml"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[UPDATE]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }

info "========================================"
info "  ZAPFLOW AI — Update"
info "  $(date '+%Y-%m-%d %H:%M:%S')"
info "========================================"

cd "$REPO_ROOT"

# ── 1. Backup ────────────────────────────────────────────────
info "Backup pré-update..."
"$REPO_ROOT/scripts/backup.sh" || warn "Backup falhou — continuando."

# ── 2. Git pull ──────────────────────────────────────────────
info "Puxando atualizações do repositório..."
git fetch origin
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [[ "$LOCAL" == "$REMOTE" ]]; then
  info "Código já está na versão mais recente."
else
  info "Atualizando de ${LOCAL:0:8} → ${REMOTE:0:8}..."
  git pull origin main
fi

# ── 3. Rebuild frontend ───────────────────────────────────────
info "Rebuilding frontend..."
cd "$REPO_ROOT/frontend-official"
npm ci --prefer-offline 2>/dev/null || npm install
VITE_API_URL=/api npm run build
cd "$REPO_ROOT"

# ── 4. Restart containers with rebuild ───────────────────────
info "Reconstruindo e reiniciando containers..."
docker compose -f "$COMPOSE_FILE" up -d --build

# ── 5. Run migrations (via backend auto-boot) ─────────────────
info "Aguardando backend executar migrations..."
sleep 15

# ── 6. Health check ──────────────────────────────────────────
MAX_WAIT=120
ELAPSED=0
until curl -sf "http://localhost/api/health" >/dev/null 2>&1; do
  if [[ $ELAPSED -ge $MAX_WAIT ]]; then
    error "Backend não respondeu após update!"
    docker compose -f "$COMPOSE_FILE" logs --tail=50 backend
    exit 1
  fi
  sleep 5
  ELAPSED=$((ELAPSED + 5))
  echo -n "."
done
echo ""

info "Update concluído! $(curl -sf http://localhost/api/health 2>/dev/null)"
docker compose -f "$COMPOSE_FILE" ps
