# Prompts para Antigravity — Upgrades ZAPAI

> Cole **um prompt por vez** no Antigravity. Cada prompt já aponta arquivo e linhas exatas para gastar o mínimo de tokens. Rode na ordem 1 → 2 → 3.

---

## PROMPT 1 — Sidebar direita: abrir todos os submenus de uma vez + melhorar espaço

```
Arquivo: frontend-official/src/pages/Inbox/components/SidebarPanel.tsx

Objetivo: quando eu abrir uma seção do painel direito (IA, Lead, Respostas, Histórico, Arquivos), todos os submenus internos dela devem já vir abertos de uma vez, sem precisar clicar um por um. E melhorar densidade/espaço.

Tarefas (só editar este arquivo, nada de lógica nova):
1. Trocar os 3 <Accordion type="single" ... collapsible> (linhas ~759, ~976, ~1191) por type="multiple".
2. Em cada um, trocar defaultValue por value/defaultValue com TODOS os ids dos AccordionItem da seção (ex.: defaultValue={["ai-status","ai-metrics","ai-action","ai-analysis"]}). Confira os value= reais de cada AccordionItem antes.
3. Reduzir respiro: AccordionTrigger usar "py-1.5", className dos Accordion usar "space-y-1.5", AccordionContent "pb-2". Manter legível.
4. Não mudar nenhuma função, estado, nem o comportamento das abas (rightPanelTab). Só os Accordions e classes de espaçamento.

Não rode build. Só me mostre o diff.
```

---

## PROMPT 2 — Renomear "Automação" → "Respostas Rápidas" e remover toggle de IA

```
Arquivo: frontend-official/src/pages/Inbox/components/SidebarPanel.tsx

Tarefa 1 — Renomear a aba "Automação" para "Respostas Rápidas" em TODAS as ocorrências:
- SECTION_TABS, label "Automação" (linha ~105)
- TabsTrigger value="qr" (linha ~735)
- RightPanelSectionTrigger label="Automação" (linha ~1121)
Trocar texto para "Respostas Rápidas". Manter id/value "qr" e o ícone.

Tarefa 2 — Remover o bloco "IA Automática" (o card com <Switch> de ligar/desligar IA) que fica dentro da TabsContent value="qr" (linhas ~1130-1144, a div com p "IA Automática" + Switch checked={aiEnabledForConversation}). Apagar a div inteira desse card.

Não remover as props relacionadas se forem usadas em outro lugar; só apagar o JSX do card aqui. Não mexer no resto da seção (busca, botão Novo, categorias, lista de respostas).

Não rode build. Me mostre o diff.
```

---

## PROMPT 3 — Pedir o desenho/validação do FLUXO completo de mensagens rápidas

> Este é o prompt de **planejamento**. Antes de codar, o Antigravity te devolve o plano para você aprovar. (Não peça implementação direto — fluxo grande gera retrabalho.)

```
Contexto do projeto ZAPAI (não precisa explorar tudo, só o necessário):
- Respostas rápidas: frontend-official/src/pages/Inbox/components/SidebarPanel.tsx (aba "qr")
- Tipos: frontend-official/src/pages/Inbox/types.ts (QuickReplyItem já tem items[] e tags[])
- Disparos/Campanhas: frontend-official/src/pages/Campaigns.tsx (já tem delay, tags, contatos)

Objetivo do recurso "Fluxo de Mensagens Rápidas":
Quero transformar respostas rápidas em FLUXOS sequenciais. Um fluxo é uma sequência ordenada de passos, onde cada passo pode ser:
- texto, imagem, vídeo, áudio ou arquivo
- com DELAY configurável antes de enviar (segundos)
- com ações entre passos: etiquetar (tag) o contato e/ou arquivar o contato

Depois de criado, sobre cada fluxo eu quero, fácil:
- ENVIAR com 1 clique (dispara a sequência com os delays)
- EDITAR
- DUPLICAR (copiar)
- EXCLUIR

Integração com Disparos (Campaigns):
- Dentro de um disparo eu quero SELECIONAR um fluxo existente e aplicá-lo a uma lista de contatos (disparo em massa usando o fluxo + delays).

NÃO escreva código ainda. Primeiro me entregue um PLANO curto contendo:
1. Modelo de dados do fluxo (estende QuickReplyItem ou cria FlowItem novo? campos: steps[], cada step {type, value, delayMs, action?}).
2. Endpoints/serviços backend necessários (criar/listar/editar/excluir/executar fluxo) e onde encaixam na API atual.
3. Motor de execução: como rodar a sequência com delay no envio 1-clique (fila/timeout no backend, reaproveitar a fila de Campaigns?).
4. UI: onde fica o editor de fluxo (modal na aba Respostas Rápidas?) e o seletor de fluxo dentro de Campaigns.
5. Lista ordenada de arquivos a criar/editar.
6. Riscos e o que pode reaproveitar do que já existe (items[], tags[], delay de Campaigns).

Seja objetivo. Quero aprovar o plano antes de você codar.
```

