# ZAPAI Install Library — postgres.sh
# PostgreSQL installer, configuration, and connectivity check.

install_postgres() {
  step "4. POSTGRESQL"
  if $SKIP_POSTGRES; then
    warn "PostgreSQL install skipped (--skip-postgres)"
    return 0
  fi

  if ! command -v psql >/dev/null 2>&1; then
    if [ "$OS_FAMILY" = "debian" ]; then
      apt-get install -y -qq postgresql postgresql-contrib 2>&1 | tail -3
    else
      dnf install -y -q postgresql-server postgresql-contrib 2>&1 | tail -3
    fi
    log "PostgreSQL installed"
  else
    log "PostgreSQL $(psql --version | head -1) already installed"
  fi
}

configure_postgres() {
  step "4.1. POSTGRESQL CONFIGURATION"
  if $SKIP_POSTGRES; then
    return 0
  fi

  if [ "$OS_FAMILY" = "rhel" ]; then
    if [ ! -f /var/lib/pgsql/data/PG_VERSION ]; then
      postgresql-setup --initdb || true
    fi
  fi
  enable_service postgresql
  start_service postgresql
  sleep 3

  log "Configurando pg_hba.conf e postgresql.conf para acesso local..."
  local hba_file=""
  local conf_file=""
  
  if sudo -u postgres psql -c 'SELECT 1' >/dev/null 2>&1; then
    hba_file=$(sudo -u postgres psql -t -A -c "SHOW hba_file;" 2>/dev/null || true)
    conf_file=$(sudo -u postgres psql -t -A -c "SHOW config_file;" 2>/dev/null || true)
  fi
  
  if [ -z "$hba_file" ]; then
    if [ "$OS_FAMILY" = "debian" ]; then
      hba_file=$(ls /etc/postgresql/*/main/pg_hba.conf 2>/dev/null | head -1 || true)
    else
      hba_file="/var/lib/pgsql/data/pg_hba.conf"
    fi
  fi

  if [ -z "$conf_file" ]; then
    if [ "$OS_FAMILY" = "debian" ]; then
      conf_file=$(ls /etc/postgresql/*/main/postgresql.conf 2>/dev/null | head -1 || true)
    else
      conf_file="/var/lib/pgsql/data/postgresql.conf"
    fi
  fi

  if [ -f "$hba_file" ]; then
    log "pg_hba.conf encontrado: $hba_file"
    cp "$hba_file" "${hba_file}.bak" 2>/dev/null || true
    sed -i '/# ZAPAI-FINAL/d' "$hba_file" 2>/dev/null || true
    
    local temp_hba
    temp_hba=$(mktemp)
    cat > "$temp_hba" << HBAEOF
# ZAPAI-FINAL Auto-configured rules
local   all             all                                     trust
host    all             all             127.0.0.1/32            trust
host    all             all             ::1/128                 trust
HBAEOF
    cat "$hba_file" >> "$temp_hba"
    mv "$temp_hba" "$hba_file"
    chown postgres:postgres "$hba_file" 2>/dev/null || true
    chmod 600 "$hba_file" 2>/dev/null || true
    log "✔ pg_hba.conf atualizado com regras de trust local"
  else
    warn "pg_hba.conf não encontrado em $hba_file"
  fi

  if [ -f "$conf_file" ]; then
    log "postgresql.conf encontrado: $conf_file"
    cp "$conf_file" "${conf_file}.bak" 2>/dev/null || true
    sed -i "s|^#listen_addresses =.*|listen_addresses = '*'|" "$conf_file" 2>/dev/null || true
    sed -i "s|^listen_addresses =.*|listen_addresses = '*'|" "$conf_file" 2>/dev/null || true
    if ! grep -q "^listen_addresses" "$conf_file"; then
      echo "listen_addresses = '*'" >> "$conf_file"
    fi
    log "✔ postgresql.conf atualizado (listen_addresses = '*')"
  else
    warn "postgresql.conf não encontrado em $conf_file"
  fi

  restart_service postgresql
  sleep 3

  if [ -f "$APP_DIR/.env.production" ]; then
    local existing_pass
    existing_pass=$(grep '^POSTGRES_PASSWORD=' "$APP_DIR/.env.production" 2>/dev/null | cut -d= -f2 || echo "")
    [ -n "$existing_pass" ] && DB_PASS="$existing_pass"
  fi

  if sudo -u postgres psql -t -A -c "SELECT 1 FROM pg_roles WHERE rolname='zapai';" 2>/dev/null | grep -q "1"; then
    log "✔ Usuário 'zapai' já existe. Atualizando senha..."
    sudo -u postgres psql -c "ALTER USER zapai WITH PASSWORD '$DB_PASS';" >/dev/null 2>&1 || true
  else
    log "Criando usuário 'zapai'..."
    sudo -u postgres psql -c "CREATE USER zapai WITH PASSWORD '$DB_PASS';" >/dev/null 2>&1 || true
    log "✔ Usuário 'zapai' criado"
  fi

  if sudo -u postgres psql -t -A -c "SELECT 1 FROM pg_database WHERE datname='zapai_crm';" 2>/dev/null | grep -q "1"; then
    log "✔ Banco de dados 'zapai_crm' já existe."
  else
    log "Criando banco de dados 'zapai_crm'..."
    sudo -u postgres psql -c "CREATE DATABASE zapai_crm OWNER zapai;" >/dev/null 2>&1 || true
    log "✔ Banco de dados 'zapai_crm' criado"
  fi

  sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE zapai_crm TO zapai;" 2>/dev/null || true
}

wait_postgres() {
  step "4.2. WAIT FOR POSTGRES"
  if $SKIP_POSTGRES; then
    return 0
  fi

  local pg_ready=false
  local attempt
  for attempt in $(seq 1 12); do
    if PGPASSWORD="$DB_PASS" psql -h localhost -U zapai -d zapai_crm -c 'SELECT 1' >/dev/null 2>&1; then
      pg_ready=true
      log "✔ PostgreSQL respondendo a conexões locais!"
      break
    fi
    warn "PostgreSQL ainda não disponível (tentativa $attempt/12)... aguardando 5s"
    sleep 5
  done

  if [ "$pg_ready" != "true" ]; then
    err "PostgreSQL indisponível para conexões TCP locais. Verifique o status do banco (systemctl status postgresql) ou pg_hba.conf."
  fi
}
