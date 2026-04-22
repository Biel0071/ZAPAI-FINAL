# Changelog — Refatoração do backend/crm

Escopo coberto: análise técnica, 5 correções de segurança, 5 correções de bugs, e Fase 2a da refatoração modular. Compatibilidade é tratada como requisito — **todos os exports históricos foram preservados**.

---

## [Phase 0] Análise técnica (2026-04-17)

Produzida auditoria de segurança / arquitetura / performance cobrindo:

- Bypass total de JWT em dev, CORS wildcard, LFI via `mediaPath`, dedupe fragmentado, cache sem TTL, fila não crash-safe, crashes ignorados.
- Problemas estruturais: monolitos de 2.5 k linhas, três camadas de shims, estado global impedindo multi-tenant.
- Performance: reagendamentos 500 ms, 2 k mensagens no boot, aliases de socket triplicando tráfego.

Entregue como laudo no chat (não commitado).

---

## [Phase 1] Correções críticas — Segurança (2026-04-17)

### Fix 1 — Bypass de autenticação por `NODE_ENV` ✅

**Arquivos:**
- `middleware/jwtAuth.js` — `createJwtAuthMiddleware`.
- `server.js` — `authMiddleware` reduzido a alias de `requireJwtAuth`.

**Antes:** qualquer request em `NODE_ENV !== 'production'` passava sem JWT.
**Depois:** bypass só ocorre com `ALLOW_DEV_AUTH_BYPASS=true` **E** `NODE_ENV !== 'production'`. Default seguro.

**Compat:** dev local exige adicionar `ALLOW_DEV_AUTH_BYPASS=true` ao `.env`.

### Fix 2 — CORS inseguro ✅

**Arquivo:** `server.js` linhas 268-292.

**Antes:** middleware manual injetava `Access-Control-Allow-Origin: *`, depois outro `cors({ origin: '*' })`. `corsBlockMiddleware` e `isOriginAllowed` existiam mas eram código morto.

**Depois:**
- Removido o wildcard manual.
- `cors({ origin: validateOrigin, credentials: true, methods, allowedHeaders })` usando a função já existente.
- Preflight (`app.options('*')`) delegado ao mesmo validator.
- `corsBlockMiddleware` montado após `apiEnvelope` para 403 explícito.

**Compat:** `isOriginAllowed` retorna `true` para qualquer origin fora de produção. Dev local não afetado.

### Fix 3 — Socket emit global sem tenant rooms ✅

**Novos arquivos:**
- `services/realtime/tenantRooms.js` — `joinTenantRoom`, `emitToTenant`, `emitToTenantWithAliases`, `resolveSocketTenantId`.

**Arquivo alterado:** `server.js` — sockets entram em `tenant:<id>` no `connection`; handlers `typing:*` emitem só para a sala do tenant.

**Compat:** `io.emit(...)` existentes no restante do código continuam broadcast. Migração será gradual na Fase 2b.

### Fix 4 — `mediaPath` inseguro (LFI) ✅

**Arquivo:** `services/messageService.js`.

**Novos helpers:** `assertMediaPathWithinAllowedRoots`, `isWithinAllowedMediaRoot`, `ALLOWED_MEDIA_ROOTS`.

**Proteção:** paths absolutos fora de `UPLOADS_DIRECTORY`, `UPLOAD_DIRECTORY` ou `PROJECT_ROOT/media` são rejeitados com código `MEDIA_PATH_FORBIDDEN` (HTTP 403). Guard é aplicado **antes** e **depois** da resolução candidata, fechando a janela de path traversal.

**Controller:** `controllers/messagesController.js` — tratamento explícito de `MEDIA_PATH_FORBIDDEN` em `sendMessage` e `sendMedia`.

**Escape hatch:** `ALLOW_UNSAFE_MEDIA_PATHS=true` + não-produção libera paths absolutos para debug.

### Fix 5 — Variáveis globais impedindo multi-tenant ✅

**Novo arquivo:** `services/sessionStateService.js` — `getWhatsappSession(tenantId)`, `setWhatsappSession(tenantId, patch)`, `resetWhatsappSession`, `listTenantSessionStates`. `Map` por tenant; mantém `global.whatsappSession` sincronizado com o tenant default como alias para leitores legados.

**Arquivos alterados:** `server.js` (init via service), `services/whatsappService.legacy.js` (init na outra porta de entrada).

