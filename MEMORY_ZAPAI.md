# 🧠 ZAPAI-FINAL — Memória de IA do Projeto

> Arquivo de contexto persistente. Atualizar após cada sessão de trabalho.
> Qualquer IA que ler este arquivo entende o estado completo do sistema em minutos.

---

## 📌 IDENTIDADE DO PROJETO

| Campo | Valor |
|---|---|
| Nome | ZapAI CRM |
| Repositório | https://github.com/Biel0071/ZAPAI-FINAL |
| Tipo | SaaS WhatsApp CRM — chatbot + atendimento humano + campanhas |
| Stack | Node.js 20 + React 18 + PostgreSQL 15 + Baileys + Socket.io |
| Infraestrutura | VPS Ubuntu + Docker Compose + Nginx + PM2 |
| IP da VPS | 209.50.229.68 (ICP) |
| Domínio | A definir / apontar |
| Branch principal | main |
| Porta backend | 4025 |
| Porta frontend | 3000 |

---

## 🏗️ ESTRUTURA DE PASTAS

```
ZAPAI-FINAL/
├── backend/                  ← API REST + WebSocket + WhatsApp engine
│   ├── server.js             ← Entrypoint (porta 4025)
│   ├── routes/               ← auth, messages, conversations, ai, sessions
│   ├── controllers/          ← lógica de negócio separada por domínio
│   ├── services/             ← whatsapp/, ai, queue, realtime
│   ├── middleware/           ← jwtAuth, rateLimiter, requestLogger
│   ├── repositories/         ← acesso ao PostgreSQL via pool pg
│   ├── migrations/           ← SQL migrations numeradas (006 mais recente)
│   ├── config/               ← database.js, runtimeEnv.js
│   └── .env.example          ← 58 variáveis documentadas
│
├── frontend/                 ← SPA React PWA (TypeScript + Vite + shadcn/ui)
│   ├── src/pages/            ← Inbox, Dashboard, CRM, AI, Settings, Diagnostics
│   ├── src/services/         ← apiService, socketService
│   └── src/components/       ← layout, ui (shadcn), domain
│
├── deploy/
│   ├── ecosystem.config.js   ← PM2: autorestart, 800MB limit, logs
│   ├── nginx.conf            ← HTTPS proxy, gzip, cache estático
│   ├── deploy.sh             ← backup → pull → build → deps → migrate → PM2
│   ├── backup.sh             ← sessions tarball + pg_dump (retém 10)
│   └── rollback.sh           ← git checkout tag + restore backup + PM2
│
├── .env.production           ← NÃO commitado — criar manualmente na VPS
├── docker-compose.yml        ← Dev local
├── docker-compose.production.yml ← Produção com Docker
└── MEMORY_ZAPAI.md           ← ESTE ARQUIVO
```

---

## ⚙️ STACK TÉCNICA DETALHADA

### Backend
- **Runtime**: Node.js 20 LTS
- **Framework**: Express 4.22
- **WebSocket**: socket.io 4.8
- **WhatsApp**: @whiskeysockets/baileys 6.7
- **Database**: PostgreSQL 15 + pool `pg`
- **Auth**: JWT HS256 nativo (sem jsonwebtoken externo)
- **IA**: OpenAI SDK 6.32 (opcional)
- **Logger**: Winston + Pino
- **Cron**: node-cron
- **Process manager**: PM2 (deploy sem Docker) ou Docker Compose

### Frontend
- **Framework**: React 18 + Vite 5 + TypeScript 5.8
- **UI**: shadcn/ui + Radix UI + TailwindCSS
- **Estado**: React Query v5 + Zustand
- **Socket**: socket.io-client 4.8
- **PWA**: vite-plugin-pwa + Workbox
- **Roteamento**: React Router DOM v6

### Infra atual na VPS
- Docker + Docker Compose instalados
- Sistema subindo via `docker-compose.production.yml`
- Dashboard acessível e mostrando dados reais (confirmado em 04/05/2026)

---

## 🔌 VARIÁVEIS DE AMBIENTE CRÍTICAS

