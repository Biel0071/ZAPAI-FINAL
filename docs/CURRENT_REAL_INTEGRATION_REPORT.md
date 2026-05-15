# CURRENT REAL INTEGRATION REPORT

Date: 2026-05-14
Branch: claude/determined-golick-9e9632
Environment target:
- Frontend: `frontend-official` on `http://localhost:8080`
- Backend: `backend` on `http://127.0.0.1:4025`

## 1. Fonte da verdade atual
- Frontend oficial ativo: `frontend-official/`
- Backend oficial ativo: `backend/`
- Artefatos legados: `archive/`, `archive/legacy/`, `archive/legacy-backend/`, `archive/legacy/frontend-old/`, `archive/legacy-frontend-candidates/`
- Fonte de verdade visual: UI atual exibida no navegador do usuário

## 2. Páginas já funcionais
- `/login`
- `/dashboard`
- `/connections`
- `/settings`
- `/diagnostics`
- `/analytics`

## 3. Páginas ainda parciais
- `/inbox`
  - API real validada
  - ainda precisa refinamento visual/comportamental completo no fluxo da thread
- `/contacts`
  - API real validada
  - página corrigida para usar contatos reais, precisa validação visual final contínua
- `/campaigns`
  - ainda depende de revisão de ações fake/local-only
- `/flows`
  - ainda depende de revisão de mutations locais sem persistência real

## 4. Mocks e fallbacks remanescentes
### Auth
- Havia fallback de login para Supabase function `admin-auth`
- Havia fallback de token para sessão Supabase em `apiGuard`
- Havia fallback de role para Supabase em `useUserRole`

### API
- `apiService.ts` ainda possui probing/fallbacks para múltiplos endpoints em algumas áreas
- algumas páginas ainda simulam sucesso local antes de consolidar mutation real

### Realtime
- `RuntimeProvider` já é a camada oficial de hidratação compartilhada
- `Inbox.tsx` ainda concentra lógica grande de socket/polling/message state
- `Connections.tsx` ainda mantém responsabilidades próprias de sessão/QR/socket

## 5. Problemas estruturais encontrados
- Drift de documentação antiga do Lovable e do runtime atual
- Mistura de fallback compatível com estado “real” em auth e API
- Algumas páginas ainda misturam store global com polling local duplicado
- Persistem states degradados pensados para períodos em que backend/DB estavam indisponíveis

## 6. Endpoints reais prioritários
- `/api/auth/login`
- `/auth/me`
- `/api/health`
- `/api/session-status`
- `/api/conversations`
- `/api/conversations/:conversationId/messages`
- `/api/contacts`
- `/api/metrics`
- `/api/campaigns`
- `/api/campaigns/:id/start`
- `/api/campaigns/:id/status`
- `/api/flows`

## 7. Decisões desta rodada
- Backend local permanece em `4025`
- Frontend local permanece em `8080`
- Supabase deixa de ser caminho ativo de autenticação
- `adminAuthSession` é a sessão oficial do frontend
- o objetivo é integrar de forma real sem redesignar domínio/memória/métricas

## 8. Backlog explícito desta rodada
1. Reduzir fallback probing no cliente API
2. Consolidar ownership do realtime entre provider e páginas
3. Fechar Contacts/Inbox/Campaigns/Flows com dados e ações reais
4. Atualizar testes e documentação final do sistema

## 9. Progresso já aplicado nesta rodada
- `useAdminAuth.ts` agora trata o backend JWT como caminho oficial e não usa mais Supabase como fallback ativo de autenticação.
- `apiGuard.ts` agora lê token apenas de `adminAuthSession`.
- `useUserRole.ts` agora deriva role apenas da sessão local do backend JWT.
- O relatório técnico inicial foi criado e passa a ser a base de acompanhamento da integração real.
