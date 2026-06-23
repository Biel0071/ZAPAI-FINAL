# Relatório de Auditoria E2E & Mapeamento Automático — ZAPFLOW AI

**Executado em:** 23/06/2026, 12:12:05
**Ferramenta:** Playwright Automated Discovery Crawler

---

## 📊 1. Resumo Executivo
* **Total de Rotas Mapeadas:** 13
* **Rotas Ativas (OK):** 13
* **Rotas Redirecionadas:** 0
* **Rotas Quebradas (400+ ou erro):** 2
* **Páginas Órfãs:** 14
* **Erros de Console/Navegador:** 97
* **APIs Consumidas:** 9 (Falhas: 0)

---

## 🚨 2. Análise de Erros e Rotas Quebradas
Abaixo estão detalhados os problemas graves que podem impedir a navegação ou causar falhas para o usuário.

### Rotas Quebradas
| Rota | Erro |
|---|---|
| `/contacts` | page.goto: Timeout 15000ms exceeded.
Call log:
[2m  - navigating to "http://localhost:8080/contacts", waiting until "domcontentloaded"[22m
 |
| `/diagnostics` | page.goto: Timeout 15000ms exceeded.
Call log:
[2m  - navigating to "http://localhost:8080/diagnostics", waiting until "domcontentloaded"[22m
 |

### Páginas Órfãs
Estas páginas estão registradas na aplicação, mas não possuem links diretos no menu ou em botões mapeados:
* Rota `/inbox` (declarada no roteador, mas sem links diretos identificados)
* Rota `/connections` (declarada no roteador, mas sem links diretos identificados)
* Rota `/contacts` (declarada no roteador, mas sem links diretos identificados)
* Rota `/flows` (declarada no roteador, mas sem links diretos identificados)
* Rota `/ai` (declarada no roteador, mas sem links diretos identificados)
* Rota `/analytics` (declarada no roteador, mas sem links diretos identificados)
* Rota `/campaigns` (declarada no roteador, mas sem links diretos identificados)
* Rota `/memory` (declarada no roteador, mas sem links diretos identificados)
* Rota `/users` (declarada no roteador, mas sem links diretos identificados)
* Rota `/nodes` (declarada no roteador, mas sem links diretos identificados)
* Rota `/deployments` (declarada no roteador, mas sem links diretos identificados)
* Rota `/logs` (declarada no roteador, mas sem links diretos identificados)
* Rota `/diagnostics` (declarada no roteador, mas sem links diretos identificados)
* Rota `/settings` (declarada no roteador, mas sem links diretos identificados)

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
| `/dashboard` | `warning` | %c[API] color:#fbbf24 Request failed: /api/sessions/status (/api/sessions/status) |
| `/dashboard` | `warning` | %c[API] color:#fbbf24 Request failed: /api/conversations (/api/conversations) |
| `/dashboard` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/dashboard` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |
| `/dashboard` | `warning` | [Runtime] session:disconnected id=teste1010 |
| `/inbox` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/inbox` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |
| `/connections` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/connections` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |
| `/connections` | `warning` | [Runtime] socket:disconnected status=reconnecting elapsed=0ms |
| `/connections` | `warning` | WebSocket connection to 'ws://localhost:4025/socket.io/?EIO=4&transport=websocket' failed: WebSocket is closed before the connection is established. |
| `/connections` | `warning` | %c[API] color:#fbbf24 Request failed: /api/sessions/status (/api/sessions/status) |
| `/contacts` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/contacts` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |
| `/flows` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/flows` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |
| `/ai` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/ai` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |
| `/analytics` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/analytics` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |
| `/campaigns` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/campaigns` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |
| `/campaigns` | `error` | WebSocket connection to 'ws://localhost:4025/socket.io/?EIO=4&transport=websocket' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED |
| `/campaigns` | `warning` | [Runtime] socket:disconnected status=reconnecting elapsed=0ms |
| `/campaigns` | `warning` | %c[API] color:#fbbf24 Request failed: /api/sessions/status (/api/sessions/status) |
| `/campaigns` | `error` | Failed to load resource: net::ERR_CONNECTION_REFUSED |
| `/campaigns` | `warning` | %c[API] color:#fbbf24 Request failed: /api/metrics (/api/metrics) |
| `/campaigns` | `error` | Failed to load resource: net::ERR_CONNECTION_REFUSED |
| `/campaigns` | `error` | Failed to load resource: net::ERR_CONNECTION_REFUSED |
| `/campaigns` | `error` | Failed to load resource: net::ERR_CONNECTION_REFUSED |
| `/campaigns` | `error` | Failed to load resource: net::ERR_CONNECTION_REFUSED |
| `/campaigns` | `warning` | %c[API] color:#fbbf24 Request failed: /api/conversations (/api/conversations) |
| `/campaigns` | `error` | Failed to load resource: net::ERR_CONNECTION_REFUSED |
| `/campaigns` | `error` | WebSocket connection to 'ws://localhost:4025/socket.io/?EIO=4&transport=websocket' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED |
| `/campaigns` | `warning` | [Runtime] socket:disconnected status=reconnecting elapsed=3793ms |
| `/memory` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/memory` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |
| `/memory` | `warning` | %c[API] color:#fbbf24 Request failed: /api/sessions/status (/api/sessions/status) |
| `/memory` | `error` | Failed to load resource: net::ERR_CONNECTION_REFUSED |
| `/memory` | `warning` | %c[API] color:#fbbf24 Request failed: /api/metrics (/api/metrics) |
| `/memory` | `error` | Failed to load resource: net::ERR_CONNECTION_REFUSED |
| `/memory` | `error` | WebSocket connection to 'ws://localhost:4025/socket.io/?EIO=4&transport=websocket' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED |
| `/memory` | `warning` | [Runtime] socket:disconnected status=reconnecting elapsed=0ms |
| `/memory` | `error` | Failed to load resource: net::ERR_CONNECTION_REFUSED |
| `/memory` | `error` | Failed to load resource: net::ERR_CONNECTION_REFUSED |
| `/memory` | `warning` | %c[API] color:#fbbf24 Request failed: /api/conversations (/api/conversations) |
| `/memory` | `error` | Failed to load resource: net::ERR_CONNECTION_REFUSED |
| `/memory` | `error` | Failed to load resource: net::ERR_CONNECTION_REFUSED |
| `/memory` | `error` | WebSocket connection to 'ws://localhost:4025/socket.io/?EIO=4&transport=websocket' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED |
| `/memory` | `warning` | [Runtime] socket:disconnected status=reconnecting elapsed=4714ms |
| `/users` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/users` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |
| `/users` | `error` | WebSocket connection to 'ws://localhost:4025/socket.io/?EIO=4&transport=websocket' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED |
| `/users` | `warning` | [Runtime] socket:disconnected status=reconnecting elapsed=0ms |
| `/users` | `warning` | %c[API] color:#fbbf24 Request failed: /api/sessions/status (/api/sessions/status) |
| `/users` | `error` | Failed to load resource: net::ERR_CONNECTION_REFUSED |
| `/users` | `warning` | %c[API] color:#fbbf24 Request failed: /api/metrics (/api/metrics) |
| `/users` | `error` | Failed to load resource: net::ERR_CONNECTION_REFUSED |
| `/users` | `error` | Failed to load resource: net::ERR_CONNECTION_REFUSED |
| `/nodes` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/nodes` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |
| `/deployments` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/deployments` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |
| `/deployments` | `warning` | %c[API] color:#fbbf24 Request failed: /api/sessions/status (/api/sessions/status) |
| `/deployments` | `error` | Failed to load resource: net::ERR_CONNECTION_REFUSED |
| `/deployments` | `error` | WebSocket connection to 'ws://localhost:4025/socket.io/?EIO=4&transport=websocket' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED |
| `/deployments` | `warning` | [Runtime] socket:disconnected status=reconnecting elapsed=0ms |
| `/deployments` | `warning` | %c[API] color:#fbbf24 Request failed: /api/metrics (/api/metrics) |
| `/deployments` | `error` | Failed to load resource: net::ERR_CONNECTION_REFUSED |
| `/deployments` | `error` | Failed to load resource: net::ERR_CONNECTION_REFUSED |
| `/deployments` | `error` | Failed to load resource: net::ERR_CONNECTION_REFUSED |
| `/deployments` | `error` | Failed to load resource: net::ERR_CONNECTION_REFUSED |
| `/logs` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/logs` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |
| `/logs` | `warning` | %c[API] color:#fbbf24 Request failed: /api/sessions/status (/api/sessions/status) |
| `/logs` | `error` | Failed to load resource: net::ERR_CONNECTION_REFUSED |
| `/logs` | `error` | WebSocket connection to 'ws://localhost:4025/socket.io/?EIO=4&transport=websocket' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED |
| `/logs` | `warning` | [Runtime] socket:disconnected status=reconnecting elapsed=0ms |
| `/logs` | `error` | Failed to load resource: net::ERR_CONNECTION_REFUSED |
| `/logs` | `warning` | %c[API] color:#fbbf24 Request failed: /api/metrics (/api/metrics) |
| `/logs` | `error` | Failed to load resource: net::ERR_CONNECTION_REFUSED |
| `/logs` | `error` | Failed to load resource: net::ERR_CONNECTION_REFUSED |
| `/logs` | `error` | Failed to load resource: net::ERR_CONNECTION_REFUSED |
| `/logs` | `warning` | %c[API] color:#fbbf24 Request failed: /api/conversations (/api/conversations) |
| `/logs` | `error` | Failed to load resource: net::ERR_CONNECTION_REFUSED |
| `/logs` | `error` | WebSocket connection to 'ws://localhost:4025/socket.io/?EIO=4&transport=websocket' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED |
| `/logs` | `warning` | [Runtime] socket:disconnected status=reconnecting elapsed=4040ms |
| `/logs` | `error` | WebSocket connection to 'ws://localhost:4025/socket.io/?EIO=4&transport=websocket' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED |
| `/logs` | `warning` | [Runtime] socket:disconnected status=reconnecting elapsed=9103ms |
| `/logs` | `error` | WebSocket connection to 'ws://localhost:4025/socket.io/?EIO=4&transport=websocket' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED |
| `/logs` | `warning` | [Runtime] socket:disconnected status=reconnecting elapsed=16393ms |
| `/settings` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/settings` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |

---

## 🔌 4. Auditoria de Integração de APIs (HTTP Status >= 400)
Requisições feitas pelo frontend ao backend que falharam ou retornaram códigos de erro.

| Método | Endpoint | Status | Erro |
|---|---|---|---|
| `GET` | `http://localhost:4025/api/metrics` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/metrics` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/sessions/status` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/metrics` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/sessions/status` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/conversations?sessionId=main` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/metrics` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/metrics` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/metrics` | 🟢 200 | - |

---

## 📱 5. Auditoria de Responsividade (Viewports)
Checagem automática de estabilidade de layout e estouro de conteúdo (overflow horizontal).

| Rota | Desktop (1600px) | Mobile (375px) | Largura Overflow |
|---|---|---|---|
| `/dashboard` | 🟢 OK | 🟢 OK | - |
| `/inbox` | 🟢 OK | 🟢 OK | - |
| `/connections` | 🟢 OK | 🟢 OK | - |
| `/flows` | 🟢 OK | 🟢 OK | - |
| `/ai` | 🟢 OK | 🟢 OK | - |
| `/analytics` | 🟢 OK | 🟢 OK | - |
| `/campaigns` | 🟢 OK | 🟢 OK | - |
| `/memory` | 🟢 OK | 🟢 OK | - |
| `/users` | 🟢 OK | 🟢 OK | - |
| `/nodes` | 🟢 OK | 🟢 OK | - |
| `/deployments` | 🟢 OK | 🟢 OK | - |
| `/logs` | 🟢 OK | 🟢 OK | - |
| `/settings` | 🟢 OK | 🟢 OK | - |

---

## 🔘 6. Botões Sem Ação Suspeitos
Botões que estão habilitados, mas cujo clique não desencadeou navegação, abertura de modal ou requisições de rede.

🟢 _Nenhum botão sem ação suspeito._

---
*Relatório gerado automaticamente pela suíte de auditoria contínua ZAPFLOW AI.*
