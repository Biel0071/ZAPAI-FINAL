# Project: ZAPFLOW Production Stabilization & Polish

## Architecture
ZAPFLOW is a full-stack WhatsApp automation and multi-agent CRM system.
- **Frontend (`frontend-official/`)**: React 18 + Vite + Tailwind CSS + Radix UI + Lucide/Phosphor Icons + Socket.IO client.
- **Backend (`backend/`)**: Node.js + Express + Socket.IO + Baileys (@whiskeysockets/baileys) + PostgreSQL (pg / Prisma) + Redis.
- **Session Layer (`backend/services/whatsapp/`)**: Multi-device WhatsApp socket management via Baileys, auth credentials storage, reconnection state machine, and session watchdog.
- **Commerce & Sync Layer (`backend/services/commerce/`, `backend/src/api/controllers/productsController.js`)**: Real-time catalog extraction, order message interception, and Pix billing engine.
- **Real-time Gateway (`backend/services/websocketGateway.js`, `backend/realtime/`)**: Socket.IO event multiplexer for real-time state, chats, messages, and commerce.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1.1 | Canonical Session Path Alignment | Unify session directory across `stableSession.js`, `sessionManager.legacy.js`, `connectionService.legacy.js`, `sessionPersistenceValidator.js`, and QA scripts to `<root>/data/sessions` | M1 | Survey (explorer_survey_1) |
| F1.2 | Session Persistence & Auto-Restore on Boot | Ensure valid `creds.json` enables automatic restoration on server boot without QR re-scanning; fix company ownership fallback | M1 | Survey (explorer_survey_1) |
| F1.3 | Connection & Reconnection State Machine | Standardize disconnect codes (401 logout vs 408/428/500/515 transient backoff), harmonize reconnect delays, and eliminate socket leaks | M1 | Survey (explorer_survey_1) |
| F1.4 | Real-time Session State Broadcasting | Broadcast session status (`connecting`, `connected`, `disconnected`, `qr`) reliably across Socket.IO and update PostgreSQL `sessions` | M1 | Survey (explorer_survey_1) |
| F2.1 | Manual Sync UI Elimination | Remove all 10 manual sync buttons, modals, popups, and progress banners across frontend components (`WebBridgeCard`, `Connections`, `AgentTab`, `EvolutionTab`, `HistoryBootstrapPanel`, `Memory`, `ActiveChatPane`, `OrderSheetModal`) | M2 | Survey (explorer_survey_2) |
| F2.2 | Unified Silent Background Auto-Sync Coordinator | Automatically trigger catalog, cart order, and billing synchronization silently on Baileys connection (`connection === 'open'`) with zero blocking modals | M2 | Survey (explorer_survey_2) |
| F2.3 | Real-Time Commerce Data Streaming | Stream incoming WhatsApp catalog updates and orders to frontend reactively via Socket.IO (`catalog:synced`, `commerce:order_received`) without page reloads | M2 | Survey (explorer_survey_2) |
| F3.1 | Frontend Vitest Test Suite Restoration | Update outdated DOM selector queries in 5 failing Vitest files (`activeChatSheet`, `inboxReconstruction`, `conversationSearch`, `historyBootstrap`, `runtimeProviderRealtimeMessage`) to reach 100% pass (291/291) | M3 | Survey (explorer_survey_3) |
| F3.2 | TypeScript Typecheck & Build Cleanliness | Fix test mock type mismatches in `src/test/` and verify clean production build | M3 | Survey (explorer_survey_3) |
| F3.3 | WebSocket Gateway Deduplication | Deduplicate redundant `io.on('connection')` listeners between `server.js` and `websocketGateway.js` | M3 | Survey (explorer_survey_3) |
| F3.4 | Outbound Queue & Event Loop Optimization | Eliminate synchronous disk/SQL bottlenecks in outbound message queue processing | M3 | Survey (explorer_survey_3) |
| F3.5 | Backend Test Runner & Teardown Cleanliness | Provide unified backend test execution and PostgreSQL pool teardown | M3 | Survey (explorer_survey_3) |
| F4.1 | 100% E2E Test Suite & Adversarial Hardening | Verify all 4 tiers of E2E tests pass, then execute Tier 5 adversarial testing | M_FINAL | Survey / Pattern |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | `m1_whatsapp_session_stability` | Canonical session paths, auto-restore on boot, reconnect state machine, socket cleanup | none | DONE |
| M2 | `m2_silent_background_sync` | Eliminate 10 manual sync UI elements, implement `WhatsAppAutoSyncCoordinator` on connection, stream updates | M1 | DONE |
| M3 | `m3_performance_and_polish` | Restore 100% Vitest tests, fix typecheck, deduplicate socket handlers, optimize outbound queue | M2 | DONE |
| M_FINAL | `m_final_e2e_verification` | Pass 100% E2E test suite (Tiers 1-4) and adversarial coverage hardening (Tier 5) | M1, M2, M3, E2E Track | DONE |

## Interface Contracts
### `WhatsAppAutoSyncCoordinator` ↔ `stableSession.js`
- **Trigger**: `stableSession.js` emits internal event or invokes `WhatsAppAutoSyncCoordinator.onSessionConnected({ sessionId, companyId, sock })`.
- **Function Signature**:
  ```javascript
  async function onSessionConnected({ sessionId, companyId, sock }): Promise<{ catalogSynced: boolean, ordersSynced: boolean, billingSynced: boolean }>
  ```
- **Error Handling**: Non-blocking. Catches any catalog/orders error and logs warning without dropping the WhatsApp socket or throwing unhandled promise rejections.

### `stableSession.js` ↔ `sessionManager.legacy.js` / Persistence
- **Canonical Path Contract**:
  ```javascript
  const SESSIONS_DIRECTORY = process.env.WHATSAPP_SESSIONS_DIR || path.resolve(__dirname, '../../../../data/sessions');
  ```
- **Validation Contract**:
  `validateSession(sessionId)` MUST inspect the exact directory where `stableSession.js` writes `creds.json`.
- **Teardown Contract**:
  `disposeSession(sessionId, { deleteFolder })` MUST delete from the canonical directory, preventing orphaned auth loops.

### Real-Time Gateway ↔ Frontend Socket Manager
- **Events**:
  - `session_status`: `{ sessionId: string, status: 'connecting' | 'connected' | 'disconnected' | 'qr', qr?: string }`
  - `catalog:synced`: `{ sessionId: string, companyId: string, synced: number, total: number, products: Array<object> }`
  - `commerce:order_received`: `{ sessionId: string, companyId: string, orderId: string, order: object }`
- **UI Contract**: Frontend updates stores/state reactively with ZERO blocking modals, zero progress dialogs, and zero manual sync buttons.

## Code Layout
- `backend/services/whatsapp/connection/`: WhatsApp Baileys connection, stableSession, reconnect, persistence
- `backend/services/sessionManager.legacy.js`: Legacy session restore and multi-session coordination
- `backend/services/commerce/`: Native WhatsApp commerce, cart order listener, catalog extractor
- `backend/services/websocketGateway.js`: Socket.IO client gateway
- `backend/tests/`: Node native test suites for backend services
- `frontend-official/src/components/connections/`: Connection cards, QR modals, session status displays
- `frontend-official/src/pages/`: Main application pages (Connections, Inbox, AI, Memory, Products)
- `frontend-official/src/test/`: Vitest frontend component tests
