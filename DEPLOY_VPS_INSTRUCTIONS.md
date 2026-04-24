# ZAPAI - DEPLOY VPS INSTRUÇÕES URGENTES

## PROBLEMA IDENTIFICADO

Erro: `failed to read dockerfile: open Dockerfile: no such file or directory`

## SOLUÇÃO IMEDIATA

### Opção 1: Quick Deploy (Recomendado)

```bash
cd /path/to/ZAPAI-FINAL
sudo bash deploy/quick-deploy.sh
```

Este script:
1. Cria Dockerfiles se não existirem
2. Para containers existentes
3. Build e start containers
4. Roda migrations automaticamente
5. Seed admin user
6. Valida /api/health db:true

### Opção 2: Deploy Manual

```bash
cd /path/to/ZAPAI-FINAL

# 1. Criar Dockerfile backend se não existir
cat > backend/Dockerfile << 'EOF'
FROM node:18-alpine

RUN apk add --no-cache python3 make g++ ffmpeg imagemagick webp

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN mkdir -p sessions uploads logs

EXPOSE 4025

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4025/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "server.js"]
EOF

# 2. Criar Dockerfile frontend se não existir
cat > frontend/Dockerfile << 'EOF'
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
EOF

# 3. Parar containers existentes
docker compose down -v

# 4. Build e start
docker compose up -d --build postgres backend

# 5. Esperar backend ficar healthy
sleep 30

# 6. Rodar migrations
docker exec zapai-backend node scripts/init-database.js

# 7. Seed admin
docker exec zapai-backend node scripts/seed-admin.js

# 8. Validar health
curl http://localhost:4025/health
```

## VALIDAÇÃO

```bash
# Verificar containers
docker ps

# Verificar logs backend
docker logs zapai-backend

# Verificar health endpoint
curl http://localhost:4025/health

# Verificar database connection
docker exec zapai-postgres psql -U zapai -d zapai_crm -c "SELECT 1;"
```

## RESULTADO ESPERADO

```json
{
  "status": "ok",
  "db": true,
  "whatsapp": "offline",
  "timestamp": "2026-04-24T..."
}
```

## LOGIN ADMIN

- Username: `admin`
- Password: `admin123` (ou check .env.production)

## TROUBLESHOOTING

### Backend não inicia
```bash
docker logs zapai-backend
```

### Database connection error
```bash
docker exec zapai-postgres psql -U zapai -d zapai_crm -c "SELECT 1;"
```

### Rebuild completo
```bash
docker compose down -v
docker compose up -d --build --force-recreate
```

### Verificar DATABASE_URL
```bash
docker exec zapai-backend env | grep DATABASE_URL
```

Deve retornar:
```
DATABASE_URL=postgresql://zapai:zapai_password@postgres:5432/zapai_crm
```

---

**URGÊNCIA: RESOLVIDO**
