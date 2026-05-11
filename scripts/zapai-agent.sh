#!/bin/bash
# ==============================================================================
# ZAPFLOW AI — NODE AGENT
# Runs as a daemon on worker VPS nodes.
# Auto-registers with master, sends heartbeats + metrics.
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Configuration ─────────────────────────────────────────────
MASTER_URL="${ZAPAI_MASTER_URL:-}"
REGISTRATION_TOKEN="${ZAPAI_REGISTRATION_TOKEN:-}"
AGENT_STATE_FILE="$SCRIPT_DIR/.zapai-agent-state"
HEARTBEAT_INTERVAL=15
METRICS_INTERVAL=30

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

log()  { echo -e "${GREEN}[agent] $1${NC}"; }
warn() { echo -e "${YELLOW}[agent] $1${NC}"; }
err()  { echo -e "${RED}[agent] $1${NC}"; }

# ── Gather system info ───────────────────────────────────────
get_node_info() {
  PUBLIC_IP=$(curl -4 -s --max-time 5 ifconfig.me 2>/dev/null || echo "unknown")
  HOSTNAME=$(hostname 2>/dev/null || echo "unknown")
  DOCKER_VER=$(docker --version 2>/dev/null | cut -d' ' -f3 | tr -d ',' || echo "unknown")
  COMPOSE_VER=$(docker compose version 2>/dev/null | cut -d' ' -f4 || echo "unknown")
  NODE_VER=$(node --version 2>/dev/null || echo "unknown")
  OS_INFO=$(cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d'"' -f2 || echo "unknown")
  KERNEL=$(uname -r 2>/dev/null || echo "unknown")
  BUILD_HASH=$(cd "$SCRIPT_DIR" && git rev-parse --short HEAD 2>/dev/null || echo "unknown")
}

# ── Register with master ─────────────────────────────────────
register_node() {
  log "Registering with master: $MASTER_URL"

  RESPONSE=$(curl -s --max-time 10 \
    -X POST "$MASTER_URL/api/master/register-node" \
    -H "Content-Type: application/json" \
    -H "x-registration-token: $REGISTRATION_TOKEN" \
    -d "{
      \"hostname\": \"$HOSTNAME\",
      \"ip\": \"$PUBLIC_IP\",
      \"version\": \"$BUILD_HASH\",
      \"port\": 4025,
      \"docker_version\": \"$DOCKER_VER\",
      \"compose_version\": \"$COMPOSE_VER\",
      \"node_version\": \"$NODE_VER\",
      \"os_info\": \"$OS_INFO\",
      \"kernel\": \"$KERNEL\"
    }" 2>/dev/null || echo '{"success":false}')

  SUCCESS=$(echo "$RESPONSE" | jq -r '.success // false' 2>/dev/null || echo "false")

  if [ "$SUCCESS" = "true" ]; then
    NODE_ID=$(echo "$RESPONSE" | jq -r '.node.node_id // ""')
    NODE_TOKEN=$(echo "$RESPONSE" | jq -r '.token // ""')

    # Save state
    cat > "$AGENT_STATE_FILE" <<EOF
NODE_ID=$NODE_ID
NODE_TOKEN=$NODE_TOKEN
MASTER_URL=$MASTER_URL
EOF
    log "Registered as: $NODE_ID"
    return 0
  else
    err "Registration failed: $RESPONSE"
    return 1
  fi
}

# ── Load saved state ─────────────────────────────────────────
load_state() {
  if [ -f "$AGENT_STATE_FILE" ]; then
    source "$AGENT_STATE_FILE"
    return 0
  fi
  return 1
}

