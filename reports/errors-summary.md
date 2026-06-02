# Relatório de Erros Consolidados — Auditoria de Sistema

**Executado em:** 28/05/2026, 14:23:54

---

## 🛑 1. Rotas Quebradas (0)
🟢 _Nenhuma rota quebrada detectada._

---

## 💥 2. Exceções JS na Interface (0)
🟢 _Nenhuma exceção lançada no navegador._

---

## ⚠️ 3. Logs de Erro de Console (63)

- **Rota:** `/connections` | **Local:** `http://localhost:8080/node_modules/.vite/deps/chunk-CYR3URII.js?v=11366c9c:520` | **Mensagem:** `Warning: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.%s qa_stress_temp_qa_stress_1779890626090 
    at div
    at div
    at ConnectionsView (http://localhost:8080/src/lovable/pages/ConnectionsView.tsx:24:35)
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at div
    at MotionDOMComponent (http://localhost:8080/node_modules/.vite/deps/framer-motion.js?v=d24a51da:8678:40)
    at div
    at Connections (http://localhost:8080/src/pages/Connections.tsx:101:27)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Outlet (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4494:26)
    at main
    at div
    at MainLayout (http://localhost:8080/src/components/layout/MainLayout.tsx:29:39)
    at RuntimeProvider (http://localhost:8080/src/providers/RuntimeProvider.tsx:59:35)
    at RequireAdminAuth (http://localhost:8080/src/App.tsx:141:29)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Routes (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4558:5)
    at Suspense
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at BootGate (http://localhost:8080/src/App.tsx:73:21)
    at Router (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4501:15)
    at BrowserRouter (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:5247:5)
    at Provider (http://localhost:8080/node_modules/.vite/deps/chunk-TYATGQZ3.js?v=11366c9c:38:15)
    at TooltipProvider (http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-tooltip.js?v=375942f4:64:5)
    at O (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:23:25)
    at z (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:21:18)
    at ThemeProvider (http://localhost:8080/src/components/theme/ThemeProvider.tsx:22:33)
    at QueryClientProvider (http://localhost:8080/node_modules/.vite/deps/@tanstack_react-query.js?v=271e7c02:2934:3)
    at GlobalErrorBoundary (http://localhost:8080/src/components/system/GlobalErrorBoundary.tsx:329:9)
    at App (http://localhost:8080/src/App.tsx:266:5)`


- **Rota:** `/inbox` | **Local:** `http://localhost:4025/api/send-message:0` | **Mensagem:** `Failed to load resource: the server responded with a status of 409 (Conflict)`


- **Rota:** `/inbox` | **Local:** `http://localhost:4025/api/send-message:0` | **Mensagem:** `Failed to load resource: the server responded with a status of 409 (Conflict)`


- **Rota:** `/inbox` | **Local:** `http://localhost:4025/api/send-message:0` | **Mensagem:** `Failed to load resource: the server responded with a status of 409 (Conflict)`


- **Rota:** `/connections` | **Local:** `http://localhost:8080/node_modules/.vite/deps/chunk-CYR3URII.js?v=11366c9c:520` | **Mensagem:** `Warning: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.%s qa_stress_temp_qa_stress_1779890626090 
    at div
    at div
    at ConnectionsView (http://localhost:8080/src/lovable/pages/ConnectionsView.tsx:24:35)
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at div
    at MotionDOMComponent (http://localhost:8080/node_modules/.vite/deps/framer-motion.js?v=d24a51da:8678:40)
    at div
    at Connections (http://localhost:8080/src/pages/Connections.tsx:101:27)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Outlet (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4494:26)
    at main
    at div
    at MainLayout (http://localhost:8080/src/components/layout/MainLayout.tsx:29:39)
    at RuntimeProvider (http://localhost:8080/src/providers/RuntimeProvider.tsx:59:35)
    at RequireAdminAuth (http://localhost:8080/src/App.tsx:141:29)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Routes (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4558:5)
    at Suspense
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at BootGate (http://localhost:8080/src/App.tsx:73:21)
    at Router (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4501:15)
    at BrowserRouter (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:5247:5)
    at Provider (http://localhost:8080/node_modules/.vite/deps/chunk-TYATGQZ3.js?v=11366c9c:38:15)
    at TooltipProvider (http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-tooltip.js?v=375942f4:64:5)
    at O (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:23:25)
    at z (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:21:18)
    at ThemeProvider (http://localhost:8080/src/components/theme/ThemeProvider.tsx:22:33)
    at QueryClientProvider (http://localhost:8080/node_modules/.vite/deps/@tanstack_react-query.js?v=271e7c02:2934:3)
    at GlobalErrorBoundary (http://localhost:8080/src/components/system/GlobalErrorBoundary.tsx:329:9)
    at App (http://localhost:8080/src/App.tsx:266:5)`


- **Rota:** `/connections` | **Local:** `http://localhost:8080/node_modules/.vite/deps/chunk-CYR3URII.js?v=11366c9c:520` | **Mensagem:** `Warning: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.%s qa_stress_temp_qa_stress_1779890626090 
    at div
    at div
    at ConnectionsView (http://localhost:8080/src/lovable/pages/ConnectionsView.tsx:24:35)
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at div
    at MotionDOMComponent (http://localhost:8080/node_modules/.vite/deps/framer-motion.js?v=d24a51da:8678:40)
    at div
    at Connections (http://localhost:8080/src/pages/Connections.tsx:101:27)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Outlet (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4494:26)
    at main
    at div
    at MainLayout (http://localhost:8080/src/components/layout/MainLayout.tsx:29:39)
    at RuntimeProvider (http://localhost:8080/src/providers/RuntimeProvider.tsx:59:35)
    at RequireAdminAuth (http://localhost:8080/src/App.tsx:141:29)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Routes (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4558:5)
    at Suspense
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at BootGate (http://localhost:8080/src/App.tsx:73:21)
    at Router (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4501:15)
    at BrowserRouter (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:5247:5)
    at Provider (http://localhost:8080/node_modules/.vite/deps/chunk-TYATGQZ3.js?v=11366c9c:38:15)
    at TooltipProvider (http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-tooltip.js?v=375942f4:64:5)
    at O (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:23:25)
    at z (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:21:18)
    at ThemeProvider (http://localhost:8080/src/components/theme/ThemeProvider.tsx:22:33)
    at QueryClientProvider (http://localhost:8080/node_modules/.vite/deps/@tanstack_react-query.js?v=271e7c02:2934:3)
    at GlobalErrorBoundary (http://localhost:8080/src/components/system/GlobalErrorBoundary.tsx:329:9)
    at App (http://localhost:8080/src/App.tsx:266:5)`


- **Rota:** `/connections` | **Local:** `http://localhost:8080/node_modules/.vite/deps/chunk-CYR3URII.js?v=11366c9c:520` | **Mensagem:** `Warning: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.%s qa_stress_temp_qa_stress_1779890626090 
    at div
    at div
    at ConnectionsView (http://localhost:8080/src/lovable/pages/ConnectionsView.tsx:24:35)
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at div
    at MotionDOMComponent (http://localhost:8080/node_modules/.vite/deps/framer-motion.js?v=d24a51da:8678:40)
    at div
    at Connections (http://localhost:8080/src/pages/Connections.tsx:101:27)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Outlet (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4494:26)
    at main
    at div
    at MainLayout (http://localhost:8080/src/components/layout/MainLayout.tsx:29:39)
    at RuntimeProvider (http://localhost:8080/src/providers/RuntimeProvider.tsx:59:35)
    at RequireAdminAuth (http://localhost:8080/src/App.tsx:141:29)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Routes (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4558:5)
    at Suspense
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at BootGate (http://localhost:8080/src/App.tsx:73:21)
    at Router (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4501:15)
    at BrowserRouter (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:5247:5)
    at Provider (http://localhost:8080/node_modules/.vite/deps/chunk-TYATGQZ3.js?v=11366c9c:38:15)
    at TooltipProvider (http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-tooltip.js?v=375942f4:64:5)
    at O (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:23:25)
    at z (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:21:18)
    at ThemeProvider (http://localhost:8080/src/components/theme/ThemeProvider.tsx:22:33)
    at QueryClientProvider (http://localhost:8080/node_modules/.vite/deps/@tanstack_react-query.js?v=271e7c02:2934:3)
    at GlobalErrorBoundary (http://localhost:8080/src/components/system/GlobalErrorBoundary.tsx:329:9)
    at App (http://localhost:8080/src/App.tsx:266:5)`


