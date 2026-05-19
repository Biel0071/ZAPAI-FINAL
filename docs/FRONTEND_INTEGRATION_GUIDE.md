# FRONTEND_INTEGRATION_GUIDE

## Arquitetura alvo

Lovable -> `lovable-sync` -> `frontend-official/src/lovable/**` -> adapters -> runtime oficial

## Camadas

### UI exportada
- `frontend-official/src/lovable/**`
- não contém lógica de backend
- não contém socket
- não contém auth

### Adapters
- `frontend-official/src/adapters/lovable/**`
- convertem dados reais em props para a UI Lovable

### Runtime protegido
- `frontend-official/src/App.tsx`
- `frontend-official/src/main.tsx`
- `frontend-official/src/providers/RuntimeProvider.tsx`
- `frontend-official/src/services/apiService.ts`
- `frontend-official/src/services/socketService.ts`

## Padrão recomendado

- páginas em `src/pages/*.tsx` continuam sendo controllers
- views Lovable entram em `src/lovable/pages/*.tsx`
- shell Lovable entra em `src/lovable/layout/*.tsx`
- wrappers oficiais continuam nos componentes protegidos de layout

## Validação obrigatória

- `npm --prefix frontend-official run build`
- `npm --prefix frontend-official run test`
- `npm --prefix frontend-official run test-ui`
- `npm run restart`
