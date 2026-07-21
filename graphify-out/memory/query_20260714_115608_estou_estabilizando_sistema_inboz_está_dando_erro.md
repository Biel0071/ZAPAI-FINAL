---
type: "query"
date: "2026-07-14T11:56:08.420471+00:00"
question: "estou estabilizando sistema inboz está dando erro ao enviar mensagem corrigir"
contributor: "graphify"
outcome: "useful"
source_nodes: ["useInboxState()", "apiService", "sendMessage()", "messagesController.js", "senders.js"]
---

# Q: estou estabilizando sistema inboz está dando erro ao enviar mensagem corrigir

## Answer

Expanded from original query via graph vocab: [inbox, sendmessage, createmessage, messageservice, outbound, whatsapp, conversation, api, socket, realtime]. The send path is useInboxState -> apiService /api/send-message -> messagesController -> WhatsApp sender. Fixed duplicate submissions while sending, required a connected session before clearing the draft, preserved the backend session registry id instead of the display name, and made the explicit Inbox recipient take precedence over stale DB conversation mappings. TypeScript, production build, and backend syntax checks passed.

## Outcome

- Signal: useful

## Source Nodes

- useInboxState()
- apiService
- sendMessage()
- messagesController.js
- senders.js