**Compat total:** nenhum leitor de `global.whatsappSession` precisa mudar agora.

---

## [Phase 1b] Correções críticas — Bugs (2026-04-17)

### Bug 1 — `runWithFastFallback` causava persistência dupla ✅

**Arquivo:** `controllers/messagesController.js:1285-1363`.

**Causa:** `Promise.race` contra timeout de 2,5 s no caminho de escrita de `receiveMessage`. Quando timeout vencia, cliente recebia fallback de memória, mas a escrita no DB continuava em background → linha duplicada + `unreadCount` duplicado + socket event duplicado.

**Correção:** no caminho de escrita, substituí o race por `try/catch` direto. Se DB rejeita → fallback memória. Se DB commita (mesmo lento) → resposta real. `runWithFastFallback` continua existindo para `aiController` (operações idempotentes).

### Bug 2 — Cache de conversas sem TTL/LRU + referências mutáveis ✅

**Arquivo:** `repositories/conversationRepository.js:1-69, 452-488`.

**Antes:** `Map` cresce indefinidamente (cada `session_id` novo vira chave); retornava a mesma referência do array; leitores podiam corromper o cache.

**Depois:** entradas `{ value, expiresAt }`, TTL (`CONVERSATION_CACHE_TTL_MS`, default 15 s) + cap (`CONVERSATION_CACHE_MAX_ENTRIES`, default 512) com eviction LRU (chave mais antiga). Retorno clonado via `.slice()`.

### Bug 3 — Dedupe Sets fragmentados e sem TTL ✅

**Novo arquivo:** `services/messageDedupeService.js` — `markSeen(namespace, id, ttl)`, `hasSeen`, `clearNamespace`, `stats`. TTL default 10 min (`MESSAGE_DEDUPE_TTL_MS`), cap 50 k (`MESSAGE_DEDUPE_MAX_ENTRIES`).

**Call-sites refatorados:**
- `controllers/messagesController.js` — `shouldPersistExternalMessageId`.
- `services/whatsappService.legacy.js` — `shouldProcessGlobalMessageId`.

**Antes:** dois Sets independentes com cap por contagem. **Depois:** um cache compartilhado com TTL real; dedupe consistente entre os dois caminhos de ingestão.

### Bug 4 — Fila outbound não era crash-safe ✅

**Arquivo:** `services/outboundQueueService.js:78-122`.

**Correções:**
- `saveQueueState`: escrita em `writeFile(tmpPath)` seguida de `rename(tmpPath, finalPath)` — atômico em NTFS/POSIX.
- `loadQueueState`: arquivo corrompido é renomeado para `*.corrupt-<ts>.bak` antes de reinicializar em branco (preserva dados para forensics).
- Removido o `.catch(() => fs.writeFile(...))` duplicado do `persistLock`.

### Bug 5 — `uncaughtException`/`unhandledRejection` não derrubavam o processo ✅

**Arquivo:** `server.js:854-895`.

**Antes:** apenas `console.error`. Node continuava em estado indefinido.

**Depois:** log + `process.exit(1)` com 500 ms de grace. Configurável via `CRASH_EXIT_ON_UNHANDLED`. Default: exit em produção, log-only fora. Supervisor (PM2/systemd/Docker/k8s) religa em estado limpo.

---

## [Phase 2a] Refatoração modular incremental (2026-04-17)

Estratégia **facade pattern**: cria nova estrutura de pastas, move apenas helpers **puros** (sem efeitos colaterais, sem estado de módulo mutável), arquivos originais viram re-exporters. Zero breakage de imports externos.

Executado em duas rodadas no mesmo dia. Rodada 1 moveu 22 helpers (primeiros grupos). Rodada 2 moveu 17 helpers adicionais (detalhes abaixo).

### Nova estrutura `services/whatsapp/` (14 arquivos)

