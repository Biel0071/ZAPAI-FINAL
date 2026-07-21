---
type: "query"
date: "2026-07-14T18:54:13.851032+00:00"
question: "foi uma vez quando envie da outra bugou e quando envio está retornando uma midia também dando alguns bugs no inbox entre envio, estabilizar"
contributor: "graphify"
outcome: "useful"
source_nodes: ["stableSession", "unwrapMessageContent", "extractMessageText", "persistInboundMessageFallback", "socketManager", "RuntimeProvider", "messageRepository"]
---

# Q: foi uma vez quando envie da outra bugou e quando envio está retornando uma midia também dando alguns bugs no inbox entre envio, estabilizar

## Answer

Confirmado por logs e banco: eventos de protocolo/multidispositivo encapsulados eram persistidos como media vazia e eventos auxiliares de mídia eram tratados pelo frontend como novas mensagens. Corrigidos unwrap de deviceSent/document/protocol, descarte defensivo de eventos vazios, consumo apenas de eventos canônicos e migração de limpeza. Testes, TypeScript, build, deploy e health aprovados no commit fb867af; zero placeholders inválidos e WhatsApp conectado.

## Outcome

- Signal: useful

## Source Nodes

- stableSession
- unwrapMessageContent
- extractMessageText
- persistInboundMessageFallback
- socketManager
- RuntimeProvider
- messageRepository