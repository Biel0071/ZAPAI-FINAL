---
name: whatsapp
description: Use ao trabalhar com a integração WhatsApp/Baileys do ZAPFLOW — sessões, QR, LID, mídia, presence, ACK, sync, history, status, PTT, multi-device. Aciona em bugs de conexão, mensagens não entregues, mídia, ou mudanças no pipeline inbound/outbound.
---

# WhatsApp Skill

Especialista em **Baileys** (WhatsApp não-oficial). Baileys é **stateful** → PM2 roda 1 instância (nunca cluster).

## Onde vive

- **Sessões:** `sessionManager.legacy.js` + `services/whatsapp/connection/stableSession.js` (2497 linhas — socket, QR, reconnect). Auth em `sessions/<nome>/` (useMultiFileAuthState).
- **Inbound:** `services/whatsapp/inbound/pipeline.js` — extract → download mídia → dedupe → persist → `automationEngine`.
- **Outbound:** `services/whatsapp/outbound/senders.js` + `outboundQueueService` (fila com delays humanizados).
- **Realtime:** `services/whatsapp/realtime/events.js` (emite `message:new` etc via Socket.IO).
- **LID:** `whatsapp_lid_mappings` (migration 021) + `shared/lidMapper` — mapear @lid ↔ @s.whatsapp.net. JIDs canônicos priorizados sobre @lid no outbound.

## Pontos de atenção

- **Reconnect:** códigos terminais (401 loggedOut, 440 replaced, 411, 403) NÃO reconectam; transientes (515, 428, 408) reconectam com backoff.
- **Sessão zombie:** auth dir vazio → limpa e precisa reescanear QR (tela Conexões). Não é bug de código.
- **Dedupe:** ring buffer por sessão + dedupe global por messageId (evitar duplicar no socket).
- **Mídia:** download via `enterpriseMediaService`, salva em disco, gera URL absoluta.
- **Human takeover:** `ConversationRuntimeService.setHumanTakeover` pausa IA por conversa (não usar métodos inexistentes — só os exportados).

Estado atual: sessão "material" precisa reconectar via QR.
