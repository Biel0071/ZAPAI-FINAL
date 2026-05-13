#!/bin/bash
# ==============================================================================
# ZAPAI — logs.sh
# Unified log viewer for all system components.
# Usage:
#   bash deploy/logs.sh              # all logs (last 50 lines each)
#   bash deploy/logs.sh backend      # backend PM2 logs only
#   bash deploy/logs.sh nginx        # nginx access+error logs
#   bash deploy/logs.sh deploy       # deploy/watcher logs
#   bash deploy/logs.sh health       # healthcheck logs
#   bash deploy/logs.sh follow       # live tail all (Ctrl+C to stop)
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." 2>/dev/null && pwd)"
LOGS_DIR="$APP_DIR/logs"

CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'
section() { echo -e "\n${CYAN}━━━━━━━━━━━━━━━━ $* ━━━━━━━━━━━━━━━━${NC}"; }

LINES="${LINES:-50}"
MODE="${1:-all}"

case "$MODE" in

  backend)
    section "BACKEND — PM2 logs (last $LINES lines)"
    pm2 logs zapflow-api --lines "$LINES" --nostream 2>/dev/null || \
      tail -n "$LINES" "$LOGS_DIR/backend/"*.log 2>/dev/null || echo "  No backend logs found"
    ;;

  nginx)
    section "NGINX ACCESS (last $LINES)"
    tail -n "$LINES" /var/log/nginx/access.log 2>/dev/null || \
      tail -n "$LINES" "$LOGS_DIR/nginx/access.log" 2>/dev/null || echo "  No nginx access logs"
    section "NGINX ERRORS (last $LINES)"
    tail -n "$LINES" /var/log/nginx/error.log 2>/dev/null || \
      tail -n "$LINES" "$LOGS_DIR/nginx/error.log" 2>/dev/null || echo "  No nginx error logs"
    ;;

  deploy)
    section "WATCHER LOG (last $LINES)"
    tail -n "$LINES" "$LOGS_DIR/deploy/watcher.log" 2>/dev/null || echo "  No watcher log"
    section "DEPLOY LOG (last $LINES)"
    tail -n "$LINES" "$LOGS_DIR/deploy/deploy.log" 2>/dev/null || echo "  No deploy log"
    ;;

  health)
    section "HEALTHCHECK DAILY (last $LINES)"
    tail -n "$LINES" "$LOGS_DIR/backend/healthcheck_daily.log" 2>/dev/null || echo "  No healthcheck log"
    section "RECOVERY LOG (last $LINES)"
    tail -n "$LINES" "$LOGS_DIR/backend/recovery.log" 2>/dev/null || echo "  No recovery log"
    ;;

  follow)
    echo -e "${YELLOW}Following all logs... (Ctrl+C to stop)${NC}"
    tail -f \
      "$LOGS_DIR/deploy/watcher.log" \
      "$LOGS_DIR/backend/recovery.log" \
      /var/log/nginx/error.log \
      2>/dev/null &
    pm2 logs zapflow-api 2>/dev/null
    ;;

  all|*)
    section "BACKEND — PM2 (last $LINES)"
    pm2 logs zapflow-api --lines "$LINES" --nostream 2>/dev/null || echo "  No PM2 logs"

    section "NGINX ERRORS (last 20)"
    tail -n 20 /var/log/nginx/error.log 2>/dev/null || echo "  No nginx errors"

    section "WATCHER (last 20)"
    tail -n 20 "$LOGS_DIR/deploy/watcher.log" 2>/dev/null || echo "  No watcher log"

    section "RECOVERY (last 10)"
    tail -n 10 "$LOGS_DIR/backend/recovery.log" 2>/dev/null || echo "  No recovery log"

    echo ""
    echo "  Use: bash deploy/logs.sh [backend|nginx|deploy|health|follow]"
    ;;
esac

echo ""