---

## PROMPT 4 — Aba Arquivos: melhorar grade de visualização das mídias recebidas

```
Arquivo: frontend-official/src/pages/Inbox/components/SidebarPanel.tsx

Contexto: a aba "Arquivos" (TabsContent value="files", ~linha 1269) lista mídias recebidas num grid-cols-2. Hoje fica desorganizado: thumbnails diferentes de tamanho, e quando o backend não devolve URL aparece o texto "Backend nao retornou URL da midia persistida" (linha ~149) ocupando o card inteiro.

Melhorar SÓ o visual da grade (sem mudar fetch/lógica):
1. Cards uniformes: thumbnail com aspect-square, object-cover, cantos arredondados; mesma altura para imagem, vídeo e documento.
2. Documentos/sem-preview: mostrar ícone central + nome, NÃO o texto de erro grande. O aviso de URL ausente vira um badge pequeno discreto no rodapé do card.
3. Linha de meta (tipo • tamanho • data) em uma linha só, truncada (truncate), sem quebrar o card.
4. Botões "Abrir"/"Baixar" compactos lado a lado; desabilitar (opacity + cursor-not-allowed) quando não houver URL, em vez de sumir.
5. Opcional: filtro rápido no topo (Todos / Imagens / Vídeos / Documentos) usando o tipo já disponível.
6. Pode ajustar para grid-cols-2 com gap-2 e, em telas estreitas, grid-cols-1.

Não alterar a função que busca os arquivos nem os tipos. Só JSX/classes do card e do grid. Me mostre o diff.
```

---

## PROMPT 5 — Histórico: mensagens recolhidas (clicar para abrir) + envio para Memória do Contato

```
Arquivo: frontend-official/src/pages/Inbox/components/SidebarPanel.tsx (aba "history", TabsContent value="history")

Objetivo: o Histórico hoje mostra cada mensagem inteira, fica longo. Quero recolher por padrão e expandir ao clicar; e poder mandar um evento para a Memória do Contato.

Tarefas:
1. Cada item do timeline (conversationTimeline.map) começa RECOLHIDO ("hide"): mostra só título + horário + 1 linha de preview (line-clamp-1). Ao clicar no item, expande e mostra o texto completo; clicar de novo recolhe. Controlar com um Set de ids expandidos em useState local (ex.: expandedTimeline), sem libs novas.
2. Indicador visual de expansível: um chevron que gira (rotate) quando aberto.
3. Em cada item adicionar um botão pequeno "Salvar na Memória" (ícone) que chama um handler novo onSaveTimelineToMemory(evt) — declare a prop opcional no tipo do componente e passe pelo Inbox.tsx; por enquanto o handler pode só montar o texto do evento e chamar a função de memória de contato existente (procure handler de memória já usado na aba Lead/IA, ex. handleSaveLeadNotes ou similar) e dar toast de sucesso. Se não existir, deixe TODO claro chamando o serviço de memória.

Não quebrar a renderização atual do timeline. Me mostre o diff e diga qual handler de memória reaproveitou.
```

---

## PROMPT 6 — Wizard de Atendente: modo "Etapas" OU modo "Página única (submenus)" + ElevenLabs funcional + prompt compilado melhor

> Prompt de **planejamento + implementação faseada**. É a mudança maior; peça o plano e aprove antes.