- **Rota:** `/connections` | **Local:** `http://localhost:8080/node_modules/.vite/deps/chunk-CYR3URII.js?v=11366c9c:520` | **Mensagem:** `Warning: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.%s qa_stress_temp_qa_stress_1779890626090 
    at div
    at div
    at ConnectionsView (http://localhost:8080/src/lovable/pages/ConnectionsView.tsx:24:35)
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at div
    at MotionDOMComponent (http://localhost:8080/node_modules/.vite/deps/framer-motion.js?v=d24a51da:8678:40)
    at div
    at Connections (http://localhost:8080/src/pages/Connections.tsx:101:27)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Outlet (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4494:26)
    at main
    at div
    at MainLayout (http://localhost:8080/src/components/layout/MainLayout.tsx:29:39)
    at RuntimeProvider (http://localhost:8080/src/providers/RuntimeProvider.tsx:59:35)
    at RequireAdminAuth (http://localhost:8080/src/App.tsx:141:29)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Routes (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4558:5)
    at Suspense
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at BootGate (http://localhost:8080/src/App.tsx:73:21)
    at Router (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4501:15)
    at BrowserRouter (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:5247:5)
    at Provider (http://localhost:8080/node_modules/.vite/deps/chunk-TYATGQZ3.js?v=11366c9c:38:15)
    at TooltipProvider (http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-tooltip.js?v=375942f4:64:5)
    at O (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:23:25)
    at z (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:21:18)
    at ThemeProvider (http://localhost:8080/src/components/theme/ThemeProvider.tsx:22:33)
    at QueryClientProvider (http://localhost:8080/node_modules/.vite/deps/@tanstack_react-query.js?v=271e7c02:2934:3)
    at GlobalErrorBoundary (http://localhost:8080/src/components/system/GlobalErrorBoundary.tsx:329:9)
    at App (http://localhost:8080/src/App.tsx:266:5)`


- **Rota:** `/connections` | **Local:** `http://localhost:8080/node_modules/.vite/deps/chunk-CYR3URII.js?v=11366c9c:520` | **Mensagem:** `Warning: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.%s qa_stress_temp_qa_stress_1779890626090 
    at div
    at div
    at ConnectionsView (http://localhost:8080/src/lovable/pages/ConnectionsView.tsx:24:35)
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at div
    at MotionDOMComponent (http://localhost:8080/node_modules/.vite/deps/framer-motion.js?v=d24a51da:8678:40)
    at div
    at Connections (http://localhost:8080/src/pages/Connections.tsx:101:27)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Outlet (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4494:26)
    at main
    at div
    at MainLayout (http://localhost:8080/src/components/layout/MainLayout.tsx:29:39)
    at RuntimeProvider (http://localhost:8080/src/providers/RuntimeProvider.tsx:59:35)
    at RequireAdminAuth (http://localhost:8080/src/App.tsx:141:29)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Routes (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4558:5)
    at Suspense
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at BootGate (http://localhost:8080/src/App.tsx:73:21)
    at Router (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4501:15)
    at BrowserRouter (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:5247:5)
    at Provider (http://localhost:8080/node_modules/.vite/deps/chunk-TYATGQZ3.js?v=11366c9c:38:15)
    at TooltipProvider (http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-tooltip.js?v=375942f4:64:5)
    at O (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:23:25)
    at z (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:21:18)
    at ThemeProvider (http://localhost:8080/src/components/theme/ThemeProvider.tsx:22:33)
    at QueryClientProvider (http://localhost:8080/node_modules/.vite/deps/@tanstack_react-query.js?v=271e7c02:2934:3)
    at GlobalErrorBoundary (http://localhost:8080/src/components/system/GlobalErrorBoundary.tsx:329:9)
    at App (http://localhost:8080/src/App.tsx:266:5)`


- **Rota:** `/connections` | **Local:** `http://localhost:8080/node_modules/.vite/deps/chunk-CYR3URII.js?v=11366c9c:520` | **Mensagem:** `Warning: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.%s qa_stress_temp_qa_stress_1779890626090 
    at div
    at div
    at ConnectionsView (http://localhost:8080/src/lovable/pages/ConnectionsView.tsx:24:35)
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at div
    at MotionDOMComponent (http://localhost:8080/node_modules/.vite/deps/framer-motion.js?v=d24a51da:8678:40)
    at div
    at Connections (http://localhost:8080/src/pages/Connections.tsx:101:27)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Outlet (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4494:26)
    at main
    at div
    at MainLayout (http://localhost:8080/src/components/layout/MainLayout.tsx:29:39)
    at RuntimeProvider (http://localhost:8080/src/providers/RuntimeProvider.tsx:59:35)
    at RequireAdminAuth (http://localhost:8080/src/App.tsx:141:29)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Routes (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4558:5)
    at Suspense
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at BootGate (http://localhost:8080/src/App.tsx:73:21)
    at Router (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4501:15)
    at BrowserRouter (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:5247:5)
    at Provider (http://localhost:8080/node_modules/.vite/deps/chunk-TYATGQZ3.js?v=11366c9c:38:15)
    at TooltipProvider (http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-tooltip.js?v=375942f4:64:5)
    at O (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:23:25)
    at z (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:21:18)
    at ThemeProvider (http://localhost:8080/src/components/theme/ThemeProvider.tsx:22:33)
    at QueryClientProvider (http://localhost:8080/node_modules/.vite/deps/@tanstack_react-query.js?v=271e7c02:2934:3)
    at GlobalErrorBoundary (http://localhost:8080/src/components/system/GlobalErrorBoundary.tsx:329:9)
    at App (http://localhost:8080/src/App.tsx:266:5)`


- **Rota:** `/connections` | **Local:** `http://localhost:8080/node_modules/.vite/deps/chunk-CYR3URII.js?v=11366c9c:520` | **Mensagem:** `Warning: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.%s qa_stress_temp_qa_stress_1779890626090 
    at div
    at div
    at ConnectionsView (http://localhost:8080/src/lovable/pages/ConnectionsView.tsx:24:35)
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at div
    at MotionDOMComponent (http://localhost:8080/node_modules/.vite/deps/framer-motion.js?v=d24a51da:8678:40)
    at div
    at Connections (http://localhost:8080/src/pages/Connections.tsx:101:27)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Outlet (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4494:26)
    at main
    at div
    at MainLayout (http://localhost:8080/src/components/layout/MainLayout.tsx:29:39)
    at RuntimeProvider (http://localhost:8080/src/providers/RuntimeProvider.tsx:59:35)
    at RequireAdminAuth (http://localhost:8080/src/App.tsx:141:29)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Routes (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4558:5)
    at Suspense
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at BootGate (http://localhost:8080/src/App.tsx:73:21)
    at Router (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4501:15)
    at BrowserRouter (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:5247:5)
    at Provider (http://localhost:8080/node_modules/.vite/deps/chunk-TYATGQZ3.js?v=11366c9c:38:15)
    at TooltipProvider (http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-tooltip.js?v=375942f4:64:5)
    at O (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:23:25)
    at z (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:21:18)
    at ThemeProvider (http://localhost:8080/src/components/theme/ThemeProvider.tsx:22:33)
    at QueryClientProvider (http://localhost:8080/node_modules/.vite/deps/@tanstack_react-query.js?v=271e7c02:2934:3)
    at GlobalErrorBoundary (http://localhost:8080/src/components/system/GlobalErrorBoundary.tsx:329:9)
    at App (http://localhost:8080/src/App.tsx:266:5)`