# ── Collect metrics ──────────────────────────────────────────
collect_metrics() {
  CPU=$(top -bn1 2>/dev/null | grep "Cpu(s)" | awk '{print $2}' || echo "0")
  MEM_TOTAL=$(free -m 2>/dev/null | awk '/Mem:/{print $2}' || echo "0")
  MEM_USED=$(free -m 2>/dev/null | awk '/Mem:/{print $3}' || echo "0")
  MEM_PERCENT=$(echo "scale=1; $MEM_USED * 100 / ($MEM_TOTAL + 1)" | bc 2>/dev/null || echo "0")
  DISK_PERCENT=$(df -h / 2>/dev/null | awk 'NR==2{print $5}' | tr -d '%' || echo "0")
  UPTIME_SECONDS=$(cat /proc/uptime 2>/dev/null | cut -d' ' -f1 | cut -d'.' -f1 || echo "0")
  DOCKER_CONTAINERS=$(docker ps -q 2>/dev/null | wc -l || echo "0")

  cat <<EOF
{
  "node_id": "$NODE_ID",
  "metrics": [
    {"type": "cpu", "name": "cpu.usage", "value": $CPU, "unit": "percent"},
    {"type": "ram", "name": "ram.total_mb", "value": $MEM_TOTAL, "unit": "mb"},
    {"type": "ram", "name": "ram.used_mb", "value": $MEM_USED, "unit": "mb"},
    {"type": "ram", "name": "ram.usage", "value": $MEM_PERCENT, "unit": "percent"},
    {"type": "disk", "name": "disk.usage", "value": $DISK_PERCENT, "unit": "percent"},
    {"type": "system", "name": "system.uptime", "value": $UPTIME_SECONDS, "unit": "seconds"},
    {"type": "docker", "name": "docker.containers_running", "value": $DOCKER_CONTAINERS, "unit": "count"}
  ]
}
EOF
}

# ── Send heartbeat ───────────────────────────────────────────
send_heartbeat() {
  CPU=$(top -bn1 2>/dev/null | grep "Cpu(s)" | awk '{print $2}' || echo "0")
  MEM_PERCENT=$(free 2>/dev/null | awk '/Mem:/{printf "%.1f", $3/$2*100}' || echo "0")
  DISK_PERCENT=$(df / 2>/dev/null | awk 'NR==2{print $5}' | tr -d '%' || echo "0")
  UPTIME=$(cat /proc/uptime 2>/dev/null | cut -d' ' -f1 | cut -d'.' -f1 || echo "0")

  curl -s --max-time 5 \
    -X POST "$MASTER_URL/api/master/heartbeat" \
    -H "Content-Type: application/json" \
    -H "x-node-token: $NODE_TOKEN" \
    -d "{
      \"node_id\": \"$NODE_ID\",
      \"version\": \"$BUILD_HASH\",
      \"metrics\": {
        \"cpu\": {\"usage\": $CPU},
        \"ram\": {\"usage\": $MEM_PERCENT},
        \"disk\": {\"usedPercent\": $DISK_PERCENT},
        \"uptime\": {\"seconds\": $UPTIME}
      }
    }" > /dev/null 2>&1
}

# ── Send metrics ─────────────────────────────────────────────
send_metrics() {
  PAYLOAD=$(collect_metrics)

  curl -s --max-time 5 \
    -X POST "$MASTER_URL/api/cluster/metrics/ingest" \
    -H "Content-Type: application/json" \
    -H "x-node-token: $NODE_TOKEN" \
    -d "$PAYLOAD" > /dev/null 2>&1
}

# ── Main loop ────────────────────────────────────────────────
main() {
  echo ""
  echo -e "${CYAN}━━━ ZAPFLOW AI NODE AGENT ━━━${NC}"
  echo ""

  if [ -z "$MASTER_URL" ]; then
    err "ZAPAI_MASTER_URL not set. Usage:"
    echo "  ZAPAI_MASTER_URL=http://master-ip:3000 ZAPAI_REGISTRATION_TOKEN=xxx bash scripts/zapai-agent.sh"
    exit 1
  fi

  get_node_info
  log "IP: $PUBLIC_IP | Host: $HOSTNAME | Docker: $DOCKER_VER"

  # Try loading saved state, or register
  if load_state && [ -n "$NODE_ID" ] && [ -n "$NODE_TOKEN" ]; then
    log "Resuming as: $NODE_ID"
  else
    register_node || exit 1
  fi

  log "Starting heartbeat loop (${HEARTBEAT_INTERVAL}s) and metrics (${METRICS_INTERVAL}s)..."

  METRICS_COUNTER=0

  while true; do
    send_heartbeat && true
    METRICS_COUNTER=$((METRICS_COUNTER + HEARTBEAT_INTERVAL))

    if [ $METRICS_COUNTER -ge $METRICS_INTERVAL ]; then
      send_metrics && true
      METRICS_COUNTER=0
    fi

    sleep $HEARTBEAT_INTERVAL
  done
}

main "$@"
