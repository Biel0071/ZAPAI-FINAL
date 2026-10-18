# Walkthrough & Verification Record — Inbox AI & Order Sheet Automation

## Overview
This document records the end-to-end implementation and deep verification of the Order Sheet ("Ficha de Pedido / Orçamento") and Closing Workflow for ad traffic leads, alongside the 4-state visual indicators in the CRM Inbox.

## Key Components Implemented & Fixed
1. **Dynamic Quantity & Turn Revision (`backend/services/orderSheetService.js`)**:
   - Dynamic quantity extraction using `parseItemQuantity` for digit and word-based numbers (e.g., "duas caixas", "3 churrasqueiras").
   - Multi-turn revision: later customer messages override earlier delivery addresses and quantities.
   - Idempotent upsert: existing open sheets are updated in PostgreSQL rather than creating duplicate orphaned records.
   - Automatic tagging: attaches `'ficha_gerada'` upon quote generation.

2. **Attendant Quality Daemon (`backend/services/attendantQualityDaemon.js`)**:
   - Fixed bug where `tags.includes('ficha_gerada')` was prematurely treated as `isFinalized`, distorting metrics and blocking customer confirmation checks.
   - Decoupled `hasGeneratedSheet` from `isFinalized`.
   - Automated customer confirmation detector: calls `finalizeAttendanceWithSheet` when confirmation phrases ("sim", "confirmo", "pode fechar", "manda o pix") are detected.

3. **Orchestrator Closing Flow (`backend/src/ai/evolutionary/orchestrator.js`)**:
   - Integrated commercial closing logic: emits the formal price quote sheet when data is ready and auto-finalizes with `finalizeAttendanceWithSheet` upon customer confirmation utterances, smoothly passing control to the human attendant.

4. **Inbox 4-State Visual Indicators (`frontend-official/src/pages/Inbox/components/ConversationRow.tsx`)**:
   - **VERDE**: "chegou" (new lead / unread).
   - **AMARELO**: "rodando" (active AI conversation).
   - **VERMELHO**: "pausado" (paused / human takeover).
   - **AZUL PISCANDO**: "finalizado / aguarda pix" with dual-layer pulsing beacon, glowing `AGUARDA PIX` badge, and pulsating blue row border/shadow.

## Verification Commands & Output Evidence

### 1. Backend Integration Tests
```bash
node --test backend/tests/orderSheetAndAttendantQuality.test.js
```
- **Result**: 5/5 tests passed green.
  - Test 1: extractSheetDataFromConversation accurately parses customer name, neighborhood, city, and items.
  - Test 2: saveConversationSheet idempotently updates or inserts in PostgreSQL.
  - Test 3: finalizeAttendanceWithSheet tags `ficha_gerada`, `aguarda_pix`, `atendimento_finalizado`, sets `aiEnabled = false`.
  - Test 4: multi-turn conversational quantity and address revision.
  - Test 5: attendantQualityDaemon automatically detects customer confirmation and finalizes.

### 2. Frontend Vitest Suite
```bash
cd frontend-official && npm test -- --run
```
- **Result**: 37/37 test files passed (236/236 unit tests green).

### 3. Frontend Production Build
```bash
cd frontend-official && npm run build
```
- **Result**: Vite production bundle compiled with 0 errors (`dist/assets/index-40E01P1w.js`).

### 4. Production Deployment & Live Daemon Verification
- **VPS Host**: `root@209.50.241.22`
- **Git Commit**: `d7815a3a` on `codex/professional-inbox-ai`
- **Migration 042**: Verified applied.
- **OpenResty Sync**: Serving `/etc/icontainer/apps/openresty/openresty/www/zapai/index.html` referencing `index-40E01P1w.js`.
- **PM2 Service**: `pm2 reload zapflow-api` (online, PID 1300787).
- **Endpoint Check**:
  `curl -s http://127.0.0.1:4025/system/attendant-quality`
  ```json
  {
    "success": true,
    "data": {
      "success": true,
      "metrics": {
        "running": true,
        "adTrafficActive": true,
        "analyzedConversationsCount": 100,
        "leadsBreakdown": {
          "chegou": 58,
          "rodando": 3,
          "pausado": 36,
          "finalizado": 3
        },
        "attendantQualityScore": 98.7,
        "dataCollectionCompletenessAvg": 85.5,
        "conversionReadinessRate": 3,
        "sheetsGeneratedCount": 498,
        "awaitingPixCount": 3,
        "lastUpdated": "2026-10-17T01:48:21.830Z"
      }
    },
    "error": null
  }
  ```

## 5. AI Follow-up Cadence, WhatsApp Brevity & Anti-Delirium Hardening

