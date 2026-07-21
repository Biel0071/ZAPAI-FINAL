---
type: "query"
date: "2026-07-14T14:10:40.068409+00:00"
question: "envio mensagem do sistema VPS não vai não fica padrão vermelho sem envio ou verde se pessoa ler padrão como ofical e funcionando correto"
contributor: "graphify"
outcome: "useful"
source_nodes: ["messageAckPipeline", "stableSession", "RuntimeProvider", "appStore"]
---

# Q: envio mensagem do sistema VPS não vai não fica padrão vermelho sem envio ou verde se pessoa ler padrão como ofical e funcionando correto

## Answer

Expanded from original query via vocab: inbox, sendmessage, messageackpipeline, messagestatus, sent, delivered, read, failed, realtime, whatsapp. O pipeline rejeitava ACKs válidos quando o WhatsApp pulava estados intermediários e mapeava Baileys status 0 como pendente. Corrigido para aceitar apenas progressão monotônica com saltos, mapear 0 como failed, impedir regressão no store e exibir entregue neutro e lido verde.

## Outcome

- Signal: useful

## Source Nodes

- messageAckPipeline
- stableSession
- RuntimeProvider
- appStore