```
Arquivo principal: frontend-official/src/lovable/pages/AIView.tsx
O wizard "Adicionar Atendente" tem 10 passos (estado wizardStep, render entre ~linha 2264 e ~2790). Cada passo edita os estados agentForm* (nome, setor, empresa, produtos, FAQ, personalidade, horários, regras, transbordo, voz). O passo 9 (Configuração de Voz / ElevenLabs, ~2669) só tem switch + regra; o Voice ID fica solto na config de Provedores (~1946).

Quero 3 melhorias. NÃO comece a codar: primeiro me devolva um PLANO curto, depois implementamos por fase.

FASE A — Dois modos de criação (mesmos campos/estados, sem duplicar lógica):
- Modo "Etapas": o wizard atual passo a passo.
- Modo "Página única": UMA tela com todos os passos virando submenus colapsáveis (Accordion), cada seção = um passo atual. Assim dá pra ver tudo e recolher campos. A página fica maior (scroll), com os Accordions fechados por padrão exceto Identificação.
- Um toggle no topo do modal/página alterna entre "Etapas" e "Página única". Os dois compartilham EXATAMENTE os mesmos componentes de campo (extraia cada passo num componente/função reutilizável: StepIdentificacao, StepEmpresa, StepVoz, etc.) para não duplicar JSX.

FASE B — ElevenLabs funcional no passo/sub-seção de Voz:
- Além do switch e da regra, adicionar: seleção de Voice ID (dropdown com vozes; se houver endpoint de listar vozes use, senão input do Voice ID), e um botão "Testar voz" que gera um áudio de exemplo com o texto digitado (se existir serviço de TTS no backend; senão deixe TODO com a assinatura do serviço).
- Persistir Voice ID junto do atendente (estado agentFormVoiceId novo, salvar/editar). Garantir que ao editar um atendente o Voice ID carrega.

FASE C — Melhorar o "prompt completo" compilado:
- Localize onde o prompt final é montado a partir de empresa+produtos+FAQ+regras+personalidade+memórias (há um preview "prompt compilado", ~linha 1440). Reescreva o template para ser mais estruturado e claro: seções com cabeçalhos (IDENTIDADE, EMPRESA, PRODUTOS/SERVIÇOS, FAQ, REGRAS, TOM/PERSONALIDADE, TRANSBORDO, VOZ), instruções de quando escalar para humano, e uso das memórias. Manter as variáveis já existentes.

No PLANO me diga: (1) como extrair os passos em componentes reutilizáveis, (2) onde guardar o modo (estado local + opcional persistir preferência), (3) o que existe hoje de serviço de vozes/TTS no backend (se não souber, liste o que precisaria), (4) os arquivos a tocar e a ordem das fases. Objetivo e curto.
```

---

## PROMPT 7 — BUG: indicador "digitando" travado + status Online/Offline inconsistente

```
BUG 1 — "digitando..." não some depois que a mensagem chega/é enviada.
Arquivos: frontend-official/src/runtime/socket/socketManager.ts (handler de typingEvents, ~linha 787) e frontend-official/src/stores/appStore.ts (updateTypingStatus / typingUsers, ~linha 599).
Causas prováveis: (a) eventos de presença "paused"/"available"/"unavailable" não estão sendo tratados como STOP; (b) não há timeout de segurança; (c) ao receber uma mensagem nova da conversa o typing não é limpo.
Corrigir:
1. No handler, tratar rawState "paused", "available", "unavailable", "stop", "stopped" e isTyping/typing === false como isTyping=false (parar).
2. Adicionar auto-clear: ao marcar typing=true para uma conversa, agendar setTimeout (~6s) que zera o typing daquela conversa se não chegar novo evento. Rearmar o timeout a cada evento. Guardar os timers num Map por conversationId e limpar no destroySharedSocket.
3. Quando uma nova mensagem entrante daquela conversa for processada (procure onde messages são adicionadas ao store via socket), chamar updateTypingStatus(conversationId, false).

BUG 2 — topo da conversa mostra "Offline" enquanto o painel mostra sessão/Baileys conectado.
Arquivos: frontend-official/src/components/inbox/ChatHeaderBar.tsx (statusLabel, ~linha 26) e onde o statusLabel é montado no Inbox (procure quem passa statusLabel ao ChatHeaderBar).
Corrigir: o statusLabel do topo deve refletir o MESMO estado de conexão da sessão/Baileys usado no resto do app (procure o status real, ex. connectionState / "BAILEYS CONECTADO" / useApiRuntimeStatus) em vez de uma flag separada. Unificar a fonte de verdade do status e garantir que "digitando..." só apareça quando isTyping for true, voltando para "online" quando parar.

Me mostre o diff e diga qual fonte de status unificou.
```

