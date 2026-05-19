# Providers Map

## Provider chain oficial

A cadeia oficial está em `src/App.tsx`:

```tsx
<GlobalErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <BootGate>
            <SafeRender scope="app-routes">
              <Suspense fallback={<PageFallback />}>
                <Routes>
                  <Route path="/login" element={<LoginRoute />} />
                  <Route element={<RequireAdminAuth><RuntimeProvider><MainLayout /></RuntimeProvider></RequireAdminAuth>}>
                    ...
                  </Route>
                </Routes>
              </Suspense>
            </SafeRender>
          </BootGate>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
</GlobalErrorBoundary>
```

## Responsabilidades

### `QueryClientProvider`

- única camada oficial de React Query
- não duplicar por página
- não criar client paralelo para features isoladas

### `ThemeProvider`

- única camada oficial de tema
- não criar provider de tema local por rota

### `BrowserRouter`

- único router oficial
- não criar subrouter estrutural para áreas internas

### `RequireAdminAuth`

- gate único de autenticação administrativa
- qualquer rota autenticada passa por ele

### `RuntimeProvider`

- camada oficial de hidratação e sync em tempo real
- centraliza status de runtime
- integra com `socketService`
- mantém estado operacional unificado

### `MainLayout`

- root do shell autenticado
- injeta `Sidebar`
- renderiza páginas no `Outlet`

## Serviços centrais congelados

### `apiService`

Arquivo oficial:
- `src/services/apiService.ts`

Regras:
- toda chamada HTTP relevante passa por ele
- não criar cliente axios paralelo sem motivo arquitetural forte

### `socketService`

Arquivo oficial:
- `src/services/socketService.ts`

Regras:
- conexão Socket.IO compartilhada única
- não criar implementação alternativa de websocket

## Resíduos auditados

Durante o freeze final foram identificados estes pontos:

- `src/hooks/useSocketMessages.ts`
  - não estava em uso
  - é resíduo de integração anterior
- `src/components/ui/sidebar.tsx`
  - primitive genérico não usado pelo shell oficial
  - pode permanecer como biblioteca base, mas não é shell oficial

## Camada Lovable protegida

A ingestão visual do Lovable deve acontecer em:
- `src/lovable/**`
- `src/adapters/lovable/**`

Essa camada pode evoluir visualmente com sync Git controlado, mas continua dependente da cadeia oficial de providers descrita acima.

## Regras proibidas

- provider duplicado por rota
- theme provider paralelo
- query client paralelo
- websocket wrapper concorrente
- auth wrapper alternativo fora de `App.tsx`
