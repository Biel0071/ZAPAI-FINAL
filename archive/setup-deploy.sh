#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/ZAPAI-FINAL"
REPO_DIR="/opt/repo.git"
LOG_FILE="/var/log/zapai-deploy.log"
HOOK_FILE="$REPO_DIR/hooks/post-receive"
PM2_APP="zapai-backend"

log() {
  echo "[SETUP-DEPLOY][$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

require_root() {
  if [ "${EUID:-$(id -u)}" -ne 0 ]; then
    echo "Execute como root: sudo bash setup-deploy.sh"
    exit 1
  fi
}

main() {
  require_root

  log "Criando diretórios"
  mkdir -p "$APP_DIR" "$REPO_DIR"
  touch "$LOG_FILE"
  chmod 664 "$LOG_FILE"

  if [ ! -d "$REPO_DIR/objects" ]; then
    log "Inicializando repositório bare em $REPO_DIR"
    git init --bare "$REPO_DIR"
  else
    log "Repositório bare já existe"
  fi

  log "Configurando git safe.directory"
  git config --global --add safe.directory "$APP_DIR" || true

  log "Criando hook post-receive"
  cat > "$HOOK_FILE" <<'HOOK'
#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/ZAPAI-FINAL"
REPO_DIR="/opt/repo.git"
LOG_FILE="/var/log/zapai-deploy.log"
PM2_APP="zapai-backend"
LOCK_FILE="/tmp/zapai-deploy.lock"

log() {
  echo "[DEPLOY][$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

fail() {
  log "ERRO: $*"
  exit 1
}

resolve_port() {
  if [ -n "${PORT:-}" ]; then
    echo "$PORT"
    return
  fi

  if [ -n "${BACKEND_PORT:-}" ]; then
    echo "$BACKEND_PORT"
    return
  fi

  if [ -f "$APP_DIR/.env.production" ]; then
    value="$(grep -E '^PORT=' "$APP_DIR/.env.production" | tail -1 | cut -d= -f2- | tr -d '"' || true)"
    if [ -n "$value" ]; then
      echo "$value"
      return
    fi
  fi

  echo "4025"
}

health_check() {
  port="$(resolve_port)"
  curl -fsS "http://127.0.0.1:${port}/api/health" >/tmp/zapai-health.out 2>/tmp/zapai-health.err
}

main() {
  exec 9>"$LOCK_FILE"
  if ! flock -n 9; then
    fail "Deploy já em execução"
  fi

  log "============================="
  log "Deploy iniciado"

  mkdir -p "$APP_DIR"

  log "Atualizando código em $APP_DIR"
  git --work-tree="$APP_DIR" --git-dir="$REPO_DIR" checkout -f

  cd "$APP_DIR"

  if [ ! -f "deploy.sh" ]; then
    fail "deploy.sh não encontrado em $APP_DIR"
  fi

  chmod +x deploy.sh

  log "Executando deploy.sh"
  bash deploy.sh

  log "Garantindo PM2 online"
  if pm2 describe "$PM2_APP" >/dev/null 2>&1; then
    pm2 restart "$PM2_APP" --update-env
  else
    pm2 start backend/server.js --name "$PM2_APP" --update-env
  fi

  pm2 save || true

  log "Validando API /api/health"
  for i in $(seq 1 20); do
    if health_check; then
      log "API online"
      cat /tmp/zapai-health.out | tee -a "$LOG_FILE" || true
      log "Deploy finalizado com sucesso"
      log "============================="
      exit 0
    fi
    log "Aguardando API subir tentativa $i/20"
    sleep 3
  done

  log "Falha no healthcheck"
  cat /tmp/zapai-health.err | tee -a "$LOG_FILE" || true
  pm2 logs "$PM2_APP" --lines 80 --nostream | tee -a "$LOG_FILE" || true
  fail "API não respondeu em /api/health"
}

main "$@"
HOOK

  chmod +x "$HOOK_FILE"
  chown -R root:root "$REPO_DIR" "$APP_DIR"

  log "Setup concluído"
  log "Remote local: git remote add production root@209.50.229.68:/opt/repo.git"
}

main "$@"
