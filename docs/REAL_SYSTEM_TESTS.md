# REAL SYSTEM TESTS

Date: 2026-05-14
Environment:
- Frontend: http://localhost:8080
- Backend: http://127.0.0.1:4025
- Database: PostgreSQL local on 127.0.0.1:5432

## Checklist executado

### Runtime local
- [x] Frontend ativo em 8080
- [x] Backend ativo em 4025
- [x] Banco local online
- [x] Proxy Vite funcional para `/api` e `/socket.io`

### Auth
- [x] Login real contra `/api/auth/login`
- [x] Sessão persistida no frontend
- [x] Header `Authorization: Bearer` usado nas chamadas autenticadas
- [x] Sessão local do backend JWT como fonte oficial
- [x] Supabase removido como fallback ativo de autenticação

### API real validada
- [x] `/api/health`
- [x] `/api/session-status`
- [x] `/api/conversations`
- [x] `/api/conversations/:conversationId/messages`
- [x] `/api/contacts`
- [x] `/api/metrics`
- [x] `/api/campaigns`
- [x] `/api/flows`

### Páginas validadas
- [x] `/dashboard`
- [x] `/connections`
- [x] `/settings`
- [x] `/diagnostics`
- [x] `/analytics`
- [x] `/contacts` (API real e correção de data source aplicada)
- [x] `/campaigns` (lista real + start real implementado)
- [x] `/flows` (lista real + create real implementado)
- [x] `/inbox` (API real validada; tela ainda concentra a maior complexidade de runtime)
- [x] rota inexistente sem tela branca

### Testes automatizados
- [x] `node backend/tests/route-smoke.js`
- [x] `npm --prefix frontend-official run build`
- [x] `npm --prefix frontend-official run test-ui`

## Bugs encontrados e corrigidos
1. Frontend auth ainda dependia de fallbacks ativos de Supabase.
   - Corrigido em `useAdminAuth.ts`, `useUserRole.ts`, `apiGuard.ts`.
2. Contacts carregava dados a partir de conversas em vez de `/api/contacts`.
   - Corrigido em `frontend-official/src/pages/Contacts.tsx`.
3. Campaigns simulava sucesso local ao iniciar campanha.
   - Corrigido para usar `POST /api/campaigns/:id/start`.
4. Flows criava itens apenas em estado local.
   - Corrigido para usar `POST /api/flows`.
5. Route/UI smoke ainda refletia fluxo antigo e seletores frágeis.
   - Atualizado para o runtime real atual.

## Pendências remanescentes
- Inbox ainda é a página mais complexa e merece mais uma rodada para reduzir duplicidade entre `RuntimeProvider` e lógica local de polling/socket.
- Há warnings de chunk size no build do frontend.
- Há avisos de acessibilidade de `DialogContent` sem `DialogTitle` no preview.

## Resultado final desta rodada
- Frontend oficial mais próximo de um frontend real integrado ao backend.
- API principal consolidada em torno dos endpoints reais do backend.
- Auth ativa unificada em backend JWT.
- Campaigns e Flows removidos do modo fake/local-only.
- Testes reais principais executados com sucesso.