---

## PROMPT 8 — Painel direito (Inbox): menos poluição visual + ícones/emojis monocromáticos

```
Arquivo: frontend-official/src/pages/Inbox/components/SidebarPanel.tsx

O painel direito tem informação demais. Reduzir densidade e usar ícones/emojis MONOCROMÁTICOS no padrão do sistema (sem cores chamativas, herdando text-muted-foreground/text-foreground).

Tarefas (só visual, não remover dados que o usuário precisa de fato):
1. Seção "IA → Status e modelo": condensar. Mostrar Provedor/Modelo com um ícone monocromático por provedor (ex.: OpenAI/GPT, Claude/Anthropic, Gemini). Crie um pequeno helper getProviderIcon(provider) que retorna um ícone do set já usado (phosphor/lucide) em tom monocromático; nada de logos coloridos.
2. Mover métricas secundárias (Tokens entrada/saída, Tempo "Sem dado") para um sub-bloco recolhível ou reduzir para uma linha discreta. Manter só o essencial visível: IA ativa, Modelo, Última resposta.
3. Padronizar espaçamentos e tamanhos de fonte (text-[11px]/text-xs) e remover badges/realces redundantes. Emojis, se usados, devem ser monocromáticos e sóbrios.
4. Não alterar lógica/fetch. Só apresentação. Manter acessível e legível.

Me mostre o diff e um print mental de antes/depois em texto.
```

---

## PROMPT 9 — Contatos: visão Kanban de afunilamento por estágio de IA

```
Arquivos: frontend-official/src/pages/Contacts.tsx e a view frontend-official/src/lovable/pages/ContactsView.tsx
Contexto: o contato já tem funnelStage (Contacts.tsx ~linha 35/186) e temperature. Hoje a tela é grid/lista.

Objetivo: adicionar um modo KANBAN de afunilamento por estágio de IA, além do grid atual.
Tarefas:
1. Toggle de visualização (Grid | Kanban) perto do toggle de layout que já existe no topo.
2. No modo Kanban, criar colunas por estágio do funil de IA. Defina os estágios a partir dos valores reais de funnelStage presentes nos contatos (ex.: Novo Lead, Em Qualificação, Preço Enviado, Negociação, Fechamento, Perdido) — derive a lista dos dados; se vazio, use um conjunto padrão.
3. Cada card de contato (reaproveite o card existente) entra na coluna do seu funnelStage. Mostrar contador por coluna.
4. Drag-and-drop entre colunas para mudar o estágio: ao soltar, chamar o serviço que atualiza funnel_stage do contato/conversa (procure apiService para update de contato/lead; se não houver, deixe handler onChangeFunnelStage(contactId, stage) com chamada ao endpoint e TODO claro). Atualização otimista no estado local.
5. Sem libs novas pesadas: use HTML5 drag-and-drop nativo.

NÃO comece codando a parte de DnD sem antes confirmar o endpoint de atualização de estágio. Me devolva: estágios derivados, endpoint usado e o diff. Pode ser faseado (1º render kanban read-only, 2º DnD).
```

---

## PROMPT 10 — Voz: 2 vozes BR padrão (sem ElevenLabs) + opção ElevenLabs + IA decide quando mandar áudio

