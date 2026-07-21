---
type: "query"
date: "2026-07-14T15:16:52.923614+00:00"
question: "mensagem não está enviando fiz algumas modificações recentes e não está funcionando inbox apenas recebendo mensagens e refresh de conexões sistema ao logar ativar também"
contributor: "graphify"
outcome: "useful"
source_nodes: ["sessionRecoveryService", "startSession", "reconnectSession", "RuntimeProvider", "useAdminAuth", "stableSession"]
---

# Q: mensagem não está enviando fiz algumas modificações recentes e não está funcionando inbox apenas recebendo mensagens e refresh de conexões sistema ao logar ativar também

## Answer

Expanded from graph vocab: inbox, sendmessage, messagescontroller, senders, sessionrecoveryservice, recoversessions, login, refresh, runtimeprovider, connections, stablesession, whatsapp. A VPS mostrou closeCode 500 e material offline. O recovery chamava startSession sem forceNew; startSession devolvia a instância desconectada e não recriava o socket. Corrigido para reconnectSession force=true com deduplicação e cooldown, e recuperação não bloqueante após login. Após deploy a sessão material conectou novamente.

## Outcome

- Signal: useful

## Source Nodes

- sessionRecoveryService
- startSession
- reconnectSession
- RuntimeProvider
- useAdminAuth
- stableSession