## Plano para congelar a versão oficial (a da imagem) e eliminar alternância

### 1) Remover gatilhos de troca de estado visual no boot
- Simplificar o `src/main.tsx` para manter apenas inicialização estável do app e metadados de build (sem lock agressivo de tema/storage).
- Preservar dark mode via tema já existente do app, sem observer forçando reescrita contínua de DOM/storage.

**Objetivo:** evitar “pisca/troca” causada por re-hidratação agressiva e side effects de boot.

### 2) Tornar o carregamento de páginas lazy determinístico
- Ajustar `lazyWithRetry` em `src/App.tsx` para um fallback previsível quando chunk falhar (sem comportamento que gere ida/volta entre estados).
- Garantir rota default estável para sessão autenticada e não autenticada.

**Objetivo:** impedir alternância entre tela oficial e fallback/blank por erro intermitente de módulo.

### 3) Unificar a origem de autenticação para evitar redirecionamento oscilante
- Corrigir `useUserRole` para não depender de sessão do auth padrão quando o acesso é pelo fluxo admin customizado.
- Derivar role e autorização da sessão admin já salva (`useAdminAuth`) para manter consistência do guard de rota.

**Objetivo:** parar redirecionamentos cruzados causados por dois mecanismos de sessão competindo.

### 4) Congelar o layout oficial do sistema
- Manter `MainLayout` como única casca visual oficial (header/status/sidebar), removendo qualquer sinal de modo paralelo/alternativo.
- Revisar mensagens de erro global para não forçar navegação que possa parecer troca de versão.

**Objetivo:** existir somente uma experiência visual oficial (igual à imagem).

### 5) Validação final orientada ao bug
- Testar fluxo real: `/login` → `/dashboard` → `/inbox` → reload múltiplos.
- Confirmar que não alterna entre “duas versões”, sem blank/404 intermitente.
- Confirmar persistência de sessão (“permanecer conectado”) e estabilidade de navegação.

**Critério de aceite:**
- Só existe a versão oficial da interface.
- Não há ida/volta entre layouts/estados visuais.
- Sem 404/blank durante reload e navegação interna.

---

## Detalhes técnicos (resumo)
- Arquivos-alvo: `src/main.tsx`, `src/App.tsx`, `src/hooks/useUserRole.ts`, `src/components/layout/MainLayout.tsx`, `src/components/system/GlobalErrorBoundary.tsx`.
- Sem mudanças estruturais no backend nem quebra de `runtime.ts`, `websocket` ou `buildApiUrl()`.
- Foco em estabilidade de boot, guards de rota e fonte única de verdade da sessão.