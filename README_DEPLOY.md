# ===========================================================================
# README_DEPLOY.md — ZAPFLOW AI — Guia de Deploy em VPS
# ===========================================================================

## Instalação Rápida em VPS (Ubuntu 20.04+)

```bash
# 1. Clone o repositório
git clone https://github.com/SEU_USUARIO/ZAPAI-FINAL.git
cd ZAPAI-FINAL

# 2. Configure o ambiente
cp .env.example .env
nano .env  # Edite: JWT_SECRET, POSTGRES_PASSWORD, AUTH_DEFAULT_PASSWORD, DOMAIN

# 3. Torne os scripts executáveis
chmod +x scripts/install.sh scripts/deploy.sh scripts/update.sh \
         scripts/backup.sh scripts/restart.sh scripts/logs.sh

# 4. Execute a instalação
sudo ./scripts/install.sh
```

O script `install.sh` vai:
- Instalar Docker e Docker Compose automaticamente
- Gerar secrets (`JWT_SECRET`, `AUTH_JWT_SECRET`, etc.) se estiverem em branco
- Criar os diretórios necessários (`data/`, `logs/`, `uploads/`, `backups/`)
- Buildar o frontend com `VITE_API_URL=/api`
- Subir todos os containers via `docker compose -f docker-compose.production.yml up -d --build`
- Validar o healthcheck em `http://localhost/api/health`

---

## Atualização

```bash
./scripts/update.sh
```

Faz backup automático antes de atualizar.

---

## Deploy Manual

```bash
./scripts/deploy.sh
```

---

## Logs

```bash
# Todos os serviços
./scripts/logs.sh

# Apenas o backend
./scripts/logs.sh backend

# Nginx, últimas 100 linhas
./scripts/logs.sh nginx 100

# Ou via docker compose diretamente
docker compose -f docker-compose.production.yml logs -f backend
docker compose -f docker-compose.production.yml logs -f nginx
```

---

## Healthcheck

```bash
curl http://localhost/api/health
curl http://localhost/api/contacts
curl http://localhost/api/campaigns
curl http://localhost/api/session-status
curl http://localhost/api/metrics
curl http://localhost/api/system/info
curl http://localhost/api/logs
```

---

## Status dos Containers

```bash
docker compose -f docker-compose.production.yml ps
```

---

## Backup Manual

```bash
./scripts/backup.sh
# Arquivo criado em: backups/zapflow-backup-YYYY-MM-DD-HH-mm.tar.gz
```

---

## Reiniciar

```bash
./scripts/restart.sh           # todos
./scripts/restart.sh backend   # só backend
./scripts/restart.sh nginx     # só nginx
```

---

## Variáveis de Ambiente Obrigatórias

| Variável | Descrição | Valor em Produção |
|---|---|---|
| `NODE_ENV` | Ambiente | `production` |
| `PORT` | Porta interna do backend | `4025` |
| `VITE_API_URL` | URL da API no frontend | `/api` |
| `DATABASE_URL` | Conexão PostgreSQL | `postgresql://...@postgres:5432/...` |
| `REDIS_URL` | Conexão Redis | `redis://redis:6379` |
| `JWT_SECRET` | Secret do JWT | Gerar com `openssl rand -hex 32` |
| `AUTH_DEFAULT_USERNAME` | Admin padrão | `zapadmin` |
| `AUTH_DEFAULT_PASSWORD` | Senha admin padrão | **Altere obrigatoriamente!** |
| `POSTGRES_PASSWORD` | Senha do banco | **Altere obrigatoriamente!** |

---

## Troubleshooting

### Network Error no frontend

**Causa**: Frontend chamando `localhost` em produção, ou backend offline.

**Solução**:
1. Verifique que `VITE_API_URL=/api` no `.env` e no `frontend-official/.env.production`
2. Verifique que o backend está online: `./scripts/logs.sh backend`
3. Verifique que o Nginx está servindo o frontend: `./scripts/logs.sh nginx`

### API offline (502 Bad Gateway)

**Causa**: Backend container não subiu ou ainda está inicializando.

**Solução**:
```bash
docker compose -f docker-compose.production.yml ps
./scripts/logs.sh backend 50
```

### Frontend retorna 404 em refresh

**Causa**: Nginx não está configurado com `try_files $uri /index.html`.

**Solução**: O arquivo `deploy/nginx/default.conf` já inclui o fallback SPA. Verifique se o volume está montado corretamente.

### WhatsApp não conecta

**Causa**: Sessão expirada ou QR não escaneado.

**Solução**:
1. Acesse `/connections` no frontend
2. Clique em "Criar sessão" ou "Reconectar"
3. Escaneie o QR code com o WhatsApp

### Banco de dados indisponível

**Causa**: PostgreSQL ainda inicializando.

**Solução**: Aguarde o healthcheck do postgres:
```bash
docker compose -f docker-compose.production.yml logs postgres
```

### Mapa sem dados / Contatos vazios

**Causa**: Banco vazio. É comportamento esperado em nova instalação.

**Solução**: Importe contatos via `/contacts` no frontend ou via API:
```bash
curl -X POST http://localhost/api/contacts \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Teste","phone":"5511999999999"}'
```

### Campanhas sem público

**Causa**: Tabela `campaigns` pode ainda não estar criada.

**Status**: Ver `docs/API_CONTRACT.md` — seção "Pendências".

---

## Arquitetura

```
Internet → Nginx (porta 80) ─┬─ /         → frontend-official/dist/
                              ├─ /api/     → backend:4025
                              └─ /socket.io/ → backend:4025 (WebSocket)

backend:4025 ─┬─ PostgreSQL:5432
               └─ Redis:6379
```

---

## Comando Final para Instalar na VPS

```bash
git clone https://github.com/SEU_USUARIO/ZAPAI-FINAL.git && \
cd ZAPAI-FINAL && \
cp .env.example .env && \
nano .env && \
chmod +x scripts/*.sh && \
sudo ./scripts/install.sh
```