- **Rota:** `/connections` | **Local:** `http://localhost:8080/node_modules/.vite/deps/chunk-CYR3URII.js?v=11366c9c:520` | **Mensagem:** `Warning: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.%s qa_stress_temp_qa_stress_1779890626090 
    at div
    at div
    at ConnectionsView (http://localhost:8080/src/lovable/pages/ConnectionsView.tsx:24:35)
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at div
    at MotionDOMComponent (http://localhost:8080/node_modules/.vite/deps/framer-motion.js?v=d24a51da:8678:40)
    at div
    at Connections (http://localhost:8080/src/pages/Connections.tsx:101:27)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Outlet (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4494:26)
    at main
    at div
    at MainLayout (http://localhost:8080/src/components/layout/MainLayout.tsx:29:39)
    at RuntimeProvider (http://localhost:8080/src/providers/RuntimeProvider.tsx:59:35)
    at RequireAdminAuth (http://localhost:8080/src/App.tsx:141:29)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Routes (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4558:5)
    at Suspense
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at BootGate (http://localhost:8080/src/App.tsx:73:21)
    at Router (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4501:15)
    at BrowserRouter (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:5247:5)
    at Provider (http://localhost:8080/node_modules/.vite/deps/chunk-TYATGQZ3.js?v=11366c9c:38:15)
    at TooltipProvider (http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-tooltip.js?v=375942f4:64:5)
    at O (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:23:25)
    at z (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:21:18)
    at ThemeProvider (http://localhost:8080/src/components/theme/ThemeProvider.tsx:22:33)
    at QueryClientProvider (http://localhost:8080/node_modules/.vite/deps/@tanstack_react-query.js?v=271e7c02:2934:3)
    at GlobalErrorBoundary (http://localhost:8080/src/components/system/GlobalErrorBoundary.tsx:329:9)
    at App (http://localhost:8080/src/App.tsx:266:5)`


- **Rota:** `/connections` | **Local:** `http://localhost:8080/node_modules/.vite/deps/chunk-CYR3URII.js?v=11366c9c:520` | **Mensagem:** `Warning: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.%s qa_stress_temp_qa_stress_1779890626090 
    at div
    at div
    at ConnectionsView (http://localhost:8080/src/lovable/pages/ConnectionsView.tsx:24:35)
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at div
    at MotionDOMComponent (http://localhost:8080/node_modules/.vite/deps/framer-motion.js?v=d24a51da:8678:40)
    at div
    at Connections (http://localhost:8080/src/pages/Connections.tsx:101:27)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Outlet (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4494:26)
    at main
    at div
    at MainLayout (http://localhost:8080/src/components/layout/MainLayout.tsx:29:39)
    at RuntimeProvider (http://localhost:8080/src/providers/RuntimeProvider.tsx:59:35)
    at RequireAdminAuth (http://localhost:8080/src/App.tsx:141:29)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Routes (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4558:5)
    at Suspense
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at BootGate (http://localhost:8080/src/App.tsx:73:21)
    at Router (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4501:15)
    at BrowserRouter (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:5247:5)
    at Provider (http://localhost:8080/node_modules/.vite/deps/chunk-TYATGQZ3.js?v=11366c9c:38:15)
    at TooltipProvider (http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-tooltip.js?v=375942f4:64:5)
    at O (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:23:25)
    at z (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:21:18)
    at ThemeProvider (http://localhost:8080/src/components/theme/ThemeProvider.tsx:22:33)
    at QueryClientProvider (http://localhost:8080/node_modules/.vite/deps/@tanstack_react-query.js?v=271e7c02:2934:3)
    at GlobalErrorBoundary (http://localhost:8080/src/components/system/GlobalErrorBoundary.tsx:329:9)
    at App (http://localhost:8080/src/App.tsx:266:5)`


- **Rota:** `/connections` | **Local:** `http://localhost:8080/node_modules/.vite/deps/chunk-CYR3URII.js?v=11366c9c:520` | **Mensagem:** `Warning: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.%s qa_stress_temp_qa_stress_1779890626090 
    at div
    at div
    at ConnectionsView (http://localhost:8080/src/lovable/pages/ConnectionsView.tsx:24:35)
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at div
    at MotionDOMComponent (http://localhost:8080/node_modules/.vite/deps/framer-motion.js?v=d24a51da:8678:40)
    at div
    at Connections (http://localhost:8080/src/pages/Connections.tsx:101:27)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Outlet (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4494:26)
    at main
    at div
    at MainLayout (http://localhost:8080/src/components/layout/MainLayout.tsx:29:39)
    at RuntimeProvider (http://localhost:8080/src/providers/RuntimeProvider.tsx:59:35)
    at RequireAdminAuth (http://localhost:8080/src/App.tsx:141:29)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Routes (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4558:5)
    at Suspense
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at BootGate (http://localhost:8080/src/App.tsx:73:21)
    at Router (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4501:15)
    at BrowserRouter (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:5247:5)
    at Provider (http://localhost:8080/node_modules/.vite/deps/chunk-TYATGQZ3.js?v=11366c9c:38:15)
    at TooltipProvider (http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-tooltip.js?v=375942f4:64:5)
    at O (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:23:25)
    at z (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:21:18)
    at ThemeProvider (http://localhost:8080/src/components/theme/ThemeProvider.tsx:22:33)
    at QueryClientProvider (http://localhost:8080/node_modules/.vite/deps/@tanstack_react-query.js?v=271e7c02:2934:3)
    at GlobalErrorBoundary (http://localhost:8080/src/components/system/GlobalErrorBoundary.tsx:329:9)
    at App (http://localhost:8080/src/App.tsx:266:5)`


- **Rota:** `/connections` | **Local:** `http://localhost:8080/node_modules/.vite/deps/chunk-CYR3URII.js?v=11366c9c:520` | **Mensagem:** `Warning: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.%s qa_stress_temp_qa_stress_1779890626090 
    at div
    at div
    at ConnectionsView (http://localhost:8080/src/lovable/pages/ConnectionsView.tsx:24:35)
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at div
    at MotionDOMComponent (http://localhost:8080/node_modules/.vite/deps/framer-motion.js?v=d24a51da:8678:40)
    at div
    at Connections (http://localhost:8080/src/pages/Connections.tsx:101:27)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Outlet (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4494:26)
    at main
    at div
    at MainLayout (http://localhost:8080/src/components/layout/MainLayout.tsx:29:39)
    at RuntimeProvider (http://localhost:8080/src/providers/RuntimeProvider.tsx:59:35)
    at RequireAdminAuth (http://localhost:8080/src/App.tsx:141:29)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Routes (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4558:5)
    at Suspense
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at BootGate (http://localhost:8080/src/App.tsx:73:21)
    at Router (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4501:15)
    at BrowserRouter (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:5247:5)
    at Provider (http://localhost:8080/node_modules/.vite/deps/chunk-TYATGQZ3.js?v=11366c9c:38:15)
    at TooltipProvider (http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-tooltip.js?v=375942f4:64:5)
    at O (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:23:25)
    at z (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:21:18)
    at ThemeProvider (http://localhost:8080/src/components/theme/ThemeProvider.tsx:22:33)
    at QueryClientProvider (http://localhost:8080/node_modules/.vite/deps/@tanstack_react-query.js?v=271e7c02:2934:3)
    at GlobalErrorBoundary (http://localhost:8080/src/components/system/GlobalErrorBoundary.tsx:329:9)
    at App (http://localhost:8080/src/App.tsx:266:5)`


