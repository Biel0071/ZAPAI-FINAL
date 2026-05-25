# Arquitetura do Sistema: Single Source of Truth e Integração Realtime

Este documento define a arquitetura técnica e o fluxo de dados consolidado do ZAPFLOW AI / ZAPAI, detalhando como a interface do Lovable foi acoplada ao backend real de forma blindada.

---

## 🏛️ Camadas Arquiteturais

A arquitetura do sistema é estruturada em 4 camadas independentes de responsabilidade única:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Lovable View Layer (src/lovable/*) [Read-Only]           │
└──────────────┬──────────────────────────────▲───────────────┘
               │ (Props / Ações)              │ (ViewModels)
┌──────────────▼──────────────────────────────┴───────────────┐
│ 2. Adapter Layer (src/adapters/lovable/*)                  │
└──────────────┬──────────────────────────────▲───────────────┘
               │ (Chamadas de Ações)          │ (Leitura Reativa)
┌──────────────▼──────────────────────────────┴───────────────┐
│ 3. State Layer (Zustand Global Store - src/stores/*)       │
└──────────────┬──────────────────────────────▲───────────────┘
               │ (Hydration / Dispatch)       │ (Mensagens / Status)
┌──────────────▼──────────────────────────────┴───────────────┐
│ 4. Runtime Layer (src/runtime/* & API - src/services/*)     │
└──────────────┬──────────────────────────────────────────────┘
               │ (TCP WebSockets / HTTP REST)
┌──────────────▼──────────────────────────────────────────────┐
│ 5. Backend Service (Express + Socket.io - Porta 4025)       │
└─────────────────────────────────────────────────────────────┘
```

### 1. View Layer (`src/lovable/*`)
- **Papel**: Detém toda a estrutura visual, spacing, padding, layouts, cores e componentes de UI do Lovable.
- **Regra**: **Estritamente Read-Only**. Nenhuma lógica operacional do backend local pode ser injetada de forma acoplada nestas views.
- **Integração**: Consome interfaces de `ViewModel` estritamente tipadas geradas pelos adapters.

### 2. Adapter Layer (`src/adapters/lovable/*`)
- **Papel**: Traduz os estados operacionais reais do banco de dados e do socket (Zustand) nos modelos de dados esperados pelas views do Lovable.
- **Regra**: Mapeia as volumetrias, densidades geográficas de DDDs e distribuições de leads em tempo real de forma que as telas renderizem dados dinâmicos do backend real sem divergência visual.

### 3. State Layer (`src/stores/*`)
- **Papel**: Centraliza o estado global da aplicação em uma store Zustand (`useAppStore`), atuando como a **Única Fonte da Verdade (Single Source of Truth)**.
- **Responsabilidade**: Sincroniza a lista de conversas, mensagens do Inbox, sessões ativas do WhatsApp, QRCodes e a latência/saúde do ecossistema local.

### 4. Runtime Layer (`src/runtime/*`)
- **Papel**: Gerencia o ciclo de vida do WebSocket (Socket.io) compartilhado, logs estruturados do sistema, persistência de diagnóstico e as checagens periódicas de conectividade de rede.
- **Sincronização**: Realiza pings HTTP silenciosos e escuta os eventos em tempo real do gateway do backend, despachando atualizações instantâneas para a store global do Zustand.

---

## 🔒 Regras de Blindagem Operacional

1. **Isolamento de Views**: Nenhum componente ou página de `src/lovable/*` pode chamar o `apiService` ou importar o `useAppStore` diretamente. Todo o acesso a APIs e estados deve ser encapsulado nas páginas controladoras de `src/pages/*` e repassado através de adapters.
2. **Ciclo de Vida Único de Conexão**: Não são permitidas conexões ou conexões duplicadas de WebSocket iniciadas de forma fragmentada pelas páginas. A única conexão ativa é aberta e gerida centralizadamente pelo `RuntimeProvider` a partir do `socketManager`.
3. **Escrita Unificada no Zustand**: Qualquer alteração de dados obtida via HTTP ou WebSocket deve atualizar a store global do Zustand. As páginas devem ouvir as propriedades da store de forma reativa, sem gerenciar estados locais (`useState`) redundantes de dados operacionais.
