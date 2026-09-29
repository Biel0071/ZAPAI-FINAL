# Architecture Modularization Plan (ZAPAICRM + ZAPAI ENGINE)

## 1. Repository Architecture Analysis

### Current architecture (observed)
- API surface is route-controller-service-repository oriented.
- Runtime entrypoint concentrates bootstrapping and orchestration in `server.js`.
- Messaging flow spans `services/whatsappService.js`, `controllers/messagesController.js`, and repositories.
- AI is now partially decoupled through `services/aiResponseEngine.js` into `zapai-engine/`.
- Realtime emissions are mostly direct via Socket.IO references in controllers/services.
- Background processing is mostly timer-driven from runtime/system services, not queue-driven.

### Domain map (current to target)
- Messaging: `routes/messages.js`, `controllers/messagesController.js`, `services/messageService.js`, `services/whatsappService.js`.
- Conversations: `routes/conversations.js`, `controllers/conversationsController.js`, `repositories/conversationRepository.js`.
- Contacts: `routes/contacts.js`, `controllers/contactsController.js`, `repositories/contactRepository.js`.
- Campaigns/Automation: `routes/automation.js`, `controllers/automationController.js`, `services/campaignEngine.js`, `services/campaignRuntime.js`, `services/automationService.js`.
- Analytics: `routes/analytics.js`, `controllers/analyticsController.js`, `services/analyticsService.js`, `services/metricsTracker.js`.
- AI integration: `services/aiResponseEngine.js` and `ai/integration/engineClient.js` connected to `zapai-engine/`.

## 2. Detected Technical Debt

- High coupling in messaging path due to broad responsibility concentration in `services/whatsappService.js`.
- Global/shared mutable state (`global.io`, `app.locals.store`) leaks dependencies across layers.
- Some synchronous enrichment/business logic in message handling path increases tail latency risk.
- Realtime event aliases and multiple emissions can create duplicate frontend processing burden.
- Worker model is not yet explicit for high-throughput jobs (campaign loops, heavy analytics, enrichment).
- Persistence maturity differs by domain; some features rely heavily on runtime state and fallbacks.

## 3. Module Reorganization Proposal

### Introduced non-breaking modular skeleton
- `modules/messaging/index.js`
- `modules/conversations/index.js`
- `modules/contacts/index.js`
- `modules/campaigns/index.js`
- `modules/automation/index.js`
- `modules/analytics/index.js`

### Introduced service layer facades (target naming)
- `services/messagingService.js`
- `services/conversationService.js`
- `services/campaignService.js`
- Existing `services/automationService.js` remains compatible.

### Introduced platform layers
- Realtime abstraction point: `realtime/socketServer.js`
- Worker entrypoints: `workers/messageWorker.js`, `workers/campaignWorker.js`
- AI integration boundary: `ai/integration/engineClient.js`

### Compatibility behavior
- Existing routes and controllers are preserved.
- Existing messaging pipeline remains active.
- `services/aiResponseEngine.js` keeps the same public contract while delegating to AI integration layer.

## 4. Safe Refactor Steps (Phased)

1. Phase A: Structural wrappers (completed)
- Keep all existing route handlers unchanged.
- Add module and service facades as composition boundaries.
- Add AI integration client between CRM and ZAPAI ENGINE.

2. Phase B: Dependency inversion for realtime
- Replace direct `global.io` references progressively with injected emitter from `realtime/socketServer.js`.
- Keep compatibility assignment during migration to avoid regressions.

3. Phase C: Messaging decomposition
- Split `whatsappService` internals into focused collaborators:
  - transport/baileys bridge
  - persistence coordinator
  - enrichment pipeline
- Keep old exported methods as compatibility proxies until complete migration.

4. Phase D: Worker enablement
- Move expensive enrichment/campaign tasks behind worker interfaces first.
- Keep synchronous fallback path controlled by feature flag.

5. Phase E: Persistence hardening and observability
- Standardize repository APIs where needed.
- Add idempotency keys and duplicate guards for message/AI processing.
- Expand structured logging and health probes for workers and realtime.

## 5. Production-Readiness Suggestions

- Introduce feature flags for each migration seam (`AI_ENGINE_V2`, `ASYNC_ENRICHMENT`, `EVENTBUS_EMITTER`).
- Add contract tests to lock existing API response shape before deep refactors.
- Add idempotency guard for outbound auto-replies keyed by message/conversation tuple.
- Add queue-backed workers for campaign and enrichment with retries and dead-letter strategy.
- Add operational telemetry:
  - queue lag
  - message processing latency
  - AI generation latency
  - socket emit failures
- Add rollout strategy:
  - canary deployment
  - reversible toggles
  - fallback to sync paths on dependency outage

## Target Backend Structure

```
modules/
  messaging/
  conversations/
  contacts/
  campaigns/
  automation/
  analytics/

services/
  messagingService.js
  conversationService.js
  campaignService.js
  automationService.js

realtime/
  socketServer.js

workers/
  messageWorker.js
  campaignWorker.js

ai/
  integration/
    engineClient.js
```

This plan keeps external APIs stable while progressively reducing coupling between messaging, CRM, and AI.