- **Rota:** `/connections` | **Local:** `http://localhost:8080/node_modules/.vite/deps/chunk-CYR3URII.js?v=11366c9c:520` | **Mensagem:** `Warning: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.%s qa_stress_temp_qa_stress_1779890626090 
    at div
    at div
    at ConnectionsView (http://localhost:8080/src/lovable/pages/ConnectionsView.tsx:24:35)
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at div
    at MotionDOMComponent (http://localhost:8080/node_modules/.vite/deps/framer-motion.js?v=d24a51da:8678:40)
    at div
    at Connections (http://localhost:8080/src/pages/Connections.tsx:101:27)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Outlet (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4494:26)
    at main
    at div
    at MainLayout (http://localhost:8080/src/components/layout/MainLayout.tsx:29:39)
    at RuntimeProvider (http://localhost:8080/src/providers/RuntimeProvider.tsx:59:35)
    at RequireAdminAuth (http://localhost:8080/src/App.tsx:141:29)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Routes (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4558:5)
    at Suspense
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at BootGate (http://localhost:8080/src/App.tsx:73:21)
    at Router (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4501:15)
    at BrowserRouter (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:5247:5)
    at Provider (http://localhost:8080/node_modules/.vite/deps/chunk-TYATGQZ3.js?v=11366c9c:38:15)
    at TooltipProvider (http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-tooltip.js?v=375942f4:64:5)
    at O (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:23:25)
    at z (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:21:18)
    at ThemeProvider (http://localhost:8080/src/components/theme/ThemeProvider.tsx:22:33)
    at QueryClientProvider (http://localhost:8080/node_modules/.vite/deps/@tanstack_react-query.js?v=271e7c02:2934:3)
    at GlobalErrorBoundary (http://localhost:8080/src/components/system/GlobalErrorBoundary.tsx:329:9)
    at App (http://localhost:8080/src/App.tsx:266:5)`


- **Rota:** `/connections` | **Local:** `http://localhost:8080/node_modules/.vite/deps/chunk-CYR3URII.js?v=11366c9c:520` | **Mensagem:** `Warning: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.%s qa_stress_temp_qa_stress_1779890626090 
    at div
    at div
    at ConnectionsView (http://localhost:8080/src/lovable/pages/ConnectionsView.tsx:24:35)
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at div
    at MotionDOMComponent (http://localhost:8080/node_modules/.vite/deps/framer-motion.js?v=d24a51da:8678:40)
    at div
    at Connections (http://localhost:8080/src/pages/Connections.tsx:101:27)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Outlet (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4494:26)
    at main
    at div
    at MainLayout (http://localhost:8080/src/components/layout/MainLayout.tsx:29:39)
    at RuntimeProvider (http://localhost:8080/src/providers/RuntimeProvider.tsx:59:35)
    at RequireAdminAuth (http://localhost:8080/src/App.tsx:141:29)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Routes (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4558:5)
    at Suspense
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at BootGate (http://localhost:8080/src/App.tsx:73:21)
    at Router (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4501:15)
    at BrowserRouter (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:5247:5)
    at Provider (http://localhost:8080/node_modules/.vite/deps/chunk-TYATGQZ3.js?v=11366c9c:38:15)
    at TooltipProvider (http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-tooltip.js?v=375942f4:64:5)
    at O (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:23:25)
    at z (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:21:18)
    at ThemeProvider (http://localhost:8080/src/components/theme/ThemeProvider.tsx:22:33)
    at QueryClientProvider (http://localhost:8080/node_modules/.vite/deps/@tanstack_react-query.js?v=271e7c02:2934:3)
    at GlobalErrorBoundary (http://localhost:8080/src/components/system/GlobalErrorBoundary.tsx:329:9)
    at App (http://localhost:8080/src/App.tsx:266:5)`


- **Rota:** `/connections` | **Local:** `http://localhost:8080/node_modules/.vite/deps/chunk-CYR3URII.js?v=11366c9c:520` | **Mensagem:** `Warning: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.%s qa_stress_temp_qa_stress_1779890626090 
    at div
    at div
    at ConnectionsView (http://localhost:8080/src/lovable/pages/ConnectionsView.tsx:24:35)
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at div
    at MotionDOMComponent (http://localhost:8080/node_modules/.vite/deps/framer-motion.js?v=d24a51da:8678:40)
    at div
    at Connections (http://localhost:8080/src/pages/Connections.tsx:101:27)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Outlet (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4494:26)
    at main
    at div
    at MainLayout (http://localhost:8080/src/components/layout/MainLayout.tsx:29:39)
    at RuntimeProvider (http://localhost:8080/src/providers/RuntimeProvider.tsx:59:35)
    at RequireAdminAuth (http://localhost:8080/src/App.tsx:141:29)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Routes (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4558:5)
    at Suspense
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at BootGate (http://localhost:8080/src/App.tsx:73:21)
    at Router (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4501:15)
    at BrowserRouter (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:5247:5)
    at Provider (http://localhost:8080/node_modules/.vite/deps/chunk-TYATGQZ3.js?v=11366c9c:38:15)
    at TooltipProvider (http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-tooltip.js?v=375942f4:64:5)
    at O (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:23:25)
    at z (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:21:18)
    at ThemeProvider (http://localhost:8080/src/components/theme/ThemeProvider.tsx:22:33)
    at QueryClientProvider (http://localhost:8080/node_modules/.vite/deps/@tanstack_react-query.js?v=271e7c02:2934:3)
    at GlobalErrorBoundary (http://localhost:8080/src/components/system/GlobalErrorBoundary.tsx:329:9)
    at App (http://localhost:8080/src/App.tsx:266:5)`


- **Rota:** `/connections` | **Local:** `http://localhost:8080/node_modules/.vite/deps/chunk-CYR3URII.js?v=11366c9c:520` | **Mensagem:** `Warning: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.%s qa_stress_temp_qa_stress_1779890626090 
    at div
    at div
    at ConnectionsView (http://localhost:8080/src/lovable/pages/ConnectionsView.tsx:24:35)
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at div
    at MotionDOMComponent (http://localhost:8080/node_modules/.vite/deps/framer-motion.js?v=d24a51da:8678:40)
    at div
    at Connections (http://localhost:8080/src/pages/Connections.tsx:101:27)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Outlet (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4494:26)
    at main
    at div
    at MainLayout (http://localhost:8080/src/components/layout/MainLayout.tsx:29:39)
    at RuntimeProvider (http://localhost:8080/src/providers/RuntimeProvider.tsx:59:35)
    at RequireAdminAuth (http://localhost:8080/src/App.tsx:141:29)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Routes (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4558:5)
    at Suspense
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at BootGate (http://localhost:8080/src/App.tsx:73:21)
    at Router (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4501:15)
    at BrowserRouter (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:5247:5)
    at Provider (http://localhost:8080/node_modules/.vite/deps/chunk-TYATGQZ3.js?v=11366c9c:38:15)
    at TooltipProvider (http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-tooltip.js?v=375942f4:64:5)
    at O (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:23:25)
    at z (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:21:18)
    at ThemeProvider (http://localhost:8080/src/components/theme/ThemeProvider.tsx:22:33)
    at QueryClientProvider (http://localhost:8080/node_modules/.vite/deps/@tanstack_react-query.js?v=271e7c02:2934:3)
    at GlobalErrorBoundary (http://localhost:8080/src/components/system/GlobalErrorBoundary.tsx:329:9)
    at App (http://localhost:8080/src/App.tsx:266:5)`


