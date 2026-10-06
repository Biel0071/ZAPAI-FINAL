# Mapa canônico consultado para polimento visual

## Loja integrada ao atendimento (06/10/2026)

- `pages/Attendants/AttendantsPage.tsx` seleciona o contexto por `sessionId`, troca o único responsável e hospeda dados comerciais. `/stores` e `/lojas` redirecionam para `/attendants?section=business`, preservando contexto; não há página de loja nos menus.
- `components/evolution/HistoryBootstrapPanel.tsx`, modo `store`, reutiliza APIs comerciais e perfil da sessão com editor completo compartilhado/exclusivo. Não executa polling de histórico nesse modo; cadastro criado permanece disponível quando o vínculo falha.
- `aiAgentService.js` reconcilia vínculos em criar/editar/atribuir, preserva propriedade comercial da sessão e evita herança arbitrária em conflitos legados. `automationEngine.js` bloqueia seleção ambígua. `historyRoutes.js` valida empresa/sessão/loja e preserva campos omitidos.
- `ZaibotFloatingAssistant.tsx` monta sob demanda o copiloto canônico, hospedado uma vez em `MainLayout.tsx`. O shell autenticado preserva as páginas CRM existentes.
- Revisão de produção estende páginas, componentes e adaptadores existentes; dados indisponíveis não recebem resultados fictícios. Extração manual após alterações, sem hook automático.

## Atendentes, Assistente ZAI e lojas por WhatsApp (05/10/2026)

- Entrada de operação única: `frontend-official/src/pages/Attendants/AttendantsPage.tsx`, com atendentes digitais e aba Assistente ZAI (`components/ai/ZaiPlatformAssistantView.tsx`). `/assistant` e `/assistente-zai` redirecionam para `/attendants?tab=copilot` em `App.tsx`.
- Configurações, fluxos, operação e evolução continuam em `frontend-official/src/pages/AI/index.tsx`; rotas legadas apontam para a respectiva aba de `/ai`. `AgentTab.tsx` compartilha a lista de perfis carregada pela página, sem um segundo cadastro de equipe.
- Dados da loja pertencem ao WhatsApp: `ai_stores` e `session_ai_profiles`, pela empresa autenticada. `StoresPage.tsx` edita vínculos reutilizando `HistoryBootstrapPanel.tsx`. `aiAgentService.js` valida empresa/sessão/agente na transação e preserva a loja escolhida ao trocar o atendente.
- Remover o último vínculo pausa o atendente; cópias e novos perfis sem número começam pausados. Uma sessão sem loja não herda o primeiro cadastro nem conhecimento de outra sessão.
- Estado de atendimento vem de `useAppStore.sessions` e `aiProgressByConversationId`, alimentados pelo runtime global. Avatar Studio estabiliza o DNA da loja; aguardando, processamento e conversa seguem esse estado. Métricas indisponíveis aparecem como `—`.
- Configuração rápida em `AgentCustomizerModal.tsx` usa nome, função, personalidade, tom, regras e memória textual consumidos pelo motor. Aparência permanece em `AvatarEditorModal.tsx`; dados comerciais ficam na loja vinculada.
- `operationsController.js`, listagens da fila e perfis de voz exigem empresa autenticada; contadores não medidos não recebem valores de exemplo. Consultas e regressões usam mocks, sem alterar sessões ou dados de produção.

Extração Graphify executada manualmente neste polimento; nenhum hook automático instalado.

## Simplificação da IA e operação real do Inbox (30/09/2026)

- Navegação IA: entrada única em `components/layout/Sidebar.tsx`, página `pages/AI.tsx` e apresentação em `pages/lovable/pages/AIView.tsx`. Abas internas: Agente, Conhecimento, Operação; valores antigos de `?tab=` permanecem compatíveis.
- Agente inicial e capacidades: `components/evolution/EvolutionCenter.tsx`; criação guiada reutiliza `HistoryBootstrapPanel.tsx`, sem ativar atendimento global.
- Painel contextual Inbox: `pages/Inbox/components/SidebarPanel.tsx`, com Atendimento, Cliente, Arquivos. Rascunhos e identidade da conversa permanecem em `hooks/useInboxState.ts`.
- Envio aceito após persistência da fila: `backend/services/outboundQueueService.js`; entrada autenticada valida contexto em `backend/src/api/controllers/messages/shared.js` e `messagesController.js`. Respostas rápidas são resolvidas por empresa em `backend/services/quickReplyService.js`.
- Mídia protegida: `backend/services/enterprise/media-service.js`, emissão em `mediaController.js`, renderização através de `frontend-official/src/core/runtime/hooks/useProtectedMediaUrl.ts`. Acesso temporário por caminho e empresa, sem JWT em URL.
- Publicação na VPS existente: `ops/deploy/auto-deploy.sh`, com snapshot e rollback em `ops/deploy/rollback.sh`. Ambiente, banco, sessões e armazenamento persistente são preservados.