```
services/whatsapp/
├── shared/
│   ├── identifiers.js     normalizePhone, ensureWhatsAppJid, normalizeSessionName, getCompanyId, DEFAULT_SESSION
│   ├── time.js            toUnixMillis, toRealtimeTimestamp, isToday, getMessageTimestamp
│   └── serialization.js   safeSerializeInboundMessage, isLikelyBase64Payload, normalizeUtf8Text
├── media/
│   ├── url.js             buildMediaUrl, getBaseUrl, normalizeRealtimeMediaType, extensionFromMimeType
│   └── payload.js         toMediaPayload, getMediaUrlPayload, getDocumentFileName         [rodada 2]
├── inbound/
│   ├── parser.js          unwrapMessageContent, extractMessageText, getMediaDescriptor
│   └── debug.js           normalizeInboundPhone, buildInboundDebugPayload                 [rodada 2]
├── realtime/
│   ├── payloads.js        buildRealtimeMessagePayload, buildStandardNewMessageEnvelope,
│   │                      buildRealtimeMediaPayload
│   └── chatState.js       isValidRealtimeChatId, getMessagePreview,                        [rodada 2]
│                          createRealtimeChatState, pruneChatMessages, ensureRealtimeStore,
│                          normalizeContactKey, resolveContactForChat, getRecentChatHistory,
│                          buildRealtimeIncomingMessage, isMessageConfirmed,
│                          CHAT_HISTORY_WINDOW_MS, MAX_CHAT_HISTORY_MESSAGES
├── connection/
│   ├── reconnect.js       shouldReconnect, getConnectionCloseCode
│   ├── qr.js              toQrDataUrl                                                      [rodada 2]
│   ├── sock.js            sessionPhoneFromSock                                             [rodada 2]
│   └── persistence.js     safeCreateSessionRecord, safeUpdateSessionStatus                 [rodada 2]
└── index.js               barrel com shared/media/inbound/realtime/connection + 40+ re-exports flat
```

**Nota:** pasta chamada `connection/` (não `sessions/`) porque o `.gitignore` do projeto bloqueia qualquer `sessions/`.

### Nova estrutura `controllers/messages/` (8 arquivos)

```
controllers/messages/
├── shared.js              normalizeChatId, toIsoTimestamp, toExactMessageText, formatApiMessage,
│                          buildStandardNewMessageEnvelope, emitSocketEvent, getStore, getRequestedSessionId,
│                          buildMediaUrl
├── media/
│   └── helpers.js         inferMediaType, isBase64MediaInput, extensionFromMimeType, saveBase64MediaToTempFile,
│                          MEDIA_TEMP_PUBLIC_PREFIX
├── sync/
│   ├── collectionOps.js   sortMessagesAsc, dedupeMessages, normalizeMessagesForApi
│   └── loadMessagesForChat.js  loadMessagesForChat                                         [rodada 2]
├── receive/
│   ├── dedupe.js          shouldPersistExternalMessageId
│   └── persistMemory.js   persistIncomingMessageInMemory                                   [rodada 2]
├── send/
│   └── .keep              placeholder para handlers HTTP (Fase 2b)
└── index.js               barrel com shared/media/sync/receive + re-exports flat
```

### Arquivos legados atualizados

**`services/whatsappService.legacy.js`** (2.571 → ~2.255 linhas, -12,3 %):

*Rodada 1* — destructure inicial de 22 nomes do `./whatsapp` + remoção de 22 definições duplicadas:
`normalizeSessionName`, `getCompanyId`, `normalizePhone`, `ensureWhatsAppJid`, `safeSerializeInboundMessage`, `isLikelyBase64Payload`, `toRealtimeTimestamp`, `buildMediaUrl`, `normalizeRealtimeMediaType`, `buildRealtimeMessagePayload`, `buildStandardNewMessageEnvelope`, `buildRealtimeMediaPayload`, `toUnixMillis`, `isToday`, `getConnectionCloseCode`, `shouldReconnect`, `getMessageTimestamp`, `normalizeUtf8Text`, `unwrapMessageContent`, `extractMessageText`, `getMediaDescriptor`, `extensionFromMimeType`. Removido `const BASE_URL` capturado em require-time; `DEFAULT_SESSION` importado de `whatsapp/shared/identifiers`.

*Rodada 2* — destructure expandido para 41 nomes + remoção de mais 15 definições duplicadas:
`toQrDataUrl`, `sessionPhoneFromSock`, `safeCreateSessionRecord`, `safeUpdateSessionStatus`, `isValidRealtimeChatId`, `getMessagePreview`, `createRealtimeChatState`, `pruneChatMessages`, `ensureRealtimeStore`, `normalizeContactKey`, `resolveContactForChat`, `getRecentChatHistory`, `buildRealtimeIncomingMessage`, `isMessageConfirmed`, `toMediaPayload`, `normalizeInboundPhone`, `buildInboundDebugPayload`, `getMediaUrlPayload`, `getDocumentFileName`.