- **Rota:** `/connections` | **Local:** `http://localhost:8080/node_modules/.vite/deps/chunk-CYR3URII.js?v=11366c9c:520` | **Mensagem:** `Warning: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.%s qa_stress_temp_qa_stress_1779890626090 
    at div
    at div
    at ConnectionsView (http://localhost:8080/src/lovable/pages/ConnectionsView.tsx:24:35)
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at div
    at MotionDOMComponent (http://localhost:8080/node_modules/.vite/deps/framer-motion.js?v=d24a51da:8678:40)
    at div
    at Connections (http://localhost:8080/src/pages/Connections.tsx:101:27)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Outlet (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4494:26)
    at main
    at div
    at MainLayout (http://localhost:8080/src/components/layout/MainLayout.tsx:29:39)
    at RuntimeProvider (http://localhost:8080/src/providers/RuntimeProvider.tsx:59:35)
    at RequireAdminAuth (http://localhost:8080/src/App.tsx:141:29)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Routes (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4558:5)
    at Suspense
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at BootGate (http://localhost:8080/src/App.tsx:73:21)
    at Router (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4501:15)
    at BrowserRouter (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:5247:5)
    at Provider (http://localhost:8080/node_modules/.vite/deps/chunk-TYATGQZ3.js?v=11366c9c:38:15)
    at TooltipProvider (http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-tooltip.js?v=375942f4:64:5)
    at O (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:23:25)
    at z (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:21:18)
    at ThemeProvider (http://localhost:8080/src/components/theme/ThemeProvider.tsx:22:33)
    at QueryClientProvider (http://localhost:8080/node_modules/.vite/deps/@tanstack_react-query.js?v=271e7c02:2934:3)
    at GlobalErrorBoundary (http://localhost:8080/src/components/system/GlobalErrorBoundary.tsx:329:9)
    at App (http://localhost:8080/src/App.tsx:266:5)`


- **Rota:** `/connections` | **Local:** `http://localhost:8080/node_modules/.vite/deps/chunk-CYR3URII.js?v=11366c9c:520` | **Mensagem:** `Warning: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.%s qa_stress_temp_qa_stress_1779890626090 
    at div
    at div
    at ConnectionsView (http://localhost:8080/src/lovable/pages/ConnectionsView.tsx:24:35)
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at div
    at MotionDOMComponent (http://localhost:8080/node_modules/.vite/deps/framer-motion.js?v=d24a51da:8678:40)
    at div
    at Connections (http://localhost:8080/src/pages/Connections.tsx:101:27)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Outlet (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4494:26)
    at main
    at div
    at MainLayout (http://localhost:8080/src/components/layout/MainLayout.tsx:29:39)
    at RuntimeProvider (http://localhost:8080/src/providers/RuntimeProvider.tsx:59:35)
    at RequireAdminAuth (http://localhost:8080/src/App.tsx:141:29)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Routes (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4558:5)
    at Suspense
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at BootGate (http://localhost:8080/src/App.tsx:73:21)
    at Router (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4501:15)
    at BrowserRouter (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:5247:5)
    at Provider (http://localhost:8080/node_modules/.vite/deps/chunk-TYATGQZ3.js?v=11366c9c:38:15)
    at TooltipProvider (http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-tooltip.js?v=375942f4:64:5)
    at O (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:23:25)
    at z (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:21:18)
    at ThemeProvider (http://localhost:8080/src/components/theme/ThemeProvider.tsx:22:33)
    at QueryClientProvider (http://localhost:8080/node_modules/.vite/deps/@tanstack_react-query.js?v=271e7c02:2934:3)
    at GlobalErrorBoundary (http://localhost:8080/src/components/system/GlobalErrorBoundary.tsx:329:9)
    at App (http://localhost:8080/src/App.tsx:266:5)`


- **Rota:** `/connections` | **Local:** `http://localhost:8080/node_modules/.vite/deps/chunk-CYR3URII.js?v=11366c9c:520` | **Mensagem:** `Warning: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.%s qa_stress_temp_qa_stress_1779890626090 
    at div
    at div
    at ConnectionsView (http://localhost:8080/src/lovable/pages/ConnectionsView.tsx:24:35)
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at div
    at MotionDOMComponent (http://localhost:8080/node_modules/.vite/deps/framer-motion.js?v=d24a51da:8678:40)
    at div
    at Connections (http://localhost:8080/src/pages/Connections.tsx:101:27)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Outlet (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4494:26)
    at main
    at div
    at MainLayout (http://localhost:8080/src/components/layout/MainLayout.tsx:29:39)
    at RuntimeProvider (http://localhost:8080/src/providers/RuntimeProvider.tsx:59:35)
    at RequireAdminAuth (http://localhost:8080/src/App.tsx:141:29)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Routes (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4558:5)
    at Suspense
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at BootGate (http://localhost:8080/src/App.tsx:73:21)
    at Router (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4501:15)
    at BrowserRouter (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:5247:5)
    at Provider (http://localhost:8080/node_modules/.vite/deps/chunk-TYATGQZ3.js?v=11366c9c:38:15)
    at TooltipProvider (http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-tooltip.js?v=375942f4:64:5)
    at O (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:23:25)
    at z (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:21:18)
    at ThemeProvider (http://localhost:8080/src/components/theme/ThemeProvider.tsx:22:33)
    at QueryClientProvider (http://localhost:8080/node_modules/.vite/deps/@tanstack_react-query.js?v=271e7c02:2934:3)
    at GlobalErrorBoundary (http://localhost:8080/src/components/system/GlobalErrorBoundary.tsx:329:9)
    at App (http://localhost:8080/src/App.tsx:266:5)`


- **Rota:** `/nodes` | **Local:** `http://localhost:4025/api/cluster/nodes:0` | **Mensagem:** `Failed to load resource: the server responded with a status of 404 (Not Found)`


- **Rota:** `/nodes` | **Local:** `http://localhost:4025/api/cluster/overview:0` | **Mensagem:** `Failed to load resource: the server responded with a status of 404 (Not Found)`


- **Rota:** `/nodes` | **Local:** `http://localhost:4025/api/cluster/nodes:0` | **Mensagem:** `Failed to load resource: the server responded with a status of 404 (Not Found)`


- **Rota:** `/nodes` | **Local:** `http://localhost:4025/api/cluster/overview:0` | **Mensagem:** `Failed to load resource: the server responded with a status of 404 (Not Found)`


- **Rota:** `/nodes` | **Local:** `http://localhost:4025/api/cluster/nodes:0` | **Mensagem:** `Failed to load resource: the server responded with a status of 404 (Not Found)`


- **Rota:** `/nodes` | **Local:** `http://localhost:4025/api/cluster/overview:0` | **Mensagem:** `Failed to load resource: the server responded with a status of 404 (Not Found)`


