# Routing Rules

## Router oficial

Existe apenas um router suportado:

- `BrowserRouter` definido em `src/App.tsx`

Não é permitido criar router paralelo por feature, tela, modal global ou sandbox local.

## Regras de rotas

### Rotas públicas

- `/login`

### Rotas autenticadas

Todas as demais rotas devem passar por:

- `RequireAdminAuth`
- `RuntimeProvider`
- `MainLayout`

## Rotas críticas congeladas

- `/dashboard`
- `/connections`
- `/inbox`
- `/campaigns`
- `/flows`
- `/analytics`
- `/settings`
- `/contacts`
- `/diagnostics`

## Regras obrigatórias

1. Toda rota autenticada herda o shell oficial via `MainLayout`.
2. Nenhuma rota autenticada pode montar layout alternativo.
3. Redirecionamentos de compatibilidade devem continuar explícitos em `App.tsx` até remoção planejada.
4. Qualquer nova rota deve seguir o mesmo wrapper autenticado.

## Alias temporários existentes

Enquanto existirem, estes aliases devem redirecionar e não montar UI separada:

- `/automation` -> `/flows`
- `/integrations` -> `/settings`
- `/dev-tools` -> `/diagnostics`
- `/system/*` -> `/diagnostics` (ou equivalente central)

## Regras de fallback

- `RootRoute` decide entre `/dashboard` e `/login`
- `CatchAllRoute` nunca pode apontar para tela antiga ou shell paralelo

## Regressão proibida

É regressão se uma rota:

- renderizar sem `MainLayout`
- renderizar com outro header global
- usar import de página legacy
- depender de preview route separada
