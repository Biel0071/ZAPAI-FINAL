---
type: "query"
date: "2026-07-14T16:38:27.163113+00:00"
question: "erro e sistema não envia mensagem está travadoo"
contributor: "graphify"
outcome: "useful"
source_nodes: ["sendMessage()", "ensureWhatsAppJid()", "conversationRepository", "MasterVersions.tsx"]
---

# Q: erro e sistema não envia mensagem está travadoo

## Answer

Expanded from original query via vocab: sendmessage messagescontroller senders ensurewhatsappjid conversationrepository consolidatelidconversations messageackpipeline versions deployments. Logs proved the contact uses 153343318048786@lid while outbound routing downgraded 553193807167 to @s.whatsapp.net. Restored phoneToLidMap routing, preserved explicit LIDs, passed chatId for text/media, exposed remote JID in conversation payloads, and moved authenticated read-only version history before the admin-only middleware. Tests, TypeScript, production build, deploy, PM2 health, 471 LID mappings, connected material session, and live outbound target resolution were verified.

## Outcome

- Signal: useful

## Source Nodes

- sendMessage()
- ensureWhatsAppJid()
- conversationRepository
- MasterVersions.tsx