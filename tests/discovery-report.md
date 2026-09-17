# Relatório de Auditoria E2E & Mapeamento Automático — ZAPFLOW AI

**Executado em:** 17/09/2026, 11:27:25
**Ferramenta:** Playwright Automated Discovery Crawler

---

## 📊 1. Resumo Executivo
* **Total de Rotas Mapeadas:** 21
* **Rotas Ativas (OK):** 14
* **Rotas Redirecionadas:** 7
* **Rotas Quebradas (400+ ou erro):** 0
* **Páginas Órfãs:** 0
* **Erros de Console/Navegador:** 60
* **APIs Consumidas:** 384 (Falhas: 0)

---

## 🚨 2. Análise de Erros e Rotas Quebradas
Abaixo estão detalhados os problemas graves que podem impedir a navegação ou causar falhas para o usuário.

### Rotas Quebradas
🟢 _Nenhuma rota quebrada detectada!_

### Páginas Órfãs
Estas páginas estão registradas na aplicação, mas não possuem links diretos no menu ou em botões mapeados:
🟢 _Nenhuma página órfã detectada! Todas as rotas possuem links de acesso._

---

## 💻 3. Erros de Console e Exceções JS (Browser)
Logs de erro capturados diretamente no console do navegador ou exceções não tratadas.

### Exceções de Renderização/JS
_Nenhuma exceção lançada pelo navegador._

