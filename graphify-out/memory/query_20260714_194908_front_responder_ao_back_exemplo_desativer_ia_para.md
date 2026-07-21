---
type: "query"
date: "2026-07-14T19:49:08.500671+00:00"
question: "front responder ao back exemplo desativer IA para usuer no front desativar no back responder"
contributor: "graphify"
source_nodes: ["useInboxState,upsertConversationControl,conversationRepository,automationEngine,outboundQueueService,aiReplyGuard,runAIForChat,stableSession"]
---

# Q: front responder ao back exemplo desativer IA para usuer no front desativar no back responder

## Answer

Implementado e publicado no commit e30f454. O frontend agora só assume IA ON/OFF após a confirmação persistida da API. O backend revalida ai_enabled no banco no último instante antes de enviar respostas automáticas, cancela itens de fila quando a IA está desligada e também protege o caminho alternativo de texto/áudio durante geração ou digitação. Mensagens humanas não são bloqueadas. Build passou; testes locais e quatro testes na VPS passaram; PM2 online com zero reinícios, health 200 e WhatsApp conectado.

## Source Nodes

- useInboxState,upsertConversationControl,conversationRepository,automationEngine,outboundQueueService,aiReplyGuard,runAIForChat,stableSession