# Mapa canônico consultado para polimento visual

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

