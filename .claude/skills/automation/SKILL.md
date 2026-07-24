---
name: automation
description: Use ao trabalhar com filas, workers e automação do ZAPFLOW — outbound queue, workers, cron, retry, dead-letter, webhooks e o pipeline de resposta da IA. Aciona em disparo de campanhas, agendamentos, ou mudanças no automationEngine.
---

# Automation Skill

## Estado real (importante)

O projeto usa **fila file-based** (`outboundQueueService`, `data/outbound_queue.json`) como padrão, mais `enterprise/queue-service`. **BullMQ/ioredis/redis são `optionalDependencies`** (flag `ENABLE_QUEUE_LEGACY`), NÃO o caminho ativo. Não assumir BullMQ sem confirmar a flag.

## Componentes

- **Fila outbound:** `outboundQueueService.js` — enqueue, processOneItem, backoff, dead-letter, executeOutbound (resolve socket da sessão e envia via Baileys).
- **Workers:** `workerSupervisor` gerencia (setInterval, não cron externo): ack_reconciliation (120s), ai_memory_flush (15min), session_watchdog (180s), connection_recovery (25s), message_retention (24h).
- **Pipeline de resposta IA:** `automationEngine.processMessage()` — 12 passos: toggle global → toggle linha → human takeover → lead bloqueado → horário comercial → agente ativo → escalação → config IA → contexto → geração → pós (memória/learning) → envio fragmentado com delays.
- **Campanhas:** `campaignDispatchEngine.js` (disparo anti-ban, throttle, retry).
- **Reativação:** `reactivationService.js` (mensagens fora de horário).

## Regra

Delays humanizados no envio (anti-ban) são intencionais — não remover. Retry/dead-letter existentes; não duplicar lógica de fila. Se for migrar para BullMQ de fato, é mudança de arquitetura (justificar, skill `architect`).
