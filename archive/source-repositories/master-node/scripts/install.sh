#!/usr/bin/env bash
set -euo pipefail

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

APP_DIR="${APP_DIR:-/opt/zapai}"
REPO_URL="${REPO_URL:-https://github.com/Biel0071/ZAPAI-FINAL.git}"
REPO_BRANCH="${REPO_BRANCH:-main}"
MASTER_API_URL="${MASTER_API_URL:-http://127.0.0.1:5000/api}"
NODE_REGISTRATION_TOKEN="${NODE_REGISTRATION_TOKEN:-}"
CLIENT_ID="${CLIENT_ID:-default-client}"
CLIENT_NAME="${CLIENT_NAME:-Default Client}"
NODE_DOMAIN="${NODE_DOMAIN:-}"
NODE_NAME="${NODE_NAME:-$(hostname)}"

log() { echo -e "${BLUE}[INSTALL]${NC} $*"; }
ok() { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
err() { echo -e "${RED}[ERR]${NC} $*"; exit 1; }

if [[ "$EUID" -ne 0 ]]; then
  err "Execute como root: sudo bash install.sh"
fi

log "[1/9] Instalando dependências de sistema"
apt-get update -y
apt-get install -y curl jq git ca-certificates gnupg lsb-release ufw

log "[2/9] Instalando Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable docker
systemctl start docker

log "[3/9] Validando Docker Compose plugin"
if ! docker compose version >/dev/null 2>&1; then
  err "Docker Compose plugin ausente. Instale pacote docker-compose-plugin."
fi

log "[4/9] Baixando projeto"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch --all
  git -C "$APP_DIR" checkout "$REPO_BRANCH"
  git -C "$APP_DIR" pull --rebase origin "$REPO_BRANCH"
else
  rm -rf "$APP_DIR"
  git clone --branch "$REPO_BRANCH" "$REPO_URL" "$APP_DIR"
fi

log "[5/9] Preparando pastas e env"
mkdir -p "$APP_DIR/logs" "$APP_DIR/logs/deploy" "$APP_DIR/backups"
mkdir -p "$APP_DIR/backend/sessions" "$APP_DIR/backend/uploads" "$APP_DIR/backend/logs"

if [ ! -f "$APP_DIR/.env.production" ]; then
  if [ -f "$APP_DIR/.env.production.example" ]; then
    cp "$APP_DIR/.env.production.example" "$APP_DIR/.env.production"
    warn "Arquivo .env.production criado do exemplo. Ajuste secrets quando necessário."
  else
    err "Arquivo .env.production.example não encontrado"
  fi
fi

log "[6/9] Subindo stack principal"
docker compose --env-file "$APP_DIR/.env.production" -f "$APP_DIR/docker-compose.production.yml" up -d --build

log "[7/9] Instalando node-agent"
cd "$APP_DIR/master-node/agent"
npm ci --omit=dev

cat > /etc/zapai-node-agent.env <<EOF
MASTER_API_URL=${MASTER_API_URL}
NODE_REGISTRATION_TOKEN=${NODE_REGISTRATION_TOKEN}
LOCAL_API_PORT=4025
HEARTBEAT_INTERVAL=30000
NODE_NAME=${NODE_NAME}
NODE_DOMAIN=${NODE_DOMAIN}
CLIENT_ID=${CLIENT_ID}
CLIENT_NAME=${CLIENT_NAME}
NODE_AGENT_LOG_FILE=${APP_DIR}/logs/node-agent.log
NODE_CREDENTIALS_PATH=${APP_DIR}/master-node/agent/.agent-credentials.json
EOF

cat > /etc/systemd/system/zapai-node-agent.service <<EOF
[Unit]
Description=ZapAI Node Agent
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${APP_DIR}/master-node/agent
EnvironmentFile=/etc/zapai-node-agent.env
ExecStart=/usr/bin/node ${APP_DIR}/master-node/agent/agent.js
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable zapai-node-agent
systemctl restart zapai-node-agent

log "[8/9] Liberando firewall"
ufw allow 22/tcp || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
ufw allow 4025/tcp || true
ufw --force enable || true

log "[9/9] Healthcheck final"
for _ in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:4025/health >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

curl -fsS http://127.0.0.1:4025/health >/dev/null 2>&1 || err "Backend healthcheck falhou"
systemctl is-active --quiet zapai-node-agent || err "Serviço zapai-node-agent não está ativo"

ok "Instalação concluída"
ok "Agent: systemctl status zapai-node-agent"
ok "Logs agent: journalctl -u zapai-node-agent -f"
