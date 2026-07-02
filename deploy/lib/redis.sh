# ZAPAI Install Library — redis.sh
# Redis installer and verification.

install_redis() {
  step "5. REDIS"
  if [ "$OS_FAMILY" = "rhel" ]; then
    REDIS_SVC="redis"
  else
    REDIS_SVC="redis-server"
  fi

  if $SKIP_REDIS; then
    warn "Redis install skipped (--skip-redis)"
    return 0
  fi

  if ! command -v redis-server >/dev/null 2>&1 && ! command -v redis-cli >/dev/null 2>&1; then
    if [ "$OS_FAMILY" = "debian" ]; then
      apt-get install -y -qq redis-server 2>&1 | tail -3
    else
      dnf install -y -q redis 2>&1 | tail -3
    fi
    sed -i 's/^# bind 127.0.0.1/bind 127.0.0.1/' /etc/redis/redis.conf 2>/dev/null || true
    sed -i 's/^# bind 127.0.0.1/bind 127.0.0.1/' /etc/redis.conf 2>/dev/null || true
    enable_service "$REDIS_SVC"
    log "Redis installed"
  else
    log "Redis already installed"
  fi

  start_service "$REDIS_SVC"
  sleep 2
  if redis-cli ping 2>/dev/null | grep -q PONG; then
    log "Redis: PONG received — online"
  else
    warn "Redis not responding — system will continue without caching layer"
  fi
}
