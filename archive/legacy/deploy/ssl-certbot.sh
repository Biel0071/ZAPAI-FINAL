#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-.env.production}"

[ -f "$ENV_FILE" ] || { echo "[SSL][ERR] Env file not found: $ENV_FILE"; exit 1; }

set -a
. "$ENV_FILE"
set +a

[ -n "${DOMAIN:-}" ] || { echo "[SSL][ERR] DOMAIN not set in $ENV_FILE"; exit 1; }
[ -n "${LETSENCRYPT_EMAIL:-}" ] || { echo "[SSL][ERR] LETSENCRYPT_EMAIL not set in $ENV_FILE"; exit 1; }

if ! command -v certbot >/dev/null 2>&1; then
  echo "[SSL][INFO] Installing certbot..."
  apt-get update
  apt-get install -y certbot python3-certbot-nginx
fi

echo "[SSL][INFO] Requesting/renewing certificate for ${DOMAIN}"
certbot --nginx \
  --non-interactive \
  --agree-tos \
  --email "$LETSENCRYPT_EMAIL" \
  -d "$DOMAIN" \
  --redirect

systemctl reload nginx

echo "[SSL][OK] SSL configured for ${DOMAIN}"
