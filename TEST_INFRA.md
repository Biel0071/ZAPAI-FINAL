# TEST_INFRA.md — ZAPFLOW End-to-End Test Infrastructure

## 1. Overview & Architecture

This document defines the architecture, test runners, execution contracts, and test matrices for the ZAPFLOW End-to-End (E2E) Opaque-box Test Suite.

The test suite validates Requirements **R1**, **R2**, and **R3** of the system:
- **R1: WhatsApp Multi-Device Session Instantiation & Connection Stability** (auto-reconnection, session persistence, canonical session paths, state broadcasts).
- **R2: Silent Automatic Background Synchronization** (zero manual sync UI, automatic background catalog/order/billing sync on connection, real-time Socket.IO streaming).
- **R3: Performance Optimization, Production Polish & Commercial Workflows** (order management lifecycle, quote-to-order conversion, PIX checkout calculations, database pool stability).

### Test Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     E2E Opaque-Box Test Runner                  │
│                     (node tests/e2e/run_all_e2e.js)             │
└──────────────┬──────────────────┬─────────────────┬─────────────┘
               │                  │                 │
       ┌───────▼───────┐  ┌───────▼──────┐  ┌───────▼──────┐
       │ Tier 1:       │  │ Tier 2:      │  │ Tier 3 & 4:  │
       │ Feature       │  │ Boundary &   │  │ Cross-Feature│
       │ Coverage      │  │ Corner Cases │  │ & Scenarios  │
       └───────┬───────┘  └───────┬──────┘  └───────┬──────┘
               │                  │                 │
┌──────────────▼──────────────────▼─────────────────▼─────────────┐
│                     Shared Test Harness                         │
│                  (tests/e2e/helpers/testHarness.js)             │
├────────────────────────┬─────────────────────┬──────────────────┤
│ Ephemeral HTTP Server  │ Socket.IO Client    │ Mock Baileys     │
│ (Express Routes API)   │ (Realtime Gateway)  │ Socket Generator │
├────────────────────────┴─────────────────────┴──────────────────┤
│ PostgreSQL DB Pool Client (zapai_crm) & Canonical Sessions Dir  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Testing Principles & Guidelines

1. **Requirement-Driven & Opaque-Box**:
   - Tests exercise public HTTP endpoints (`/api/sessions`, `/api/commerce`, `/api/quotes`, `/api/products`), real-time WebSocket events (`session_status`, `catalog:synced`, `commerce:order_received`), and the filesystem session persistence layer.
   - Tests do NOT rely on internal private methods or implementation details.

2. **Self-Contained & Isolated**:
   - Each test sets up its own isolated identifiers (e.g. `companyId = 'e2e_comp_' + Date.now()`).
   - Database records created during tests are cleaned up in teardown hooks.
   - Tests run in ephemeral environments with dynamic ports (port 0), preventing port collision.

3. **Zero Browser Dependency**:
   - Built entirely on native Node.js (`node:test`, `node:assert/strict`, native `fetch`, and `socket.io-client`).
   - Runs fast in local, CI, headless Linux, and Windows environments without Playwright/Chromium overhead.

4. **Unambiguous Exit Codes**:
   - Returns exit code `0` on 100% pass.
   - Returns exit code `1` on any failure.

---

## 3. 4-Tier Test Design Methodology & Coverage Matrix

| Tier | File Path | Focus | Test Cases Count | Requirements Covered |
| :--- | :--- | :--- | :---: | :--- |
| **Tier 1: Feature Coverage** | `tests/e2e/tier1_feature_coverage.test.js` | Primary behavior (happy path) in isolation | 18 | R1 (6), R2 (6), R3 (6) |
| **Tier 2: Boundary & Corner Cases** | `tests/e2e/tier2_boundary_corner.test.js` | Malformed payloads, timeouts, network drops, rapid bursts | 15 | R1 (5), R2 (5), R3 (5) |
| **Tier 3: Cross-Feature Combinations** | `tests/e2e/tier3_cross_feature.test.js` | Pairwise subsystem interactions & race conditions | 5 | R1 ↔ R2, R2 ↔ R3, R1 ↔ R3 |
| **Tier 4: Real-World Scenarios** | `tests/e2e/tier4_real_world_scenarios.test.js` | Realistic end-to-end customer & admin workflows | 5 | Full lifecycle R1 + R2 + R3 |
| **Tier 5: Adversarial Hardening** | `tests/e2e/tier5_adversarial_hardening.test.js` | White-box path traversal, creds corruption, flapping, auto-sync isolation | 23 | R1, R2, Robustness |
| **Total** | | | **66** | |

### Detailed Test Matrix

