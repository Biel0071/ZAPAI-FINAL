# ZAPFLOW — Visual Polish, UI Sizing & Bug Fix Walkthrough

Este documento detalha as correções e polimentos visuais implementados no ZAPFLOW (ZAPAI-FINAL) abrangendo Inbox, Campanhas, Automação por IA, Navegação Global e Comandos Rápidos (`/learn`, `/boost`, `/goal`, `/plan`).

---

## 1. Inbox & Chat UI

### 1.1 Proporções e Listagem de Conversas (`ConversationRow.tsx`)
- **Avatar Padronizado (48px)**: `h-12 w-12` consistente com fallback de iniciais e anel sutil.
- **Truncamento Preciso**: Nome de contato e prévia de mensagem com `truncate min-w-0 flex-1`, evitando transbordamento horizontal.
- **Menu de 3 Pontos Acessível em Mobile**: No mobile e touch screens, o botão de ações agora permanece visível (`opacity-100 sm:opacity-0 sm:group-hover/row:opacity-100 focus-within:opacity-100 data-[state=open]:opacity-100`) permitindo fixar, silenciar e excluir conversas em smartphones e tablets.
- **Acessibilidade**: Adicionado atributo `aria-label="Mais opções da conversa"`.

### 1.2 Comandos Rápidos `/learn`, `/boost`, `/goal`, `/plan` & Compositor (`ActiveChatPane.tsx`)
- **Auto-Redimensionamento do Textarea**: Ao selecionar comandos ou respostas rápidas (via clique ou `Enter`/`Tab`), o textarea redimensiona dinamicamente sua altura (`scrollHeight`) até 140px, eliminando barras de rolagem ou texto espremido em campo de 1 linha.
- **Posicionamento do Cursor**: O cursor agora é automaticamente colocado ao fim do texto inserido, permitindo envio imediato ou complementação rápida.
- **Tecla Escape Não-Destrutiva**: Pressionar `Escape` fecha o menu flutuante de sugestões mantendo o texto digitado intacto, em vez de apagar todo o conteúdo.
- **Busca por Prefixo Tolerante**: Suporte a digitação com espaço (ex: `/learn feedback`) sem sumir com a sugestão ativa.
- **Comandos Especializados**:
  - `/learn`: 🧠 Ensinar a IA e registrar insights da conversa.
  - `/boost`: ⚡ Atendimento turbo de alta conversão e fechamento imediato.
  - `/goal`: 🎯 Foco em meta de atendimento e SLA com resolução ágil.
  - `/plan`: 📋 Apresentação de planos e propostas comerciais.

### 1.3 Assistente IA Integrado (`ZaiAssistantComposer.tsx`)
- **Ações Rápidas Expandidas**: Adicionadas pílulas de ação direta para `boost` (Turbo Boost), `goal` (Foco na Meta), `plan` (Planos & Proposta) e `learn` (Ensinar IA).
- **Auto-Resize ao Usar Resposta**: Ao clicar em "Usar Resposta", o texto inserido no compositor redimensiona o campo de entrada automaticamente.

### 1.4 Painel Lateral de Atendimento (`SidebarPanel.tsx`)
- **4 Abas Unificadas**: Atendimento & Cliente, Respostas Rápidas, Arquivos, Logs & Linha do Tempo.
- **Scroll Vertical Limpo**: Enforçado `overflow-x-hidden` e `overflow-y-auto` com barras finas `scrollbar-thin`.

---

## 2. Campanhas & Proteção Anti-Ban

### 2.1 Presets de Cadência Humana (`CadencePresetSelector.tsx`)
- **Grid Responsivo e Alturas Uniformes**: Cards com `h-full` para alinhamento entre *Sem Risco*, *Equilibrado*, *Turbo* e *Personalizado*.
- **Contraste Aprimorado**: Badges e bordas coloridas ajustadas para os temas escuro e claro.

### 2.2 Rampa de Maturação de Chips (`ChipMaturationCard.tsx`)
- **Tabela de 5 Fases**: Cards de estágio com `h-full` e bordas dinâmicas indicando o estado atual, concluído e pendente.

### 2.3 Botões de Ação de Campanhas (`Campaigns.tsx`)
- **Feedback Visual de Ação Ativa**: Adicionados spinners animados (`Clock animate-spin`) aos botões de agendamento (`Iniciar Sem Risco`, `Turbo`, `Cancelar`) quando a requisição está em andamento (`actionCampaignId === scheduledCampaign.id`).

---

## 3. Hub Unificado de IA (`/ai`)

- **Navegação em Abas**: Indicadores de aba ativa com realce esmeralda (`ring-emerald-500/40 border-emerald-500/20 font-bold`).
- **Cards Uniformes**: Alinhamento de padding e transições suaves entre *Agente & Inteligência*, *Automação & Fluxos*, *Operações & Filas* e *Evolução & Score*.

---

## 4. Layout Global & Navegação Móvel

### 4.1 Barra Inferior Móvel (`MobileBottomNav.tsx`)
- **Sincronização de Estado Ativo**: O rótulo e o ícone agora usam o mesmo estado calculado `isActive`, mantendo o botão destacado mesmo ao navegar por rotas filhas (`/ai`, `/flows`, `/operations`, `/evolution`).
- **Touch Targets Ergonomicos**: Áreas de toque confortáveis com mínimo de 46px de altura.

### 4.2 Sidebar Desktop (`Sidebar.tsx`)
- **Suporte a Subrotas**: A verificação de rota ativa agora reconhece subcaminhos (como `/settings/profile`, `/campaigns/...`, etc.), mantendo a seleção acesa.

---

## 5. Backend AI Compose (`backend/src/api/routes/aiConfig.js`)

- Adicionadas diretrizes específicas no backend para as ações `boost`, `goal`, `plan` e `learn` na rota `POST /ai/compose`, garantindo respostas geradas com o tom e objetivo pretendidos.