- **Rota:** `/connections` | **Local:** `http://localhost:8080/node_modules/.vite/deps/chunk-CYR3URII.js?v=11366c9c:520` | **Mensagem:** `Warning: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.%s qa_stress_temp_qa_stress_1779890626090 
    at div
    at div
    at ConnectionsView (http://localhost:8080/src/lovable/pages/ConnectionsView.tsx:24:35)
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at div
    at MotionDOMComponent (http://localhost:8080/node_modules/.vite/deps/framer-motion.js?v=d24a51da:8678:40)
    at div
    at Connections (http://localhost:8080/src/pages/Connections.tsx:101:27)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Outlet (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4494:26)
    at main
    at div
    at MainLayout (http://localhost:8080/src/components/layout/MainLayout.tsx:29:39)
    at RuntimeProvider (http://localhost:8080/src/providers/RuntimeProvider.tsx:59:35)
    at RequireAdminAuth (http://localhost:8080/src/App.tsx:141:29)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Routes (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4558:5)
    at Suspense
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at BootGate (http://localhost:8080/src/App.tsx:73:21)
    at Router (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4501:15)
    at BrowserRouter (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:5247:5)
    at Provider (http://localhost:8080/node_modules/.vite/deps/chunk-TYATGQZ3.js?v=11366c9c:38:15)
    at TooltipProvider (http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-tooltip.js?v=375942f4:64:5)
    at O (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:23:25)
    at z (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:21:18)
    at ThemeProvider (http://localhost:8080/src/components/theme/ThemeProvider.tsx:22:33)
    at QueryClientProvider (http://localhost:8080/node_modules/.vite/deps/@tanstack_react-query.js?v=271e7c02:2934:3)
    at GlobalErrorBoundary (http://localhost:8080/src/components/system/GlobalErrorBoundary.tsx:329:9)
    at App (http://localhost:8080/src/App.tsx:266:5)`


- **Rota:** `/nodes` | **Local:** `http://localhost:4025/api/cluster/nodes:0` | **Mensagem:** `Failed to load resource: the server responded with a status of 404 (Not Found)`


- **Rota:** `/nodes` | **Local:** `http://localhost:4025/api/cluster/overview:0` | **Mensagem:** `Failed to load resource: the server responded with a status of 404 (Not Found)`


- **Rota:** `/nodes` | **Local:** `http://localhost:4025/api/cluster/nodes:0` | **Mensagem:** `Failed to load resource: the server responded with a status of 404 (Not Found)`


- **Rota:** `/nodes` | **Local:** `http://localhost:4025/api/cluster/overview:0` | **Mensagem:** `Failed to load resource: the server responded with a status of 404 (Not Found)`


- **Rota:** `/nodes` | **Local:** `http://localhost:4025/api/cluster/nodes:0` | **Mensagem:** `Failed to load resource: the server responded with a status of 404 (Not Found)`


- **Rota:** `/nodes` | **Local:** `http://localhost:4025/api/cluster/overview:0` | **Mensagem:** `Failed to load resource: the server responded with a status of 404 (Not Found)`


- **Rota:** `/nodes` | **Local:** `http://localhost:4025/api/cluster/nodes:0` | **Mensagem:** `Failed to load resource: the server responded with a status of 404 (Not Found)`


- **Rota:** `/nodes` | **Local:** `http://localhost:4025/api/cluster/overview:0` | **Mensagem:** `Failed to load resource: the server responded with a status of 404 (Not Found)`


- **Rota:** `/nodes` | **Local:** `http://localhost:4025/api/cluster/nodes:0` | **Mensagem:** `Failed to load resource: the server responded with a status of 404 (Not Found)`


- **Rota:** `/nodes` | **Local:** `http://localhost:4025/api/cluster/overview:0` | **Mensagem:** `Failed to load resource: the server responded with a status of 404 (Not Found)`


- **Rota:** `/nodes` | **Local:** `http://localhost:4025/api/cluster/nodes:0` | **Mensagem:** `Failed to load resource: the server responded with a status of 404 (Not Found)`


- **Rota:** `/nodes` | **Local:** `http://localhost:4025/api/cluster/overview:0` | **Mensagem:** `Failed to load resource: the server responded with a status of 404 (Not Found)`


- **Rota:** `/deployments` | **Local:** `http://localhost:4025/api/cluster/nodes:0` | **Mensagem:** `Failed to load resource: the server responded with a status of 404 (Not Found)`


- **Rota:** `/deployments` | **Local:** `http://localhost:4025/api/cluster/overview:0` | **Mensagem:** `Failed to load resource: the server responded with a status of 404 (Not Found)`


- **Rota:** `/deployments` | **Local:** `http://localhost:4025/api/cluster/nodes:0` | **Mensagem:** `Failed to load resource: the server responded with a status of 404 (Not Found)`


- **Rota:** `/deployments` | **Local:** `http://localhost:4025/api/cluster/overview:0` | **Mensagem:** `Failed to load resource: the server responded with a status of 404 (Not Found)`


- **Rota:** `/deployments` | **Local:** `http://localhost:4025/api/cluster/nodes:0` | **Mensagem:** `Failed to load resource: the server responded with a status of 404 (Not Found)`


- **Rota:** `/deployments` | **Local:** `http://localhost:4025/api/cluster/overview:0` | **Mensagem:** `Failed to load resource: the server responded with a status of 404 (Not Found)`


- **Rota:** `/connections` | **Local:** `http://localhost:8080/node_modules/.vite/deps/chunk-CYR3URII.js?v=11366c9c:520` | **Mensagem:** `Warning: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.%s qa_stress_temp_qa_stress_1779890626090 
    at div
    at div
    at ConnectionsView (http://localhost:8080/src/lovable/pages/ConnectionsView.tsx:24:35)
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at div
    at MotionDOMComponent (http://localhost:8080/node_modules/.vite/deps/framer-motion.js?v=d24a51da:8678:40)
    at div
    at Connections (http://localhost:8080/src/pages/Connections.tsx:101:27)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Outlet (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4494:26)
    at main
    at div
    at MainLayout (http://localhost:8080/src/components/layout/MainLayout.tsx:29:39)
    at RuntimeProvider (http://localhost:8080/src/providers/RuntimeProvider.tsx:59:35)
    at RequireAdminAuth (http://localhost:8080/src/App.tsx:141:29)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Routes (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4558:5)
    at Suspense
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at BootGate (http://localhost:8080/src/App.tsx:73:21)
    at Router (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4501:15)
    at BrowserRouter (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:5247:5)
    at Provider (http://localhost:8080/node_modules/.vite/deps/chunk-TYATGQZ3.js?v=11366c9c:38:15)
    at TooltipProvider (http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-tooltip.js?v=375942f4:64:5)
    at O (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:23:25)
    at z (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:21:18)
    at ThemeProvider (http://localhost:8080/src/components/theme/ThemeProvider.tsx:22:33)
    at QueryClientProvider (http://localhost:8080/node_modules/.vite/deps/@tanstack_react-query.js?v=271e7c02:2934:3)
    at GlobalErrorBoundary (http://localhost:8080/src/components/system/GlobalErrorBoundary.tsx:329:9)
    at App (http://localhost:8080/src/App.tsx:266:5)`


- **Rota:** `/deployments` | **Local:** `http://localhost:4025/api/cluster/nodes:0` | **Mensagem:** `Failed to load resource: the server responded with a status of 404 (Not Found)`


- **Rota:** `/deployments` | **Local:** `http://localhost:4025/api/cluster/overview:0` | **Mensagem:** `Failed to load resource: the server responded with a status of 404 (Not Found)`


- **Rota:** `/deployments` | **Local:** `http://localhost:4025/api/cluster/nodes:0` | **Mensagem:** `Failed to load resource: the server responded with a status of 404 (Not Found)`


- **Rota:** `/deployments` | **Local:** `http://localhost:4025/api/cluster/overview:0` | **Mensagem:** `Failed to load resource: the server responded with a status of 404 (Not Found)`


- **Rota:** `/deployments` | **Local:** `http://localhost:4025/api/cluster/nodes:0` | **Mensagem:** `Failed to load resource: the server responded with a status of 404 (Not Found)`


- **Rota:** `/deployments` | **Local:** `http://localhost:4025/api/cluster/overview:0` | **Mensagem:** `Failed to load resource: the server responded with a status of 404 (Not Found)`


- **Rota:** `/deployments` | **Local:** `http://localhost:4025/api/cluster/nodes:0` | **Mensagem:** `Failed to load resource: the server responded with a status of 404 (Not Found)`