```
Arquivo backend: backend/services/audioGenerationService.js (hoje SÓ ElevenLabs; lança erro sem credencial, ~linha 120).
Arquivo IA: backend/ai-agents/services/aiAgentService.js (voiceEnabled/voiceRule, ~linha 69).
Frontend: frontend-official/src/lovable/pages/AIView.tsx (passo/sub-seção de Voz do atendente).

NÃO codar ainda — me devolva um PLANO curto primeiro.

Objetivo 1 — Vozes padrão SEM ElevenLabs (sem tokens):
- Adicionar um provedor de TTS gratuito/local como fallback com 2 vozes brasileiras: "Masculina BR (padrão)" e "Feminina BR (padrão)". 
- No PLANO, liste opções viáveis de TTS pt-BR sem custo por token (ex.: gTTS/Google TTS público, edge-tts/Microsoft, espeak-ng, Piper offline) com prós/contras (qualidade, dependência externa, licença). Recomende uma.
- Estrutura: audioGenerationService deve ter seleção de provider: "default" (as 2 vozes BR) ou "elevenlabs" (quando houver credencial). Em vez de lançar erro sem ElevenLabs, cair no provider default.

Objetivo 2 — Opção ElevenLabs mantida: quando houver provider_keys de elevenlabs, permitir usar Voice ID custom (já existe no wizard).

Objetivo 3 — IA identifica o momento de mandar áudio:
- Hoje voiceRule é "always" ou "voice_in" (responder em áudio só quando receber áudio). Adicionar regra "smart": a IA decide quando faz sentido responder em áudio (ex.: explicações longas, saudação, quando o cliente mandou áudio). No PLANO descreva como implementar o "smart" (heurística simples por tamanho/tipo da última mensagem, ou um classificador leve) sem estourar tokens.

No PLANO: (1) provider TTS recomendado e como pluga no service, (2) novos campos (voiceProvider, voiceGender) e migração, (3) onde o aiAgentService decide gerar áudio e como entra a regra "smart", (4) ajustes no wizard (AIView) para escolher Provider de Voz: Padrão (Masc/Fem BR) ou ElevenLabs, e a regra de envio. Curto e objetivo.
```

---

## PROMPT 11 — Análise de IA: ativar e tornar funcional com dados reais

```
Arquivo: frontend-official/src/lovable/pages/AIView.tsx (TAB Análise, activeInternalTab === "analise", ~linha 2617; sub-tabs "Evolução IA" / "Logs de Auditoria IA", ~linha 2622).
Backend: procure serviço de inteligência/análise já existente: backend/services/aiIntelligenceService.js e aiConversationMemoryService.js.

Problema: a aba Análise mostra dados estáticos/placeholder (Camila — Score 0/100, Conversões 0, Taxa 0%). Quero ativar com métricas reais por atendente.

NÃO codar ainda — PLANO primeiro.
Quero por atendente: Conversas Analisadas, Conversões, Objeções Capturadas, Taxa de Sucesso, Score, Tópicos mais frequentes, e os Logs de Auditoria IA reais.
No PLANO: (1) que dados já existem no backend (aiIntelligenceService) e quais faltam, (2) endpoint(s) para buscar métricas por atendente e período, (3) como calcular Score/Taxa de Sucesso de forma simples e explicável, (4) como popular "Tópicos mais frequentes" (agregação das mensagens/intenções já salvas), (5) o que muda no AIView para consumir dados reais (estado, loading, vazio). Objetivo e curto. Depois implementamos por fase: 1º ligar métricas que já existem, 2º calcular as faltantes.
```

---

## PROMPT 12 — Delay humanizado + métricas de envio + aquecimento/limites de disparo (expor na UI)

```
Backend (já existe, conferir): backend/services/campaignDispatchEngine.js tem warmup (warmupMessages, warmupDelayMultiplier ~linha 67-92), throttle e rate limit por sessão. backend/services/outboundQueueService.js controla a fila.
Frontend Campanhas: frontend-official/src/pages/Campaigns.tsx (typingDelay/delays já existem no builder).
Frontend Atendente (delay humanizado de resposta): frontend-official/src/lovable/pages/AIView.tsx (agentFormResponseDelayMin/Max, agentFormTypingDelayMin/Max).

Objetivo: deixar o delay humanizado e o aquecimento configuráveis e visíveis, com métricas.

Tarefas:
1. Delay humanizado das RESPOSTAS da IA: revisar como agentFormResponseDelay* e typingDelay* são aplicados no envio (procure onde o backend espera antes de responder). Garantir que: (a) o atraso é aleatório entre min e max, (b) o "digitando" é emitido durante o delay e parado ao enviar. Melhorar a curva (delay proporcional ao tamanho da resposta, com teto).
2. Aquecimento de número (warmup) no DISPARO: expor na UI de Campanhas os campos que já existem no engine — warmupMessages (quantas primeiras mensagens usam delay maior) e warmupDelayMultiplier — e um limite diário/por hora de envios (dailyLimit / hourlyLimit) com validação. Se o limite não existir no engine, adicionar no campaignDispatchEngine respeitando rate limit por sessão.
3. Métricas de envio do disparo: mostrar enviados/falhas/na fila/limite restante por campanha, lendo do estado do engine/outboundQueueService. 
4. Texto de ajuda curto explicando "número aquecido" e por que limitar (anti-ban).

Pode começar PLANO + Fase 1 (delay humanizado). Me diga onde o backend aplica o delay hoje e o diff. Não invente limites mágicos: derive dos campos do engine.
```

