# SYSTEM ARCHITECTURE

## Overview

This repository is split into two top-level modules:

- `zapai-crm`: the SaaS CRM product (APIs, websocket, frontend, business workflows).
- `zapai-engine`: reusable AI orchestration engine (agents, memory, providers, adapters, orchestration runtime).

The CRM remains the product runtime and consumes the engine through an explicit integration layer.

## CRM Layer (`zapai-crm`)

The CRM layer contains:

- API and runtime boot: `zapai-crm/server.js`, `zapai-crm/api/`, `zapai-crm/routes/`.
- Domain services and controllers: `zapai-crm/controllers/`, `zapai-crm/services/`, `zapai-crm/repositories/`, `zapai-crm/workers/`.
- Supporting infrastructure: `zapai-crm/config/`, `zapai-crm/middleware/`, `zapai-crm/store/`, `zapai-crm/realtime/`, `zapai-crm/uploads/`.
- Product UI: `zapai-crm/frontend/`.
- Product docs: `zapai-crm/docs/`.

Root compatibility keeps `server.js` at project top-level for `npm start`.

Additional runtime entrypoints are organized by functionality in `entrypoints/`:

- `entrypoints/api.js`
- `entrypoints/localRuntimeAgent.js`

The test configuration is also grouped inside `tests/jest.config.js`.

## AI Engine Layer (`zapai-engine`)

The engine is reusable and project-agnostic. Main folders:

- `zapai-engine/core/`
- `zapai-engine/agents/`
- `zapai-engine/memory/`
- `zapai-engine/providers/`
- `zapai-engine/interfaces/`
- `zapai-engine/adapters/`
- `zapai-engine/dev-engine/`

Public API exposed by `zapai-engine/index.js`:

- `createEngine(options)`
- `processEvent(event)`
- `registerAgent(kind, agent)`

## Integration Flow (CRM -> Engine)

CRM integration entrypoints:

- `zapai-crm/backend/ai/AIEngineClient.js`
- `zapai-crm/backend/ai/AIEventBridge.js`

Flow:

1. CRM receives inbound event (message, context, metadata).
2. CRM service calls `AIEventBridge.processEvent(event, options)`.
3. Bridge resolves engine instance via `AIEngineClient.getEngineClient(...)`.
4. Engine runs orchestration (`processEvent`) and returns response/actions.
5. CRM applies actions (message send, updates, stage changes) through existing CRM services.

## Compatibility Guarantees

This modularization keeps existing behavior intact for:

- message routes and message persistence pipeline
- conversation routes and lifecycle
- websocket events (`new_message`, `message:new`, etc.)
- AI response pipeline through the new CRM integration bridge

The root startup command (`npm start`) remains valid through compatibility wrappers while architecture ownership is now explicit.
