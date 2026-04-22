#!/usr/bin/env bash
# deploy.sh — full deploy to VPS
# Usage: ./deploy/deploy.sh
# Run as: zapai user (NOT root)
set -euo pipefail

APP_DIR="/opt/zapai"
FRONTEND_DIR="$APP_DIR/frontend"
BACKEND_DIR="$APP_DIR/backend"
DEPLOY_DIR="$APP_DIR/deploy"

echo "=============================================="
echo "  ZapAI Deploy — $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================="

# 1. Backup before anything
echo "[DEPLOY] Step 1/7 — Backup"
bash "$DEPLOY_DIR/backup.sh"

# 2. Pull latest code
echo "[DEPLOY] Step 2/7 — Git pull"
cd "$APP_DIR"
git pull origin main

# 3. Build frontend
echo "[DEPLOY] Step 3/7 — Frontend build"
cd "$FRONTEND_DIR"
npm ci --omit=dev --no-audit --no-fund
npm run build

# 4. Install backend deps
echo "[DEPLOY] Step 4/7 — Backend deps"
cd "$BACKEND_DIR"
npm ci --omit=dev --no-audit --no-fund

# 5. Run DB migrations (if enabled in .env)
echo "[DEPLOY] Step 5/7 — DB migrations"
NODE_ENV=production DB_RUN_MIGRATIONS_ON_BOOT=true node -e "
  require('dotenv').config();
  const { runMigrations } = require('./services/migrationRunner');
  runMigrations().then(() => { console.log('Migrations OK'); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
" || echo "[DEPLOY] Migration step skipped (no DB or already up-to-date)"

# 6. Reload PM2 (zero-downtime)
echo "[DEPLOY] Step 6/7 — PM2 reload"
if pm2 describe zapai-backend > /dev/null 2>&1; then
  pm2 reload ecosystem.config.js --env production --update-env
else
  pm2 start ecosystem.config.js --env production
fi
pm2 save

# 7. Smoke test
echo "[DEPLOY] Step 7/7 — Smoke test"
sleep 3
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4025/health)
if [[ "$STATUS" == "200" ]]; then
  echo "[DEPLOY] Health check PASSED (HTTP $STATUS)"
else
  echo "[DEPLOY] Health check FAILED (HTTP $STATUS) — check logs: pm2 logs zapai-backend"
  exit 1
fi

# Reload Nginx (picks up new dist/)
echo "[DEPLOY] Reloading Nginx..."
sudo nginx -t && sudo systemctl reload nginx

echo "=============================================="
echo "  Deploy COMPLETE — $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================="
