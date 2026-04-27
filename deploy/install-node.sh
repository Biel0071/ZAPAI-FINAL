#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

MASTER_URL="${1:-${MASTER_URL:-}}"
NODE_REGISTRATION_TOKEN="${2:-${NODE_REGISTRATION_TOKEN:-}}"

if [ -z "$MASTER_URL" ] || [ -z "$NODE_REGISTRATION_TOKEN" ]; then
  echo "Usage: sudo bash deploy/install-node.sh <MASTER_URL> <NODE_REGISTRATION_TOKEN>"
  exit 1
fi

echo "[INSTALL] install-node.sh agora delega para install.sh node (modo unificado)"
exec bash "$SCRIPT_DIR/install.sh" node "$MASTER_URL" "$NODE_REGISTRATION_TOKEN"
