# ZAPAI Install Library — nginx.sh
# Nginx config generation, site activation, SSL registration.

write_nginx_config() {
  local domain="$1"
  local enable_ssl="$2"
  local dest="/etc/nginx/sites-available/zapai"

  log "Gerando configuração do Nginx (domain: ${domain:-none}, SSL: ${enable_ssl})..."

  # Header & Limits
  cat > "$dest" << NGINX_EOF
limit_req_zone \$binary_remote_addr zone=auth_limit:10m rate=5r/s;
limit_req_zone \$binary_remote_addr zone=api_limit:10m  rate=30r/s;
NGINX_EOF

  # Port 80 Block
  cat >> "$dest" << NGINX_EOF

server {
    listen 80 default_server;
    server_name ${domain:-_} _;

    client_max_body_size 50m;
    gzip on;
    gzip_types text/plain application/json application/javascript text/css;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
NGINX_EOF

  if [ "$enable_ssl" = "true" ] && [ -n "$domain" ]; then
    cat >> "$dest" << NGINX_EOF

    # Smart HTTPS redirect (prevents loops under reverse proxies/Cloudflare Flexible SSL and IP access)
    set \$redirect_to_https 0;
    if (\$scheme != "https") {
        set \$redirect_to_https 1;
    }
    if (\$http_x_forwarded_proto = "https") {
        set \$redirect_to_https 0;
    }
    if (\$host ~* ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+\$) {
        set \$redirect_to_https 0;
    }
    if (\$request_uri ~* ^/\\.well-known/acme-challenge/) {
        set \$redirect_to_https 0;
    }

    if (\$redirect_to_https = 1) {
        return 301 https://\$host\$request_uri;
    }
NGINX_EOF
  fi

  cat >> "$dest" << NGINX_EOF

    # Frontend
    root ${FRONTEND_DIR}/dist;
    index index.html;

    location / {
        location = /index.html {
            add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";
            add_header Pragma "no-cache";
            add_header Expires "0";
        }
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        limit_req zone=api_limit burst=60 nodelay;
        proxy_pass http://127.0.0.1:${BACKEND_PORT}/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 30s;
        proxy_connect_timeout 10s;
        client_max_body_size 25M;
    }

    location ~ ^/auth/ {
        limit_req zone=auth_limit burst=10 nodelay;
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 30s;
    }

    location ~ ^/(health|ready|api/health|api/ready)\$ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_read_timeout 10s;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT}/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_buffering off;
    }

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
}
NGINX_EOF

  # SSL Port 443 Block (only if SSL is active)
  if [ "$enable_ssl" = "true" ] && [ -n "$domain" ]; then
    cat >> "$dest" << NGINX_EOF

server {
    listen 443 ssl http2 default_server;
    server_name ${domain} _;

    ssl_certificate     /etc/letsencrypt/live/${domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${domain}/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    client_max_body_size 50m;
    gzip on;
    gzip_types text/plain application/json application/javascript text/css;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Frontend
    root ${FRONTEND_DIR}/dist;
    index index.html;

    location / {
        location = /index.html {
            add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";
            add_header Pragma "no-cache";
            add_header Expires "0";
        }
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        limit_req zone=api_limit burst=60 nodelay;
        proxy_pass http://127.0.0.1:${BACKEND_PORT}/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 30s;
        proxy_connect_timeout 10s;
        client_max_body_size 25M;
    }

    location ~ ^/auth/ {
        limit_req zone=auth_limit burst=10 nodelay;
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 30s;
    }

    location ~ ^/(health|ready|api/health|api/ready)\$ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_read_timeout 10s;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT}/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_buffering off;
    }
}
NGINX_EOF
  fi

  ln -sf /etc/nginx/sites-available/zapai /etc/nginx/sites-enabled/zapai 2>/dev/null || true
  rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
}

install_nginx() {
  step "12. NGINX INSTALL"
  
  # Liberar porta 80 caso esteja ocupada por Apache ou HTTPD (comum em VPS Hostinger/cPanel)
  if systemctl is-active --quiet apache2 2>/dev/null || command -v apache2 >/dev/null 2>&1; then
    log "Porta 80 ocupada pelo Apache. Parando e desativando apache2..."
    systemctl stop apache2 2>/dev/null || true
    systemctl disable apache2 2>/dev/null || true
  fi
  if systemctl is-active --quiet httpd 2>/dev/null || command -v httpd >/dev/null 2>&1; then
    log "Porta 80 ocupada pelo HTTPD. Parando e desativando httpd..."
    systemctl stop httpd 2>/dev/null || true
    systemctl disable httpd 2>/dev/null || true
  fi

  enable_service nginx
  start_service nginx

  if [ ! -d /etc/nginx/sites-available ]; then
    mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
    if [ -f /etc/nginx/nginx.conf ] && ! grep -q "sites-enabled" /etc/nginx/nginx.conf; then
      sed -i 's|include /etc/nginx/conf.d/\*\.conf;|include /etc/nginx/conf.d/*.conf;\n    include /etc/nginx/sites-enabled/*;|' /etc/nginx/nginx.conf
      log "Configurada diretiva sites-enabled no nginx.conf"
    fi
  fi

  if [ -f /etc/nginx/nginx.conf ]; then
    sed -i 's/listen       80 default_server;/listen       80;/g' /etc/nginx/nginx.conf 2>/dev/null || true
    sed -i 's/listen       \[::\]:80 default_server;/listen       \[::\]:80;/g' /etc/nginx/nginx.conf 2>/dev/null || true
  fi

  local ssl_active=false
  if [ -n "$DOMAIN" ] && [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    ssl_active=true
  fi

  write_nginx_config "$DOMAIN" "$ssl_active"
  nginx -t && restart_service nginx
  log "Nginx: valid config, reloaded/restarted"

  ln -sf /var/log/nginx/access.log "$LOGS_DIR/nginx/access.log" 2>/dev/null || true
  ln -sf /var/log/nginx/error.log  "$LOGS_DIR/nginx/error.log"  2>/dev/null || true
}

configure_nginx() {
  step "12.1. NGINX SSL & FIREWALL CONFIGURATION"
  
  if [ -n "$DOMAIN" ]; then
    if command -v certbot >/dev/null 2>&1; then
      mkdir -p /var/www/certbot
      
      if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
        log "Requisitando novo certificado Let's Encrypt para $DOMAIN..."
        certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" --non-interactive --agree-tos \
          --email "admin@${DOMAIN}" 2>&1 | tail -5 || \
          warn "Certbot falhou ao gerar o certificado. Verifique os logs e DNS."
      else
        log "Certificado Let's Encrypt já existente encontrado para $DOMAIN."
      fi
      
      if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
        write_nginx_config "$DOMAIN" "true"
        nginx -t && restart_service nginx
        log "✔ SSL configurado com sucesso e Nginx reconfigurado!"
      else
        warn "SSL não pôde ser configurado. Nginx permanecerá em modo HTTP-only."
      fi
    else
      warn "certbot não encontrado — pulando configuração SSL automática"
    fi
  fi
}