- **Rota:** `/deployments` | **Local:** `http://localhost:4025/api/cluster/overview:0` | **Mensagem:** `Failed to load resource: the server responded with a status of 404 (Not Found)`


- **Rota:** `/deployments` | **Local:** `http://localhost:4025/api/cluster/nodes:0` | **Mensagem:** `Failed to load resource: the server responded with a status of 404 (Not Found)`


- **Rota:** `/deployments` | **Local:** `http://localhost:4025/api/cluster/overview:0` | **Mensagem:** `Failed to load resource: the server responded with a status of 404 (Not Found)`


- **Rota:** `/deployments` | **Local:** `http://localhost:4025/api/cluster/nodes:0` | **Mensagem:** `Failed to load resource: the server responded with a status of 404 (Not Found)`


- **Rota:** `/deployments` | **Local:** `http://localhost:4025/api/cluster/overview:0` | **Mensagem:** `Failed to load resource: the server responded with a status of 404 (Not Found)`


- **Rota:** `/connections` | **Local:** `http://localhost:8080/node_modules/.vite/deps/chunk-CYR3URII.js?v=11366c9c:520` | **Mensagem:** `Warning: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.%s qa_stress_temp_qa_stress_1779890626090 
    at div
    at div
    at ConnectionsView (http://localhost:8080/src/lovable/pages/ConnectionsView.tsx:24:35)
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at div
    at MotionDOMComponent (http://localhost:8080/node_modules/.vite/deps/framer-motion.js?v=d24a51da:8678:40)
    at div
    at Connections (http://localhost:8080/src/pages/Connections.tsx:101:27)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Outlet (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4494:26)
    at main
    at div
    at MainLayout (http://localhost:8080/src/components/layout/MainLayout.tsx:29:39)
    at RuntimeProvider (http://localhost:8080/src/providers/RuntimeProvider.tsx:59:35)
    at RequireAdminAuth (http://localhost:8080/src/App.tsx:141:29)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Routes (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4558:5)
    at Suspense
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at BootGate (http://localhost:8080/src/App.tsx:73:21)
    at Router (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4501:15)
    at BrowserRouter (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:5247:5)
    at Provider (http://localhost:8080/node_modules/.vite/deps/chunk-TYATGQZ3.js?v=11366c9c:38:15)
    at TooltipProvider (http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-tooltip.js?v=375942f4:64:5)
    at O (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:23:25)
    at z (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:21:18)
    at ThemeProvider (http://localhost:8080/src/components/theme/ThemeProvider.tsx:22:33)
    at QueryClientProvider (http://localhost:8080/node_modules/.vite/deps/@tanstack_react-query.js?v=271e7c02:2934:3)
    at GlobalErrorBoundary (http://localhost:8080/src/components/system/GlobalErrorBoundary.tsx:329:9)
    at App (http://localhost:8080/src/App.tsx:266:5)`


- **Rota:** `/connections` | **Local:** `http://localhost:8080/node_modules/.vite/deps/chunk-CYR3URII.js?v=11366c9c:520` | **Mensagem:** `Warning: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.%s qa_stress_temp_qa_stress_1779890626090 
    at div
    at div
    at ConnectionsView (http://localhost:8080/src/lovable/pages/ConnectionsView.tsx:24:35)
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at div
    at MotionDOMComponent (http://localhost:8080/node_modules/.vite/deps/framer-motion.js?v=d24a51da:8678:40)
    at div
    at Connections (http://localhost:8080/src/pages/Connections.tsx:101:27)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Outlet (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4494:26)
    at main
    at div
    at MainLayout (http://localhost:8080/src/components/layout/MainLayout.tsx:29:39)
    at RuntimeProvider (http://localhost:8080/src/providers/RuntimeProvider.tsx:59:35)
    at RequireAdminAuth (http://localhost:8080/src/App.tsx:141:29)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Routes (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4558:5)
    at Suspense
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at BootGate (http://localhost:8080/src/App.tsx:73:21)
    at Router (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4501:15)
    at BrowserRouter (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:5247:5)
    at Provider (http://localhost:8080/node_modules/.vite/deps/chunk-TYATGQZ3.js?v=11366c9c:38:15)
    at TooltipProvider (http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-tooltip.js?v=375942f4:64:5)
    at O (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:23:25)
    at z (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:21:18)
    at ThemeProvider (http://localhost:8080/src/components/theme/ThemeProvider.tsx:22:33)
    at QueryClientProvider (http://localhost:8080/node_modules/.vite/deps/@tanstack_react-query.js?v=271e7c02:2934:3)
    at GlobalErrorBoundary (http://localhost:8080/src/components/system/GlobalErrorBoundary.tsx:329:9)
    at App (http://localhost:8080/src/App.tsx:266:5)`


- **Rota:** `/connections` | **Local:** `http://localhost:8080/node_modules/.vite/deps/chunk-CYR3URII.js?v=11366c9c:520` | **Mensagem:** `Warning: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.%s qa_stress_temp_qa_stress_1779890626090 
    at div
    at div
    at ConnectionsView (http://localhost:8080/src/lovable/pages/ConnectionsView.tsx:24:35)
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at div
    at MotionDOMComponent (http://localhost:8080/node_modules/.vite/deps/framer-motion.js?v=d24a51da:8678:40)
    at div
    at Connections (http://localhost:8080/src/pages/Connections.tsx:101:27)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Outlet (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4494:26)
    at main
    at div
    at MainLayout (http://localhost:8080/src/components/layout/MainLayout.tsx:29:39)
    at RuntimeProvider (http://localhost:8080/src/providers/RuntimeProvider.tsx:59:35)
    at RequireAdminAuth (http://localhost:8080/src/App.tsx:141:29)
    at RenderedRoute (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4088:5)
    at Routes (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4558:5)
    at Suspense
    at SafeRender (http://localhost:8080/src/components/system/SafeRender.tsx:71:9)
    at BootGate (http://localhost:8080/src/App.tsx:73:21)
    at Router (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:4501:15)
    at BrowserRouter (http://localhost:8080/node_modules/.vite/deps/react-router-dom.js?v=e1519375:5247:5)
    at Provider (http://localhost:8080/node_modules/.vite/deps/chunk-TYATGQZ3.js?v=11366c9c:38:15)
    at TooltipProvider (http://localhost:8080/node_modules/.vite/deps/@radix-ui_react-tooltip.js?v=375942f4:64:5)
    at O (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:23:25)
    at z (http://localhost:8080/node_modules/.vite/deps/next-themes.js?v=b36d0de8:21:18)
    at ThemeProvider (http://localhost:8080/src/components/theme/ThemeProvider.tsx:22:33)
    at QueryClientProvider (http://localhost:8080/node_modules/.vite/deps/@tanstack_react-query.js?v=271e7c02:2934:3)
    at GlobalErrorBoundary (http://localhost:8080/src/components/system/GlobalErrorBoundary.tsx:329:9)
    at App (http://localhost:8080/src/App.tsx:266:5)`


---

## 🔌 4. Requisições de API Quebradas (Status HTTP >= 400) (39)

- **Método/URL:** `POST /api/send-message` | **Status:** `409` | **Latency:** `41ms`
- **Response:** `{"error":"Session main is not connected (status: error).","sessionId":"main","status":"error","success":false}`


- **Método/URL:** `POST /api/send-message` | **Status:** `409` | **Latency:** `20ms`
- **Response:** `{"error":"Session main is not connected (status: error).","sessionId":"main","status":"error","success":false}`


- **Método/URL:** `POST /api/send-message` | **Status:** `409` | **Latency:** `15ms`
- **Response:** `{"error":"Session main is not connected (status: error).","sessionId":"main","status":"error","success":false}`