### Changes Implemented & Critical Bugs Resolved
1. **AI Follow-up Progressive Cadence & Attempt 1 Detection in Live Chats**:
   - **Bug identified & resolved**: In live conversations where Camila/attendant answered the customer's question, the prior attempt counted the attendant's normal chat reply as a follow-up touch (`consecutiveAgentMsgs = 1`), jumping directly to Attempt 2, waiting 24 hours, and completely skipping Attempt 1 (4-6h check-in).
   - **Fix**: Accurately track follow-ups using conversation tags (`followup_toque_1`, `followup_toque_2`, `followup_toque_3`) and interaction timing. Live chats now properly trigger Attempt 1 after 4-6h of customer silence, Attempt 2 after 24h from Attempt 1, and Attempt 3 after 48h from Attempt 2.
   - **Auto-Deactivation upon 3rd Touch**: Executing Attempt 3 automatically tags `followup_toque_3`, `followup_esgotado`, `followup_desativado`, and removes `followup_ia_ativo`, capping strictly at 3 touches.
   - **Complete Tag Cleanup on Reply**: `resetFollowupOnCustomerResponse` now cleans all `followup_*` tags (`followup_toque_1`, `followup_toque_2`, `followup_toque_3`, `followup_ia_ativo`, `followup_esgotado`, `followup_desativado`), leaving zero stale tags.
   - **Terminal Purchase Auto-Deactivation**: If customer purchases or is in `aguardando_pix`, `finalizado`, `pago`, or `pedido_confirmado`, follow-up is immediately deactivated.

2. **WhatsApp Attendant Brevity & Bullet Item Inline Preservation**:
   - **Bug identified & resolved**: The prior `enforceResponseWordLimit` dropped all bullet lines if non-bullet lines existed, erasing product options from the customer's view (e.g. asking which option the customer wanted without displaying the options).
   - **Fix**: Formats bullet items inline as natural Portuguese text, removing markdown dashes while preserving the options.
   - **Robotic Boilerplate Stripping**: Automatically removes generic bot phrases ("Como posso te ajudar hoje?", "Espero ter ajudado", "assistente virtual", "Prezado cliente").

3. **Reactivation Service Hardening**:
   - Eliminated hardcoded robotic prompts in `backend/services/reactivationService.js` ("Você é o atendente virtual da loja", "Como posso te ajudar hoje?"), replaced with natural store attendant persona (Camila).

4. **Deep Verification Evidence**:
   - **Targeted Integration Tests (`backend/tests/aiFollowupCadenceAndConciseness.test.js`)**:
     - Ran on production VPS `root@209.50.241.22`: 11/11 tests passed (0 failures).
     - Covers: progressive cadence, 3-touch angles, purchase stop, response brevity, system prompt grounding, deactivation reset, 3-attempt cap, live chat attempt 1 detection, attempt 3 deactivation, multi-touch tag reset, and inline bullet preservation.
   - **Backend Regression Test Suites**:
     - Ran on production VPS: 29/29 tests passed (0 failures) across `orderSheetAndAttendantQuality.test.js`, `humanDelays.test.js`, `aiEvolutionOverviewHonesty.test.js`, `aiConversationalContinuity.test.js`, and `reactivationAutomationScope.test.js`.
   - **Frontend Compilation**:
     - `npm run build` in `frontend-official`: exit code 0 (`built in 32.55s`).
   - **VPS PM2 Service & Health Check**:
     - PM2 process `zapflow-api`: online.
     - Health check `curl -s http://localhost:4025/health`: HTTP 200 (`whatsapp: connected`, `db: true`, `aiEngine: healthy`).



## 6. Real Evolutionary Scoring (XP) per Conversation & Per-Customer Algorithm (ALGO-01 to ALGO-05)

### Architecture & Components
1. **Database Persistence (`backend/migrations/044_create_conversation_evolution_scores.js`)**:
   - Table `conversation_evolution_scores`: stores per-conversation audited scoring (`cadastral_xp`, `product_xp`, `sheet_xp`, `conversion_xp`, `quality_xp`, `total_xp`, `milestones`, `breakdown`, `algorithm_code`, `algorithm_name`, `funnel_stage`, `has_order_sheet`).
   - Table `agent_metrics`: stores aggregated metrics per agent key.
   - Indexes on `(company_id, conversation_id)`, `(company_id, algorithm_code)`, `(company_id, total_xp DESC)`.