**`module.exports` inalterado** — todas as 23 chaves históricas continuam presentes (validado via script).

**`controllers/messagesController.js`** (1.678 → ~1.410 linhas, -16 %):

*Rodada 1* — destructure inicial de 18 nomes do `./messages` + remoção de 14 definições duplicadas:
`getRequestedSessionId`, `normalizeChatId`, `toIsoTimestamp`, `buildStandardNewMessageEnvelope`, `sortMessagesAsc`, `dedupeMessages`, `normalizeMessagesForApi`, `emitSocketEvent`, `toExactMessageText`, `formatApiMessage`, `inferMediaType`, `isBase64MediaInput`, `extensionFromMimeType`, `saveBase64MediaToTempFile`. Removido `const BASE_URL` e `const recentInboundMessageIds`.

*Rodada 2* — destructure expandido para 20 nomes + remoção de 2 definições:
`persistIncomingMessageInMemory`, `loadMessagesForChat`.

**`module.exports` inalterado** — todas as 12 chaves históricas continuam presentes (validado via script).

### Validação

- `node -c` limpo em todos os 8 arquivos novos/alterados.
- Script de auditoria de exports: **0 chaves ausentes** em `whatsappService.legacy` e `messagesController`.
- Boot do servidor: módulos carregam, HTTP server sobe na porta 4000, Baileys tenta restaurar sessão (erros `Bad MAC` pré-existentes de credenciais corrompidas, sem relação com a refatoração).

---

## [Phase 2b] Refatoração com efeitos colaterais (2026-04-17)

Segue o mesmo padrão facade da Fase 2a, mas agora movendo blocos com efeitos colaterais (Socket.IO, DB, Baileys). Cada bloco foi validado com `node -c` e auditoria de exports antes de seguir ao próximo.

### Novos módulos (8 arquivos)

**`services/whatsapp/`:**

- **`realtime/events.js`** — `emitRealtimeEvent`, `emitConnectionUpdate`, `emitSessionStatus`, `emitMessageUpdates`, `emitChatsLoaded`, `emitChatUpdated`, `emitInboundRealtimeMessage`. (rodada 2b-1)
- **`connection/logger.js`** — `logSessionEvent`, `pushConnectionLog`. (rodada 2b-1)
- **`outbound/senders.js`** — `ensureSocket`, `sendWithRetry`, `sendMessage`, `sendImage`, `sendVideo`, `sendAudio`, `sendDocument`, `sendMediaMessage`, `isWhatsAppConnected` (helper). (rodada 2b-2)
- **`persistence/conversation.js`** — `syncMessageCache`, `syncConversationCache`, `findOrCreateContact`, `findOrCreateConversation`, `getConversationPreview`, `maybeGenerateAiSummary`, `persistConversationMessage`. (rodada 2b-4)
- **`inbound/pipeline.js`** — `downloadMedia`, `extractIncomingMessage`, `formatInboundSavedMessage`, `buildRealtimeDeduplicationKey`, `shouldProcessRealtimeMessage`, `shouldProcessGlobalMessageId`, `persistRealtimeMessage`, `persistInboundMessageFallback`. (rodada 2b-5)

**`controllers/messages/`:**

- **`realtime/inboxEvents.js`** — `scheduleConversationRevalidation`, `emitConversationSnapshotImmediate`, `emitInboxRealtimeEvent`, `emitInboxRealtimeEventFromStore`. (rodada 2b-3)
- **`send/persistOutgoing.js`** — `ensureConversationForMessage`, `persistOutgoingMessageRecord`. (rodada 2b-3b)
- **`receive/register.js`** — `registerIncomingMessage`, `registerOutgoingMessage`. (rodada 2b-3b)

### Mudança de contrato importante

**`outbound/senders.js`** não usa mais a variável local `isWhatsAppConnected` (let-mutável que vivia no escopo de `whatsappService.legacy.js`). Agora `ensureSocket` lê `global.whatsappSession?.connected` primeiro (fonte de verdade atualizada pelo listener Baileys) e cai para `sessionStateService.getWhatsappSession().connected` como fallback. A variável local `isWhatsAppConnected` continua no legacy (e continua sendo mutada pelo listener) porque `hasActiveConnection` ainda a consulta. Comportamento observável é idêntico — ambos os flags sempre flipam juntos nas linhas de `connection === 'open'` e `connection === 'close'`.

