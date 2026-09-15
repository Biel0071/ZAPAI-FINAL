# Mapa canônico consultado para polimento visual

Verificado em 15/09/2026 por Graphify query e leitura dos imports. Este mapa descreve o recorte de UI; não substitui o grafo completo.

- Shell autenticado: `frontend-official/src/components/layout/MainLayout.tsx`; navegação: `Sidebar.tsx` no mesmo diretório.
- Header: `frontend-official/src/lovable/layout/HeaderShell.tsx`, usado pelo adaptador de Header existente.
- Orquestração Inbox: `frontend-official/src/pages/Inbox.tsx` e `Inbox/hooks/useInboxState.ts`.
- Colunas redimensionáveis: `frontend-official/src/lovable/pages/InboxView.tsx`, reexportado por `InboxPageView.tsx`.
- Conversa/compositor: `frontend-official/src/pages/Inbox/components/ActiveChatPane.tsx`; detalhes contextuais: `SidebarPanel.tsx`; bolhas: `MessageRow.tsx`.
- Primitivas compartilhadas: `frontend-official/src/components/ui/`; tokens e estilos globais: `frontend-official/src/index.css`.

Fluxo: MainLayout → página Inbox → InboxView → colunas existentes. O estado de recolhimento pertence ao useInboxState. As mudanças visuais não introduzem estado de negócio nem alteram o isolamento de empresa.