2. **Milestone Scoring Engine (`backend/services/conversationEvolutionService.js`)**:
   - Pure milestone evaluation logic (`evaluateConversationMilestones`):
     * **Cadastral Data Collection (+15 to +25 XP)**: +10 XP for confirmed name, +5 XP for phone, +10 XP for neighborhood/address.
     * **Product Specification (+20 XP)**: Canonical product/capacity identification (e.g. "Caixa d'água 5.000 Litros").
     * **Order Sheet / Quotation (+40 XP)**: Formal order sheet generated from catalog.
     * **Funnel Conversion (+50 XP)**: Funnel stage advance to `negociacao`, `aguarda_pix`, `fechamento`, or `pago`.
     * **Service Quality (+15 XP)**: Penalizes bot repetition loops and hallucinations; awards +15 XP for clean service.
     * Total score strictly ranges between 0 and 150 XP per conversation with zero mock data.
   - Idempotent persistence (`scoreConversationAndPersist`) with multi-tenant scoping.
   - Automated background sweep in `attendantQualityDaemon.js` ensures every analyzed conversation is dynamically scored.

3. **Per-Customer Algorithm Grounding & Anti-Delirium**:
   - Algorithms `ALGO-01` (Lead Frio / Apresentação), `ALGO-02` (Consultivo Técnico), `ALGO-03` (Quebra de Objeção / Parcelamento), `ALGO-04` (Foco em Fechamento / Ficha), `ALGO-05` (Pós-Venda Protegido / Não Vender).
   - Injected into prompt contexts across `backend/services/ai.service.js`, `backend/src/ai/evolutionary/customerMemoryEngine.js`, and `backend/services/conversationMemoryEngine.js`.
   - Strict catalog grounding: prevents hallucinating fictional capacities, models, or unverified terms.

4. **Frontend Interactive Inspection UI (`frontend-official/src/components/evolution/ConversationScoresSection.tsx`)**:
   - Integrated as the 5th subtab in `frontend-official/src/pages/AI/EvolutionTab.tsx`.
   - Displays KPI cards (Total XP Real, Conversas Auditadas, Média por Atendimento, Conversões).
   - Filter chips for all algorithms (`Todos`, `ALGO-01` to `ALGO-05`) and real-time search.
   - 5 interactive milestone badges with itemized score indicators (`+25 XP`, `+20 XP`, `+40 XP`, `+50 XP`, `+15 XP`).
   - Audit modal with complete milestone breakdown and direct deep-link to the Inbox conversation (`/inbox?conversationId=...`).

### Deep Verification Evidence
1. **Targeted Backend Integration Tests**:
   - `backend/tests/aiConversationEvolutionScoring.test.js`: **10/10 passed** (full 150 XP, ALGO-02, ALGO-03, ALGO-05, anti-repetition penalty, canonical capacity anti-delirium, persistence structure, null/corrupted safety, zero mock XP on unattended conversations, and realtime WebSocket event emission).
   - `backend/tests/evolutionaryAgent.test.js`: **8/8 passed** (5-layer system tests, PostgreSQL integration, orchestrator prompt compilation).
   - `backend/tests/evolutionaryRoutesTenant.test.js`: **4/4 passed** (tenant authentication isolation and error handling).
   - `backend/tests/evolutionMetricsHonesty.test.js`: **3/3 passed** (honesty checks and continuity from observed experiences).
   - `backend/tests/humanLearningMetrics.test.js`: **5/5 passed** (tenant-scoped zero and unmeasured quality).

2. **Frontend Test Suites**:
   - `frontend-official/src/test/conversationScoresInteractivity.test.tsx`: **2/2 passed** (renders milestone badges and opens audit modal).
   - `frontend-official/src/test/evolutionTabHonesty.test.tsx`: **8/8 passed** (honesty checks, renders zero states without fake mock data).
   - `frontend-official` build: `npm run build` completed in 14.54s without warnings or errors.

3. **Production VPS Deployment & Live Verification (`root@209.50.241.22`)**:
   - Git commits `03792064` + `f73bd841` + `48df4be2` (zero mock XP on unattended conversations, null safety, `ai_experience_events` persistence, and websocket realtime) deployed and pulled on VPS.
   - Migration `044` applied in PostgreSQL `zapai_crm`.
   - OpenResty bundle `/assets/EvolutionTab-CrSkFv-P.js` (98.2 kB) synced to `/etc/icontainer/apps/openresty/openresty/www/zapai/` and responding HTTP/2 200.
   - PM2 service `zapflow-api`: online and stable (PID 3684456).
   - Live endpoint verification:
     * `GET /health`: HTTP 200 (`status: online`, `db: true`, `whatsapp: connected`, `aiEngine: healthy`).
     * `GET /api/ai/evolution/conversation-scores`: HTTP 200, returned **150 real conversations scored** with **13,530 total XP** and **90.2 average XP**.
     * `GET /api/ai/evolution/agent-evolution-metrics`: HTTP 200, dynamic level calculation derived **Master Closer Nível 7** (34,630 total XP, 87% progress).
     * `GET /api/ai/evolution/conversation-scores/16861`: HTTP 200, top scored conversation (150 XP, ALGO-05) audited with all 5 milestones.

