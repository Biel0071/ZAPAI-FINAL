# ZAPAI Install Library — health.sh
# Detailed final system health checks and summary reporting.

health_checks() {
  step "21. SYSTEM VALIDATION TESTS"
  log "Executando testes finais de saúde e integridade do sistema..."
  sleep 5

  local validation_failed=false

  # 1. PostgreSQL status
  if ! systemctl is-active --quiet postgresql; then
    warn "PostgreSQL não está ativo!"
    validation_failed=true
  else
    log "✔ PostgreSQL ativo e respondendo"
  fi

  # 2. Redis status
  if [ "$OS_FAMILY" = "rhel" ]; then
    REDIS_SVC="redis"
  else
    REDIS_SVC="redis-server"
  fi
  if ! systemctl is-active --quiet "$REDIS_SVC"; then
    warn "Redis ($REDIS_SVC) não está ativo!"
    validation_failed=true
  else
    log "✔ Redis ativo e respondendo"
  fi

  # 3. Nginx status
  if ! systemctl is-active --quiet nginx; then
    warn "Nginx não está ativo!"
    validation_failed=true
  else
    log "✔ Nginx ativo e respondendo"
  fi

  # 4. PM2 status and app running
  if ! pm2 show zapflow-api >/dev/null 2>&1; then
    warn "PM2 zapflow-api não está ativo/rodando!"
    validation_failed=true
  else
    log "✔ PM2 zapflow-api ativo e em execução"
  fi

  # 5. DB query test using DATABASE_URL from .env.production
  if [ -f "$APP_DIR/.env.production" ]; then
    set -a
    # shellcheck disable=SC1091
    source "$APP_DIR/.env.production" 2>/dev/null || true
    set +a
    
    if ! PGPASSWORD="$POSTGRES_PASSWORD" psql "$DATABASE_URL" -c 'SELECT 1' >/dev/null 2>&1; then
      warn "Teste de query psql usando DATABASE_URL falhou!"
      validation_failed=true
    else
      log "✔ Consulta ao banco de dados validada (SELECT 1 ok)"
    fi
  fi

  # 6. Localhost connection checks
  local curl_http
  curl_http=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://localhost/" 2>/dev/null || echo "000")
  if [ "$curl_http" = "000" ]; then
    warn "Conexão com Nginx local (http://localhost/) falhou!"
    validation_failed=true
  else
    log "✔ Nginx local respondendo (HTTP $curl_http)"
  fi

  local curl_health
  curl_health=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://localhost/health" 2>/dev/null || echo "000")
  log "✔ Endpoint de saúde (/health) retornado via Nginx (HTTP $curl_health)"

  local curl_be_health
  curl_be_health=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://127.0.0.1:4025/health" 2>/dev/null || echo "000")
  if [ "$curl_be_health" != "200" ]; then
    warn "Conexão direta com backend porta 4025 (health) falhou! (HTTP $curl_be_health)"
    validation_failed=true
  else
    log "✔ Backend diretamente na porta 4025 respondendo (HTTP 200 OK)"
  fi

  # 7. Print debug statuses of services on failure
  if [ "$validation_failed" = "true" ]; then
    warn "━━━ DIAGNÓSTICO DE FALHA OPERACIONAL ━━━"
    echo "PM2 Status:"
    pm2 status || true
    echo "Nginx Status:"
    systemctl status nginx --no-pager || true
    echo "PostgreSQL Status:"
    systemctl status postgresql --no-pager || true
    echo "Redis Status:"
    systemctl status "$REDIS_SVC" --no-pager || true
    err "FALHA NOS TESTES DE INTEGRIDADE! Um ou mais serviços críticos não estão ativos."
  fi
  
  log "✔ Todos os testes de integridade passaram com sucesso!"
}

show_summary() {
  local end_time
  end_time="$(date +%s)"
  local duration=$((end_time - START_TIME))

  echo ""
  echo "============================================================"
  echo -e "${GREEN}  ✅ ZAPAI BOOTSTRAP COMPLETE — $(date)${NC}"
  echo "  System is ONLINE. No manual steps needed."
  echo "  Tempo total de deploy: ${duration} segundos."
  echo ""
  echo -e "${CYAN}  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}  ► OPEN URL:  ${PUBLIC_URL}${NC}"
  echo -e "${CYAN}  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo -e "${YELLOW}  ADMIN LOGIN${NC}"
  echo "  Username:  zapadmin"
  echo "  Password:  zapadmin1010"
  echo ""
  echo "  Backend:   http://${PUBLIC_IP}:${BACKEND_PORT}/api/health"
  echo "  API URL:   ${PUBLIC_URL}/api/"
  echo "  Health:    ${PUBLIC_URL}/health"
  echo "  Banco:     PostgreSQL (Porta 5432)"
  echo "  Redis:     Porta 6379 (Online)"
  echo "  PM2:       pm2 status && pm2 logs zapflow-api"
  echo "  Firewall:  Ativo (Bloqueia porta direta ${BACKEND_PORT})"
  echo ""
  echo "  ► /connections → scan WhatsApp QR"
  echo "  ► Auto-deploy ACTIVE: git push origin main → VPS updates"
  echo "============================================================"
}
