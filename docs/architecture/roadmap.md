# Roadmap MVP — ZAPAI-FINAL

## FUNCIONALIDADES MVP

- [x] Receber mensagem
- [x] Processar com IA
- [x] Responder usuário
- [x] Persistir dados
- [x] Interface básica
- [x] Deploy funcionando

## Status real do sistema

| Item | Status | Observação |
|---|---|---|
| Backend Express | ✅ Funcionando | `backend/server.js` é o entrypoint e possui healthcheck. |
| WebSocket / Socket.IO | ✅ Funcionando | Infra possui proxy `/socket.io/`; validação no `auto-deploy.sh`. |
| WhatsApp / Baileys | ⚠️ Instável | Funcional, mas depende de sessão persistente e QR/conexão real em produção. |
| IA / OpenAI | ⚠️ Instável | Código existe; depende de `OPENAI_API_KEY` válida. |
| Persistência PostgreSQL | ✅ Funcionando | Docker Compose production usa Postgres interno e volume persistente. |
| Redis | ✅ Funcionando | Docker Compose production usa Redis interno sem exposição pública. |
| Frontend React/Vite | ✅ Funcionando | Build gerado em `frontend/dist` e servido pelo Nginx. |
| Deploy produção | ✅ Funcionando | Caminho oficial: `infra/scripts/auto-deploy.sh` + `docker-compose.production.yml`. |
| SSL / HTTPS | ⚠️ Instável | Automatizado, mas depende de DNS real apontando para a VPS. |
| Observabilidade | ⚠️ Instável | Logs existem; falta dashboard/alerta consolidado. |

## Caminho oficial de produção

1. Configurar `.env.production` na raiz.
2. Garantir DNS do domínio apontando para a VPS.
3. Executar:

```bash
bash infra/scripts/auto-deploy.sh
```

4. Validar:

```bash
bash infra/scripts/auto-deploy.sh --status
curl -I https://SEU_DOMINIO.com
curl https://SEU_DOMINIO.com/health
curl https://SEU_DOMINIO.com/api/health
```

## Plano final de estabilização

### Alta prioridade

1. Consolidar deploy oficial em `infra/scripts/auto-deploy.sh` e marcar scripts antigos de `deploy/` como legado.
2. Remover ou arquivar diretórios duplicados de origem auxiliar (`ZAPAI-CRM/`, `swift-wa-assist/`) fora do runtime.
3. Corrigir conflito Nginx host vs Nginx container antes do deploy final em VPS.
4. Validar `.env.production` único na raiz contra `docker-compose.production.yml`.

### Média prioridade

1. Atualizar `README.md` para refletir Docker/Nginx atual em vez do fluxo PM2 antigo.
2. Separar documentação legada em `archive/`.
3. Padronizar scripts de diagnóstico em `infra/scripts/`.
4. Criar checklist operacional pós-deploy em `docs/deploy.md`.

### Baixa prioridade

1. Reorganizar backend futuramente para `backend/src/` com migração incremental.
2. Limpar arquivos `.legacy.js` após confirmar ausência de imports.
3. Reduzir dependências frontend não usadas após auditoria de bundle.