### Erros de Console (Console.error / Console.warn)
| Rota | Tipo | Mensagem |
|---|---|---|
| `/login` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/login` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |
| `/dashboard` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/dashboard` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |
| `/dashboard` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/dashboard` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |
| `/inbox` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/inbox` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |
| `/ai?tab=dashboard` | `warning` | Warning: Missing `Description` or `aria-describedby={undefined}` for {DialogContent}. |
| `/connections` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/connections` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |
| `/connections` | `warning` | [Runtime] session:disconnected id=main |
| `/contacts` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/contacts` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |
| `/contacts` | `warning` | Warning: Missing `Description` or `aria-describedby={undefined}` for {DialogContent}. |
| `/flows` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/flows` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |
| `/flows` | `warning` | Warning: Missing `Description` or `aria-describedby={undefined}` for {DialogContent}. |
| `/ai` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/ai` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |
| `/ai?tab=dashboard` | `warning` | Warning: Missing `Description` or `aria-describedby={undefined}` for {DialogContent}. |
| `/analytics` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/analytics` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |
| `/dashboard?tab=analytics` | `warning` | Warning: Missing `Description` or `aria-describedby={undefined}` for {DialogContent}. |
| `/campaigns` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/campaigns` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |
| `/campaigns` | `warning` | Warning: Missing `Description` or `aria-describedby={undefined}` for {DialogContent}. |
| `/memory` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/memory` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |
| `/users` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/users` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |
| `/nodes` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/nodes` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |
| `/settings?tab=notificacoes` | `warning` | WebSocket connection to 'ws://localhost:8080/ws/nodes?tenant=default' failed: WebSocket is closed before the connection is established. |
| `/settings?tab=notificacoes` | `warning` | WebSocket connection to 'ws://localhost:8080/ws/metrics?tenant=default' failed: WebSocket is closed before the connection is established. |
| `/settings?tab=notificacoes` | `warning` | WebSocket connection to 'ws://localhost:8080/ws/deployments?tenant=default' failed: WebSocket is closed before the connection is established. |
| `/deployments` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/deployments` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |
| `/settings?tab=notificacoes` | `warning` | WebSocket connection to 'ws://localhost:8080/ws/nodes?tenant=default' failed: WebSocket is closed before the connection is established. |
| `/settings?tab=notificacoes` | `warning` | WebSocket connection to 'ws://localhost:8080/ws/metrics?tenant=default' failed: WebSocket is closed before the connection is established. |
| `/settings?tab=notificacoes` | `warning` | WebSocket connection to 'ws://localhost:8080/ws/deployments?tenant=default' failed: WebSocket is closed before the connection is established. |
| `/logs` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/logs` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |
| `/diagnostics` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/diagnostics` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |
| `/settings` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/settings` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |
| `/operations` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/operations` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |
| `/operations` | `warning` | Warning: Missing `Description` or `aria-describedby={undefined}` for {DialogContent}. |
| `/nodes/node-DESKTOP-8PV0NA2-1782493760847` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/nodes/node-DESKTOP-8PV0NA2-1782493760847` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |
| `/nodes/node-DESKTOP-8PV0NA2-1782241358221` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/nodes/node-DESKTOP-8PV0NA2-1782241358221` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |
| `/nodes/node-DESKTOP-8PV0NA2-1782213649961` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/nodes/node-DESKTOP-8PV0NA2-1782213649961` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |
| `/nodes/node-DESKTOP-8PV0NA2-1781894479836` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/nodes/node-DESKTOP-8PV0NA2-1781894479836` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |
| `/nodes/node-DESKTOP-8PV0NA2-1781705967073` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/nodes/node-DESKTOP-8PV0NA2-1781705967073` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |

---

## 🔌 4. Auditoria de Integração de APIs (HTTP Status >= 400)
Requisições feitas pelo frontend ao backend que falharam ou retornaram códigos de erro.

| Método | Endpoint | Status | Erro |
|---|---|---|---|
| `POST` | `/api/sessions/recover` | 🟢 200 | - |
| `GET` | `/api/sessions/status` | 🟢 200 | - |
| `GET` | `/api/ai/executive-insights` | 🟢 200 | - |
| `GET` | `/health` | 🟢 200 | - |
| `GET` | `/api/health` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30` | 🟢 200 | - |
| `GET` | `/api/metrics` | 🟢 200 | - |
| `GET` | `/api/ai/metrics` | 🟢 200 | - |
| `GET` | `/api/ai/status` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30` | 🟢 200 | - |
| `POST` | `/api/sessions/recover` | 🟢 200 | - |
| `GET` | `/api/metrics` | 🟢 200 | - |
| `GET` | `/api/sessions/status` | 🟢 200 | - |
| `GET` | `/health` | 🟢 200 | - |
| `GET` | `/api/ai/executive-insights` | 🟢 200 | - |
| `GET` | `/api/health` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `GET` | `/api/metrics` | 🟢 200 | - |
| `GET` | `/api/ai/metrics` | 🟢 200 | - |
| `GET` | `/api/ai/status` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `GET` | `/api/metrics` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30` | 🟢 200 | - |
| `POST` | `/api/sessions/recover` | 🟢 200 | - |
| `GET` | `/api/sessions/status` | 🟢 200 | - |
| `GET` | `/api/metrics` | 🟢 200 | - |
| `GET` | `/health` | 🟢 200 | - |
| `GET` | `/api/ai/executive-insights` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `GET` | `/api/health` | 🟢 200 | - |
| `GET` | `/api/metrics` | 🟢 200 | - |
| `GET` | `/api/ai/metrics` | 🟢 200 | - |
| `GET` | `/api/ai/status` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `GET` | `/api/metrics` | 🟢 200 | - |
| `GET` | `/api/metrics` | 🟢 200 | - |
| `POST` | `/api/sessions/recover` | 🟢 200 | - |
| `GET` | `/api/sessions/status` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30` | 🟢 200 | - |
| `GET` | `/health` | 🟢 200 | - |
| `GET` | `/api/health` | 🟢 200 | - |
| `GET` | `/api/config/ai-agents` | 🟢 200 | - |
| `GET` | `/api/metrics` | 🟢 200 | - |
| `GET` | `/api/ai/memory` | 🟢 200 | - |
| `GET` | `/api/config/advanced-ai` | 🟢 200 | - |
| `GET` | `/api/quick-replies/active-flow/120363421155649753%40g.us` | 🟢 200 | - |
| `GET` | `/api/conversations/controls` | 🟢 200 | - |
| `GET` | `/api/ai/conversation-memory/358` | 🟢 200 | - |
| `GET` | `/api/ai/status` | 🟢 200 | - |
| `GET` | `/api/ai/logs` | 🟢 200 | - |
| `GET` | `/api/conversations/436/messages?limit=50` | 🟢 200 | - |
| `GET` | `/api/quick-replies` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `GET` | `/health` | 🟢 200 | - |
| `GET` | `/health` | 🟢 200 | - |
| `GET` | `/api/ai/executive-insights` | 🟢 200 | - |
| `GET` | `/api/config/business-hours` | 🟢 200 | - |
| `GET` | `/api/config/absence-message` | 🟢 200 | - |
| `GET` | `/api/queue` | 🟢 200 | - |
| `GET` | `/api/session-status` | 🟢 200 | - |
| `GET` | `/api/ai/prompt` | 🟢 200 | - |
| `GET` | `/api/config/ai-agents` | 🟢 200 | - |
| `GET` | `/api/ai/logs` | 🟢 200 | - |
| `GET` | `/api/ai/metrics` | 🟢 200 | - |
| `GET` | `/api/integrations/webhooks` | 🟢 200 | - |
| `GET` | `/api/config/user-providers` | 🟢 200 | - |
| `GET` | `/api/contacts` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `POST` | `/api/sessions/recover` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `GET` | `/api/sessions/status` | 🟢 200 | - |
| `GET` | `/health` | 🟢 200 | - |
| `GET` | `/api/health` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `GET` | `/api/sessions/status` | 🟢 200 | - |
| `POST` | `/api/sessions/recover` | 🟢 200 | - |
| `GET` | `/health` | 🟢 200 | - |
| `GET` | `/api/health` | 🟢 200 | - |
| `GET` | `/api/contacts` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `GET` | `/api/contacts` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `GET` | `/api/sessions/status` | 🟢 200 | - |
| `POST` | `/api/sessions/recover` | 🟢 200 | - |
| `GET` | `/api/health` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `GET` | `/health` | 🟢 200 | - |
| `GET` | `/api/flows` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `GET` | `/api/contacts` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `POST` | `/api/sessions/recover` | 🟢 200 | - |
| `GET` | `/api/sessions/status` | 🟢 200 | - |
| `GET` | `/health` | 🟢 200 | - |
| `GET` | `/api/health` | 🟢 200 | - |
| `GET` | `/api/ai/executive-insights` | 🟢 200 | - |
| `GET` | `/api/ai/prompt` | 🟢 200 | - |
| `GET` | `/api/config/business-hours` | 🟢 200 | - |
| `GET` | `/api/config/absence-message` | 🟢 200 | - |
| `GET` | `/api/ai/memory` | 🟢 200 | - |
| `GET` | `/api/queue` | 🟢 200 | - |
| `GET` | `/api/config/advanced-ai` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `GET` | `/api/session-status` | 🟢 200 | - |
| `GET` | `/api/config/ai-agents` | 🟢 200 | - |
| `GET` | `/api/ai/logs?sessionId=111` | 🟢 200 | - |
| `GET` | `/api/integrations/webhooks` | 🟢 200 | - |
| `GET` | `/api/ai/metrics?sessionId=111` | 🟢 200 | - |
| `GET` | `/api/config/user-providers` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `GET` | `/api/contacts` | 🟢 200 | - |
| `GET` | `/api/ai/status` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `POST` | `/api/sessions/recover` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `GET` | `/api/sessions/status` | 🟢 200 | - |
| `GET` | `/api/health` | 🟢 200 | - |
| `GET` | `/health` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `GET` | `/api/ai/executive-insights` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `GET` | `/api/ai/status` | 🟢 200 | - |
| `GET` | `/api/ai/metrics` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `GET` | `/api/contacts` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `POST` | `/api/sessions/recover` | 🟢 200 | - |
| `GET` | `/api/sessions/status` | 🟢 200 | - |
| `GET` | `/health` | 🟢 200 | - |
| `GET` | `/api/health` | 🟢 200 | - |
| `GET` | `/api/contacts` | 🟢 200 | - |
| `GET` | `/api/config/ai-agents` | 🟢 200 | - |
| `GET` | `/api/campaigns` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=500` | 🟢 200 | - |
| `GET` | `/api/quick-replies` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `GET` | `/api/contacts` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `GET` | `/api/sessions/status` | 🟢 200 | - |
| `POST` | `/api/sessions/recover` | 🟢 200 | - |
| `GET` | `/health` | 🟢 200 | - |
| `GET` | `/api/ai/memory` | 🟢 200 | - |
| `GET` | `/api/health` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `GET` | `/api/ai/memory/analytics` | 🟢 200 | - |
| `GET` | `/api/ai/memory/search?q=` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `GET` | `/api/ai/memory` | 🟢 200 | - |
| `GET` | `/api/ai/memory/analytics` | 🟢 200 | - |
| `GET` | `/api/ai/memory/search?q=` | 🟢 200 | - |
| `POST` | `/api/ai/memory` | 🟢 200 | - |
| `GET` | `/api/ai/memory` | 🟢 200 | - |
| `GET` | `/api/ai/memory/analytics` | 🟢 200 | - |
| `GET` | `/api/ai/memory/search?q=` | 🟢 200 | - |
| `POST` | `/api/ai/memory/flush` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `POST` | `/api/sessions/recover` | 🟢 200 | - |
| `GET` | `/api/sessions/status` | 🟢 200 | - |
| `GET` | `/api/health` | 🟢 200 | - |
| `GET` | `/health` | 🟢 200 | - |
| `GET` | `/api/ai/status` | 🟢 200 | - |
| `GET` | `/api/admin/users` | 🟢 200 | - |
| `GET` | `/health` | 🟢 200 | - |
| `GET` | `/api/admin/users` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `POST` | `/api/ai/disable` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `GET` | `/api/sessions/status` | 🟢 200 | - |
| `POST` | `/api/sessions/recover` | 🟢 200 | - |
| `GET` | `/api/health` | 🟢 200 | - |
| `GET` | `/health` | 🟢 200 | - |
| `GET` | `/api/ai/status` | 🟢 200 | - |
| `GET` | `/api/admin/users` | 🟢 200 | - |
| `GET` | `/health` | 🟢 200 | - |
| `GET` | `/api/cluster/deployments` | 🟢 200 | - |
| `GET` | `/api/cluster/overview` | 🟢 200 | - |
| `GET` | `/api/cluster/nodes` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `POST` | `/api/ai/enable` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `POST` | `/api/sessions/recover` | 🟢 200 | - |
| `GET` | `/api/sessions/status` | 🟢 200 | - |
| `GET` | `/api/health` | 🟢 200 | - |
| `GET` | `/health` | 🟢 200 | - |
| `GET` | `/api/ai/status` | 🟢 200 | - |
| `GET` | `/api/admin/users` | 🟢 200 | - |
| `GET` | `/health` | 🟢 200 | - |
| `GET` | `/api/cluster/deployments` | 🟢 200 | - |
| `GET` | `/api/cluster/overview` | 🟢 200 | - |
| `GET` | `/api/cluster/nodes` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `POST` | `/api/ai/disable` | 🟢 200 | - |
| `POST` | `/api/sessions/recover` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `GET` | `/api/sessions/status` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `GET` | `/api/health` | 🟢 200 | - |
| `GET` | `/api/system/error-log` | 🟢 200 | - |
| `GET` | `/health` | 🟢 200 | - |
| `GET` | `/api/ai/status` | 🟢 200 | - |
| `GET` | `/health` | 🟢 200 | - |
| `GET` | `/api/admin/users` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `POST` | `/api/ai/enable` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `POST` | `/api/sessions/recover` | 🟢 200 | - |
| `GET` | `/api/sessions/status` | 🟢 200 | - |
| `GET` | `/api/health` | 🟢 200 | - |
| `GET` | `/api/system/error-log` | 🟢 200 | - |
| `GET` | `/api/health` | 🟢 200 | - |
| `GET` | `/api/system/runtime/status` | 🟢 200 | - |
| `GET` | `/api/system/status` | 🟢 200 | - |
| `GET` | `/api/session-status` | 🟢 200 | - |
| `GET` | `/health` | 🟢 200 | - |
| `GET` | `/api/ai/status` | 🟢 200 | - |
| `GET` | `/api/health` | 🟢 200 | - |
| `GET` | `/api/websocket/status` | 🟢 200 | - |
| `GET` | `/api/contacts` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `GET` | `/api/conversations` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `GET` | `/health` | 🟢 200 | - |
| `GET` | `/api/ai/status` | 🟢 200 | - |
| `GET` | `/api/admin/users` | 🟢 200 | - |
| `GET` | `/api/ai/system-health` | 🟢 200 | - |
| `POST` | `/api/ai/disable` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `POST` | `/api/sessions/recover` | 🟢 200 | - |
| `GET` | `/api/sessions/status` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `GET` | `/health` | 🟢 200 | - |
| `GET` | `/api/health` | 🟢 200 | - |
| `GET` | `/api/ai/status` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `GET` | `/api/admin/users` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `POST` | `/api/ai/enable` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `GET` | `/api/sessions/status` | 🟢 200 | - |
| `POST` | `/api/sessions/recover` | 🟢 200 | - |
| `GET` | `/api/health` | 🟢 200 | - |
| `GET` | `/health` | 🟢 200 | - |
| `GET` | `/api/operations/metrics` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `GET` | `/api/contacts` | 🟢 200 | - |
| `POST` | `/api/sessions/recover` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `GET` | `/api/sessions/status` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `GET` | `/api/health` | 🟢 200 | - |
| `GET` | `/health` | 🟢 200 | - |
| `GET` | `/api/system/error-log` | 🟢 200 | - |
| `GET` | `/api/system/runtime/status` | 🟢 200 | - |
| `GET` | `/api/cluster/deployments` | 🟢 200 | - |
| `GET` | `/api/cluster/nodes` | 🟢 200 | - |
| `GET` | `/api/cluster/metrics` | 🟢 200 | - |
| `GET` | `/api/session-status` | 🟢 200 | - |
| `GET` | `/api/cluster/overview` | 🟢 200 | - |
| `GET` | `/api/cluster/deployments` | 🟢 200 | - |
| `GET` | `/api/cluster/nodes` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `GET` | `/api/system/error-log` | 🟢 200 | - |
| `GET` | `/api/system/runtime/status` | 🟢 200 | - |
| `GET` | `/api/session-status` | 🟢 200 | - |
| `GET` | `/api/cluster/metrics` | 🟢 200 | - |
| `GET` | `/api/cluster/deployments` | 🟢 200 | - |
| `GET` | `/api/cluster/nodes` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `POST` | `/api/sessions/recover` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `GET` | `/api/sessions/status` | 🟢 200 | - |
| `GET` | `/api/health` | 🟢 200 | - |
| `GET` | `/health` | 🟢 200 | - |
| `GET` | `/api/system/error-log` | 🟢 200 | - |
| `GET` | `/api/session-status` | 🟢 200 | - |
| `GET` | `/api/system/runtime/status` | 🟢 200 | - |
| `GET` | `/api/cluster/metrics` | 🟢 200 | - |
| `GET` | `/api/cluster/deployments` | 🟢 200 | - |
| `GET` | `/api/cluster/nodes` | 🟢 200 | - |
| `GET` | `/api/cluster/overview` | 🟢 200 | - |
| `GET` | `/api/cluster/deployments` | 🟢 200 | - |
| `GET` | `/api/cluster/nodes` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `GET` | `/api/system/error-log` | 🟢 200 | - |
| `GET` | `/api/system/runtime/status` | 🟢 200 | - |
| `GET` | `/api/cluster/nodes` | 🟢 200 | - |
| `GET` | `/api/session-status` | 🟢 200 | - |
| `GET` | `/api/cluster/deployments` | 🟢 200 | - |
| `GET` | `/api/cluster/metrics` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `GET` | `/api/sessions/status` | 🟢 200 | - |
| `POST` | `/api/sessions/recover` | 🟢 200 | - |
| `GET` | `/api/health` | 🟢 200 | - |
| `GET` | `/health` | 🟢 200 | - |
| `GET` | `/api/cluster/nodes` | 🟢 200 | - |
| `GET` | `/api/cluster/deployments` | 🟢 200 | - |
| `GET` | `/api/system/error-log` | 🟢 200 | - |
| `GET` | `/api/system/runtime/status` | 🟢 200 | - |
| `GET` | `/api/session-status` | 🟢 200 | - |
| `GET` | `/api/cluster/metrics` | 🟢 200 | - |
| `GET` | `/api/cluster/overview` | 🟢 200 | - |
| `GET` | `/api/cluster/deployments` | 🟢 200 | - |
| `GET` | `/api/cluster/nodes` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `GET` | `/api/system/error-log` | 🟢 200 | - |
| `GET` | `/api/cluster/nodes` | 🟢 200 | - |
| `GET` | `/api/cluster/metrics` | 🟢 200 | - |
| `GET` | `/api/system/runtime/status` | 🟢 200 | - |
| `GET` | `/api/session-status` | 🟢 200 | - |
| `GET` | `/api/cluster/deployments` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `POST` | `/api/sessions/recover` | 🟢 200 | - |
| `GET` | `/api/health` | 🟢 200 | - |
| `GET` | `/health` | 🟢 200 | - |
| `GET` | `/api/cluster/nodes` | 🟢 200 | - |
| `GET` | `/api/system/error-log` | 🟢 200 | - |
| `GET` | `/api/cluster/deployments` | 🟢 200 | - |
| `GET` | `/api/system/runtime/status` | 🟢 200 | - |
| `GET` | `/api/cluster/metrics` | 🟢 200 | - |
| `GET` | `/api/session-status` | 🟢 200 | - |
| `GET` | `/api/cluster/overview` | 🟢 200 | - |
| `GET` | `/api/cluster/nodes` | 🟢 200 | - |
| `GET` | `/api/cluster/deployments` | 🟢 200 | - |
| `GET` | `/api/sessions/status` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `GET` | `/api/system/error-log` | 🟢 200 | - |
| `GET` | `/api/system/runtime/status` | 🟢 200 | - |
| `GET` | `/api/session-status` | 🟢 200 | - |
| `GET` | `/api/cluster/metrics` | 🟢 200 | - |
| `GET` | `/api/cluster/deployments` | 🟢 200 | - |
| `GET` | `/api/cluster/nodes` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `GET` | `/api/sessions/status` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `POST` | `/api/sessions/recover` | 🟢 200 | - |
| `GET` | `/api/health` | 🟢 200 | - |
| `GET` | `/health` | 🟢 200 | - |
| `GET` | `/api/cluster/nodes` | 🟢 200 | - |
| `GET` | `/api/system/error-log` | 🟢 200 | - |
| `GET` | `/api/system/runtime/status` | 🟢 200 | - |
| `GET` | `/api/cluster/deployments` | 🟢 200 | - |
| `GET` | `/api/cluster/metrics` | 🟢 200 | - |
| `GET` | `/api/session-status` | 🟢 200 | - |
| `GET` | `/api/cluster/overview` | 🟢 200 | - |
| `GET` | `/api/cluster/deployments` | 🟢 200 | - |
| `GET` | `/api/cluster/nodes` | 🟢 200 | - |
| `GET` | `/api/conversations?limit=30&sessionId=111` | 🟢 200 | - |
| `GET` | `/api/metrics?sessionId=111` | 🟢 200 | - |
| `GET` | `/api/system/error-log` | 🟢 200 | - |
| `GET` | `/api/system/runtime/status` | 🟢 200 | - |
| `GET` | `/api/session-status` | 🟢 200 | - |
| `GET` | `/api/cluster/nodes` | 🟢 200 | - |
| `GET` | `/api/cluster/metrics` | 🟢 200 | - |
| `GET` | `/api/cluster/deployments` | 🟢 200 | - |

