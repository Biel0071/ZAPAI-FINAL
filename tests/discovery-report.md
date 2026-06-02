# Relatório de Auditoria E2E & Mapeamento Automático — ZAPFLOW AI

**Executado em:** 29/05/2026, 16:54:46
**Ferramenta:** Playwright Automated Discovery Crawler

---

## 📊 1. Resumo Executivo
* **Total de Rotas Mapeadas:** 15
* **Rotas Ativas (OK):** 15
* **Rotas Redirecionadas:** 0
* **Rotas Quebradas (400+ ou erro):** 0
* **Páginas Órfãs:** 0
* **Erros de Console/Navegador:** 45
* **APIs Consumidas:** 119 (Falhas: 4)

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
| `/inbox` | `error` | Failed to fetch AI memory: Error: Conversation memory not found
    at request (http://localhost:8080/src/services/apiService.ts:138:27)
    at async http://localhost:8080/src/pages/Inbox.tsx?t=1780084213781:1760:30 |
| `/connections` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/connections` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |
| `/connections` | `error` | Warning: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.%s qa_stress_temp_qa_stress_1779890626090 
    at div
    at div
    at ConnectionsView (http://localhost:8080/src/lovable/pages/ConnectionsView.tsx:24:35)
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at div
    at MotionDOMComponent (http://localhost:8080/node_modules/.vite/deps/framer-motion.js?v=1622601f:8678:40)
    at div
    at Connections (http://localhost:8080/src/pages/Connections.tsx?t=1780084213781:101:27)
    at PageRouteBoundary (http://localhost:8080/src/components/system/PageRouteBoundary.tsx:115:9)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=1ef25700:4088:5)
    at Outlet (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=1ef25700:4494:26)
    at main
    at div
    at MainLayout (http://localhost:8080/src/components/layout/MainLayout.tsx:29:39)
    at RuntimeProvider (http://localhost:8080/src/providers/RuntimeProvider.tsx?t=1780084213781:59:35)
    at RequireAdminAuth (http://localhost:8080/src/App.tsx?t=1780084213781:142:29)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=1ef25700:4088:5)
    at Routes (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=1ef25700:4558:5)
    at Suspense
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at BootGate (http://localhost:8080/src/App.tsx?t=1780084213781:74:21)
    at Router (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=1ef25700:4501:15)
    at BrowserRouter (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=1ef25700:5247:5)
    at Provider (http://localhost:8080/node_modules/.vite/deps/chunk-TYATGQZ3.js?v=33db4bb5:38:15)
    at TooltipProvider (http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-tooltip.js?v=14e6fd6a:64:5)
    at O (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=9905b612:23:25)
    at z (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=9905b612:21:18)
    at ThemeProvider (http://localhost:8080/src/components/theme/ThemeProvider.tsx:22:33)
    at QueryClientProvider (http://localhost:8080/node_modules/.vite/deps/@tanstack_react-query.js?v=200c7150:2934:3)
    at GlobalErrorBoundary (http://localhost:8080/src/components/system/GlobalErrorBoundary.tsx:329:9)
    at App (http://localhost:8080/src/App.tsx?t=1780084213781:267:5) |
| `/connections` | `error` | Warning: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.%s qa_stress_temp_qa_stress_1779890626090 
    at div
    at div
    at ConnectionsView (http://localhost:8080/src/lovable/pages/ConnectionsView.tsx:24:35)
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at div
    at MotionDOMComponent (http://localhost:8080/node_modules/.vite/deps/framer-motion.js?v=1622601f:8678:40)
    at div
    at Connections (http://localhost:8080/src/pages/Connections.tsx?t=1780084213781:101:27)
    at PageRouteBoundary (http://localhost:8080/src/components/system/PageRouteBoundary.tsx:115:9)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=1ef25700:4088:5)
    at Outlet (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=1ef25700:4494:26)
    at main
    at div
    at MainLayout (http://localhost:8080/src/components/layout/MainLayout.tsx:29:39)
    at RuntimeProvider (http://localhost:8080/src/providers/RuntimeProvider.tsx?t=1780084213781:59:35)
    at RequireAdminAuth (http://localhost:8080/src/App.tsx?t=1780084213781:142:29)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=1ef25700:4088:5)
    at Routes (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=1ef25700:4558:5)
    at Suspense
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at BootGate (http://localhost:8080/src/App.tsx?t=1780084213781:74:21)
    at Router (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=1ef25700:4501:15)
    at BrowserRouter (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=1ef25700:5247:5)
    at Provider (http://localhost:8080/node_modules/.vite/deps/chunk-TYATGQZ3.js?v=33db4bb5:38:15)
    at TooltipProvider (http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-tooltip.js?v=14e6fd6a:64:5)
    at O (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=9905b612:23:25)
    at z (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=9905b612:21:18)
    at ThemeProvider (http://localhost:8080/src/components/theme/ThemeProvider.tsx:22:33)
    at QueryClientProvider (http://localhost:8080/node_modules/.vite/deps/@tanstack_react-query.js?v=200c7150:2934:3)
    at GlobalErrorBoundary (http://localhost:8080/src/components/system/GlobalErrorBoundary.tsx:329:9)
    at App (http://localhost:8080/src/App.tsx?t=1780084213781:267:5) |
| `/connections` | `warning` | Warning: Missing `Description` or `aria-describedby={undefined}` for {DialogContent}. |
| `/connections` | `error` | Warning: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.%s qa_stress_temp_qa_stress_1779890626090 
    at div
    at div
    at ConnectionsView (http://localhost:8080/src/lovable/pages/ConnectionsView.tsx:24:35)
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at div
    at MotionDOMComponent (http://localhost:8080/node_modules/.vite/deps/framer-motion.js?v=1622601f:8678:40)
    at div
    at Connections (http://localhost:8080/src/pages/Connections.tsx?t=1780084213781:101:27)
    at PageRouteBoundary (http://localhost:8080/src/components/system/PageRouteBoundary.tsx:115:9)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=1ef25700:4088:5)
    at Outlet (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=1ef25700:4494:26)
    at main
    at div
    at MainLayout (http://localhost:8080/src/components/layout/MainLayout.tsx:29:39)
    at RuntimeProvider (http://localhost:8080/src/providers/RuntimeProvider.tsx?t=1780084213781:59:35)
    at RequireAdminAuth (http://localhost:8080/src/App.tsx?t=1780084213781:142:29)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=1ef25700:4088:5)
    at Routes (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=1ef25700:4558:5)
    at Suspense
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at BootGate (http://localhost:8080/src/App.tsx?t=1780084213781:74:21)
    at Router (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=1ef25700:4501:15)
    at BrowserRouter (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=1ef25700:5247:5)
    at Provider (http://localhost:8080/node_modules/.vite/deps/chunk-TYATGQZ3.js?v=33db4bb5:38:15)
    at TooltipProvider (http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-tooltip.js?v=14e6fd6a:64:5)
    at O (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=9905b612:23:25)
    at z (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=9905b612:21:18)
    at ThemeProvider (http://localhost:8080/src/components/theme/ThemeProvider.tsx:22:33)
    at QueryClientProvider (http://localhost:8080/node_modules/.vite/deps/@tanstack_react-query.js?v=200c7150:2934:3)
    at GlobalErrorBoundary (http://localhost:8080/src/components/system/GlobalErrorBoundary.tsx:329:9)
    at App (http://localhost:8080/src/App.tsx?t=1780084213781:267:5) |
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
| `/campaigns` | `error` | Warning: validateDOMNesting(...): %s cannot appear as a descendant of <%s>.%s <button> button 
    at button
    at http://localhost:8080/node_modules/.vite/deps/chunk-EVRD2W64.js?v=33db4bb5:43:13
    at http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-checkbox.js?v=f60cd453:98:6
    at Provider (http://localhost:8080/node_modules/.vite/deps/chunk-TYATGQZ3.js?v=33db4bb5:38:15)
    at CheckboxProvider (http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-checkbox.js?v=f60cd453:45:5)
    at http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-checkbox.js?v=f60cd453:152:7
    at _c (http://localhost:8080/src/components/ui/checkbox.tsx:25:57)
    at button
    at div
    at div
    at div
    at div
    at _c8 (http://localhost:8080/src/components/ui/card.tsx:67:61)
    at div
    at _c (http://localhost:8080/src/components/ui/card.tsx:23:53)
    at div
    at div
    at CampaignsView (http://localhost:8080/src/lovable/pages/CampaignsView.tsx:21:33)
    at div
    at div
    at Campaigns (http://localhost:8080/src/pages/Campaigns.tsx?t=1780084213781:138:35)
    at PageRouteBoundary (http://localhost:8080/src/components/system/PageRouteBoundary.tsx:115:9)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=1ef25700:4088:5)
    at Outlet (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=1ef25700:4494:26)
    at main
    at div
    at MainLayout (http://localhost:8080/src/components/layout/MainLayout.tsx:29:39)
    at RuntimeProvider (http://localhost:8080/src/providers/RuntimeProvider.tsx?t=1780084213781:59:35)
    at RequireAdminAuth (http://localhost:8080/src/App.tsx?t=1780084213781:142:29)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=1ef25700:4088:5)
    at Routes (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=1ef25700:4558:5)
    at Suspense
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at BootGate (http://localhost:8080/src/App.tsx?t=1780084213781:74:21)
    at Router (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=1ef25700:4501:15)
    at BrowserRouter (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=1ef25700:5247:5)
    at Provider (http://localhost:8080/node_modules/.vite/deps/chunk-TYATGQZ3.js?v=33db4bb5:38:15)
    at TooltipProvider (http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-tooltip.js?v=14e6fd6a:64:5)
    at O (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=9905b612:23:25)
    at z (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=9905b612:21:18)
    at ThemeProvider (http://localhost:8080/src/components/theme/ThemeProvider.tsx:22:33)
    at QueryClientProvider (http://localhost:8080/node_modules/.vite/deps/@tanstack_react-query.js?v=200c7150:2934:3)
    at GlobalErrorBoundary (http://localhost:8080/src/components/system/GlobalErrorBoundary.tsx:329:9)
    at App (http://localhost:8080/src/App.tsx?t=1780084213781:267:5) |
| `/memory` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/memory` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |
| `/users` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/users` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |
| `/nodes` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/nodes` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |
| `/nodes` | `error` | Failed to load resource: the server responded with a status of 404 (Not Found) |
| `/nodes` | `error` | Failed to load resource: the server responded with a status of 404 (Not Found) |
| `/deployments` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/deployments` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |
| `/deployments` | `error` | Failed to load resource: the server responded with a status of 404 (Not Found) |
| `/deployments` | `error` | Failed to load resource: the server responded with a status of 404 (Not Found) |
| `/logs` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/logs` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |
| `/diagnostics` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/diagnostics` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |
| `/diagnostics` | `error` | Warning: Each child in a list should have a unique "key" prop.%s%s See https://reactjs.org/link/warning-keys for more information.%s 

Check the render method of `Diagnostics`.  
    at div
    at Diagnostics (http://localhost:8080/src/runtime/diagnostics/Diagnostics.tsx?t=1780084213781:341:33)
    at PageRouteBoundary (http://localhost:8080/src/components/system/PageRouteBoundary.tsx:115:9)
    at ProtectedRoute (http://localhost:8080/src/App.tsx?t=1780084213781:194:27)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=1ef25700:4088:5)
    at Outlet (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=1ef25700:4494:26)
    at main
    at div
    at MainLayout (http://localhost:8080/src/components/layout/MainLayout.tsx:29:39)
    at RuntimeProvider (http://localhost:8080/src/providers/RuntimeProvider.tsx?t=1780084213781:59:35)
    at RequireAdminAuth (http://localhost:8080/src/App.tsx?t=1780084213781:142:29)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=1ef25700:4088:5)
    at Routes (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=1ef25700:4558:5)
    at Suspense
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at BootGate (http://localhost:8080/src/App.tsx?t=1780084213781:74:21)
    at Router (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=1ef25700:4501:15)
    at BrowserRouter (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=1ef25700:5247:5)
    at Provider (http://localhost:8080/node_modules/.vite/deps/chunk-TYATGQZ3.js?v=33db4bb5:38:15)
    at TooltipProvider (http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-tooltip.js?v=14e6fd6a:64:5)
    at O (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=9905b612:23:25)
    at z (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=9905b612:21:18)
    at ThemeProvider (http://localhost:8080/src/components/theme/ThemeProvider.tsx:22:33)
    at QueryClientProvider (http://localhost:8080/node_modules/.vite/deps/@tanstack_react-query.js?v=200c7150:2934:3)
    at GlobalErrorBoundary (http://localhost:8080/src/components/system/GlobalErrorBoundary.tsx:329:9)
    at App (http://localhost:8080/src/App.tsx?t=1780084213781:267:5) |
| `/settings` | `warning` | ⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition. |
| `/settings` | `warning` | ⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath. |

---

## 🔌 4. Auditoria de Integração de APIs (HTTP Status >= 400)
Requisições feitas pelo frontend ao backend que falharam ou retornaram códigos de erro.

| Método | Endpoint | Status | Erro |
|---|---|---|---|
| `GET` | `http://localhost:4025/api/metrics` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/sessions/status` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/conversations` | 🟢 200 | - |
| `GET` | `http://localhost:4025/health` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/metrics` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/sessions/status` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/conversations` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/metrics` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/sessions/status` | 🟢 200 | - |
| `GET` | `http://localhost:4025/health` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/metrics` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/sessions/status` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/conversations` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/metrics` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/sessions/status` | 🟢 200 | - |
| `GET` | `http://localhost:4025/health` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/sessions/status` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/conversations?limit=20` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/quick-replies` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/ai/conversation-memory/5511999999999` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/conversations/controls` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/conversations` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/metrics` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/sessions/status` | 🟢 200 | - |
| `GET` | `http://localhost:4025/health` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/sessions/status` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/sessions/status` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/metrics` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/sessions/status` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/conversations` | 🟢 200 | - |
| `GET` | `http://localhost:4025/health` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/conversations?limit=200` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/contacts` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/conversations` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/metrics` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/sessions/status` | 🟢 200 | - |
| `GET` | `http://localhost:4025/health` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/flows` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/conversations` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/metrics` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/sessions/status` | 🟢 200 | - |
| `GET` | `http://localhost:4025/health` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/ai/status` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/config/business-hours` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/config/absence-message` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/queue` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/ai/memory` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/config/advanced-ai` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/ai/prompt` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/conversations` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/metrics` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/sessions/status` | 🟢 200 | - |
| `GET` | `http://localhost:4025/health` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/metrics` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/conversations?limit=200` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/conversations?limit=200` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/metrics` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/metrics` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/conversations` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/sessions/status` | 🟢 200 | - |
| `GET` | `http://localhost:4025/health` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/contacts` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/campaigns` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/conversations?limit=500` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/metrics` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/conversations` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/sessions/status` | 🟢 200 | - |
| `GET` | `http://localhost:4025/health` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/ai/memory` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/ai/memory/analytics` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/ai/memory/search?q=` | 🟢 200 | - |
| `POST` | `http://localhost:4025/api/ai/memory` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/ai/memory` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/ai/memory/analytics` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/ai/memory/search?q=` | 🟢 200 | - |
| `POST` | `http://localhost:4025/api/ai/memory/flush` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/conversations` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/metrics` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/sessions/status` | 🟢 200 | - |
| `GET` | `http://localhost:4025/health` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/session-status` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/conversations` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/metrics` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/sessions/status` | 🟢 200 | - |
| `GET` | `http://localhost:4025/health` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/cluster/nodes` | 🔴 404 | `{"success":false,"data":null,"error":"Route not found: GET /api/cluster/nodes"}` |
| `GET` | `http://localhost:4025/api/cluster/overview` | 🔴 404 | `{"success":false,"data":null,"error":"Route not found: GET /api/cluster/overview"}` |
| `GET` | `http://localhost:4025/api/conversations` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/metrics` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/sessions/status` | 🟢 200 | - |
| `GET` | `http://localhost:4025/health` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/cluster/nodes` | 🔴 404 | `{"success":false,"data":null,"error":"Route not found: GET /api/cluster/nodes"}` |
| `GET` | `http://localhost:4025/api/cluster/overview` | 🔴 404 | `{"success":false,"data":null,"error":"Route not found: GET /api/cluster/overview"}` |
| `GET` | `http://localhost:4025/api/metrics` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/sessions/status` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/conversations` | 🟢 200 | - |
| `GET` | `http://localhost:4025/health` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/system/error-log` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/conversations` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/metrics` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/sessions/status` | 🟢 200 | - |
| `GET` | `http://localhost:4025/health` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/system/runtime/status` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/system/error-log` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/conversations` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/sessions/status` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/session-status` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/websocket/status` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/health` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/contacts` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/health` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/system/runtime/status` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/system/error-log` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/sessions/status` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/metrics` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/conversations` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/sessions/status` | 🟢 200 | - |
| `GET` | `http://localhost:4025/health` | 🟢 200 | - |
| `GET` | `http://localhost:4025/api/ai/status` | 🟢 200 | - |

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

---

## 🔘 6. Botões Sem Ação Suspeitos
Botões que estão habilitados, mas cujo clique não desencadeou navegação, abertura de modal ou requisições de rede.

| Rota | Texto do Botão | Classe / ID | Resultado do Clique |
|---|---|---|---|
| `/dashboard` | `Recolher` | `sidebar-item mt-1 w-full` | Click did not trigger state change |
| `/dashboard` | `Visão Geral` | `radix-:r4:-trigger-overview` | Click did not trigger state change |
| `/dashboard` | `Horários` | `radix-:r4:-trigger-schedule` | Not tested (safe/destructive mode or disabled) |
| `/dashboard` | `Mapa de Origem` | `radix-:r4:-trigger-map` | Not tested (safe/destructive mode or disabled) |
| `/inbox` | `Recolher` | `sidebar-item mt-1 w-full` | Click did not trigger state change |
| `/inbox` | `Todas` | `radix-:r4:-trigger-all` | Click did not trigger state change |
| `/inbox` | `Não lidas` | `radix-:r4:-trigger-unread` | Click did not trigger state change |
| `/inbox` | `IA ativa` | `radix-:r4:-trigger-ai` | Click did not trigger state change |
| `/inbox` | `Arquivadas` | `radix-:r4:-trigger-archived` | Click did not trigger state change |
| `/inbox` | `5
553193672075
15:36

delivery consistency check

` | `inbox-message w-full text-left` | Not tested (safe/destructive mode or disabled) |
| `/inbox` | `KM
Kalu Moda Íntima
10:28

[SMOKE] inbound stabili` | `inbox-message w-full text-left` | Not tested (safe/destructive mode or disabled) |
| `/inbox` | `WI
Ward imports
13:44

[SMOKE] inbound stabilizati` | `inbox-message w-full text-left` | Not tested (safe/destructive mode or disabled) |
| `/inbox` | `WI
Ward imports
08:56

????

22` | `inbox-message w-full text-left` | Not tested (safe/destructive mode or disabled) |
| `/inbox` | `C
Caua
08:53

Será q tem jeito

84` | `inbox-message w-full text-left` | Not tested (safe/destructive mode or disabled) |
| `/inbox` | `K
Kevynlima
17:49

[media]

5` | `inbox-message w-full text-left` | Not tested (safe/destructive mode or disabled) |
| `/inbox` | `U
Unknown
17:26

da ideia mn` | `inbox-message w-full text-left` | Not tested (safe/destructive mode or disabled) |
| `/inbox` | `E
Eris
15:28

agradeço demais irmão

6` | `inbox-message w-full text-left` | Not tested (safe/destructive mode or disabled) |
| `/inbox` | `KC
Kane Company
15:17

Alguém precisando de Dev?

` | `inbox-message w-full text-left` | Not tested (safe/destructive mode or disabled) |
| `/inbox` | `�
🙏🏼
14:48

oi

1` | `inbox-message w-full text-left` | Not tested (safe/destructive mode or disabled) |
| `/inbox` | `�
🙏🏼
14:32

teste` | `inbox-message w-full text-left` | Not tested (safe/destructive mode or disabled) |
| `/inbox` | `KM
Kalu Moda Íntima
14:17

[media]

4` | `inbox-message w-full text-left` | Not tested (safe/destructive mode or disabled) |
| `/inbox` | `�
🙏🏼
22:26

[SMOKE] inbound stabilization messag` | `inbox-message w-full text-left` | Not tested (safe/destructive mode or disabled) |
| `/inbox` | `E
Eris
00:12

Deus abençoe a todos

53` | `inbox-message w-full text-left` | Not tested (safe/destructive mode or disabled) |
| `/inbox` | `IA` | `radix-:rg:-trigger-ai` | Not tested (safe/destructive mode or disabled) |
| `/inbox` | `Lead` | `radix-:rg:-trigger-lead` | Not tested (safe/destructive mode or disabled) |
| `/inbox` | `Arquivos` | `radix-:rg:-trigger-files` | Not tested (safe/destructive mode or disabled) |
| `/inbox` | `Automação` | `radix-:rg:-trigger-qr` | Not tested (safe/destructive mode or disabled) |
| `/inbox` | `Histórico` | `radix-:rg:-trigger-history` | Not tested (safe/destructive mode or disabled) |
| `/connections` | `Recolher` | `sidebar-item mt-1 w-full` | Click did not trigger state change |
| `/contacts` | `Recolher` | `sidebar-item mt-1 w-full` | Click did not trigger state change |
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
| `/ai` | `Status da IA` | `radix-:r4:-trigger-status` | Click did not trigger state change |
| `/ai` | `Editor de Prompt` | `radix-:r4:-trigger-prompt` | Click did not trigger state change |
| `/ai` | `Provedores de IA` | `radix-:r4:-trigger-providers` | Click did not trigger state change |
| `/ai` | `Horário Comercial` | `radix-:r4:-trigger-business-hours` | Click did not trigger state change |
| `/ai` | `Mensagem de Ausência` | `radix-:r4:-trigger-absence` | Click did not trigger state change |
| `/ai` | `Fila de Reativação` | `radix-:r4:-trigger-reactivation` | Not tested (safe/destructive mode or disabled) |
| `/ai` | `Central de Treinamento` | `radix-:r4:-trigger-training` | Not tested (safe/destructive mode or disabled) |
| `/ai` | `AI Learning` | `radix-:r4:-trigger-learning` | Not tested (safe/destructive mode or disabled) |
| `/ai` | `Configuração de Memória` | `radix-:r4:-trigger-memory` | Not tested (safe/destructive mode or disabled) |
| `/ai` | `Ajustes Avançados` | `radix-:r4:-trigger-advanced` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `Recolher` | `sidebar-item mt-1 w-full` | Click did not trigger state change |
| `/campaigns` | `1
PÚBLICO` | `flex flex-col items-center` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `2
MENSAGEM` | `flex flex-col items-center` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `3
DELAYS` | `flex flex-col items-center` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `4
REVISÃO` | `flex flex-col items-center` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `5
LANÇAR` | `flex flex-col items-center` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/campaigns` | `` | `peer h-4 w-4` | Not tested (safe/destructive mode or disabled) |
| `/memory` | `Recolher` | `sidebar-item mt-1 w-full` | Click did not trigger state change |
| `/deployments` | `Recolher` | `sidebar-item mt-1 w-full` | Click error: locator.click: Timeout 1500ms exceeded.
Call log:
[2m  - waiting for locator('button').filter({ hasText: 'Recolher' }).first()[22m
[2m    - locator resolved to <button aria-label="Recolher menu" class="sidebar-item mt-1 w-full">…</button>[22m
[2m  - attempting click action[22m
[2m    - waiting for element to be visible, enabled and stable[22m
[2m    - element is visible, enabled and stable[22m
[2m    - scrolling into view if needed[22m
[2m    - done scrolling[22m
[2m    - performing click action[22m
 |
| `/logs` | `Recolher` | `sidebar-item mt-1 w-full` | Click did not trigger state change |
| `/diagnostics` | `Recolher` | `sidebar-item mt-1 w-full` | Click did not trigger state change |
| `/diagnostics` | `Structured Logs (174)` | `flex w-full items-center` | Not tested (safe/destructive mode or disabled) |
| `/diagnostics` | `Erros recentes do backend` | `flex w-full items-center` | Not tested (safe/destructive mode or disabled) |
| `/settings` | `Perfil` | `flex items-center gap-3` | Click did not trigger state change |

---
*Relatório gerado automaticamente pela suíte de auditoria contínua ZAPFLOW AI.*
