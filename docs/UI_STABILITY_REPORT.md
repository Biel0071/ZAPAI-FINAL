# UI Stability Report

## Definição oficial (freeze)

- Frontend oficial fixado: `frontend/` (principal atual)
- Backend oficial fixado: `backend/`
- Fontes legadas (não renderizar): `ZAPAI-CRM`, `archive`, `master-node`, `swift-wa-assist`

## Regras aplicadas

1. Bloqueio de referências legadas em `src/` por `frontend/scripts/ui-stability-guard.cjs`.
2. Rotas oficiais congeladas e validadas no guard:
   - `/`
   - `/connections`
   - `/inbox`
   - `/contacts`
   - `/ai`
   - `/flows`
   - `/campaigns`
   - `/diagnostics`
   - `/settings`
   - `/admin/master`
   - `*`
3. Build de produção passa obrigatoriamente pelo guard (`build:prod`).
4. Rota duplicada de navegação removida da sidebar (`/?tab=performance`).

## Páginas duplicadas

Comparação entre oficial e legado (`archive/legacy-frontend-candidates/pages`):

- Legadas candidatas: `AIConfigPage`, `AIIntelligencePage`, `AnalyticsPage`, `CampaignsPage`, `ChatPage`, `ConnectionsPage`, `ContactsPage`, `DashboardPage`, `DiagnosticsPage`, `FlowBuilderPage`, `MapPage`, `QuickRepliesPage`
- Oficiais ativas: `AdminMaster`, `AI`, `Campaigns`, `Connections`, `Contacts`, `Dashboard`, `Diagnostics`, `Flows`, `Inbox`, `NotFound`, `Settings`

Status: não há renderização ativa de páginas legadas.

## Componentes duplicados

Comparação entre oficial e legado (`archive/legacy-frontend-candidates/components`):

- Legados de CRM detectados: `ChatWindow`, `ConversationItem`, `ConversationList`, `InboxLayout`, `MessageBubble`, `CampaignStepHeader`, `KpiTile`, `FlowPalette`, `InboxInfoCard`, `DddHeatmapCard`, `MetricGrid`, `OverviewPageHeader`, `SessionOverviewList`, `StatusGrid`, `TrendBarsCard`
- Oficiais ativos: componentes de `layout/*`, `system/*`, `theme/*` e `components/ui/*` (Shadcn)

Status: componentes legados preservados em `archive`, sem import ativo no frontend oficial.

## Rotas conflitantes

- Conflito identificado e removido: item de menu `/?tab=performance` (duplicava dashboard visualmente).
- Rotas válidas finais: apenas as rotas oficiais em `App.tsx`.

## Imports mortos (levantamento)

- Arquivo com uso não encontrado por import no `src`: `frontend/src/components/NavLink.tsx`.
- Arquivo CSS não importado em runtime principal: `frontend/src/App.css`.

Observação: o `FRONTEND_AUDIT_REPORT.json` lista órfãos por heurística ampla; este relatório destaca apenas os casos práticos de risco para flutuação de interface.

## Telas antigas ainda ativas

- Nenhuma tela legada ativa detectada em rotas oficiais.
- Nenhum import para `ZAPAI-CRM`, `archive`, `master-node` ou `swift-wa-assist` detectado em `frontend/src`.

## Build limpo

Executado com sucesso:

- `npm run ui:guard`
- `npm run audit:clean`
- `npm run build:prod`

Resultado: freeze visual validado e build concluído.
