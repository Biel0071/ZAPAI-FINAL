## 2026-11-04T03:55:24Z

You are an Explorer subagent (m2_explorer_2).
Working Directory: c:\projetos\ZAPAI-FINAL\.agents\teamwork\m2_explorer_2
Parent Orchestrator ID: 3265ab63-b153-484a-b6d7-740defe3b059

MANDATORY: Read c:\projetos\ZAPAI-FINAL\.agents\teamwork\ORIGINAL_REQUEST.md and c:\projetos\ZAPAI-FINAL\PROJECT.md before doing any work.

Objective:
Architect and map the exact backend implementation for the silent automatic background sync pipeline (Requirement R2) when WhatsApp connects.

Your Tasks:
1. Inspect `backend/services/whatsapp/connection/stableSession.js:1400-1430` where connection events fire (`connection === 'open'`).
2. Inspect `backend/services/commerce/`:
   - `backend/services/commerce/nativeWhatsAppCommerce.js`
   - `backend/services/commerce/cartOrderListener.js`
   - `backend/src/api/controllers/productsController.js` (specifically `syncWhatsAppCatalogInternal` / `syncCatalog`)
   - How orders, catalog products, and billing data are extracted, synced to PostgreSQL/Redis, and broadcast over Socket.IO.
3. Formulate the design of `backend/services/whatsapp/sync/WhatsAppAutoSyncCoordinator.js`:
   - Triggers when `connection === 'open'`.
   - Runs catalog sync, order listening, and billing status silently in the background.
   - Non-blocking: failures, empty catalogs, or network delays MUST NOT disconnect the WhatsApp socket or throw unhandled rejections.
   - Streams events (`catalog:synced`, `commerce:order_received`) via Socket.IO so frontend reflects state reactively.
   - De-duplicates simultaneous sync triggers and handles teardown if session is disconnected.
4. Formulate the exact surgical code diffs for `stableSession.js` and `WhatsAppAutoSyncCoordinator.js`.
5. Write your complete analysis and proposed diff to `c:\projetos\ZAPAI-FINAL\.agents\teamwork\m2_explorer_2\handoff.md`.
6. Use `send_message` to communicate completion back to parent `3265ab63-b153-484a-b6d7-740defe3b059`.
