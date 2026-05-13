#!/bin/bash
# Health check completo ZAPFLOW
# Uso: ./health-check.sh

API="http://127.0.0.1:4025"
FRONTEND="http://127.0.0.1:3000"
NGINX="http://127.0.0.1"

echo "=== ZAPFLOW HEALTH CHECK ==="
echo "Data: $(date)"
echo ""

echo "--- Docker Containers ---"
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep zapai

echo ""
echo "--- Backend Health ---"
curl -sS "$API/health" | head -c 300
echo ""

echo "--- Frontend (direct) ---"
curl -sS -o /dev/null -w "HTTP %{http_code}\n" "$FRONTEND/"

echo "--- Frontend (via Nginx) ---"
curl -sS -o /dev/null -w "HTTP %{http_code}\n" "$NGINX/"

echo ""
echo "--- API Endpoints ---"
curl -sS -o /dev/null -w "Login API: %{http_code}\n" -X POST "$API/api/auth/login" -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123"}'
curl -sS -o /dev/null -w "Conversations: %{http_code}\n" -H 'x-tenant-id: default' "$API/api/conversations"
curl -sS -o /dev/null -w "Contacts: %{http_code}\n" -H 'x-tenant-id: default' "$API/api/contacts"
curl -sS -o /dev/null -w "Campaigns: %{http_code}\n" -H 'x-tenant-id: default' "$API/api/campaigns"

echo ""
echo "--- WhatsApp Session ---"
curl -sS -H 'x-tenant-id: default' "$API/api/sessions/status" | grep -o '"status":"[^"]*"'

echo ""
echo "--- Memory ---"
docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.CPUPerc}}' | grep zapai

echo ""
echo "--- Disk ---"
df -h / | tail -1

echo ""
echo "=== DONE ==="
