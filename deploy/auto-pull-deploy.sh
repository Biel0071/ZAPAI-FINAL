#!/bin/bash
# ==============================================================================
# ZAPAI-FINAL — Auto Pull and Deploy Daemon
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

DEPLOY_LOCK="/tmp/zapai_deploy.lock"
if [ -f "$DEPLOY_LOCK" ]; then
    # Stale lock guard (10 minutes)
    if find /tmp -name "zapai_deploy.lock" -mmin +10 -print | grep -q .; then
        echo "[AUTO-PULL] Removing stale lock file"
        rm -f "$DEPLOY_LOCK"
    else
        echo "[AUTO-PULL] Deploy already in progress. Skipping."
        exit 0
    fi
fi

# Fetch from origin
git fetch origin main >/dev/null 2>&1 || {
    echo "[AUTO-PULL] Warning: git fetch failed. Checking again next tick."
    exit 0
}

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" != "$REMOTE" ]; then
    echo "[AUTO-PULL] Updates detected on main branch!"
    echo "Local:  $LOCAL"
    echo "Remote: $REMOTE"
    echo "Starting deployment..."
    
    touch "$DEPLOY_LOCK"
    
    # Run the official deploy script
    if bash deploy/auto-deploy.sh; then
        echo "[AUTO-PULL] Auto-deployment succeeded!"
    else
        echo "[AUTO-PULL] Auto-deployment failed. Rollback handled by auto-deploy.sh."
    fi
    
    rm -f "$DEPLOY_LOCK"
fi