### Backend (.env.production) — obrigatórias
```env
NODE_ENV=production
PORT=4025
DATABASE_URL=postgresql://zapai:SENHA@postgres:5432/zapai_crm
JWT_SECRET=<64 chars random>
AUTH_JWT_SECRET=<64 chars random>
AUTH_DEFAULT_USERNAME=admin
AUTH_DEFAULT_PASSWORD=<senha forte>
FRONTEND_URL=https://SEU_DOMINIO.com
CORS_ALLOWED_ORIGINS=https://SEU_DOMINIO.com
NGROK_MANAGED_EXTERNALLY=true
CRASH_EXIT_ON_UNHANDLED=true
LOG_LEVEL=info
DB_RUN_MIGRATIONS_ON_BOOT=true

# Postgres
POSTGRES_USER=zapai
POSTGRES_PASSWORD=<senha forte>
POSTGRES_DB=zapai_crm

# Tokens multi-tenant
MASTER_PANEL_TOKEN=<token>
NODE_REGISTRATION_TOKEN=<token>
```

### Frontend (build-time)
```env
VITE_API_URL=https://SEU_DOMINIO.com
```
> ⚠️ VITE_API_URL é baked no build. Deve ser HTTPS + domínio, nunca IP direto.

---

## 🐛 BUGS CONHECIDOS E CORRIGIDOS

| # | Bug | Status | Data |
|---|-----|--------|------|
| B1 | VITE_API_URL hardcoded com IP 209.50.229.68 | ✅ Corrigido — fallback removido do compose e env.example | 04/05/2026 |
| B2 | Portas 5432 e 6379 expostas publicamente no compose | ✅ Corrigido — ports removidos, acesso apenas via rede Docker | 04/05/2026 |
| B3 | CORS_ALLOWED_ORIGINS inclui domínio Lovable externo | ✅ Corrigido — removido de .env.production.example | 04/05/2026 |
| B4 | Conflito PM2 vs Docker (dois modelos no mesmo repo) | ✅ Resolvido — infra/ criada, Makefile unifica comandos | 04/05/2026 |
| B5 | Sessões Baileys sem backup automático no pipeline Docker | ✅ Corrigido — script backup-sessions.sh criado em infra/scripts/ | 04/05/2026 |

---

## ✅ FUNCIONALIDADES IMPLEMENTADAS

- [x] Conexão WhatsApp via QR Code (Baileys)
- [x] Envio e recebimento de mensagens
- [x] Dashboard com métricas em tempo real
- [x] Interface estilo inbox/chat
- [x] Sistema de sessões multi-dispositivo
- [x] API REST completa
- [x] Socket.io tempo real
- [x] Autenticação JWT
- [x] Sistema multi-tenant parcial
- [x] Campanhas (estrutura)
- [x] Integração OpenAI (opcional)
- [x] PWA instalável
- [x] Sistema de logs (Winston + Pino)
- [x] Healthcheck endpoint
- [x] Backup automático PostgreSQL
- [x] Rollback automático via script
- [x] Página de login pré-dashboard (rota pública `/login`)
- [x] Recuperação de senha via e-mail (endpoint + página)
- [x] Página "esqueci minha senha"
- [x] Onboarding wizard de primeiro acesso (/onboarding)
- [x] Nginx service no docker-compose (infra/docker/docker-compose.prod.yml)
- [x] SSL automatizado no compose (certbot service)
- [x] Backup automático das sessões Baileys no Docker
- [x] Fechar portas 5432/6379 no docker-compose.production.yml
- [x] VITE_API_URL via domínio HTTPS (não IP)
- [x] Envio de e-mails para recuperação de senha

---

## 🚧 FUNCIONALIDADES PENDENTES

- [ ] Testar login em produção com credenciais do .env
- [ ] Apontar domínio para IP da VPS (209.50.229.68)
- [ ] Configurar SSL via Certbot e atualizar nginx.conf com domínio real

---

## 📋 MIGRATIONS APLICADAS