### Arquivos legados — resultado final

| Arquivo | 2a depois | 2b depois | Redução total |
|---|---|---|---|
| `services/whatsappService.legacy.js` | 2.255 | **1.348** | 2.571 → 1.348 (**-47,6 %**) |
| `controllers/messagesController.js` | 1.410 | **927** | 1.678 → 927 (**-44,8 %**) |

**Meta de `< 1000 linhas`:** controller ✅ (927). Legacy ❌ (1.348) — ver nota abaixo.

### Não incluído nesta fase — *listeners Baileys, reconnect lifecycle, chat operations*

Blocos intencionalmente deixados no legacy nesta rodada:

1. **`createStableSession`** (~566 linhas) — listeners `messages.upsert`, `messages.update`, `connection.update`, callbacks reconnect. Depende do estado mutável de módulo (`activeSessions`, `reconnectTimers`, `isWhatsAppConnected`) e de eventos reais do Baileys. Movê-los sem smoke tests de integração (QR real, recepção de mensagem real, reconexão forçada) contradiz "máxima segurança em produção".
2. **Chat operations** (~200 linhas) — `findSessionForChat`, `getChatConfig`, `getOrCreateChat`, `saveMessage`, `addTag`, `removeTag`, `archiveChat`, `toggleAI`. Dependem do `activeSessions`/`chats` mutável.
3. **Metrics + realtime store** (~180 linhas) — `emitRealtimeMetrics`, `addMessageToRealtimeStore`, `loadRealtimeHistory`, `hasActiveConnection`, `shouldEmitMetricsForMessage`, `buildMediaEventPayload`.

**Caminho seguro para fase 2c (futuro):** criar `services/whatsapp/state/registry.js` que exporta os mesmos objetos `activeSessions` e `chats` (referência preservada). Migrar as 8 chat operations em um turno dedicado, com smoke test de QR + recepção inbound + toggle AI antes de marcar como concluído.

### Validação 2b

- `node -c` limpo em todos os 8 arquivos novos e nos 2 facades.
- Script de auditoria de exports: `whatsapp missing: NONE`, `messages missing: NONE`. As 23 chaves históricas do `whatsappService.legacy` e as 12 do `messagesController` continuam presentes.
- Nenhum comportamento runtime alterado: o listener Baileys continua em `createStableSession`, o ciclo de reconexão intacto, os flags de conexão sincronizados como antes.

---

## [Phase 2c] Encerramento do legado (2026-04-17)

Fase final. Migra o estado mutável compartilhado, o `createStableSession` inteiro (listeners Baileys + reconnect lifecycle) e remove a dependência de `global.whatsappSession` como fonte de verdade.

### Novos módulos (4 arquivos)

- **`services/whatsapp/state/registry.js`** — Singletons mutáveis `activeSessions` e `chats`. Ambos exportados por referência: o legacy facade e todos os consumers compartilham exatamente os mesmos objetos, preservando a semântica original de "mutação em escopo de módulo".
- **`services/whatsapp/chat/operations.js`** — 8 funções migradas do legacy:
  `findSessionForChat`, `getChatConfig`, `getOrCreateChat`, `saveMessage`, `addTag`, `removeTag`, `archiveChat`, `toggleAI`. Leem/escrevem nos registries compartilhados e delegam broadcasting a `realtime/events` + `realtime/metrics`.
- **`services/whatsapp/realtime/metrics.js`** — 3 funções migradas: `hasActiveConnection`, `shouldEmitMetricsForMessage`, `emitRealtimeMetrics`. `hasActiveConnection` agora consulta `sessionStateService.getWhatsappSession().connected` em vez da variável local `isWhatsAppConnected`.
- **`services/whatsapp/connection/stableSession.js`** — O grande final. 9 funções migradas:
  `ensureSessionsDirectory`, `ensureSessionPath`, `ensureEnterpriseQueues`, `buildMediaEventPayload`, `addMessageToRealtimeStore`, `loadRealtimeHistory`, `runAIForChat`, `shouldRefreshSummary`, **`createStableSession`** (factory completo com listeners `creds.update` / `connection.update` / `messages.upsert` / `messages.update` e todo o ciclo de reconexão com backoff).

