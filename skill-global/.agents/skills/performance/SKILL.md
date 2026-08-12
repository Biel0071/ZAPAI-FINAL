---
name: performance
description: Use ao investigar ou otimizar performance no ZAPFLOW — renderizações React, queries PostgreSQL, cache, filas, Node CPU/RAM, websockets. Aciona em lentidão, gargalos, ou antes de finalizar mudanças em caminhos quentes (inbox realtime, disparo de campanhas, dashboard).
---

# Performance Skill

## Analisar

- **Renderizações** — memoização (useMemo/useCallback), Zustand selectors estreitos, evitar re-render da árvore inteira. Inbox e Dashboard são os mais sensíveis.
- **Queries** — PostgreSQL via `pg`. Checar índices (migrations 011/028/031 são de performance), `EXPLAIN` em queries lentas (log de slow query >500ms em `config/database.js`), evitar N+1.
- **Cache** — `lib/requestCache` (frontend, TTL 30s), cache de prompt de IA (60s em `ai.service.js`).
- **Filas** — `outboundQueueService` (file-based) e `enterprise/queue-service`; backpressure em `backpressureController`.
- **Node CPU/RAM** — PM2 `max_memory_restart 900M`; `--max-old-space-size=1024`. Cuidar de leaks em timers/listeners de socket.
- **Websocket** — socket singleton compartilhado (`socketManager`), 1 subscriber → store. Não abrir múltiplos loops de poll.

## Regra

Medir antes de otimizar. Não micro-otimizar sem evidência de gargalo (a skill `karpathy` vale aqui também).
