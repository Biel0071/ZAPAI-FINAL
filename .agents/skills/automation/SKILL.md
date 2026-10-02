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
- **Campanhas:** `campaignDispatchEngine.js` (disparo anti-ban, throttle, retry) e `campaignMaturationService.js` (maturação de chip, cálculo de metas diárias e progressão anti-ban em 5 fases).
- **Reativação:** `reactivationService.js` (mensagens fora de horário).

## Regras e Padrões Anti-Ban

1. **Cadência Humanizada (Anti-Ban):**
   - Delays humanizados no envio são intencionais — **nunca** remover ou substituir por loops síncronos sem intervalo.
   - Disparos em massa nunca devem utilizar intervalos fixos/mecânicos. O perfil seguro ("Sem Risco") deve empregar jitter estocástico (85s a 140s por contato), simulação de presença de digitação ativa (`composing` por 6s a 12s) e micropausas humanas variáveis (150s a 240s a cada 6 a 8 envios), distribuindo 60 envios em ~2 horas.
2. **Maturação Progressiva de Chip:**
   - Chips são avaliados em 5 fases de aquecimento (`campaignMaturationService.js`):
     - Fase 1 (Dias 1-2): 30 msgs/dia (Modo Seguro)
     - Fase 2 (Dias 3-4): 60 msgs/dia (Modo Seguro)
     - Fase 3 (Dias 5-7): 120 msgs/dia (Modo Equilibrado)
     - Fase 4 (Semana 2): 250 msgs/dia (Modo Equilibrado)
     - Fase 5 (Maduro 15d+): 500 msgs/dia (Escala Comercial)
3. **Consumo de API no Frontend:**
   - O `executeRequest` em `apiService.ts` auto-desempacota envelopes `{ success: true, data: T }`. Sempre consuma com fallback `const payload = res?.data || res` para compatibilidade universal.