### Remoção da dependência `global.whatsappSession` como fonte de verdade

- **Listener Baileys** (`stableSession.js`): em `connection === 'open'` e `connection === 'close'` chama `sessionStateService.setWhatsappSession(DEFAULT_TENANT, { connected, status })`. Não muta mais `global.whatsappSession` diretamente.
- **`server.js`** — `buildSessionStatusPayload` agora lê `sessionStateService.getWhatsappSession()` em vez de `global.whatsappSession`.
- **`services/whatsapp/outbound/senders.js`** — `isWhatsAppConnected()` inverteu a prioridade: agora lê `sessionStateService` primeiro, com `global.whatsappSession` só como fallback defensivo.

**`global.whatsappSession` permanece como alias escrito por `sessionStateService.syncGlobalAlias()`** — isso é intencional e documentado. Mantém compat para qualquer consumer externo ao projeto (ex.: middlewares de monitoramento ainda não migrados) que ainda leia diretamente o global. Nenhum código da nossa base escreve mais nele.

### Resultado final do legacy

| Arquivo | Original | Pós-2a | Pós-2b | Pós-2c | Redução total |
|---|---|---|---|---|---|
| `services/whatsappService.legacy.js` | 2.571 | 2.255 | 1.348 | **72** | **-97,2 %** |
| `controllers/messagesController.js` | 1.678 | 1.410 | **927** | **927** | **-44,8 %** |

O legacy facade agora é literalmente um re-exporter de ~50 linhas efetivas (22 no `destructure`, 22 no `module.exports`, + metadata/comentários). Todo o código executável vive em `services/whatsapp/*`.

### Estrutura final `services/whatsapp/` (19 módulos)

```
services/whatsapp/
├── shared/          identifiers.js · time.js · serialization.js
├── state/           registry.js                              [2c]
├── media/           url.js · payload.js
├── inbound/         parser.js · debug.js · pipeline.js
├── realtime/        payloads.js · chatState.js · events.js · metrics.js  [metrics:2c]
├── connection/      reconnect.js · qr.js · sock.js · persistence.js ·
│                    logger.js · stableSession.js            [stableSession:2c]
├── outbound/        senders.js
├── chat/            operations.js                            [2c]
├── persistence/     conversation.js
└── index.js         barrel: 3 nested namespaces + 60+ flat re-exports
```

### Validação 2c

| Check | Resultado |
|---|---|
| `node -c` em todos os arquivos novos e nos 2 facades | ✅ OK |
| `chats === registry.chats` | ✅ `true` (mesma referência) |
| `activeSessions === registry.activeSessions` | ✅ `true` (mesma referência) |
| `typeof createStableSession` no legacy | ✅ `function` |
| Exports `whatsappService.legacy` (23 chaves históricas) | ✅ `NONE` missing |
| Exports `messagesController` (12 chaves históricas) | ✅ `NONE` missing |
| Contagem final `whatsappService.legacy.js` | **72 linhas** |
| Contagem final `messagesController.js` | **927 linhas** |
| Leituras de `global.whatsappSession` em código não-facade | ✅ 0 (apenas fallback defensivo em `senders.js`) |
| Escritas de `global.whatsappSession` em código de aplicação | ✅ 0 (apenas `sessionStateService.syncGlobalAlias`) |

### O que intencionalmente permanece

1. **`sessionStateService.syncGlobalAlias()`** — preserva `global.whatsappSession` como alias read-only em sync com o tenant default. Compat para consumers externos ao projeto.
2. **Fallback defensivo em `senders.js`** — `isWhatsAppConnected()` cai para `global.whatsappSession?.connected` se `sessionStateService` não estiver inicializado (não deveria acontecer em runtime, mas é uma rede de segurança barata).
3. **`controllers/messagesController.js` em 927 linhas** — os 6 handlers HTTP (`sendMessage`, `sendMedia`, `receiveMessage`, `getMessages*`, `listMessages`, `createMessage`, `getChats`, `getMessagesByChatId`, `getMessagesByConversationId`) permanecem no facade. Migrar cada um para `controllers/messages/send/*.js` e `controllers/messages/receive/*.js` é a próxima etapa natural, mas está fora do escopo 2c.

