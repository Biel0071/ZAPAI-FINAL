#!/usr/bin/env bash
set -e

# ZAPAI Backend Initialization Script
# Usage: npm start

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=================================="
echo "ZAPAI - Backend Server Starting"
echo "=================================="
echo ""

# Load environment
if [ -f .env ]; then
  echo "✓ Loading .env"
  set -a
  source .env
  set +a
else
  echo "⚠ Warning: .env not found, using defaults"
fi

# Print configuration
echo "Configuration:"
echo "  NODE_ENV: ${NODE_ENV:-development}"
echo "  PORT: ${PORT:-4025}"
echo "  DATABASE_URL: ${DATABASE_URL:-not set}"
echo "  FRONTEND_URL: ${FRONTEND_URL:-not set}"
echo ""

# Create required directories
echo "Creating required directories..."
mkdir -p sessions uploads logs media data reports

# Start server
echo "Starting Node.js server..."
exec node server.js
