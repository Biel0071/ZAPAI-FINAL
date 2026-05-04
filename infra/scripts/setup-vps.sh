#!/bin/bash
# Setup inicial da VPS — executar uma vez
set -euo pipefail

echo "=== ZAPAI CRM — Setup VPS ==="

# 1. Criar estrutura de diretórios
mkdir -p /opt/zapai/{backups/{sessions,postgres},logs,certbot/{certs,www}}
chown -R "$USER":"$USER" /opt/zapai

# 2. UFW firewall
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw deny 4025/tcp  # Backend: NUNCA expor
ufw deny 5432/tcp  # Postgres: NUNCA expor
ufw deny 6379/tcp  # Redis: NUNCA expor
ufw --force enable

echo "=== Firewall configurado ==="
ufw status

# 3. Verificar Docker
docker --version
docker compose version

# 4. Clonar repo se não existir
if [ ! -d "/opt/zapai/ZAPAI-FINAL" ]; then
  git clone https://github.com/Biel0071/ZAPAI-FINAL.git /opt/zapai/ZAPAI-FINAL
fi

echo "=== Setup concluído ==="
echo "Próximos passos:"
echo "1. cd /opt/zapai/ZAPAI-FINAL"
echo "2. cp .env.production.example .env.production"
echo "3. nano .env.production  (preencher todas as variáveis)"
echo "4. make up"
