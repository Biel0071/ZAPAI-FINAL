# ZAPAI Install Library — utils.sh
# Port checking, directory archiving, and snapshot utilities.

find_free_port() {
  local start=$1
  local port=$start
  while [ "$port" -lt $((start + 100)) ]; do
    if ! ss -tlnp 2>/dev/null | grep -q ":${port} " && \
       ! lsof -i ":${port}" >/dev/null 2>&1; then
      BACKEND_PORT="$port"
      return 0
    fi
    port=$((port + 1))
  done
  BACKEND_PORT="$start"
}

cleanup_old_installations() {
  step "0. CLEANUP OLD INSTALLATIONS"
  local dead_path
  local DEAD_PATHS=(
    "/opt/zapai-frontend"
    "/var/www/zapai"
    "/var/www/html/zapai"
    "/opt/zapai-old"
  )
  for dead_path in "${DEAD_PATHS[@]}"; do
    if [ -d "$dead_path" ] && \
       [ "$dead_path" != "$APP_DIR" ] && \
       [ "$dead_path" != "$DEPLOY_DIR" ] && \
       [ "$dead_path" != "$BACKEND_DIR" ] && \
       [ "$dead_path" != "$FRONTEND_DIR" ]; then
      warn "Dead installation: $dead_path — archiving"
      mkdir -p /opt/zapai-archive
      mv "$dead_path" "/opt/zapai-archive/$(basename "$dead_path")_$(date +%Y%m%d_%H%M%S)" 2>/dev/null || true
      log "Archived: $dead_path"
    fi
  done

  if command -v pm2 >/dev/null 2>&1; then
    local running_apps
    running_apps=$(pm2 jlist 2>/dev/null | python3 -c \
      "import sys,json; procs=json.load(sys.stdin); print(len(procs))" 2>/dev/null || echo '0')
    if [ "$running_apps" -gt 0 ]; then
      warn "PM2: $running_apps app(s) running — checking for orphans"
      pm2 jlist 2>/dev/null | python3 -c "
import sys, json, subprocess
procs = json.load(sys.stdin)
for p in procs:
    name = p.get('name', '')
    if name and name != 'zapflow-api':
        subprocess.run(['pm2', 'delete', name], capture_output=True)
        print(f'Removed orphan PM2 app: {name}')
" 2>/dev/null || pm2 delete all 2>/dev/null || true
    else
      log "PM2: no running apps — clean slate"
    fi
  fi
}

vps_environment_audit() {
  step "0.5. VPS ENVIRONMENT AUDIT"
  echo ""
  echo "  ── System ──────────────────────────────────────────"
  local os_name
  os_name=$(. /etc/os-release 2>/dev/null && echo "$NAME $VERSION_ID" || uname -s)
  local kernel
  kernel=$(uname -r)
  local arch
  arch=$(uname -m)
  echo "  OS:       $os_name ($arch)"
  echo "  Kernel:   $kernel"

  local cpu_cores
  cpu_cores=$(nproc 2>/dev/null || grep -c processor /proc/cpuinfo 2>/dev/null || echo '?')
  local cpu_model
  cpu_model=$(grep 'model name' /proc/cpuinfo 2>/dev/null | head -1 | cut -d: -f2 | xargs || echo 'unknown')
  echo "  CPU:      $cpu_cores core(s) — $cpu_model"

  local ram_total
  ram_total=$(free -m 2>/dev/null | awk '/^Mem/{print $2}' || echo '?')
  local ram_free
  ram_free=$(free -m 2>/dev/null | awk '/^Mem/{print $4}' || echo '?')
  echo "  RAM:      ${ram_total}MB total / ${ram_free}MB free"

  local disk_total
  disk_total=$(df -h "$APP_DIR" 2>/dev/null | awk 'NR==2{print $2}' || echo '?')
  local disk_free
  disk_free=$(df -h "$APP_DIR" 2>/dev/null | awk 'NR==2{print $4}' || echo '?')
  local disk_pct
  disk_pct=$(df -h "$APP_DIR" 2>/dev/null | awk 'NR==2{print $5}' || echo '?')
  echo "  Disk:     ${disk_total} total / ${disk_free} free (${disk_pct} used)"

  local disk_used_int
  disk_used_int=$(df "$APP_DIR" 2>/dev/null | awk 'NR==2{gsub(/%/,"",$5); print $5}' || echo '0')
  if [ "${disk_used_int:-0}" -gt 90 ] 2>/dev/null; then
    warn "Disk usage >90% — install may fail. Free up space first."
  fi

  echo ""
  echo "  ── Network ──────────────────────────────────────────"
  if curl -s --max-time 3 https://github.com -o /dev/null; then
    log "Internet: reachable ✔"
  else
    warn "Internet: unreachable — apt-get and git clone may fail"
  fi
  echo "  Public IP: $PUBLIC_IP"

  echo "  Listening ports (40xx range):"
  ss -tlnp 2>/dev/null | grep -E ':40[0-9]{2}' | awk '{print "    "$1,$4,$NF}' || echo "    none"

  echo ""
  echo "  ── Tools already installed ──────────────────────────"
  local tool
  local AUDIT_TOOLS=(git curl wget nginx psql redis-cli node npm pm2 python3 openssl unzip build-essential)
  for tool in "${AUDIT_TOOLS[@]}"; do
    if command -v "$tool" >/dev/null 2>&1; then
      local ver
      ver=$(${tool} --version 2>/dev/null | head -1 | sed 's/^[^0-9]*//' | cut -c1-20 || echo 'ok')
      printf "  ✔ %-16s %s\n" "$tool" "$ver"
    else
      printf "  ✖ %-16s (missing — will install)\n" "$tool"
    fi
  done

  echo ""
  echo "  ── Current project directory ────────────────────────"
  if [ -d "$APP_DIR/.git" ]; then
    local current_branch
    current_branch=$(git -C "$APP_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')
    local current_commit
    current_commit=$(git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null || echo 'unknown')
    echo "  Repo:     $APP_DIR"
    echo "  Branch:   $current_branch @ $current_commit"
  else
    echo "  Repo:     $APP_DIR (not yet cloned)"
  fi
  echo ""
}
