#!/bin/bash
# validate-production.sh — Valida configuração de produção
set -euo pipefail

ERRORS=0

echo "=== ZAPAI Production Validator ==="

# 1. docker-compose syntax
echo "[1/6] docker-compose syntax..."
if docker compose -f docker-compose.production.yml --env-file .env.production config > /dev/null 2>&1; then
  echo "  [OK] docker-compose syntax valid"
else
  echo "  [FAIL] docker-compose syntax invalid"
  ERRORS=$((ERRORS + 1))
fi

# 2. No exposed DB ports
echo "[2/6] Checking exposed ports..."
if grep -qE "^\s+- \"?(127\.0\.0\.1:)?5432:5432\"?" docker-compose.production.yml 2>/dev/null || \
   grep -qE "^\s+- \"?(127\.0\.0\.1:)?5432\"?" docker-compose.production.yml 2>/dev/null; then
  echo "  [FAIL] Postgres port 5432 exposed"
  ERRORS=$((ERRORS + 1))
else
  echo "  [OK] Postgres port NOT exposed"
fi

if grep -qE "^\s+- \"?(127\.0\.0\.1:)?6379:6379\"?" docker-compose.production.yml 2>/dev/null || \
   grep -qE "^\s+- \"?(127\.0\.0\.1:)?6379\"?" docker-compose.production.yml 2>/dev/null; then
  echo "  [FAIL] Redis port 6379 exposed"
  ERRORS=$((ERRORS + 1))
else
  echo "  [OK] Redis port NOT exposed"
fi

if grep -qE "^\s+- \"4025:4025\"" docker-compose.production.yml 2>/dev/null; then
  echo "  [FAIL] Backend port 4025 exposed to host (should be internal only)"
  ERRORS=$((ERRORS + 1))
else
  echo "  [OK] Backend port 4025 NOT exposed to host"
fi

# 3. No hardcoded IPs
echo "[3/6] Checking hardcoded IPs..."
if grep -qE "209\.50\.229\.68|127\.0\.0\.1:4025" docker-compose.production.yml 2>/dev/null; then
  echo "  [FAIL] Hardcoded IP found in docker-compose"
  ERRORS=$((ERRORS + 1))
else
  echo "  [OK] No hardcoded IP in docker-compose"
fi

if [ -f .env.production ] && grep -qE "209\.50\.229\.68" .env.production 2>/dev/null; then
  echo "  [WARN] Hardcoded IP found in .env.production"
else
  echo "  [OK] .env.production clean (or not present)"
fi

# 4. nginx.conf uses domain not IP
echo "[4/6] Checking nginx config..."
if grep -qE "209\.50\.229\.68|127\.0\.0\.1" infra/nginx/nginx.conf 2>/dev/null; then
  echo "  [WARN] Hardcoded IP in nginx.conf"
else
  echo "  [OK] nginx.conf clean"
fi

# 5. SSL placeholders replaced?
echo "[5/6] Checking SSL readiness..."
if grep -q "SEU_DOMINIO" infra/nginx/nginx.conf 2>/dev/null; then
  echo "  [WARN] nginx.conf still has placeholder SEU_DOMINIO"
else
  echo "  [OK] nginx.conf domain configured"
fi

if grep -q "SEU_DOMINIO" .env.production 2>/dev/null || \
   grep -q "SEU_IP_DA_VPS" .env.production 2>/dev/null; then
  echo "  [WARN] .env.production still has placeholders"
else
  echo "  [OK] .env.production placeholders filled (or not present)"
fi

# 6. Check .env.production.example has no hardcoded IPs
echo "[6/6] Checking .env.production.example..."
if grep -qE "209\.50\.229\.68|127\.0\.0\.1" .env.production.example 2>/dev/null; then
  echo "  [FAIL] Hardcoded IP in .env.production.example"
  ERRORS=$((ERRORS + 1))
else
  echo "  [OK] .env.production.example clean"
fi

# Summary
echo ""
if [ $ERRORS -eq 0 ]; then
  echo "✅ ALL CHECKS PASSED — Production configuration is clean"
  exit 0
else
  echo "❌ $ERRORS CHECK(S) FAILED — Fix before deploying"
  exit 1
fi
