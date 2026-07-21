---
type: "query"
date: "2026-07-14T19:31:38.621175+00:00"
question: "prrimeira vez egunda travou sistema deixar real funcional estabilizar"
contributor: "graphify"
source_nodes: ["sendMessage,resolveRegisteredJid,ensureWhatsAppJid,lidMapper,messagesController,conversationRepository,auto-deploy"]
---

# Q: prrimeira vez egunda travou sistema deixar real funcional estabilizar

## Answer

Corrigido e publicado no commit 33be7c9. A falha era causada por revalidação transitória do LID no segundo envio, que gerava HTTP 422 falso, e por ordem incorreta no restart do PM2 que deixava processo órfão na porta 4025. O LID confirmado agora é reutilizado com cache e fallback seguro; o deploy para e remove o processo gerenciado antes de limpar a porta. Cinco testes passaram. VPS validada com um listener, PM2 online, zero reinícios, health 200 e WhatsApp conectado.

## Source Nodes

- sendMessage,resolveRegisteredJid,ensureWhatsAppJid,lidMapper,messagesController,conversationRepository,auto-deploy