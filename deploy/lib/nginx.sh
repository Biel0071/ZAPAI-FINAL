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

  # Se aaPanel/BT for detectado, copie também para a pasta vhost do aaPanel
  if [ -d "/www/server/panel/vhost/nginx" ]; then
    cp -f "$dest" "/www/server/panel/vhost/nginx/zapai.conf"
    cp -f "$dest" "/www/server/panel/vhost/nginx/00_zapai.conf"
    log "aaPanel/BT detectado: Copiada config para zapai.conf e 00_zapai.conf"
  fi
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
  
  # Auto-cura e ativação em múltiplos servidores (Nginx/OpenResty)
  deploy_nginx_auto_heal

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
        deploy_nginx_auto_heal
        log "✔ SSL configurado com sucesso e Nginx reconfigurado!"
      else
        warn "SSL não pôde ser configurado. Nginx permanecerá em modo HTTP-only."
      fi
    else
      warn "certbot não encontrado — pulando configuração SSL automática"
    fi
  fi
}

deploy_nginx_auto_heal() {
  log "Iniciando auto-detecção do servidor web ativo (Nginx/OpenResty)..."
  
  local BINARY_PATH=""
  local CONF_FILE=""
  local VHOST_DIRS=()
  
  # --- Verificação de Proxy Docker (comum no painel Integrator ICP e outros) ---
  if command -v docker >/dev/null 2>&1; then
    log "Docker detectado. Procurando container proxy nas portas 80/443..."
    local proxy_container=""
    for cid in $(docker ps -q 2>/dev/null); do
      local ports
      ports=$(docker port "$cid" 2>/dev/null || true)
      if echo "$ports" | grep -q -E "(:80|:443)"; then
        proxy_container="$cid"
        break
      fi
    done
    
    if [ -n "$proxy_container" ]; then
      local container_name
      container_name=$(docker inspect -f '{{.Name}}' "$proxy_container" | sed 's|/||')
      log "Container proxy encontrado: $container_name (ID: $proxy_container)"
      
      # Obter todos os mounts do container no formato Source:Destination
      local mounts_json
      mounts_json=$(docker inspect -f '{{range .Mounts}}{{.Source}}:{{.Destination}} {{end}}' "$proxy_container" 2>/dev/null || true)
      
      local docker_healed=false
      for mount in $mounts_json; do
        local host_path="${mount%%:*}"
        local container_path="${mount#*:}"
        
        # Procurar por pastas de configuração do Nginx ou OpenResty
        if [[ "$container_path" =~ /etc/nginx/conf.d || "$container_path" =~ /etc/nginx/sites-enabled || "$container_path" =~ /etc/nginx/sites-available || "$container_path" =~ /usr/local/openresty/nginx/conf || "$container_path" =~ /etc/nginx || "$container_path" =~ /etc/openresty ]]; then
          local mapped_dir="$host_path"
          log "Diretório de vhost Docker mapeado no host: $mapped_dir"
          
          if [ -f "/etc/nginx/sites-available/zapai" ] && [ -d "$mapped_dir" ]; then
            cp -f "/etc/nginx/sites-available/zapai" "$mapped_dir/zapai.conf" 2>/dev/null
            cp -f "/etc/nginx/sites-available/zapai" "$mapped_dir/00_zapai.conf" 2>/dev/null
            log "Configuração copiada para o volume Docker do host em $mapped_dir"
            docker_healed=true
          fi
        fi
      done
      
      if $docker_healed; then
        # Recarregar o Nginx/OpenResty dentro do container
        log "Recarregando Nginx/OpenResty dentro do container $container_name..."
        if docker exec "$proxy_container" nginx -t >/dev/null 2>&1; then
          docker exec "$proxy_container" nginx -s reload >/dev/null 2>&1 && log "Nginx do container recarregado com sucesso!" && return 0
        elif docker exec "$proxy_container" openresty -t >/dev/null 2>&1; then
          docker exec "$proxy_container" openresty -s reload >/dev/null 2>&1 && log "OpenResty do container recarregado com sucesso!" && return 0
        fi
        
        # Se falhar no reload silencioso, reiniciar o container
        docker restart "$proxy_container" >/dev/null 2>&1 && log "Container proxy reiniciado para aplicar configurações" && return 0
      fi
    fi
  fi

  # 1. Tentar encontrar o processo master ativo do Nginx ou OpenResty no host
  local ps_line
  ps_line=$(ps aux 2>/dev/null | grep -E "nginx|openresty" | grep "master process" | grep -v grep | head -n 1 || true)
  
  if [ -n "$ps_line" ]; then
    # Extrair caminho absoluto do binário usando regex
    BINARY_PATH=$(echo "$ps_line" | grep -o -E "/[^ ]*(nginx|openresty)[^ ]*" | head -n 1 || true)
    # Extrair arquivo de configuração (-c /caminho/para/nginx.conf)
    CONF_FILE=$(echo "$ps_line" | grep -o -E "\-c\s+[^ ]+" | awk '{print $2}' || true)
  fi
  
  # Se não encontrou o binário pelo processo, tentar localizadores comuns
  if [ -z "$BINARY_PATH" ] || [ ! -x "$BINARY_PATH" ]; then
    BINARY_PATH=$(which openresty 2>/dev/null || which nginx 2>/dev/null || echo "")
  fi
  
  # Se encontrou o binário mas não o arquivo de config, consultar o binário
  if [ -n "$BINARY_PATH" ] && [ -z "$CONF_FILE" ]; then
    CONF_FILE=$("$BINARY_PATH" -V 2>&1 | grep -o -E "\-\-conf\-path=[^ ]+" | cut -d= -f2 || true)
  fi
  
  # Fallbacks comuns se nada funcionar
  [ -z "$CONF_FILE" ] && [ -f "/usr/local/openresty/nginx/conf/nginx.conf" ] && CONF_FILE="/usr/local/openresty/nginx/conf/nginx.conf"
  [ -z "$CONF_FILE" ] && [ -f "/etc/nginx/nginx.conf" ] && CONF_FILE="/etc/nginx/nginx.conf"
  
  log "Servidor ativo binário: ${BINARY_PATH:-Não detectado}"
  log "Configuração principal: ${CONF_FILE:-Não detectada}"
  
  # 2. Identificar possíveis diretórios de Virtual Hosts (includes)
  if [ -f "$CONF_FILE" ]; then
    local conf_dir
    conf_dir=$(dirname "$CONF_FILE")
    
    # Buscar os diretórios de include no arquivo principal
    local include_patterns
    include_patterns=$(grep -E "include\s+[^;]+" "$CONF_FILE" | grep -o -E "include\s+[^;]+" | awk '{print $2}' || true)
    
    for pat in $include_patterns; do
      local abs_pat="$pat"
      [[ "$pat" != /* ]] && abs_pat="$conf_dir/$pat"
      
      local dir_name
      dir_name=$(dirname "$abs_pat" 2>/dev/null || true)
      if [ -d "$dir_name" ] && [[ ! " ${VHOST_DIRS[*]} " =~ " ${dir_name} " ]]; then
        VHOST_DIRS+=("$dir_name")
      fi
    done
  fi
  
  # Adicionar diretórios de include conhecidos do aaPanel, ICP, CyberPanel, etc.
  local extra_dirs=(
    "/etc/nginx/sites-enabled"
    "/etc/nginx/conf.d"
    "/www/server/panel/vhost/nginx"
    "/www/server/nginx/conf/vhost"
    "/usr/local/openresty/nginx/conf/vhost"
    "/usr/local/openresty/nginx/conf/conf.d"
    "/etc/nginx/sites-available"
  )
  for d in "${extra_dirs[@]}"; do
    if [ -d "$d" ] && [[ ! " ${VHOST_DIRS[*]} " =~ " ${d} " ]]; then
      VHOST_DIRS+=("$d")
    fi
  done
  
  # 3. Copiar e ativar a configuração do ZapAI em todos os diretórios vhost encontrados
  local source_conf="/etc/nginx/sites-available/zapai"
  if [ -f "$source_conf" ]; then
    for v_dir in "${VHOST_DIRS[@]}"; do
      cp -f "$source_conf" "$v_dir/zapai.conf" 2>/dev/null && log "Config copiada para $v_dir/zapai.conf" || true
      cp -f "$source_conf" "$v_dir/00_zapai.conf" 2>/dev/null && log "Config copiada para $v_dir/00_zapai.conf (prioridade)" || true
    done
  fi
  
  # 4. Recarregar o servidor web ativo usando o método mais compatível
  if [ -n "$BINARY_PATH" ] && [ -x "$BINARY_PATH" ]; then
    if "$BINARY_PATH" -t 2>/dev/null; then
      "$BINARY_PATH" -s reload 2>/dev/null && log "Servidor web recarregado com sucesso ($BINARY_PATH -s reload)" && return 0
    fi
  fi
  
  # Fallbacks do sistema de controle
  systemctl reload openresty 2>/dev/null || systemctl restart openresty 2>/dev/null || \
  systemctl reload nginx 2>/dev/null || systemctl restart nginx 2>/dev/null || \
  service nginx reload 2>/dev/null || service openresty reload 2>/dev/null || true
}