| Arquivo | Descrição |
|---|---|
| 001_* | Schema inicial |
| 002_* | Usuários e autenticação |
| 003_* | Conversas e mensagens |
| 004_* | Sessões WhatsApp |
| 005_* | CRM / leads |
| 006_fix_master_node_schema.js | Fix schema master/node + tabela nodes |

---

## 🔄 FLUXO DE DEPLOY ATUAL (Docker)

```bash
# Na VPS, dentro de /opt/zapai ou onde clonou
git pull origin main
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build

# Verificar
docker compose -f docker-compose.production.yml ps
curl http://localhost:4025/health
```

---

## 🔐 MODELO DE AUTENTICAÇÃO

- Login via `POST /api/auth/login` com `{ username, password, tenantId }`
- Retorna JWT Bearer token
- Token usado em todas as rotas protegidas via header `Authorization: Bearer <token>`
- `tenantId` default: `default`
- Admin default: `AUTH_DEFAULT_USERNAME` / `AUTH_DEFAULT_PASSWORD` do .env

---

## 📡 ENDPOINTS PRINCIPAIS

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /health | Healthcheck público |
| POST | /api/auth/login | Login → JWT |
| GET | /api/conversations | Lista conversas |
| POST | /api/messages/send | Envia mensagem |
| GET | /api/sessions | Lista sessões WhatsApp |
| POST | /api/sessions/:id/qr | Gera QR Code |
| GET | /api/analytics | Métricas |

---

## 🧭 DECISÕES ARQUITETURAIS TOMADAS

1. **Baileys** escolhido sobre API oficial WA para eliminar custo por mensagem
2. **Sessões em arquivo** (`/app/sessions` volume Docker) para persistência
3. **Multi-tenant por tenantId** — estrutura preparada, não 100% implementada
4. **PM2 como alternativa ao Docker** — deploy.sh usa PM2 direto sem container
5. **JWT nativo** (sem lib jsonwebtoken) para reduzir dependências

---

## 📅 HISTÓRICO DE SESSÕES DE TRABALHO

| Data | Sessão | O que foi feito |
|------|--------|-----------------|
| 04/05/2026 | Diagnóstico inicial | Análise completa do repositório. Identificados 5 blockers críticos. Sistema rodando na VPS ICP com Docker. Dashboard acessível com dados reais. |
| 04/05/2026 | Login + Infra + Correções | Criada página de login (/login), forgot-password, ProtectedRoute, authService. Auth backend corrigido para bcrypt contra DB. Portas 5432/6379 fechadas no compose. IP hardcoded removido. Nginx + certbot integrados no docker-compose.production.yml principal. Porta 4025 do backend fechada para host (apenas nginx acessa). Frontend servido via nginx static. Criada infra/ com nginx, certbot, Makefile, scripts backup-sessions.sh, setup-vps.sh, validate-production.sh. |
| 04/05/2026 | Onboarding wizard | Criada tela /onboarding com wizard de 3 passos (empresa, e-mail admin, WhatsApp). Controle de estado via localStorage (zapai_onboarding_done). Rota pública adicionada ao App.tsx. |
| 04/05/2026 | Deploy PRO evolução | auto-deploy.sh evoluído: idempotência (verifica antes de instalar/gerar), rollback automático (backup pré-deploy de nginx.conf, frontend/dist, imagem Docker), validação forte (health 90s retry, frontend HTTP, WebSocket handshake, containers), SSL inteligente (dry-run certbot, verifica expiração), modo --status, modo --debug, saída profissional. Criado deploy-to-vps.ps1 (deploy da máquina Windows para VPS via SSH/SCP). |

> **Como atualizar**: Após cada sessão, adicionar linha no histórico acima com data, resumo e arquivos modificados.

---

## 🎯 PRÓXIMOS PASSOS PRIORIZADOS

1. **Apontar domínio** para IP da VPS (209.50.229.68)
2. **Configurar SSL** via Certbot e atualizar nginx.conf com domínio real
3. **Testar login** em produção com credenciais do .env

---

*Última atualização: 04/05/2026 — Sessão: Onboarding + Infra Finalizada*
