#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-.env.production}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="$SCRIPT_DIR/nginx.production.conf.template"
TARGET="/etc/nginx/sites-available/zapai-production"
LINK="/etc/nginx/sites-enabled/zapai-production"

[ -f "$ENV_FILE" ] || { echo "[NGINX][ERR] Env file not found: $ENV_FILE"; exit 1; }
[ -f "$TEMPLATE" ] || { echo "[NGINX][ERR] Template not found: $TEMPLATE"; exit 1; }

set -a
. "$ENV_FILE"
set +a

[ -n "${DOMAIN:-}" ] || { echo "[NGINX][ERR] DOMAIN not set in $ENV_FILE"; exit 1; }

if ! command -v nginx >/dev/null 2>&1; then
  echo "[NGINX][INFO] Installing nginx..."
  apt-get update
  apt-get install -y nginx
fi

mkdir -p /var/www/certbot

sed "s/__DOMAIN__/${DOMAIN}/g" "$TEMPLATE" > "$TARGET"
ln -sf "$TARGET" "$LINK"
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl enable nginx
systemctl restart nginx

echo "[NGINX][OK] Nginx configured for ${DOMAIN}"
