# ZapAI CRM — WhatsApp CRM com IA

> Sistema completo de CRM para WhatsApp com automação por IA, gestão de conversas em tempo real, sessões multi-dispositivo via Baileys e dashboard React PWA.

[![Node](https://img.shields.io/badge/Node-20_LTS-green)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-blue)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue)](https://postgresql.org)
[![socket.io](https://img.shields.io/badge/socket.io-4.8-black)](https://socket.io)

---

## Visão Geral

O ZapAI CRM conecta múltiplas sessões WhatsApp a um painel centralizado, permitindo:

- 📱 **Multi-sessão WhatsApp** via Baileys (sem API oficial)
- 💬 **Inbox unificada** com conversas, contatos, tags e respostas rápidas
- 🤖 **IA integrada** (OpenAI) para sugestões, respostas automáticas e análise
- 📊 **Analytics e CRM** com leads, campanhas e automações
- ⚡ **Tempo real** via socket.io (QR gerado ao vivo, mensagens instantâneas)
- 📲 **PWA** — instalável no celular como app nativo

---

## Stack

### Backend (`backend/`)
| Camada | Tecnologia |
|---|---|
| Runtime | Node.js 20 LTS |
| Framework | Express 4.22 |
| WebSocket | socket.io 4.8 |
| WhatsApp | @whiskeysockets/baileys 6.7 |
| Database | PostgreSQL 15 + pool `pg` |
| Auth | JWT HS256 nativo (sem jsonwebtoken) |
| IA | OpenAI SDK 6.32 |
| Logger | Winston + Pino |
| Cron | node-cron |

### Frontend (`frontend/`)
| Camada | Tecnologia |
|---|---|
| Framework | React 18 + Vite 5 |
| Linguagem | TypeScript 5.8 |
| UI | shadcn/ui + Radix UI + TailwindCSS |
| Ícones | Phosphor Icons + Lucide |
| Estado | React Query v5 + Zustand |
| Socket | socket.io-client 4.8 |
| PWA | vite-plugin-pwa + Workbox |
| Roteamento | React Router DOM v6 |

### Infraestrutura
| Serviço | Tecnologia |
|---|---|
| Process manager | PM2 |
| Reverse proxy | Nginx |
| SSL | Let's Encrypt (Certbot) |
| OS | Ubuntu 22.04 LTS |

---

## Estrutura de Pastas

```
ZAPAI-FINAL/
├── backend/                  ← API REST + WebSocket + WhatsApp
│   ├── server.js             ← Entrypoint (porta 4025)
│   ├── routes/               ← auth, messages, conversations, ai, sessions…
│   ├── controllers/          ← lógica de negócio
│   ├── services/             ← whatsapp/, ai, queue, realtime…
│   ├── middleware/           ← jwtAuth, rateLimiter, requestLogger…
│   ├── repositories/         ← acesso ao PostgreSQL
│   ├── migrations/           ← SQL migrations
│   ├── config/               ← database.js, runtimeEnv.js…
│   ├── .env.example          ← template de variáveis (58 vars)
│   └── package.json          ← 15 deps de produção
│
├── frontend/                 ← SPA React PWA
│   ├── src/
│   │   ├── pages/            ← Inbox, Dashboard, CRM, AI, Settings…
│   │   ├── services/         ← apiService, socketService, supabase…
│   │   ├── components/       ← layout, ui (shadcn), domain
│   │   └── hooks/            ← use-toast, use-mobile…
│   ├── .env.example          ← VITE_API_URL, VITE_SUPABASE_*
│   └── vite.config.ts        ← proxy /api + /auth + /socket.io → backend
│
├── deploy/
│   ├── ecosystem.config.js   ← PM2: autorestart, logs, 800MB limit
│   ├── nginx.conf            ← HTTPS, proxy API+WS, gzip, cache estático
│   ├── deploy.sh             ← backup → pull → build → deps → migrate → PM2 → smoke
│   ├── backup.sh             ← sessions tarball + pg_dump (retém 10)
│   └── rollback.sh           ← git checkout tag + restore backup + PM2
│
├── logs/                     ← runtime logs (gitignored, .gitkeep)
├── docs/                     ← documentação técnica
├── archive/                  ← código legado arquivado
└── README.md
```

---

## Quick Start — Desenvolvimento Local

### Pré-requisitos
- Node.js 20+
- PostgreSQL 15+ rodando localmente
- (Opcional) OpenAI API key para recursos de IA

### Backend
```bash
cd backend
cp .env.example .env
# Edite .env: DATABASE_URL, JWT_SECRET, AUTH_DEFAULT_USERNAME/PASSWORD
npm install
npm start
# → http://localhost:4025/health deve retornar {"success":true,...}
```

### Frontend
```bash
cd frontend
cp .env.example .env
# Edite .env: VITE_API_URL=http://localhost:4025
npm install
npm run dev
# → http://localhost:8080
```

### Verificar sistema funcionando
```bash
# Health check
curl http://localhost:4025/health

# Login (retorna JWT)
curl -X POST http://localhost:4025/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"sua-senha","tenantId":"default"}'
```

---

## Deploy VPS (Ubuntu 22.04+)

### 1. Pré-requisitos na VPS
```bash
# Node 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PM2
sudo npm i -g pm2

# Nginx
sudo apt install -y nginx

# PostgreSQL 15
sudo apt install -y postgresql postgresql-contrib

# Certbot (SSL)
sudo apt install -y certbot python3-certbot-nginx

# Usuário dedicado
sudo useradd -m -s /bin/bash zapai
sudo mkdir -p /opt/zapai && sudo chown zapai:zapai /opt/zapai
```

### 2. Clonar e configurar
```bash
sudo -u zapai bash
cd /opt/zapai
git clone https://github.com/Biel0071/ZAPAI-FINAL.git .

# Backend env
cp backend/.env.example backend/.env
nano backend/.env          # preencher DATABASE_URL, JWT_SECRET, AUTH_DEFAULT_PASSWORD, etc.

# Frontend env de produção
cp frontend/.env.example frontend/.env.production
nano frontend/.env.production
# VITE_API_URL=https://seu-dominio.com
```

### 3. Banco de dados
```bash
sudo -u postgres psql << 'SQL'
CREATE USER zapai WITH PASSWORD 'senha_forte_aqui';
CREATE DATABASE zapai_crm OWNER zapai;
GRANT ALL PRIVILEGES ON DATABASE zapai_crm TO zapai;
SQL
```

### 4. Nginx + SSL
```bash
# Substituir YOUR_DOMAIN no nginx.conf
sed -i 's/YOUR_DOMAIN/seu-dominio.com/g' deploy/nginx.conf
sudo cp deploy/nginx.conf /etc/nginx/sites-available/zapai
sudo ln -s /etc/nginx/sites-available/zapai /etc/nginx/sites-enabled/zapai
sudo nginx -t && sudo systemctl reload nginx

# SSL
sudo certbot --nginx -d seu-dominio.com
```

### 5. Primeiro deploy
```bash
chmod +x deploy/*.sh
./deploy/deploy.sh
# Acompanhar: pm2 logs zapai-backend
```

### Deploys subsequentes
```bash
./deploy/deploy.sh
```

### Rollback para versão estável
```bash
./deploy/rollback.sh v1-stable-freeze
```

---

## Variáveis de Ambiente

### Backend (`backend/.env`) — obrigatórias
| Variável | Exemplo | Descrição |
|---|---|---|
| `NODE_ENV` | `production` | Modo de execução |
| `PORT` | `4025` | Porta do servidor |
| `DATABASE_URL` | `postgresql://zapai:senha@localhost:5432/zapai_crm` | PostgreSQL |
| `JWT_SECRET` | *(64 chars random)* | Assinar tokens JWT |
| `AUTH_DEFAULT_USERNAME` | `admin` | Login do admin |
| `AUTH_DEFAULT_PASSWORD` | *(senha forte)* | Senha do admin |
| `DEFAULT_COMPANY_ID` | `default` | Tenant padrão |
| `FRONTEND_URL` | `https://seu-dominio.com` | CORS whitelist |
| `NGROK_MANAGED_EXTERNALLY` | `true` | Desabilitar ngrok em prod |
| `CRASH_EXIT_ON_UNHANDLED` | `true` | PM2 pode restartar |

### Backend — opcionais
| Variável | Descrição |
|---|---|
| `OPENAI_API_KEY` | IA (respostas automáticas, análise) |
| `OPENAI_MODEL` | Modelo padrão (default: gpt-4.1-mini) |
| `LOG_LEVEL` | `info` / `debug` / `warn` |
| `DB_RUN_MIGRATIONS_ON_BOOT` | `true` para auto-migrate |

### Frontend (`frontend/.env.production`)
| Variável | Exemplo | Descrição |
|---|---|---|
| `VITE_API_URL` | `https://seu-dominio.com` | Backend URL sem trailing slash |
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` | Se usar Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `eyJ...` | Chave anon Supabase |

> Ver template completo em `backend/.env.example` (58 variáveis documentadas).

---

## Gerar JWT_SECRET seguro
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Portas e Firewall

| Serviço | Porta | Exposição |
|---|:-:|---|
| Backend Node.js | 4025 | **interna** — somente via Nginx |
| Frontend / Nginx | 80 / 443 | **pública** |
| PostgreSQL | 5432 | **interna** — 127.0.0.1 apenas |

```bash
# UFW (VPS)
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw deny 4025/tcp  # Backend: NUNCA expor diretamente
sudo ufw enable
```

---

## Monitoramento

```bash
# Status dos processos
pm2 status

# Logs em tempo real
pm2 logs zapai-backend

# Health check
curl https://seu-dominio.com/health

# Reiniciar
pm2 restart zapai-backend
```

---

## Segurança — Checklist

- [ ] `JWT_SECRET` e `AUTH_JWT_SECRET` com 64+ caracteres únicos
- [ ] `AUTH_DEFAULT_PASSWORD` forte (nunca o default)
- [ ] `.env` nunca commitado (verificar com `git status`)
- [ ] Porta 4025 fechada no firewall externo
- [ ] SSL ativo (Certbot)
- [ ] `NGROK_MANAGED_EXTERNALLY=true` em produção
- [ ] `CRASH_EXIT_ON_UNHANDLED=true` para PM2 restartar

---

## Licença

Código proprietário — todos os direitos reservados.
