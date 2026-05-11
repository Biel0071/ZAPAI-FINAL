#!/bin/bash
# ==============================================================================
# ZAPFLOW AI — AUTO-BOOTSTRAP VPS SCRIPT
# ==============================================================================
# Setup automático para Ubuntu 24.04 VPS
# Executar como root: bash setup-vps.sh
# ==============================================================================

set -e

echo "🚀 Iniciando auto-bootstrap do Zapflow AI..."

# 1. Atualizar pacotes e instalar dependências
echo "📦 Instalando dependências do sistema..."
apt-get update && apt-get upgrade -y
apt-get install -y curl wget git jq ufw htop

# 2. Instalar Docker e Docker Compose
if ! command -v docker &> /dev/null; then
    echo "🐳 Instalando Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
else
    echo "✅ Docker já está instalado."
fi

# 2.5 Instalar Netdata para observabilidade
if [ ! -d "/opt/netdata" ] && ! command -v netdata &> /dev/null; then
    echo "📊 Instalando Netdata..."
    wget -O /tmp/netdata-kickstart.sh https://get.netdata.cloud/kickstart.sh && sh /tmp/netdata-kickstart.sh --non-interactive || true
else
    echo "✅ Netdata já está instalado."
fi

# 3. Configurar Firewall (UFW)
echo "🛡️ Configurando Firewall..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp  # App pública
ufw allow 8080/tcp  # Dozzle Logs
ufw allow 19999/tcp # Netdata
ufw --force enable

# 4. Preparar Ambiente do Projeto
echo "📂 Preparando diretórios do projeto..."
WORKDIR="/opt/ZAPAI-FINAL"
if [ ! -d "$WORKDIR" ]; then
    echo "Clonando repositório..."
    # Necessário que o repositório seja público ou tenha chave SSH configurada
    git clone https://github.com/Biel0071/ZAPAI-FINAL.git "$WORKDIR"
fi

cd "$WORKDIR"
git pull origin main

# 5. Auto-configurar .env se não existir
if [ ! -f ".env.production" ]; then
    echo "📝 Criando .env.production padrão..."
    cp .env.production.example .env.production
    # Substituir segredos
    sed -i "s/TROQUE_openssl_rand_hex_32/$(openssl rand -hex 32)/g" .env.production
    sed -i "s/TROQUE_openssl_rand_hex_24/$(openssl rand -hex 24)/g" .env.production
    sed -i "s/TROQUE_PARA_UMA_SENHA_FORTE/zapadmin123/g" .env.production
    sed -i "s/TROQUE_PARA_SENHA_FORTE/zapadmin123/g" .env.production
    echo "✅ .env.production gerado! Senha padrão DB: zapadmin123 | Senha Admin: zapadmin123"
fi

# 5.5 Instalar Node.js e compilar o Frontend
if ! command -v node &> /dev/null; then
    echo "🟩 Instalando Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

echo "🏗️ Compilando Frontend React/Vite..."
cd frontend
npm ci
npm run build
cd ..

# 6. Criar Volumes e Diretórios
echo "📁 Criando diretórios persistentes..."
mkdir -p backups/postgres logs/backend backend/sessions backend/uploads
chmod -R 777 backups logs backend/sessions backend/uploads

# 7. Limpar Containers Antigos
echo "🧹 Limpando containers órfãos..."
docker compose --env-file .env.production -f docker-compose.production.yml down --remove-orphans || true

# 8. Validar Nginx Syntax
echo "🔍 Validando Nginx Syntax..."
docker run --rm -v $(pwd)/infra/nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro nginx:alpine nginx -t || { echo "❌ nginx inválido"; exit 1; }

# 9. Subir Stack
echo "⚙️ Construindo e iniciando stack..."
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build || { echo "❌ compose inválido ou build quebrado"; exit 1; }

# 10. Healthchecks e Testes Automáticos
echo "⏳ Aguardando serviços estabilizarem (10s)..."
sleep 10

echo "🧪 Executando Testes Finais..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000)
if [ "$HTTP_CODE" != "200" ]; then
    echo "❌ frontend quebrado (HTTP $HTTP_CODE)"
    exit 1
fi

API_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/health || echo "000")
if [ "$API_CODE" != "200" ]; then
    echo "❌ api falhar (HTTP $API_CODE)"
    exit 1
fi

if grep -qi "localhost:4025" frontend/src/config/runtime.ts; then
    echo "❌ localhost detectado ou 4025 detectado no frontend!"
    exit 1
fi

echo ""
echo "============================================================"
echo "✨ ZAPFLOW AI DEPLOY CONCLUÍDO ✨"
echo "============================================================"
echo "Acesse a aplicação via http://<SEU_IP_AQUI>"
echo "Painel de Logs: docker compose --env-file .env.production -f docker-compose.production.yml logs -f"
echo "Para verificar a saúde dos containers:"
echo "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"
echo "============================================================"