---

## PROMPT 13 — Editor de Resposta Rápida: delay em TODA mensagem + mídia (preview/áudio/legenda) + duplicar + layout

```
Arquivos: frontend-official/src/pages/Inbox.tsx (modal "Nova/Editar Resposta Rápida", ~linha 740-1100), estado em frontend-official/src/pages/Inbox/hooks/useInboxState.ts (qrDialogItems, moveQrDialogItem, qrDialogIsFlow), tipos em frontend-official/src/pages/Inbox/types.ts (QuickReplyMediaItem e FlowStep).

Objetivo: tornar o editor mais completo e a tela maior/melhor.

1. DELAY EM TODA MENSAGEM (não só em Fluxo):
   - Adicionar a CADA item da sequência dois controles de tempo: "Tempo digitando" (typingMs) e "Aguardar antes de enviar" (delayMs). Hoje o delayMs só aparece quando qrDialogIsFlow; passar a exibir os dois sempre.
   - Acrescentar typingMs ao tipo dos itens (QuickReplyMediaItem e FlowStep) e ao estado. Default razoável (ex.: typing 1.5s, delay 0).

2. LEGENDA NA MÍDIA (como no WhatsApp):
   - Para itens de mídia (image/video), adicionar um campo de texto "Legenda (caption)" abaixo do preview. Salvar como caption no item. Persistir junto da mídia.

3. PREVIEW/REPRODUÇÃO DA MÍDIA:
   - Imagem: thumbnail clicável que abre o preview grande (reutilize o previewMedia já existente no Inbox).
   - Áudio: player <audio controls> para ouvir.
   - Vídeo: thumbnail que abre player.
   - Documento: ícone + nome (como hoje).

4. AÇÕES POR ITEM: além de mover ▲▼ (já existe), adicionar botão "Duplicar item" (copia o item logo abaixo) e manter excluir. Botões com ícones, tooltip curto.

5. LAYOUT/BOTÕES da tela:
   - Aumentar a largura do modal (ex.: sm:max-w-2xl) e a área da sequência com scroll.
   - Padronizar botões (Texto / Mídia / Salvar / Cancelar) com ícones e tamanhos consistentes; melhorar respiro e separadores.
   - Cabeçalho do item mostrando tipo (Texto/Imagem/Áudio/Vídeo/Doc) com ícone monocromático.

Garantir que sendQuickReply/execução do fluxo respeite typingMs e delayMs (emitir "digitando" durante typingMs, esperar delayMs entre passos) e envie a caption junto da mídia. Se a execução estiver no backend, ajuste lá também (veja Prompt 14/16). Me mostre o diff e onde alterou os tipos.
```

---

## PROMPT 14 — IA com digitação humanizada em tempo real (anti-bloqueio)

```
Backend: backend/ai-agents/services/aiAgentService.js (typingDelayProfile/delayProfile, ~linha 23-44) e backend/services/whatsapp/connection/stableSession.js (já usa sock.sendPresenceUpdate('recording'), ~linha 527) e backend/services/whatsapp/outbound/senders.js.

Objetivo: antes de enviar uma resposta, a IA deve "digitar" como um humano: emitir presença "composing" por um tempo proporcional ao tamanho do texto, então enviar. Isso reduz bloqueios.

NÃO codar tudo de uma vez — PLANO curto + Fase 1.

Regras:
1. Calcular o tempo de digitação a partir do tamanho da resposta: ex. duracao = clamp(textLength * msPorCaractere, typingDelayProfile.minMs, typingDelayProfile.maxMs). Tornar msPorCaractere configurável.
2. Durante esse tempo, enviar sock.sendPresenceUpdate('composing', chatId) (e 'recording' se a resposta for áudio). Renovar a presença em intervalos (Baileys expira ~10s) e dar 'paused' ao terminar.
3. Só então enviar a mensagem. Se houver delayProfile (delay de resposta), aplicar antes de começar a digitar (atraso aleatório entre min e max).
4. O front já mostra "digitando..." ao receber a presença (ver Prompt 7) — garantir que o evento chega ao app via socket também, não só ao WhatsApp.
5. Sequências (Resposta Rápida/Fluxo) com vários passos: repetir o ciclo digitar→enviar por passo, respeitando typingMs/delayMs do passo (Prompt 13).

PLANO: (1) onde hoje a IA dispara o envio (função que chama senders), (2) como injetar o ciclo presença→espera→envio sem travar a fila, (3) campos novos configuráveis e onde ficam no wizard (AIView). Depois implemente a Fase 1 (texto). Me mostre o diff.
```

