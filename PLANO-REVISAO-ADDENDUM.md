# Revisão do Plano + Novas Modificações (colar no Antigravity)

> Cole isto como resposta ao plano que você gerou. Primeiro as CORREÇÕES do plano 7–12, depois as MODIFICAÇÕES NOVAS (13–16) a integrar.

---

## A. Correções no plano 7–12 (ajustar antes de implementar)

**A1. Prompt 10 (TTS) — TROCAR o provedor recomendado.**
Não use o endpoint `translate_tts` do Google: é uma API não-oficial, limita ~200 caracteres por requisição, exige token (`tk`) e é bloqueada com frequência. E "fingir" voz masculina com pitch-shift via ffmpeg soa robótico.
Use **edge-tts (Microsoft Edge TTS)** como fallback gratuito, sem API key, com vozes neurais reais pt-BR:
- Feminina BR: `pt-BR-FranciscaNeural`
- Masculina BR: `pt-BR-AntonioNeural`
Alternativa 100% offline: **Piper** (vozes pt-BR locais) — recomende como opção secundária para quem não quer depender de rede.
Ajuste o `audioGenerationService.js`: `voiceProvider` = `"default"` (edge-tts, escolhe voz por `voiceGender`) ou `"elevenlabs"` (quando houver credencial). Sem ElevenLabs, cair no default em vez de lançar erro. Remova o plano de pitch-shift.

**A2. Prompt 7 (typing travado) — auto-clear de 6s é curto.**
Um humano digitando uma mensagem longa leva mais de 6s e o WhatsApp renova a presença a cada poucos segundos; 6s pode limpar o "digitando" no meio. Use **timeout de 10s, rearmado a cada evento** de presença. Mantenha a limpeza imediata ao chegar mensagem da conversa e ao receber `paused/available/unavailable/stop`.

**A3. Prompts 12 e 14 se sobrepõem — unificar.**
A Fase 1 do Prompt 12 só calcula o delay e dá `sleep`. Isso sozinho NÃO reduz bloqueio. O ganho anti-bloqueio vem de **emitir `sock.sendPresenceUpdate('composing', chatId)` durante o delay** (Prompt 14) e parar com `'paused'` antes de enviar. Implemente os dois juntos em `runAIForChat` (stableSession.js): calcular delay proporcional → emitir composing renovando a cada ~8s → enviar. Não duplicar a lógica em dois lugares.

**A4. Prompt 9 (Kanban) — tratar contato sem conversa.**
Um contato pode não ter `conversationId` (não dá pra `PATCH /api/conversations/:id`) ou ter mais de uma conversa. No drop: se não houver conversationId, desabilitar o arrastar (ou criar/abrir conversa antes). Defina qual conversa recebe o `funnel_stage` quando houver várias (use a mais recente). Reverter no erro, como já planejado.

**A5. Prompt 11 (Análise) — validar que o dado existe antes da UI.**
Antes de calcular score, confirme que `conversations.agent_name` e `lead_intent` estão de fato populados em produção. Se vierem vazios, a tela mostra 0 (igual hoje). Comece ligando só as métricas com dado real e mostre estado vazio honesto onde faltar, em vez de número fake.

---

## B. Novas modificações a INTEGRAR no plano (Prompts 13–16)

Adicione estas seções ao plano, na ordem abaixo. Detalhes completos estão em `PROMPTS-ANTIGRAVITY-UPGRADES.md` (prompts 13 a 16).

**B1. Editor de Resposta Rápida (Prompt 13)** — `Inbox.tsx` (modal ~740-1100), `useInboxState.ts`, `types.ts`.
- Delay em TODA mensagem: adicionar `typingMs` e `delayMs` por item (hoje delay só aparece em Fluxo). Acrescentar `typingMs` aos tipos `QuickReplyMediaItem` e `FlowStep`.
- Legenda (`caption`) em itens de mídia.
- Preview clicável (imagem), player de áudio, player de vídeo; duplicar item; modal maior (`sm:max-w-2xl`) e botões padronizados com ícone.
- `sendQuickReply`/execução do fluxo deve respeitar `typingMs`/`delayMs` (emitir digitando) e enviar caption.

**B2. IA digitação humanizada em tempo real (Prompt 14)** — mesma base do A3. Ciclo presença→espera→envio por passo; reaproveitar `typingDelayProfile`/`delayProfile`. Fase 1 = texto.

**B3. Arquivamento + Etiquetas REAIS no WhatsApp (Prompt 15)** — `whatsapp/chat/operations.js` (`archiveChat` hoje só local), `conversationsController.js`, `stableSession.js`.
- Arquivar real: `sock.chatModify({ archive }, chatId)` + ouvir `chats.update` (sync bidirecional) + segmento "Arquivados" listar reais.
- Etiquetas: PRIMEIRO confirmar a versão do Baileys e se a sessão é Business e expõe labels. Se sim, criar/associar label real + ouvir `labels.*`. Se não, manter local e marcar o limite — não prometer sync.

**B4. Inbox: mídia com legenda (Prompt 16)** — `ActiveChatPane.tsx` (composer) + `senders.js`.
- Texto digitado com anexo de imagem/vídeo vira `caption` da mídia (não mensagem separada). Conferir se `senders.js` já passa caption no envio Baileys e unificar se estiver separado.

---

## C. Ordem de execução recomendada (custo x risco)

1. **Prompt 7** (bug de uso — primeiro).
2. **Prompts 8, 13, 16** (frontend visual/UX, baixo risco).
3. **Prompt 9** (kanban, médio).
4. **Prompts 12 + 14 juntos** (delay humanizado + presença — núcleo anti-bloqueio).
5. **Prompt 10** (vozes — depois de trocar para edge-tts).
6. **Prompt 15** (arquivar/etiquetas — depende do Baileys, mais risco).
7. **Prompt 11** (análise — depois de garantir dados reais).

## D. Verificação (acrescentar à seção de verificação do plano)
- Typing limpa em <=10s e some ao chegar mensagem; header bate com estado do Baileys.
- Áudio gera com edge-tts sem ElevenLabs, voz masc/fem audivelmente diferentes (não pitch-shift).
- Disparo emite `composing` real no aparelho durante o delay (validar no celular).
- Arquivar no sistema reflete no WhatsApp e vice-versa.
- Resposta rápida com mídia+legenda chega como uma única mensagem com caption.