- **Método/URL:** `GET /api/cluster/nodes` | **Status:** `404` | **Latency:** `79ms`
- **Response:** `{"success":false,"data":null,"error":"Route not found: GET /api/cluster/nodes"}`


- **Método/URL:** `GET /api/cluster/overview` | **Status:** `404` | **Latency:** `82ms`
- **Response:** `{"success":false,"data":null,"error":"Route not found: GET /api/cluster/overview"}`


- **Método/URL:** `GET /api/cluster/nodes` | **Status:** `404` | **Latency:** `97ms`
- **Response:** `{"success":false,"data":null,"error":"Route not found: GET /api/cluster/nodes"}`


- **Método/URL:** `GET /api/cluster/overview` | **Status:** `404` | **Latency:** `100ms`
- **Response:** `{"success":false,"data":null,"error":"Route not found: GET /api/cluster/overview"}`


- **Método/URL:** `GET /api/cluster/nodes` | **Status:** `404` | **Latency:** `72ms`
- **Response:** `{"success":false,"data":null,"error":"Route not found: GET /api/cluster/nodes"}`


- **Método/URL:** `GET /api/cluster/overview` | **Status:** `404` | **Latency:** `73ms`
- **Response:** `{"success":false,"data":null,"error":"Route not found: GET /api/cluster/overview"}`


- **Método/URL:** `GET /api/cluster/nodes` | **Status:** `404` | **Latency:** `81ms`
- **Response:** `{"success":false,"data":null,"error":"Route not found: GET /api/cluster/nodes"}`


- **Método/URL:** `GET /api/cluster/overview` | **Status:** `404` | **Latency:** `87ms`
- **Response:** `{"success":false,"data":null,"error":"Route not found: GET /api/cluster/overview"}`


- **Método/URL:** `GET /api/cluster/nodes` | **Status:** `404` | **Latency:** `82ms`
- **Response:** `{"success":false,"data":null,"error":"Route not found: GET /api/cluster/nodes"}`


- **Método/URL:** `GET /api/cluster/overview` | **Status:** `404` | **Latency:** `84ms`
- **Response:** `{"success":false,"data":null,"error":"Route not found: GET /api/cluster/overview"}`


- **Método/URL:** `GET /api/cluster/nodes` | **Status:** `404` | **Latency:** `124ms`
- **Response:** `{"success":false,"data":null,"error":"Route not found: GET /api/cluster/nodes"}`


- **Método/URL:** `GET /api/cluster/overview` | **Status:** `404` | **Latency:** `127ms`
- **Response:** `{"success":false,"data":null,"error":"Route not found: GET /api/cluster/overview"}`


- **Método/URL:** `GET /api/cluster/nodes` | **Status:** `404` | **Latency:** `36ms`
- **Response:** `{"success":false,"data":null,"error":"Route not found: GET /api/cluster/nodes"}`


- **Método/URL:** `GET /api/cluster/overview` | **Status:** `404` | **Latency:** `38ms`
- **Response:** `{"success":false,"data":null,"error":"Route not found: GET /api/cluster/overview"}`


- **Método/URL:** `GET /api/cluster/nodes` | **Status:** `404` | **Latency:** `82ms`
- **Response:** `{"success":false,"data":null,"error":"Route not found: GET /api/cluster/nodes"}`


- **Método/URL:** `GET /api/cluster/overview` | **Status:** `404` | **Latency:** `84ms`
- **Response:** `{"success":false,"data":null,"error":"Route not found: GET /api/cluster/overview"}`


- **Método/URL:** `GET /api/cluster/nodes` | **Status:** `404` | **Latency:** `75ms`
- **Response:** `{"success":false,"data":null,"error":"Route not found: GET /api/cluster/nodes"}`


- **Método/URL:** `GET /api/cluster/overview` | **Status:** `404` | **Latency:** `78ms`
- **Response:** `{"success":false,"data":null,"error":"Route not found: GET /api/cluster/overview"}`


- **Método/URL:** `GET /api/cluster/nodes` | **Status:** `404` | **Latency:** `75ms`
- **Response:** `{"success":false,"data":null,"error":"Route not found: GET /api/cluster/nodes"}`


- **Método/URL:** `GET /api/cluster/overview` | **Status:** `404` | **Latency:** `77ms`
- **Response:** `{"success":false,"data":null,"error":"Route not found: GET /api/cluster/overview"}`


- **Método/URL:** `GET /api/cluster/nodes` | **Status:** `404` | **Latency:** `123ms`
- **Response:** `{"success":false,"data":null,"error":"Route not found: GET /api/cluster/nodes"}`


- **Método/URL:** `GET /api/cluster/overview` | **Status:** `404` | **Latency:** `125ms`
- **Response:** `{"success":false,"data":null,"error":"Route not found: GET /api/cluster/overview"}`


- **Método/URL:** `GET /api/cluster/nodes` | **Status:** `404` | **Latency:** `77ms`
- **Response:** `{"success":false,"data":null,"error":"Route not found: GET /api/cluster/nodes"}`


- **Método/URL:** `GET /api/cluster/overview` | **Status:** `404` | **Latency:** `81ms`
- **Response:** `{"success":false,"data":null,"error":"Route not found: GET /api/cluster/overview"}`


- **Método/URL:** `GET /api/cluster/nodes` | **Status:** `404` | **Latency:** `85ms`
- **Response:** `{"success":false,"data":null,"error":"Route not found: GET /api/cluster/nodes"}`


- **Método/URL:** `GET /api/cluster/overview` | **Status:** `404` | **Latency:** `89ms`
- **Response:** `{"success":false,"data":null,"error":"Route not found: GET /api/cluster/overview"}`


- **Método/URL:** `GET /api/cluster/nodes` | **Status:** `404` | **Latency:** `80ms`
- **Response:** `{"success":false,"data":null,"error":"Route not found: GET /api/cluster/nodes"}`


- **Método/URL:** `GET /api/cluster/overview` | **Status:** `404` | **Latency:** `83ms`
- **Response:** `{"success":false,"data":null,"error":"Route not found: GET /api/cluster/overview"}`


- **Método/URL:** `GET /api/cluster/nodes` | **Status:** `404` | **Latency:** `79ms`
- **Response:** `{"success":false,"data":null,"error":"Route not found: GET /api/cluster/nodes"}`


- **Método/URL:** `GET /api/cluster/overview` | **Status:** `404` | **Latency:** `81ms`
- **Response:** `{"success":false,"data":null,"error":"Route not found: GET /api/cluster/overview"}`


- **Método/URL:** `GET /api/cluster/nodes` | **Status:** `404` | **Latency:** `74ms`
- **Response:** `{"success":false,"data":null,"error":"Route not found: GET /api/cluster/nodes"}`


- **Método/URL:** `GET /api/cluster/overview` | **Status:** `404` | **Latency:** `77ms`
- **Response:** `{"success":false,"data":null,"error":"Route not found: GET /api/cluster/overview"}`


- **Método/URL:** `GET /api/cluster/nodes` | **Status:** `404` | **Latency:** `79ms`
- **Response:** `{"success":false,"data":null,"error":"Route not found: GET /api/cluster/nodes"}`


- **Método/URL:** `GET /api/cluster/overview` | **Status:** `404` | **Latency:** `81ms`
- **Response:** `{"success":false,"data":null,"error":"Route not found: GET /api/cluster/overview"}`


- **Método/URL:** `GET /api/cluster/nodes` | **Status:** `404` | **Latency:** `76ms`
- **Response:** `{"success":false,"data":null,"error":"Route not found: GET /api/cluster/nodes"}`


- **Método/URL:** `GET /api/cluster/overview` | **Status:** `404` | **Latency:** `79ms`
- **Response:** `{"success":false,"data":null,"error":"Route not found: GET /api/cluster/overview"}`

