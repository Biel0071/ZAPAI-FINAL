# ZAPAI-FINAL — Source of Truth Arquitetural

> Última atualização: 13/05/2026 | Status: PRODUCTION READY

---

## Estrutura Oficial

> Decisão de consolidação: `frontend-official/` é a única fonte de verdade do runtime do frontend. A UI do Lovable deve entrar por fluxo controlado via branch `lovable-sync` e superfície `frontend-official/src/lovable/`, sem manter app paralelo ou runtime concorrente.

```
ZAPAI-FINAL/
├── backend/                         ← BACKEND OFICIAL
│   ├── server.js                    ← Entrypoint principal
│   ├── ecosystem.config.js          ← PM2 OFICIAL (zapflow-api, porta 4025)
│   ├── docker-entrypoint.sh         ← Docker entrypoint
│   ├── autoBootstrap.js             ← Geração automática de .env
│   ├── config/                      ← database.js, redis.js
│   ├── controllers/                 ← Lógica de negócio
│   ├── routes/                      ← API routes (registradas em index.js)
│   ├── services/                    ← Runtime services (WhatsApp, AI, Queue)
│   ├── migrations/                  ← DB migrations (000-011)
│   ├── sessions/                    ← Baileys auth state (persistente em Docker volume)
│   └── scripts/
│       ├── healthcheck.js           ← HEALTHCHECK OFICIAL
│       ├── recovery.sh              ← RECOVERY OFICIAL
│       ├── run-migrations.js        ← Migration runner
│       └── seed-admin.js            ← Admin seed
│
├── frontend-official/               ← FRONTEND OFICIAL ÚNICO
│   └── src/                         ← React + Vite + TypeScript
│       ├── App.tsx                  ← Roteamento principal + guards + layout autenticado
│       ├── main.tsx                 ← Entrypoint + hardening + bootstrap real
│       ├── pages/                   ← Todas as páginas (Dashboard, Inbox, etc.)
│       ├── providers/               ← RuntimeProvider (WebSocket + Zustand)
│       └── lib/runtimeHardening.ts  ← JSON.parse patch + chunk recovery
│
├── deploy/                          ← DEPLOY OFICIAL
│   ├── auto-deploy.sh               ← AUTO-DEPLOY OFICIAL (com rollback)
│   ├── vps-setup.sh                 ← VPS SETUP OFICIAL (uma vez, como root)
│   └── nginx.conf                   ← NGINX OFICIAL
│
├── docker-compose.production.yml    ← DOCKER COMPOSE ÚNICO
│
└── archive/legacy/                  ← Scripts legados (arquivados, não executar)
```

---

## PM2 — App Oficial

```bash
# Nome: zapflow-api (NÃO zapai-backend — esse é legado)
pm2 start backend/ecosystem.config.js --env production
pm2 status
pm2 logs zapflow-api
```

---

## Deploy — Fluxo Oficial

```bash
# No VPS, após git pull:
bash deploy/auto-deploy.sh

# Flags disponíveis:
bash deploy/auto-deploy.sh --skip-build    # pula frontend build
bash deploy/auto-deploy.sh --skip-migrate  # pula migrations
bash deploy/auto-deploy.sh --dry-run       # valida sem aplicar
```

---

## Healthcheck Oficial

```bash
node backend/scripts/healthcheck.js           # texto
node backend/scripts/healthcheck.js --json    # JSON
node backend/scripts/healthcheck.js --strict  # exit 1 se falhar
```

---

## Recovery Oficial

```bash
bash backend/scripts/recovery.sh             # diagnose + recover
bash backend/scripts/recovery.sh --dry-run   # apenas diagnóstico
bash backend/scripts/recovery.sh --force     # força restart
```

---

## Nginx — Config Oficial

```bash
# Arquivo: deploy/nginx.conf
# Copiar para: /etc/nginx/sites-available/zapai
sudo cp deploy/nginx.conf /etc/nginx/sites-available/zapai
sudo ln -sf /etc/nginx/sites-available/zapai /etc/nginx/sites-enabled/zapai
sudo nginx -t && sudo systemctl reload nginx
```

---

## Portas

| Serviço | Porta | Observação |
|---|---|---|
| Backend | **4025** | Interno — só acessível via Nginx |
| Nginx HTTP | 80 | Público → redireciona p/ HTTPS |
| Nginx HTTPS | 443 | Público → proxy p/ backend:4025 |
| PostgreSQL | 5432 | Interno Docker |
| Redis | 6379 | Interno Docker |

---

## Arquivos que NÃO devem ser executados

Todo conteúdo em `archive/legacy/` é **legado arquivado**.
Não execute nenhum script desse diretório em produção.

---

## Variáveis de Ambiente Críticas

```env
NODE_ENV=production
PORT=4025
DATABASE_URL=postgresql://zapai:senha@postgres:5432/zapai_crm
JWT_SECRET=<mín 32 chars aleatórios>
REDIS_URL=redis://redis:6379
WHATSAPP_MAX_RECONNECT_REQUESTS=50
WHATSAPP_RECONNECT_BACKOFF_MAX_MS=90000
GRACEFUL_SHUTDOWN_TIMEOUT_MS=12000
CRASH_EXIT_ON_UNHANDLED=true
PM2_READY_SIGNAL=true
```
