# Frontend Architecture

## Baseline oficial

O frontend oficial do sistema é **exclusivamente** `frontend-official/` servindo em `http://localhost:8080` e falando com o backend oficial em `http://127.0.0.1:4025`.

Não existe segunda UI suportada, segundo shell, segundo router ou preview paralelo válido para operação.

## Cadeia raiz obrigatória

A cadeia raiz oficial está em `src/App.tsx` e deve permanecer:

1. `GlobalErrorBoundary`
2. `QueryClientProvider`
3. `ThemeProvider`
4. `TooltipProvider`
5. `BrowserRouter`
6. `BootGate`
7. `SafeRender`
8. `RequireAdminAuth`
9. `RuntimeProvider`
10. `MainLayout`
11. página da rota

Qualquer mudança que introduza provider paralelo para shell, auth, theme, websocket ou runtime fora dessa cadeia é regressão arquitetural.

## Shell oficial único

Os únicos componentes autorizados para o shell global são:

- `src/components/layout/MainLayout.tsx`
- `src/components/layout/Header.tsx`
- `src/components/layout/Sidebar.tsx`

### Responsabilidades

- `MainLayout.tsx`
  - contém o root shell autenticado
  - injeta a `Sidebar`
  - aplica apenas o deslocamento estrutural horizontal do conteúdo
  - **não** cria topbar adicional
  - **não** duplica badges globais fora do `Header`

- `Header.tsx`
  - é a única topbar oficial das páginas autenticadas
  - centraliza título, subtítulo, estado de runtime, ações e CTA de reconnect
  - não deve ser duplicado por wrappers externos

- `Sidebar.tsx`
  - é a única navegação lateral oficial
  - centraliza navegação CRM/sistema
  - controla somente o estado de colapso lateral

## Regras permanentes

### Proibido

- criar segundo shell
- criar header alternativo de página
- criar topbar paralela no layout root
- inserir wrapper sticky concorrente acima do `Header`
- montar sidebar por página
- usar preview como runtime normal
- usar fallback para `5173` ou `4173`
- misturar componentes de shell antigos com o shell atual

### Obrigatório

- toda rota autenticada passa por `MainLayout`
- toda página autenticada usa `Header`
- toda navegação lateral vem de `Sidebar`
- todo acesso de backend passa por `apiService`
- toda conexão principal de websocket passa por `socketService` e `RuntimeProvider`

## Estado atual congelado

O baseline congelado após a consolidação final é:

- shell único Lovable-like estabilizado
- sem topbar duplicada em `MainLayout`
- páginas críticas validadas por Playwright:
  - `/dashboard`
  - `/connections`
  - `/inbox`
  - `/settings`
- build production válida
- runtime oficial único em `8080/4025`

## Guardrails de regressão

Toda mudança de layout deve ser validada com:

- `npm --prefix frontend-official run build`
- `npm --prefix frontend-official run test`
- `npm --prefix frontend-official run test-ui`
- `npm run restart`

Se qualquer dessas validações quebrar por shell/layout/heading visibility, a mudança não deve ser promovida.
