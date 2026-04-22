# Intelligent Service Architecture

## 1. Objective

This document defines a production architecture for intelligent customer service with:

- Agentic automation for triage and execution
- Human-in-the-loop (HITL) supervision
- Realtime Inbox operation
- Safe fallback between live and contingency runtime

The architecture is aligned with the current project structure and contracts in `zapai-crm`.

## 2. Core Principles

- Modular boundaries: gateway, orchestration, intelligence, supervision
- Explicit runtime state per conversation (`ai_active`, `human_active`, `paused`, `closed`)
- Contract-first API (`success`, `data`, `error` envelope)
- Realtime as acceleration channel, not single source of truth
- Guardrails for loops, abuse, and uncontrolled autonomous actions

## 3. Layered Architecture

### Layer A: Message Gateway

Responsibilities:

- Receive inbound WhatsApp events
- Normalize payloads
- Route to orchestrator pipeline

Current project mapping:

- `services/whatsappService.js`
- `controllers/messagesController.js`
- `server.js` (socket, route binding, lifecycle)

External option:

- Evolution API webhook input can be introduced as an alternate ingress adapter.

### Layer B: Orchestration and Routing

Responsibilities:

- Identify content type (text, audio, media)
- Resolve tenant and session context
- Check pause/handoff status
- Trigger AI or human path

Current mapping:

- `backend/inbox/services/ConversationService.js`
- `backend/inbox/events/InboxRealtimeService.js`
- `services/sessionManager.js`
- `services/systemManager.js`

### Layer C: Intelligence and Memory

Responsibilities:

- Prompt strategy and policy control
- Context retrieval (short-term + long-term)
- Response generation with confidence and action intent

Current mapping:

- `services/aiResponseEngine.js`
- `services/aiLearningEngine.js`
- `controllers/aiController.js`
- `config/promptManager.js`

RAG extension path:

- Add vector retrieval adapter before generation.
- Inject relevant snippets into system context only when similarity threshold is met.

### Layer D: Supervision and HITL

Responsibilities:

- Human takeover state machine
- Manual response override
- Pause timer and auto-resume
- Audit trail

Current mapping:

- `frontend/src/modules/inbox/*`
- `controllers/conversationsController.js`
- `realtime/socketServer.js`

## 4. Conversation State Machine

Recommended finite states:

- `triage`
- `ai_active`
- `human_active`
- `waiting_human`
- `paused_ai`
- `closed`

Required transitions:

- `triage -> ai_active` when policy allows automation
- `ai_active -> human_active` on explicit transfer or low confidence
- `human_active -> paused_ai` while operator is active
- `paused_ai -> ai_active` after timeout
- `* -> closed` on explicit end

Suggested timeout constant:

- `HUMAN_TIMEOUT_MS = 7200000` (2h), configurable by tenant.

## 5. HITL Operational Rules

When human takes over:

- Set conversation flag `humanActive = true`
- Block autonomous sends from AI
- Keep collecting context and analytics in background

On human inactivity timeout:

- Set `humanActive = false`
- Re-enable AI responses
- Emit realtime event indicating resumed automation

## 6. API Contract Standard

All JSON responses should follow:

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

Error example:

```json
{
  "success": false,
  "data": null,
  "error": "No connected WhatsApp session is available."
}
```

Current implementation status:

- Envelope middleware is active in `middleware/apiEnvelope.js`
- Unified response wrapping is active in `server.js`

## 7. Realtime Event Contract

Canonical events:

- `message:new`
- `conversation:update`
- `typing:start`
- `typing:stop`
- `handoff:requested`
- `handoff:accepted`
- `handoff:released`

Compatibility aliases can be emitted while migrating old consumers:

- `new_message`
- `conversation_updated`

## 8. Guardrails and Loop Prevention

Mandatory controls:

- Reject bot-to-bot loops by source metadata check
- Limit agent action iterations per request (`maxIterations`)
- Add per-conversation cooldown for repeated tool calls
- Fail safe on repeated uncertain outputs and escalate to human

Recommended thresholds:

- Max autonomous turns without user intent progression: `N = 3`
- Max tool retries per action: `M = 2`
- Escalate to HITL when confidence < threshold or repeated ambiguity

## 9. Inbox Frontend Blueprint

The Inbox module already follows the target pattern:

- `types.ts`
- `inboxGateway.ts`
- `useInboxController.ts`
- `components/*`
- `InboxModule.tsx`

Same pattern is now applied across the system modules for consistency.

## 10. Reliability and Fallback

Runtime policy:

- `live` mode when APIs and session are healthy
- `mock/contingency` mode when upstream dependencies fail

Rules:

- Never render blank screen
- Always expose loading, error, empty, disabled states
- Keep operator visibility of current mode (`live` vs `mock`)

## 11. Security and Governance

- Tenant isolation with explicit `x-tenant-id`
- Rate limiting for write-heavy endpoints
- Structured audit logs for every AI decision path
- No hidden autonomous action without trace id and reason

## 12. Infrastructure Baseline (Self-hosted)

Suggested baseline:

- CPU: 4 vCPU
- RAM: 8 GB
- Storage: 160 GB NVMe
- OS: Ubuntu 22.04 LTS
- TLS enabled and monitored

Container stack recommendation:

- API + realtime service
- Workflow engine (optional n8n integration)
- Cache/session store (Redis)
- Relational DB + optional vector DB for RAG

## 13. Integration with n8n and Evolution API

If external orchestration is used:

1. Evolution API receives WhatsApp message
2. Webhook forwards normalized payload to n8n
3. n8n calls internal endpoints for state check and AI decision
4. Response routed back through messaging gateway
5. Handoff events sync with Inbox realtime channel

This keeps `zapai-crm` as source of truth while allowing workflow automation expansion.

## 14. Rollout Plan

Phase 1:

- Stabilize envelope contract and realtime schema
- Enforce module architecture in frontend

Phase 2:

- Add explicit HITL state table/flags in persistence
- Add handoff events and pause/resume automation

Phase 3:

- Introduce vector retrieval adapter for RAG
- Add confidence-based escalation policy

Phase 4:

- Add autonomous action tooling with strict guardrails
- Add full audit dashboards and cost controls

## 15. Success Metrics

- First response time (AI and human)
- Handoff latency
- Resolution rate without escalation
- Human override rate
- Loop prevention incidents
- Token and API cost per conversation

This architecture enables scalable autonomous service while preserving human control in sensitive interactions.