---

## PROMPT 15 — Arquivamento e Etiquetas REAIS no WhatsApp (sincronizar com o aparelho)

```
Backend: backend/services/whatsapp/chat/operations.js (archiveChat ~linha 151-171 só seta flag local, NÃO arquiva no WhatsApp), backend/controllers/conversationsController.js (endpoints), backend/services/whatsapp/connection/stableSession.js (instância sock do Baileys).
Frontend: segmento "Arquivados" em Contatos (frontend-official/src/pages/Contacts.tsx) e ações de arquivar/etiquetar na conversa.

Problema: arquivar e etiquetas hoje são só locais. Quero que reflitam de verdade no WhatsApp (Baileys) e vice-versa.

NÃO codar ainda — PLANO primeiro (envolve protocolo do Baileys).

ARQUIVAR (real):
1. Em archiveChat/unarchive, chamar sock.chatModify({ archive: true/false, lastMessages: [...] }, chatId) do Baileys, além de atualizar o estado local/banco.
2. Tratar o evento 'chats.update' do Baileys para refletir no sistema quando o usuário arquivar pelo celular (sincronização bidirecional).
3. Garantir que o segmento "Arquivados" em Contatos liste de fato os arquivados (filtrar por archived=true vindo do estado real).

ETIQUETAS (labels reais):
4. Labels no WhatsApp só existem no WhatsApp Business. No PLANO confirme se a sessão é Business e se o Baileys desta versão expõe labels (addLabel/addChatLabel/labelAssociation). Se SIM: criar etiqueta no sistema => criar no WhatsApp; associar etiqueta a contato => associação real; e ouvir 'labels.edit'/'labels.association' para sincronizar de volta. Se NÃO houver suporte: deixar etiquetas locais robustas e marcar claramente o limite, sem prometer sync.

PLANO: (1) versão do Baileys e o que ela suporta de archive/labels, (2) endpoints a criar/ajustar, (3) eventos a escutar para sync bidirecional, (4) o que muda no front (Contatos arquivados + UI de etiquetas). Curto. Depois implementamos: Fase 1 arquivar real, Fase 2 etiquetas.
```

---

## PROMPT 16 — Inbox: enviar mídia com legenda (caption) dentro da imagem/vídeo, como no WhatsApp

```
Frontend: frontend-official/src/pages/Inbox/components/ActiveChatPane.tsx (composer de mensagem e anexos/ComposerAttachment).
Backend: backend/services/whatsapp/outbound/senders.js (envio de mídia) e o caminho controllers/messages/send.

Objetivo: ao anexar uma imagem/vídeo no Inbox, permitir escrever uma legenda que vai DENTRO da mídia (caption), igual ao WhatsApp — e não como mensagem separada.

Tarefas:
1. No composer, quando houver anexo de imagem/vídeo, o texto digitado vira a caption daquele anexo (mostrar a caixa de legenda sobre/junto do preview do anexo). Para áudio/documento, manter comportamento atual.
2. Enviar a caption junto no payload de mídia. Conferir em senders.js se o envio Baileys já aceita caption (image/video aceitam { image, caption }); se hoje envia mídia e texto separados, unificar.
3. Suportar múltiplos anexos com caption por anexo (se já houver multi-anexo).
4. Refletir a caption na bolha de mensagem enviada (a UI já lê message.caption em alguns pontos — garantir consistência).

Me diga se o senders.js já passava caption e o diff. Pode ser fase única.
```

---

### Dica de custo de tokens
- Rode os prompts **separados** (1, depois 2, depois 3). Juntar tudo num prompt só faz o agente reler o arquivo inteiro várias vezes.
- No Prompt 3, peça **plano antes do código** — assim você corrige o desenho antes de gerar centenas de linhas.
- Sempre que possível, cite **arquivo + linha** (como acima) para o agente não varrer a base toda.
