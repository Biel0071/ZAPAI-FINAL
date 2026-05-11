# CHANGELOG_AI

## 2026-04-28 - Estabilização VPS única (209.50.229.68:4025)

### Escopo
- Auditoria backend + deploy para operação exclusiva via VPS `209.50.229.68` na porta `4025`.
- Limpeza de legado conflitante de ngrok e variáveis duplicadas de API no deploy.

### Ajustes aplicados
- `backend/server.js`
  - Removidas dependências e fluxo de runtime/ngrok no boot e shutdown.
  - URL pública passa a usar `MASTER_API_URL`/`PUBLIC_API_URL` com fallback explícito para `http://209.50.229.68:4025`.
  - Mantidos healthcheck e Socket.IO com CORS por allowlist.
- `backend/controllers/conversationsController.js`
  - Removida dependência de `config/ngrok`.
  - Endpoint `/public-url` e geração de `paymentUrl` agora usam base explícita (`MASTER_API_URL`/`PUBLIC_API_URL`).
- `deploy/install.sh`
  - Removida geração de `VITE_WHATSAPP_API_BASE_URL` (fonte duplicada/legada).
- `deploy/doctor.sh`
  - Removida sugestão de `VITE_WHATSAPP_API_BASE_URL` ao regenerar `.env.production` do frontend.
- `deploy/ecosystem.config.js`
  - PM2 revisado para produção master: `NODE_ROLE=master`, `MASTER=true`, `MASTER_API_URL=http://209.50.229.68:4025`, `autorestart=true`.
  - Removidas flags de ngrok do perfil de produção.
- `.github/workflows/deploy-vps.yml`
  - Deploy automático em `main` com validação pós-deploy de `health` e handshake de Socket.IO.
- Templates de ambiente
  - Removidos blocos/flags de ngrok em `backend/.env.example`, `backend/.env.production.example` e `.env.production.example`.

### Validação local
- `node --check backend/server.js`: OK.
- `node --check backend/controllers/conversationsController.js`: OK.

### Resultado
- Backend e deploy alinhados para produção previsível via VPS oficial, sem dependência operacional de ngrok.

## 2026-04-27 - Operação DevOps ZAPAI-FINAL

### Contexto
- Atuação como engenharia DevOps para estabilização e deploy seguro do projeto ZAPAI-FINAL.
- VPS oficial prevista: `209.50.229.68`.
- Backend de produção: porta `4025`.
- Frontend de produção: porta `3000`.

### Auditoria local realizada
- Verificado estado Git em `main`.
- Confirmado último commit publicado: `d8bf099 fix deploy env parser definitivo`.
- Auditado `deploy/install.sh` para geração segura de `.env.production`.
- Auditado `docker-compose.production.yml` para serviços principais: postgres, redis, backup, backend e frontend.
- Confirmado que `deploy/install.sh` não possui mais geração via heredoc `cat <<EOF`.
- Confirmado que `deploy/install.sh` não possui linhas reais iniciadas com `+`.

### Validações locais executadas
- `git diff --check`: aprovado.
- `node --check backend/server.js`: aprovado.
- `npm --prefix frontend run build:prod`: aprovado.
- `docker compose --env-file .env.production -f docker-compose.production.yml config`: aprovado usando `.env.production` temporário criado a partir de `.env.production.example` e removido ao final.

### Observações
- O primeiro teste de build frontend foi reexecutado com `npm --prefix frontend` porque o terminal tentou executar `npm run build:prod` na raiz, onde não existe `package.json`.
- O build frontend emitiu aviso não bloqueante de Rollup sobre opções `minify` e `terserOptions`, mas concluiu com sucesso.
- Nenhum deploy em produção foi executado nesta etapa local sem confirmação/acesso SSH explícito.

### Próximos passos para VPS
1. Conectar na VPS via SSH.
2. Executar `git pull` no diretório do projeto.
3. Executar `sudo bash deploy/install.sh master`.
4. Validar `docker ps`.
5. Testar `curl http://127.0.0.1:4025/health` e `curl http://209.50.229.68:4025/health`.
6. Revisar logs dos containers `zapai-backend`, `zapai-frontend`, `zapai-postgres`, `zapai-redis`.

### Tentativa de execução VPS
- Usuário/host confirmado: `root@209.50.229.68`.
- Comando SSH de identificação executado antes de qualquer deploy destrutivo.
- Resultado: bloqueado por autenticação SSH.
- Erro retornado: `Permission denied (publickey,password)`.
- Nenhum `git pull`, `deploy/install.sh`, alteração Docker ou restart foi executado na VPS.

### Status
- Local validado.
- VPS aguardando credenciais SSH válidas ou sessão autenticada para execução remota.