#### Tier 1: Feature Coverage (18 tests)
- **T1_R1_01**: Session directory writes to canonical `<root>/data/sessions/<sessionId>`.
- **T1_R1_02**: Valid `creds.json` enables restoration without QR regeneration.
- **T1_R1_03**: Transient disconnect codes (408, 515, 428) maintain reconnection state.
- **T1_R1_04**: Session status and health REST endpoints (`/api/sessions/status`, `/api/sessions/:id/health`).
- **T1_R1_05**: Explicit disconnect and connect controls (`/api/sessions/:id/disconnect-system`).
- **T1_R1_06**: Real-time session state broadcasting (`session_status`) via Socket.IO.
- **T1_R2_01**: Silent auto-sync coordinator triggered on `connection === 'open'`.
- **T1_R2_02**: Catalog sync engine extracts products and persists them into database.
- **T1_R2_03**: Cart order listener unwraps Baileys `orderMessage` into `customer_orders`.
- **T1_R2_04**: Real-time `catalog:synced` event streamed with item counts and payloads.
- **T1_R2_05**: Real-time `commerce:order_received` event streamed to CRM clients.
- **T1_R2_06**: Non-blocking error containment: remote IQ failures do not drop WhatsApp socket.
- **T1_R3_01**: Order creation endpoint (`POST /api/commerce/orders/create`) with calculated totals.
- **T1_R3_02**: Order confirmation flow (`POST /api/commerce/orders/:id/confirm`) updates status and logs.
- **T1_R3_03**: Order rejection flow (`POST /api/commerce/orders/:id/reject`).
- **T1_R3_04**: Commercial quote creation and acceptance auto-converting into `customer_orders`.
- **T1_R3_05**: Order sheet PIX calculation (5% cash discount, formatted instructions, funnel stage transition).
- **T1_R3_06**: Database connection pool stability under sequential and parallel loads.

#### Tier 2: Boundary & Corner Cases (15 tests)
- **T2_R1_01**: Corrupted / malformed `creds.json` recovery without server crash.
- **T2_R1_02**: Missing mandatory keys in credentials (`noiseKey`, `signedIdentityKey`, `registrationId`, `me`).
- **T2_R1_03**: Rapid burst reconnect requests (10 rapid requests handled without socket leak).
- **T2_R1_04**: Disconnect code 401 (Logged Out) cleans credentials without infinite retry loops.
- **T2_R1_05**: Reconnecting a non-existent session ID returns safe error envelope.
- **T2_R2_01**: Empty catalog sync payload (0 products) handled gracefully.
- **T2_R2_02**: Malformed `orderMessage` missing `orderId` or amounts assigns fallback defaults.
- **T2_R2_03**: Nested order in ephemeral/view-once wrapper unrolled properly.
- **T2_R2_04**: Large catalog payload (200+ products) sync within memory SLA.
- **T2_R2_05**: Ingesting duplicate WhatsApp orders handled idempotently.
- **T2_R3_01**: Order creation with missing phone returns 400 Bad Request.
- **T2_R3_02**: Order creation with empty items array returns 400 Bad Request.
- **T2_R3_03**: Accepting already accepted quote returns idempotent response.
- **T2_R3_04**: High discount / negative calculation clamped to zero minimum.
- **T2_R3_05**: Concurrent order creation burst under simultaneous connections.

#### Tier 3: Cross-Feature Combinations (5 tests)
- **T3_01**: Reconnection event triggered during active catalog background sync.
- **T3_02**: Incoming order message arriving while session socket is in disconnected state.
- **T3_03**: Simultaneous emission of `session_status` and `commerce:order_received` events.
- **T3_04**: Quote approval automatically triggers order creation and session dispatch.
- **T3_05**: Strict multi-tenant data and session isolation across separate companies.

#### Tier 4: Real-World Application Scenarios (5 tests)
- **T4_01**: Complete Client Onboarding -> Auto-Sync -> Order Creation -> PIX Checkout workflow.
- **T4_02**: Server Reboot Simulation: Session persistence from disk without QR re-scanning.
- **T4_03**: Quote Lifecycle to Official Order to Atendente Confirmation.
- **T4_04**: Live Catalog Update with Reactive Real-Time Order Ingestion.
- **T4_05**: Transient Connection Failure (Error 515) Recovery with Zero Data Loss.

---

## 4. Runner Invocation & CLI Usage

### Run All Tiers (Master Runner)
```bash
node tests/e2e/run_all_e2e.js
```

### Run Individual Tiers
```bash
# Tier 1 only
node --test tests/e2e/tier1_feature_coverage.test.js

# Tier 2 only
node --test tests/e2e/tier2_boundary_corner.test.js

# Tier 3 only
node --test tests/e2e/tier3_cross_feature.test.js

# Tier 4 only
node --test tests/e2e/tier4_real_world_scenarios.test.js

# Tier 5 (Adversarial Hardening)
node --test tests/e2e/tier5_adversarial_hardening.test.js
```

### Environment Configuration Flags
- `DATABASE_URL`: PostgreSQL connection string (defaults to `postgresql://zapai:zapai_password@localhost:5432/zapai_crm`).
- `WHATSAPP_SESSIONS_DIR`: Canonical sessions directory (defaults to `<root>/data/sessions`).
- `TEST_BASE_URL`: Optional URL to test against an external already-running server (if omitted, harness boots an ephemeral in-process server on an available port).

---

## 5. Exit Codes & CI Integration

- Exit code `0`: All test suites passed without failure.
- Exit code `1`: One or more tests failed, or unexpected unhandled rejection occurred.
