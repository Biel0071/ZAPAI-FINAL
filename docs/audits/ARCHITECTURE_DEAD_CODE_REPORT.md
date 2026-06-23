# ZAPAI-FINAL — Architecture Dead Code Report
Generated: 2026-05-13 12:17

## STATUS: CONSOLIDATED ✅

## O Que Foi Arquivado

### Scripts de Deploy (→ archive/legacy/deploy/)
22 arquivos movidos:
deploy.sh, quick-deploy.sh, update.sh, install.sh, full-install.sh,
doctor.sh (22KB), doctor-full.sh, diagnose-production.sh, restart-clean.sh,
reset.sh, rollback.sh, backup.sh, check.sh, health-check.sh, monitor-72h.sh,
nginx-setup.sh, configure-nginx.sh, ssl-certbot.sh, init-database-container.sh,
install-node.sh, setup-monitoring.sh, ecosystem.config.js (LEGADO - zapai-backend)

### Scripts de Root (→ archive/legacy/)
6 arquivos: deploy.sh, emergency-restart.sh, runtime-doctor.sh, setup-vps.sh,
rollback.sh, validate-vps.sh

### Scripts em scripts/ (→ archive/legacy/scripts/)
4 arquivos: deploy.sh, rollback.sh, monitor.sh, zapai-agent.sh

### Nginx Legado (→ archive/legacy/nginx/)
deploy/nginx-api.conf, deploy/nginx.production.conf.template,
infrastructure/nginx/nginx.conf.template

### Frontend Legado (→ archive/legacy/frontend-old/)
Todo o código de frontend/src/ (Supabase-based, obsoleto desde março/2026)
43+ arquivos de código movidos (node_modules permanece em frontend/ para evitar
mover GBs — está em .gitignore do archive)

## O Que NÃO Foi Removido (Toda a Lógica de Runtime)

### Backend Routes (TODOS ATIVOS)
Nenhuma rota foi removida. 24 route files em backend/routes/.

### Frontend Pages (TODAS ATIVAS)
Nenhuma página foi removida. Todas 18 páginas mapeadas em App.tsx.

### Providers / Hooks / Services (TODOS ATIVOS)
RuntimeProvider, socketService, apiService, errorLogService — intactos.

## Duplicações Eliminadas

| Item | Antes | Depois |
|---|---|---|
| ecosystem.config.js | 2 (nomes diferentes!) | 1 (backend/) |
| PM2 app names | zapflow-api + zapai-backend | zapflow-api |
| Deploy scripts | 32 espalhados | 1 (auto-deploy.sh) |
| nginx.conf | 4 versões | 1 (deploy/nginx.conf) |
| Frontends | 2 (official + legado) | 1 (frontend-official/) |
| Root scripts | 6 órfãos | 0 |

## Riscos Eliminados

- PM2 iniciando com nome errado (zapai-backend vs zapflow-api)
- nginx reload usando config incorreta
- Developer executando script legado sem saber
- Confusão sobre qual ecosystem.config.js usar

## Validação Pós-Consolidação

- node --check backend/server.js: PASS
- node --check backend/ecosystem.config.js: PASS
- npx tsc --noEmit (frontend-official): 0 ERRORS
- Todos os 14 runtime files verificados: INTACT