---

## 📱 5. Auditoria de Responsividade (Viewports)
Checagem automática de estabilidade de layout e estouro de conteúdo (overflow horizontal).

| Rota | Desktop (1600px) | Mobile (375px) | Largura Overflow |
|---|---|---|---|
| `/dashboard` | 🟢 OK | 🟢 OK | - |
| `/inbox` | 🟢 OK | 🟢 OK | - |
| `/connections` | 🟢 OK | 🟢 OK | - |
| `/contacts` | 🟢 OK | 🟢 OK | - |
| `/flows` | 🟢 OK | 🟢 OK | - |
| `/ai` | 🟢 OK | 🟢 OK | - |
| `/analytics` | 🟢 OK | 🟢 OK | - |
| `/campaigns` | 🟢 OK | 🟢 OK | - |
| `/memory` | 🟢 OK | 🟢 OK | - |
| `/users` | 🟢 OK | 🟢 OK | - |
| `/nodes` | 🟢 OK | 🟢 OK | - |
| `/deployments` | 🟢 OK | 🟢 OK | - |
| `/logs` | 🟢 OK | 🟢 OK | - |
| `/diagnostics` | 🟢 OK | 🟢 OK | - |
| `/settings` | 🟢 OK | 🟢 OK | - |
| `/operations` | 🟢 OK | 🟢 OK | - |
| `/nodes/node-DESKTOP-8PV0NA2-1782493760847` | 🟢 OK | 🟢 OK | - |
| `/nodes/node-DESKTOP-8PV0NA2-1782241358221` | 🟢 OK | 🟢 OK | - |
| `/nodes/node-DESKTOP-8PV0NA2-1782213649961` | 🟢 OK | 🟢 OK | - |
| `/nodes/node-DESKTOP-8PV0NA2-1781894479836` | 🟢 OK | 🟢 OK | - |
| `/nodes/node-DESKTOP-8PV0NA2-1781705967073` | 🟢 OK | 🟢 OK | - |

