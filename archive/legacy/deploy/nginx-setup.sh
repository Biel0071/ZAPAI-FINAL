#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${1:-${DOMAIN:-}}"
EMAIL="${2:-${LETSENCRYPT_EMAIL:-admin@$DOMAIN}}"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$APP_DIR/.env.production"
NGINX_SITE="/etc/nginx/sites-available/zapai.conf"
NGINX_ENABLED="/etc/nginx/sites-enabled/zapai.conf"

info() { echo "[NGINX][INFO] $*"; }
ok() { echo "[NGINX][OK]   $*"; }
fail() { echo "[NGINX][ERR]  $*" >&2; exit 1; }

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  fail "Execute como root: sudo bash deploy/nginx-setup.sh app.seudominio.com email@dominio.com"
fi

[ -n "$DOMAIN" ] || fail "Informe o domínio: bash deploy/nginx-setup.sh app.seudominio.com email@dominio.com"

info "Instalando Nginx e Certbot"
apt-get update -y
apt-get install -y nginx certbot python3-certbot-nginx

info "Criando config Nginx para $DOMAIN"
cat > "$NGINX_SITE" <<EOF_NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    client_max_body_size 50m;

    location /api/ {
        proxy_pass http://127.0.0.1:4025/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:4025/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    location /health {
        proxy_pass http://127.0.0.1/health;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:80;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
    }
}
EOF_NGINX

ln -sf "$NGINX_SITE" "$NGINX_ENABLED"
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl reload nginx

info "Emitindo certificado SSL"
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect
systemctl enable certbot.timer || true
systemctl restart nginx

if [ -f "$ENV_FILE" ]; then
  info "Atualizando .env.production"
  tmp_file="$(mktemp)"
  grep -v -E '^(FRONTEND_URL|CORS_ALLOWED_ORIGINS|VITE_API_URL)=' "$ENV_FILE" > "$tmp_file" || true
  cat >> "$tmp_file" <<EOF_ENV
FRONTEND_URL="https://${DOMAIN}"
CORS_ALLOWED_ORIGINS="https://${DOMAIN}"
VITE_API_URL="https://${DOMAIN}"
EOF_ENV
  mv "$tmp_file" "$ENV_FILE"
fi

ok "HTTPS ativo: https://${DOMAIN}"
