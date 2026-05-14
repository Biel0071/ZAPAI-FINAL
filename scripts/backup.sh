#!/usr/bin/env bash
# ============================================================
# ZAPFLOW AI — backup.sh
# Creates a full backup: DB, uploads, sessions, logs, .env
# Usage: ./scripts/backup.sh
# ============================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/docker-compose.production.yml"
TIMESTAMP=$(date '+%Y-%m-%d-%H-%M')
BACKUP_DIR="$REPO_ROOT/backups"
BACKUP_FILE="$BACKUP_DIR/zapflow-backup-${TIMESTAMP}.tar.gz"
TEMP_DIR="$(mktemp -d)"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[BACKUP]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }

cleanup() { rm -rf "$TEMP_DIR"; }
trap cleanup EXIT

mkdir -p "$BACKUP_DIR"

info "========================================"
info "  ZAPFLOW AI — Backup"
info "  Destino: $BACKUP_FILE"
info "  $(date '+%Y-%m-%d %H:%M:%S')"
info "========================================"

# ── 1. Backup PostgreSQL ─────────────────────────────────────
info "Fazendo dump do banco de dados..."
mkdir -p "$TEMP_DIR/db"

if docker compose -f "$COMPOSE_FILE" ps postgres 2>/dev/null | grep -q "running\|Up"; then
  docker compose -f "$COMPOSE_FILE" exec -T postgres \
    pg_dumpall -U "${POSTGRES_USER:-zapai}" \
    > "$TEMP_DIR/db/zapflow-db-${TIMESTAMP}.sql" 2>/dev/null \
    && info "Dump do banco concluído." \
    || warn "Dump do banco falhou — banco pode estar offline."
else
  # Try standalone pg_dump if postgres is available locally
  if [[ -f "$REPO_ROOT/backups/postgres" ]]; then
    cp -r "$REPO_ROOT/backups/postgres" "$TEMP_DIR/db/" 2>/dev/null || true
  fi
  warn "Container postgres não está rodando — backup do banco ignorado."
fi

# ── 2. Backup uploads ────────────────────────────────────────
info "Copiando uploads..."
for dir in uploads media upload; do
  if [[ -d "$REPO_ROOT/backend/$dir" ]]; then
    cp -r "$REPO_ROOT/backend/$dir" "$TEMP_DIR/" 2>/dev/null || true
  fi
  if [[ -d "$REPO_ROOT/$dir" ]]; then
    cp -r "$REPO_ROOT/$dir" "$TEMP_DIR/" 2>/dev/null || true
  fi
done

# ── 3. Backup WhatsApp sessions ──────────────────────────────
info "Copiando sessões WhatsApp..."
for dir in sessions data; do
  if [[ -d "$REPO_ROOT/backend/$dir" ]]; then
    mkdir -p "$TEMP_DIR/whatsapp"
    cp -r "$REPO_ROOT/backend/$dir" "$TEMP_DIR/whatsapp/" 2>/dev/null || true
  fi
done

# ── 4. Backup logs ───────────────────────────────────────────
info "Copiando logs recentes..."
mkdir -p "$TEMP_DIR/logs"
if [[ -d "$REPO_ROOT/logs" ]]; then
  find "$REPO_ROOT/logs" -name "*.log" -newer "$BACKUP_DIR" -exec cp {} "$TEMP_DIR/logs/" \; 2>/dev/null || true
fi

# ── 5. Backup .env ───────────────────────────────────────────
info "Copiando arquivos de configuração..."
mkdir -p "$TEMP_DIR/config"
[[ -f "$REPO_ROOT/.env" ]]            && cp "$REPO_ROOT/.env" "$TEMP_DIR/config/.env"
[[ -f "$REPO_ROOT/backend/.env" ]]    && cp "$REPO_ROOT/backend/.env" "$TEMP_DIR/config/backend.env"
[[ -f "$REPO_ROOT/frontend-official/.env.production" ]] && \
  cp "$REPO_ROOT/frontend-official/.env.production" "$TEMP_DIR/config/frontend.env.production"

# ── 6. Create tarball ────────────────────────────────────────
info "Comprimindo backup..."
tar -czf "$BACKUP_FILE" -C "$TEMP_DIR" . 2>/dev/null

BACKUP_SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
info "Backup criado: $BACKUP_FILE ($BACKUP_SIZE)"

# ── 7. Rotate old backups (keep last 7) ──────────────────────
info "Removendo backups antigos (mantendo os 7 mais recentes)..."
ls -t "$BACKUP_DIR"/zapflow-backup-*.tar.gz 2>/dev/null | tail -n +8 | xargs rm -f 2>/dev/null || true

info "Backup concluído!"