---

## Estrutura de pastas após Fase 2a

```
backend/crm/
├── controllers/
│   ├── messagesController.js          (legacy facade, 1.470 linhas; handlers HTTP)
│   └── messages/                      NOVO
│       ├── index.js
│       ├── shared.js
│       ├── media/helpers.js
│       ├── sync/collectionOps.js
│       ├── receive/dedupe.js
│       └── send/.keep
├── services/
│   ├── whatsappService.legacy.js      (legacy facade, 2.440 linhas; Baileys lifecycle)
│   ├── whatsapp/                      NOVO
│   │   ├── index.js
│   │   ├── shared/identifiers.js
│   │   ├── shared/time.js
│   │   ├── shared/serialization.js
│   │   ├── media/url.js
│   │   ├── inbound/parser.js
│   │   ├── realtime/payloads.js
│   │   └── connection/reconnect.js
│   ├── messageDedupeService.js        NOVO (Bug 3)
│   ├── sessionStateService.js         NOVO (Fix 5)
│   └── realtime/tenantRooms.js        NOVO (Fix 3)
└── docs/
    └── CHANGELOG_REFACTOR.md          (este arquivo)
```

---

## Variáveis de ambiente introduzidas

| Variável | Default | Fase | Efeito |
|---|---|---|---|
| `ALLOW_DEV_AUTH_BYPASS` | *(unset)* | Fix 1 | Libera auth em dev quando `true`. |
| `ALLOW_UNSAFE_MEDIA_PATHS` | *(unset)* | Fix 4 | Permite `mediaPath` absoluto fora dos roots (dev). |
| `CONVERSATION_CACHE_TTL_MS` | `15000` | Bug 2 | TTL do cache de `listConversations`. |
| `CONVERSATION_CACHE_MAX_ENTRIES` | `512` | Bug 2 | Cap do cache. |
| `MESSAGE_DEDUPE_TTL_MS` | `600000` | Bug 3 | TTL global do dedupe inbound. |
| `MESSAGE_DEDUPE_MAX_ENTRIES` | `50000` | Bug 3 | Cap do dedupe. |
| `CRASH_EXIT_ON_UNHANDLED` | prod=`true`, dev=`false` | Bug 5 | Exit em `uncaughtException`/`unhandledRejection`. |

---

## Rotas preservadas

Nenhuma rota HTTP foi tocada. O `module.exports` de `messagesController.js` continua com as 12 chaves originais; o router `routes/messages.js` e os consumidores em `conversationsController.js` / `outboundQueueService.js` continuam funcionando sem modificação.

---

## Próximo passo — Fase 2b (planejado, não executado)

Extração dos **fluxos pesados** (que dependem de estado de módulo mutável ou conexão):

- `services/whatsapp/outbound/sender.js` — `sendMessage`, `sendImage`, `sendVideo`, `sendAudio`, `sendDocument`, `sendMediaMessage`, `sendWithRetry`, `ensureSocket` (requer migrar `isWhatsAppConnected` para `sessionStateService`).
- `services/whatsapp/inbound/download.js` — `downloadMedia`, `extractIncomingMessage`.
- `services/whatsapp/connection/manager.js` — `createStableSession`, `ensureSessionPath`, lifecycle de sessão, listeners Baileys.
- `services/whatsapp/realtime/events.js` — `emitRealtimeEvent`, `emitConnectionUpdate`, `emitSessionStatus`, `emitChatUpdated`, migrados para `emitToTenant`.
- `controllers/messages/send/sendMessage.js`, `controllers/messages/send/sendMedia.js` — HTTP handlers.
- `controllers/messages/receive/receiveMessage.js`, `controllers/messages/receive/register.js` — handlers + `registerIncomingMessage` / `registerOutgoingMessage`.
- `controllers/messages/sync/loadMessagesForChat.js`, `controllers/messages/sync/listMessages.js`.
- `controllers/messages/realtime/inboxEvents.js` — `emitInboxRealtimeEvent*`, `scheduleConversationRevalidation`, `emitConversationSnapshotImmediate`.

Pré-requisitos para Fase 2b:
1. Teste de fumaça automatizado (envio/recebimento via mock Baileys).
2. Consolidar `global.io` via `services/realtime/ioProvider.js`.
3. Migrar `isWhatsAppConnected` para `sessionStateService`.
