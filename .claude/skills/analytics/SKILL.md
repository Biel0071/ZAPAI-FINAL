---
name: analytics
description: Use ao criar ou revisar métricas, dashboards e BI do ZAPFLOW — KPIs, funis, tempo de resposta, mapa, heatmap, IA analytics. Aciona ao mexer no Dashboard, Analytics, ConversionHeatmap ou métricas de campanha.
---

# Analytics Skill

## Criar / revisar

- **KPIs** — dashboard tem abas (overview/conversations/ai/commercial/operations/analytics/infra/map/executive/diagnostics/reports). Dados reais do backend, sem mock.
- **Dashboards** — `pages/Dashboard.tsx` (container) → `adapters/lovable/dashboardAdapter` → `lovable/pages/DashboardView.tsx`. Analytics/Operations são abas do Dashboard.
- **Funis** — `funnel_stage`/`lead_temperature` em `conversations`; `salesFunnel.js` no backend.
- **Tempo de resposta** — `campaignAnalysisService` calcula % resposta e tempo médio da 1ª resposta a partir de `messages` (from_me/created_at).
- **Mapa / Heatmap** — mapa de regiões no dashboard; `ConversionHeatmap` (componente pronto) alimentado com dados reais de campanha.
- **IA Analytics** — `aiIntelligenceService`, executive insights (`aiExecutiveInsightService`).

## Regra (aprendida)

- Toda taxa/percentual precisa de clamp e denominador coerente. Bug real corrigido: "Automação IA 297%" (aiResponses acumulado ÷ messagesToday) → clamp a 100%. Sempre validar janelas de tempo compatíveis.
- Dados REAIS, sem mock — requisito do projeto.
