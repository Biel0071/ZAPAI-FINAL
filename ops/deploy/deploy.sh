#!/bin/bash
# ==============================================================================
# ZAPAI — deploy.sh
# Manual deploy trigger (same as auto-deploy.sh but with interactive output).
# Usage: bash deploy/deploy.sh [--dry-run] [--skip-build] [--skip-migrate]
# ==============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd)"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ZAPAI MANUAL DEPLOY — $(date)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

exec bash "$SCRIPT_DIR/auto-deploy.sh" "$@"