---

## 🔘 6. Botões Sem Ação Suspeitos
Botões que estão habilitados, mas cujo clique não desencadeou navegação, abertura de modal ou requisições de rede.

| Rota | Texto do Botão | Classe / ID | Resultado do Clique |
|---|---|---|---|
| `/dashboard` | `Recolher` | `group relative transition-all` | Not tested (safe/destructive mode or disabled) |
| `/dashboard` | `Hub ZAI` | `radix-:rl:-trigger-overview` | Not tested (safe/destructive mode or disabled) |
| `/dashboard` | `Conversas` | `radix-:rl:-trigger-conversations` | Not tested (safe/destructive mode or disabled) |
| `/dashboard` | `Performance IA` | `radix-:rl:-trigger-ai` | Not tested (safe/destructive mode or disabled) |
| `/dashboard` | `Comercial` | `radix-:rl:-trigger-commercial` | Not tested (safe/destructive mode or disabled) |
| `/dashboard` | `Mapa Interativo` | `radix-:rl:-trigger-map` | Not tested (safe/destructive mode or disabled) |
| `/dashboard` | `Hoje` | `rounded-lg px-2.5 py-1` | Not tested (safe/destructive mode or disabled) |
| `/inbox` | `Todas` | `radix-:r3g:-trigger-all` | Not tested (safe/destructive mode or disabled) |
| `/inbox` | `Não lidas` | `radix-:r3g:-trigger-unread` | Not tested (safe/destructive mode or disabled) |
| `/inbox` | `IA ativa` | `radix-:r3g:-trigger-ai` | Not tested (safe/destructive mode or disabled) |
| `/inbox` | `Arquivadas` | `radix-:r3g:-trigger-archived` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `` | `peer shrink-0 border` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `` | `peer shrink-0 border` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `` | `peer shrink-0 border` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `` | `peer shrink-0 border` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `` | `peer shrink-0 border` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `` | `peer shrink-0 border` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `` | `peer shrink-0 border` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `` | `peer shrink-0 border` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `` | `peer shrink-0 border` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `` | `peer shrink-0 border` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `` | `peer shrink-0 border` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `` | `peer shrink-0 border` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `` | `peer shrink-0 border` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `` | `peer shrink-0 border` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `` | `peer shrink-0 border` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `` | `peer shrink-0 border` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `` | `peer shrink-0 border` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `` | `peer shrink-0 border` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `` | `peer shrink-0 border` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `` | `peer shrink-0 border` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `` | `peer shrink-0 border` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `` | `peer shrink-0 border` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `` | `peer shrink-0 border` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `` | `peer shrink-0 border` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `` | `peer shrink-0 border` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `` | `peer shrink-0 border` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `` | `peer shrink-0 border` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `` | `peer shrink-0 border` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `` | `peer shrink-0 border` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `` | `peer shrink-0 border` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `` | `peer shrink-0 border` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `` | `peer shrink-0 border` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `` | `peer shrink-0 border` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `` | `peer shrink-0 border` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `` | `peer shrink-0 border` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `` | `peer shrink-0 border` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `` | `peer shrink-0 border` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `` | `peer shrink-0 border` | Not tested (safe/destructive mode or disabled) |
| `/contacts` | `` | `peer shrink-0 border` | Not tested (safe/destructive mode or disabled) |
| `/ai` | `Dashboard IA` | `w-full flex items-center` | Click error: locator.click: Timeout 1500ms exceeded.
Call log:
[2m  - waiting for locator('button').filter({ hasText: 'Dashboard IA' }).first()[22m
[2m    - locator resolved to <button class="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all text-left bg-primary text-primary-foreground shadow-sm shadow-primary/20">…</button>[22m
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is visible, enabled and stable[22m
[2m      - scrolling into view if needed[22m
[2m      - done scrolling[22m
[2m      - <div data-state="open" aria-hidden="true" data-aria-hidden="true" class="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"></div> intercepts pointer events[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    - waiting for element to be visible, enabled and stable[22m
 |
| `/analytics` | `Hub ZAI` | `radix-:rl:-trigger-overview` | Click error: locator.click: Timeout 1500ms exceeded.
Call log:
[2m  - waiting for locator('button').filter({ hasText: 'Hub ZAI' }).first()[22m
[2m    - locator resolved to <button role="tab" type="button" tabindex="-1" data-state="active" aria-selected="true" data-orientation="horizontal" data-radix-collection-item="" id="radix-:rl:-trigger-overview" aria-controls="radix-:rl:-content-overview" class="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 ring-offset-background transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-v…>Hub ZAI</button>[22m
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is visible, enabled and stable[22m
[2m      - scrolling into view if needed[22m
[2m      - done scrolling[22m
[2m      - <div data-state="open" aria-hidden="true" data-aria-hidden="true" class="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"></div> intercepts pointer events[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    - waiting for element to be visible, enabled and stable[22m
[2m    - element is visible, enabled and stable[22m
[2m    - scrolling into view if needed[22m
[2m    - done scrolling[22m
[2m    - <div data-state="open" aria-hidden="true" data-aria-hidden="true" class="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"></div> intercepts pointer events[22m
[2m  - retrying click action[22m
[2m    - waiting 100ms[22m
[2m    - waiting for element to be visible, enabled and stable[22m
[2m    - element is visible, enabled and stable[22m
[2m    - scrolling into view if needed[22m
[2m    - done scrolling[22m
 |
| `/analytics` | `Conversas` | `radix-:rl:-trigger-conversations` | Click error: locator.click: Timeout 1500ms exceeded.
Call log:
[2m  - waiting for locator('button').filter({ hasText: 'Conversas' }).first()[22m
[2m    - locator resolved to <button role="tab" type="button" tabindex="-1" aria-selected="false" data-state="inactive" data-orientation="horizontal" data-radix-collection-item="" id="radix-:rl:-trigger-conversations" aria-controls="radix-:rl:-content-conversations" class="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 ring-offset-background transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm focus-visible:outline-none focus-visible:r…>Conversas</button>[22m
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is visible, enabled and stable[22m
[2m      - scrolling into view if needed[22m
[2m      - done scrolling[22m
[2m      - <div data-state="open" aria-hidden="true" data-aria-hidden="true" class="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"></div> intercepts pointer events[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    - waiting for element to be visible, enabled and stable[22m
[2m    - element is visible, enabled and stable[22m
[2m    - scrolling into view if needed[22m
[2m    - done scrolling[22m
[2m    - <div data-state="open" aria-hidden="true" data-aria-hidden="true" class="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"></div> intercepts pointer events[22m
[2m  - retrying click action[22m
[2m    - waiting 100ms[22m
[2m    - waiting for element to be visible, enabled and stable[22m
[2m    - element is visible, enabled and stable[22m
[2m    - scrolling into view if needed[22m
[2m    - done scrolling[22m
 |
| `/analytics` | `Performance IA` | `radix-:rl:-trigger-ai` | Not tested (safe/destructive mode or disabled) |
| `/analytics` | `Comercial` | `radix-:rl:-trigger-commercial` | Not tested (safe/destructive mode or disabled) |
| `/analytics` | `Mapa Interativo` | `radix-:rl:-trigger-map` | Not tested (safe/destructive mode or disabled) |
| `/analytics` | `Hoje` | `rounded-lg px-2.5 py-1` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `Novo Disparo` | `radix-:r22:-trigger-compose` | Click error: locator.click: Timeout 1500ms exceeded.
Call log:
[2m  - waiting for locator('button').filter({ hasText: 'Novo Disparo' }).first()[22m
[2m    - locator resolved to <button role="tab" type="button" tabindex="-1" data-state="active" aria-selected="true" data-orientation="horizontal" data-radix-collection-item="" id="radix-:r22:-trigger-compose" aria-controls="radix-:r22:-content-compose" class="inline-flex items-center justify-center whitespace-nowrap px-3 py-1.5 text-sm font-medium ring-offset-background transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm focus-visible:outline-none focus-visible:ring-…>…</button>[22m
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is visible, enabled and stable[22m
[2m      - scrolling into view if needed[22m
[2m      - done scrolling[22m
[2m      - <div data-state="open" aria-hidden="true" data-aria-hidden="true" class="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"></div> intercepts pointer events[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    - waiting for element to be visible, enabled and stable[22m
[2m    - element is visible, enabled and stable[22m
[2m    - scrolling into view if needed[22m
[2m    - done scrolling[22m
[2m    - <div data-state="open" aria-hidden="true" data-aria-hidden="true" class="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"></div> intercepts pointer events[22m
[2m  - retrying click action[22m
[2m    - waiting 100ms[22m
[2m    - waiting for element to be visible, enabled and stable[22m
 |
| `/campaigns` | `Histórico
2` | `radix-:r22:-trigger-history` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `Análise IA` | `radix-:r22:-trigger-analysis` | Not tested (safe/destructive mode or disabled) |
| `/users` | `Sistema & Operações` | `rounded-full px-3 py-1` | Not tested (safe/destructive mode or disabled) |
| `/users` | `Usuários Master` | `flex w-full items-center` | Not tested (safe/destructive mode or disabled) |
| `/nodes` | `Sistema & Operações` | `rounded-full px-3 py-1` | Not tested (safe/destructive mode or disabled) |
| `/nodes` | `Cluster` | `flex w-full items-center` | Not tested (safe/destructive mode or disabled) |
| `/deployments` | `Sistema & Operações` | `rounded-full px-3 py-1` | Not tested (safe/destructive mode or disabled) |
| `/deployments` | `Deployments` | `flex w-full items-center` | Not tested (safe/destructive mode or disabled) |
| `/logs` | `Sistema & Operações` | `rounded-full px-3 py-1` | Not tested (safe/destructive mode or disabled) |
| `/logs` | `Logs` | `flex w-full items-center` | Not tested (safe/destructive mode or disabled) |
| `/diagnostics` | `Sistema & Operações` | `rounded-full px-3 py-1` | Not tested (safe/destructive mode or disabled) |
| `/diagnostics` | `Diagnóstico & Saúde` | `flex w-full items-center` | Not tested (safe/destructive mode or disabled) |
| `/diagnostics` | `Structured Logs (200)` | `flex w-full items-center` | Not tested (safe/destructive mode or disabled) |
| `/diagnostics` | `Erros recentes do backend` | `flex w-full items-center` | Not tested (safe/destructive mode or disabled) |
| `/settings` | `Geral` | `rounded-full px-3 py-1` | Not tested (safe/destructive mode or disabled) |
| `/settings` | `Perfil` | `flex w-full items-center` | Not tested (safe/destructive mode or disabled) |
| `/nodes/node-DESKTOP-8PV0NA2-1782493760847` | `Overview` | `radix-:rk:-trigger-overview` | Click did not trigger state change |
| `/nodes/node-DESKTOP-8PV0NA2-1782493760847` | `Metrics` | `radix-:rk:-trigger-metrics` | Click did not trigger state change |
| `/nodes/node-DESKTOP-8PV0NA2-1782493760847` | `Containers` | `radix-:rk:-trigger-containers` | Not tested (safe/destructive mode or disabled) |
| `/nodes/node-DESKTOP-8PV0NA2-1782493760847` | `Sessions` | `radix-:rk:-trigger-sessions` | Not tested (safe/destructive mode or disabled) |
| `/nodes/node-DESKTOP-8PV0NA2-1782493760847` | `Deployments` | `radix-:rk:-trigger-deployments` | Not tested (safe/destructive mode or disabled) |
| `/nodes/node-DESKTOP-8PV0NA2-1782493760847` | `Logs` | `radix-:rk:-trigger-logs` | Not tested (safe/destructive mode or disabled) |
| `/nodes/node-DESKTOP-8PV0NA2-1782493760847` | `Runtime` | `radix-:rk:-trigger-runtime` | Not tested (safe/destructive mode or disabled) |
| `/nodes/node-DESKTOP-8PV0NA2-1782493760847` | `Websocket` | `radix-:rk:-trigger-websocket` | Not tested (safe/destructive mode or disabled) |
| `/nodes/node-DESKTOP-8PV0NA2-1782493760847` | `Diagnostics` | `radix-:rk:-trigger-diagnostics` | Not tested (safe/destructive mode or disabled) |
| `/nodes/node-DESKTOP-8PV0NA2-1782241358221` | `Overview` | `radix-:rk:-trigger-overview` | Click did not trigger state change |
| `/nodes/node-DESKTOP-8PV0NA2-1782241358221` | `Metrics` | `radix-:rk:-trigger-metrics` | Click did not trigger state change |
| `/nodes/node-DESKTOP-8PV0NA2-1782241358221` | `Containers` | `radix-:rk:-trigger-containers` | Not tested (safe/destructive mode or disabled) |
| `/nodes/node-DESKTOP-8PV0NA2-1782241358221` | `Sessions` | `radix-:rk:-trigger-sessions` | Not tested (safe/destructive mode or disabled) |
| `/nodes/node-DESKTOP-8PV0NA2-1782241358221` | `Deployments` | `radix-:rk:-trigger-deployments` | Not tested (safe/destructive mode or disabled) |
| `/nodes/node-DESKTOP-8PV0NA2-1782241358221` | `Logs` | `radix-:rk:-trigger-logs` | Not tested (safe/destructive mode or disabled) |
| `/nodes/node-DESKTOP-8PV0NA2-1782241358221` | `Runtime` | `radix-:rk:-trigger-runtime` | Not tested (safe/destructive mode or disabled) |
| `/nodes/node-DESKTOP-8PV0NA2-1782241358221` | `Websocket` | `radix-:rk:-trigger-websocket` | Not tested (safe/destructive mode or disabled) |
| `/nodes/node-DESKTOP-8PV0NA2-1782241358221` | `Diagnostics` | `radix-:rk:-trigger-diagnostics` | Not tested (safe/destructive mode or disabled) |
| `/nodes/node-DESKTOP-8PV0NA2-1782213649961` | `Overview` | `radix-:rk:-trigger-overview` | Click did not trigger state change |
| `/nodes/node-DESKTOP-8PV0NA2-1782213649961` | `Metrics` | `radix-:rk:-trigger-metrics` | Click did not trigger state change |
| `/nodes/node-DESKTOP-8PV0NA2-1782213649961` | `Containers` | `radix-:rk:-trigger-containers` | Not tested (safe/destructive mode or disabled) |
| `/nodes/node-DESKTOP-8PV0NA2-1782213649961` | `Sessions` | `radix-:rk:-trigger-sessions` | Not tested (safe/destructive mode or disabled) |
| `/nodes/node-DESKTOP-8PV0NA2-1782213649961` | `Deployments` | `radix-:rk:-trigger-deployments` | Not tested (safe/destructive mode or disabled) |
| `/nodes/node-DESKTOP-8PV0NA2-1782213649961` | `Logs` | `radix-:rk:-trigger-logs` | Not tested (safe/destructive mode or disabled) |
| `/nodes/node-DESKTOP-8PV0NA2-1782213649961` | `Runtime` | `radix-:rk:-trigger-runtime` | Not tested (safe/destructive mode or disabled) |
| `/nodes/node-DESKTOP-8PV0NA2-1782213649961` | `Websocket` | `radix-:rk:-trigger-websocket` | Not tested (safe/destructive mode or disabled) |
| `/nodes/node-DESKTOP-8PV0NA2-1782213649961` | `Diagnostics` | `radix-:rk:-trigger-diagnostics` | Not tested (safe/destructive mode or disabled) |
| `/nodes/node-DESKTOP-8PV0NA2-1781894479836` | `Overview` | `radix-:rk:-trigger-overview` | Click did not trigger state change |
| `/nodes/node-DESKTOP-8PV0NA2-1781894479836` | `Metrics` | `radix-:rk:-trigger-metrics` | Click did not trigger state change |
| `/nodes/node-DESKTOP-8PV0NA2-1781894479836` | `Containers` | `radix-:rk:-trigger-containers` | Not tested (safe/destructive mode or disabled) |
| `/nodes/node-DESKTOP-8PV0NA2-1781894479836` | `Sessions` | `radix-:rk:-trigger-sessions` | Not tested (safe/destructive mode or disabled) |
| `/nodes/node-DESKTOP-8PV0NA2-1781894479836` | `Deployments` | `radix-:rk:-trigger-deployments` | Not tested (safe/destructive mode or disabled) |
| `/nodes/node-DESKTOP-8PV0NA2-1781894479836` | `Logs` | `radix-:rk:-trigger-logs` | Not tested (safe/destructive mode or disabled) |
| `/nodes/node-DESKTOP-8PV0NA2-1781894479836` | `Runtime` | `radix-:rk:-trigger-runtime` | Not tested (safe/destructive mode or disabled) |
| `/nodes/node-DESKTOP-8PV0NA2-1781894479836` | `Websocket` | `radix-:rk:-trigger-websocket` | Not tested (safe/destructive mode or disabled) |
| `/nodes/node-DESKTOP-8PV0NA2-1781894479836` | `Diagnostics` | `radix-:rk:-trigger-diagnostics` | Not tested (safe/destructive mode or disabled) |
| `/nodes/node-DESKTOP-8PV0NA2-1781705967073` | `Overview` | `radix-:rl:-trigger-overview` | Click did not trigger state change |
| `/nodes/node-DESKTOP-8PV0NA2-1781705967073` | `Metrics` | `radix-:rl:-trigger-metrics` | Click did not trigger state change |
| `/nodes/node-DESKTOP-8PV0NA2-1781705967073` | `Containers` | `radix-:rl:-trigger-containers` | Not tested (safe/destructive mode or disabled) |
| `/nodes/node-DESKTOP-8PV0NA2-1781705967073` | `Sessions` | `radix-:rl:-trigger-sessions` | Not tested (safe/destructive mode or disabled) |
| `/nodes/node-DESKTOP-8PV0NA2-1781705967073` | `Deployments` | `radix-:rl:-trigger-deployments` | Not tested (safe/destructive mode or disabled) |
| `/nodes/node-DESKTOP-8PV0NA2-1781705967073` | `Logs` | `radix-:rl:-trigger-logs` | Not tested (safe/destructive mode or disabled) |
| `/nodes/node-DESKTOP-8PV0NA2-1781705967073` | `Runtime` | `radix-:rl:-trigger-runtime` | Not tested (safe/destructive mode or disabled) |
| `/nodes/node-DESKTOP-8PV0NA2-1781705967073` | `Websocket` | `radix-:rl:-trigger-websocket` | Not tested (safe/destructive mode or disabled) |
| `/nodes/node-DESKTOP-8PV0NA2-1781705967073` | `Diagnostics` | `radix-:rl:-trigger-diagnostics` | Not tested (safe/destructive mode or disabled) |

---
*Relatório gerado automaticamente pela suíte de auditoria contínua ZAPFLOW AI.*
