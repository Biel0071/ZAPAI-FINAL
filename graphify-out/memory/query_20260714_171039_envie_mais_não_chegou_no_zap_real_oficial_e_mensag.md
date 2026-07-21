---
type: "query"
date: "2026-07-14T17:10:39.704265+00:00"
question: "envie mais não chegou no zap real oficial e mensagens apagadas em 1 deve apagar em oturo ou vice versa funcionara real como normal"
contributor: "graphify"
outcome: "useful"
source_nodes: ["sendMessage", "senders", "ensureWhatsAppJid", "messageAckPipeline", "deleteMessage", "messagesController", "messageRepository", "stableSession"]
---

# Q: envie mais não chegou no zap real oficial e mensagens apagadas em 1 deve apagar em oturo ou vice versa funcionara real como normal

## Answer

Expanded from original query via graph vocab: [sendMessage, senders, ensureWhatsAppJid, lidMapper, messageAckPipeline, deleteMessage, messagesController, messageRepository, stableSession]. The graph traced outbound routing through sendMessage/senders and ACK handling through messageAckPipeline/stableSession, while deleteMessage only removed the local database row. Implemented authoritative WhatsApp LID verification, required server ACK before reporting success, persisted WhatsApp message keys, revoked outbound messages through Baileys, and synchronized incoming revoke protocol events back to the Inbox. Commit 4f7c25c was deployed to VPS 209.50.241.22; health, database, runtime, PM2, and WhatsApp connection are online. A user-triggered new message is still required for end-to-end recipient confirmation.

## Outcome

- Signal: useful

## Source Nodes

- sendMessage
- senders
- ensureWhatsAppJid
- messageAckPipeline
- deleteMessage
- messagesController
- messageRepository
- stableSession