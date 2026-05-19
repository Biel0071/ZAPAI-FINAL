# Consolidação ZAPAI-FINAL

## FASE 1 - Mapeamento

### Projeto oficial

- `ZAPAI-FINAL/frontend` - frontend oficial em React/Vite/Shadcn, com rotas oficiais e runtime config de produção.
- `ZAPAI-FINAL/backend` - backend oficial Node/Express, PM2/VPS, master node e integração PostgreSQL.
- `ZAPAI-FINAL/deploy` - scripts de deploy/doctor/rollback e Docker Compose.
- `ZAPAI-FINAL/archive` - destino para legado preservado sem ativação em runtime.
- `ZAPAI-FINAL/docs` - documentação operacional.

### Repositórios/fontes auxiliares locais

- `C:\projetos\ZAPAI-FINAL\ZAPAI-CRM` - versão auxiliar antiga com frontend CRM mais completo e backend legado.
- `C:\projetos\ZAPAI-FINAL\swift-wa-assist` - versão auxiliar praticamente espelhada ao frontend oficial atual.
- `C:\projetos\_archive\src-20260326-080102` - backup externo com componentes React/Lovable antigos.
- `C:\projetos\ai-engine-core` - motor AI externo; deve permanecer separado, apenas integrar via cliente/feature flag.

### Frontend - candidatos úteis

`ZAPAI-CRM/frontend` contém páginas/telas potencialmente superiores ou complementares:

- `AnalyticsPage.tsx`
- `ChatPage.tsx`
- `ConnectionsPage.tsx`
- `DashboardPage.tsx`
- `DiagnosticsPage.tsx`
- `FlowBuilderPage.tsx`
- `MapPage.tsx`
- `QuickRepliesPage.tsx`
- `AIConfigPage.tsx`
- `AIIntelligencePage.tsx`

Componentes úteis identificados:

- `components/inbox/*`
- `components/modules/overview/*`
- `components/modules/dashboard/KpiTile.tsx`
- `components/modules/flows/FlowPalette.tsx`
- `views/chat/*`
- `views/connections/*`
- `views/dashboard/*`

### Backend - candidatos úteis

`ZAPAI-CRM/backend/crm` contém módulos legados, muitos já migrados para o backend oficial:

- `ai/*`
- `ai-agents/*`
- `controllers/*`
- `routes/*`
- `services/*`
- `repositories/*`
- `migrations/*`

Observação: backend antigo contém configuração `ngrok` e não deve ser importado diretamente para produção. Qualquer módulo útil deve ser copiado pontualmente, isolado por feature flag e sem dependência de ngrok.

### Duplicações identificadas

- `swift-wa-assist` duplica majoritariamente o frontend oficial.
- `ZAPAI-CRM/backend/crm/ai` duplica `backend/ai` oficial.
- `ZAPAI-CRM/backend/_archive/baileys` duplica serviços WhatsApp legados já arquivados no backend oficial.
- Componentes UI antigos em `ZAPAI-CRM/frontend/src/components/ui` são redundantes com Shadcn oficial em `frontend/src/components/ui`.

## Decisão de consolidação

- Não substituir `frontend-official/src` oficial em massa.
- Não importar backend legado inteiro.
- Preservar candidatos em `archive/legacy-frontend-candidates` e importar para runtime oficial somente após build individual.
- Manter `ai-engine-core` fora do projeto oficial, integrado apenas via cliente/feature flag quando necessário.
- Toda UI real do Lovable deve entrar por `lovable-sync` e ser absorvida na superfície controlada `frontend-official/src/lovable/**`.

## FASE 2 - Consolidação executada

Arquivos candidatos preservados em `archive/legacy-frontend-candidates`:

- Páginas antigas de CRM em `pages/`.
- Componentes de inbox e módulos em `components/`.
- Views antigas de chat/connections/dashboard em `views/`.

Nenhuma rota de produção foi alterada nesta fase.

## FASE 3 - Organização executada

- Estrutura oficial mantida em `frontend/`, `backend/`, `deploy/`, `docs/` e `archive/`.
- Foi criada a pasta `archive/source-repositories`.
- A movimentação física de `ZAPAI-CRM` e `swift-wa-assist` foi bloqueada por permissão do Windows, provavelmente por arquivos travados ou `node_modules`. Eles devem ser tratados como fontes auxiliares arquiváveis, não como runtime oficial.