Verificado em 15/09/2026 por Graphify query e leitura dos imports. Este mapa descreve o recorte de UI; não substitui o grafo completo.

- Shell autenticado: `frontend-official/src/components/layout/MainLayout.tsx`; navegação: `Sidebar.tsx` no mesmo diretório.
- Header: `frontend-official/src/lovable/layout/HeaderShell.tsx`, usado pelo adaptador de Header existente.
- Orquestração Inbox: `frontend-official/src/pages/Inbox.tsx` e `Inbox/hooks/useInboxState.ts`.
- Colunas redimensionáveis: `frontend-official/src/lovable/pages/InboxView.tsx`, reexportado por `InboxPageView.tsx`.
- Conversa/compositor: `frontend-official/src/pages/Inbox/components/ActiveChatPane.tsx`; detalhes contextuais: `SidebarPanel.tsx`; bolhas: `MessageRow.tsx`.
- Primitivas compartilhadas: `frontend-official/src/components/ui/`; tokens e estilos globais: `frontend-official/src/index.css`.

Fluxo: MainLayout → página Inbox → InboxView → colunas existentes. O estado de recolhimento pertence ao useInboxState. As mudanças visuais não introduzem estado de negócio nem alteram o isolamento de empresa.

## Histórico WhatsApp e atendente inicial (18/09/2026)

- Entrada canônica: `backend/services/whatsapp/connection/stableSession.js`; conexão autenticada vincula a empresa antes do socket.
- Sync e solicitações de histórico: `backend/services/whatsapp/historySync.js`, executado pelo `workerSupervisor`.
- Fila e persistência silenciosa: `backend/src/data/repositories/historyRepository.js`; migração `034_whatsapp_history_bootstrap.js`.
- Análise e versões: `backend/src/ai/evolutionary/historyLearning.js`; API autenticada em `historyRoutes.js` no mesmo diretório.
- Publicação revisada: `backend/src/ai/agents/services/aiAgentService.js`, mantendo o runtime de agentes existente.
- Painel compartilhado: `frontend-official/src/components/evolution/HistoryBootstrapPanel.tsx`, usado por Conexões e Evolution Center.

Histórico não passa pelo pipeline de automações/novas mensagens. Todo estado de
negócio persiste com empresa e sessão. Relatórios e candidatos não alteram o agente
ativo sem publicação autenticada da versão revisada. `graphify update .` executado
manualmente; nenhum hook automático foi instalado.

## Memória por WhatsApp e criação de atendentes (22/09/2026)

- Persistência e projeção durável: `backend/services/aiMemoryEngine.js` e `backend/services/aiConversationMemoryService.js`.
- Isolamento estrito por empresa, conexão e contato: tabela `ai_conversation_memory(company_id, session_id, contact_id)` via migração `035_session_agent_memory.js`.
- Vínculo opcional com lojas e conhecimento oficial: tabelas `ai_stores` e `session_ai_profiles`, integrado em `backend/src/ai/agents/services/aiAgentService.js` (`sessionKnowledge`, `evolveSessionStyles`, `restoreSessionStyle`).
- Criação em três vias (manual, prompt com IA, histórico) com prévia e revisão explícita: `backend/src/ai/evolutionary/historyRoutes.js` e componente `frontend-official/src/components/evolution/HistoryBootstrapPanel.tsx` nas telas `Connections.tsx`, `AIView.tsx` (Atendentes) e `EvolutionCenter.tsx`.
- Evolução de agentes: restrita a estilo estruturado (tom, extensão), com versionamento em `ai_agent_versions` e rollback em 1 clique (pausando a evolução). Regras comerciais, preços e produtos nunca são alterados automaticamente.

