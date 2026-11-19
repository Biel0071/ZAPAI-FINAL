## 2026-11-04T05:11:53Z
You are the Implementation Worker for Milestone 3 (m3_worker_1).
Working Directory: c:\projetos\ZAPAI-FINAL\.agents\teamwork\m3_worker_1
Parent Orchestrator ID: 3265ab63-b153-484a-b6d7-740defe3b059

MANDATORY: Read c:\projetos\ZAPAI-FINAL\.agents\teamwork\ORIGINAL_REQUEST.md and c:\projetos\ZAPAI-FINAL\PROJECT.md before doing any work.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Mission:
Implement Milestone 3: Performance Optimization, Vitest Restoration, TypeScript Typecheck Cleanliness, WebSocket Deduplication, and Backend Teardown.

Inputs from Explorers (read these handoff files for full line-by-line diffs):
- Explorer 1 (Vitest Failures): c:\projetos\ZAPAI-FINAL\.agents\teamwork\m3_explorer_1\handoff.md
- Explorer 2 (WebSocket & Queue): c:\projetos\ZAPAI-FINAL\.agents\teamwork\m3_explorer_2\handoff.md
- Explorer 3 (TypeScript & Teardown): c:\projetos\ZAPAI-FINAL\.agents\teamwork\m3_explorer_3\handoff.md

Your Implementation Scope:
Part 1 — Vitest Test Suite Restoration (from Explorer 1):
1. `frontend-official/src/pages/Inbox/components/ActiveChatPane.tsx`: Line 818, add optional chaining `apiService.getCommerceOrders?.(...)`.
2. `frontend-official/src/test/activeChatSheet.test.tsx`: In mock, add `getCommerceOrders: vi.fn().mockResolvedValue({ success: true, total: 0, orders: [] })` and `getProducts: vi.fn().mockResolvedValue({ success: true, data: [] })`.
3. `frontend-official/src/test/inboxReconstruction.test.tsx`: In mock, add `getCommerceOrders` and `getProducts`.
4. `frontend-official/src/test/conversationSearch.test.tsx`: Include `{ sessionId: "other" }` in `newMatch` mock return and `{ sessionId: "main" }` in `staleMatch`.
5. `frontend-official/src/test/historyBootstrap.test.tsx`: Support button label `"Criar manual"` or `"Criar manualmente"`.
6. `frontend-official/src/test/runtimeProviderRealtimeMessage.test.tsx`: Dynamically record `initialFetchCount` before testing new message event.

Part 2 — WebSocket Deduplication & Outbound Queue (from Explorer 2):
1. Centralize WebSocket event handling into `backend/services/websocketGateway.js` (apply `c:\projetos\ZAPAI-FINAL\.agents\teamwork\m3_explorer_2\proposed_websocketGateway.js`). Ensure idempotent `init(io)`, `.unref()` on `dedupCleanupTimer`, and inclusion of `typing:*`, `archive_chat`, `unarchive_chat`, `add_tag`, `remove_tag`.
2. Update `backend/server.js`: Initialize `websocketGateway.init(io)` at line 107 right after `new Server()`. Remove duplicate `io.on('connection')` block at line 654 (deduplicate).
3. `backend/services/outboundQueueService.js`:
   - Replace global boolean `let processingTick = false;` with controlled worker pool (`activeWorkers < MAX_CONCURRENT_DISPATCHES`, default 3).
   - Add `.unref()` to `workerTimer` and `workerWakeupTimer`.
   - Implement Windows retry resilience for atomic rename in `writeQueueFileAtomic`.
4. `backend/services/automationEngine.js`: In AI response chunk loops and quick reply loops, use `outboundQueueService.enqueueBatch()` where multi-message payloads are queued.

Part 3 — TypeScript Typecheck & Teardown Cleanliness (from Explorer 3):
1. `frontend-official/package.json`: Add `"typecheck": "tsc --noEmit -p tsconfig.app.json"`.
2. `frontend-official/src/core/services/apiService.ts`:
   - Widen `ChatMessage`: add `text?: string; phone?: string; sessionId?: string; sender?: string; type?: string;`. Add `"received"` to `status`. Add `"product" | "order" | "text"` to `mediaType`.
   - Widen `Contact`: add `createdAt?: string;`.
   - Widen `CampaignSettings`: add `allowOutsideHours?: boolean;`.
3. `frontend-official/src/state/stores/appStore.ts` & `frontend-official/src/core/services/normalizeSession.ts`:
   - Add `sessionId?: string; connected?: boolean;` to `SessionItem`.
4. `frontend-official/src/components/avatar-engine/AvatarItemPreview.tsx`: Widen `gender?: "male" | "female" | "neutral" | string;`.
5. `frontend-official/src/components/avatar-engine/ZaiAvatarRenderer.tsx`: Safely access `(avatar as any)?.name`.
6. `frontend-official/src/components/contacts/LeadMemoryGraphModal.tsx`: Add missing `X` icon import from `@phosphor-icons/react`.
7. `frontend-official/src/components/evolution/ConversationScoresSection.tsx`: Add type parameter `requestApiEndpoint<any>` and align parameters.
8. `frontend-official/src/core/services/zaiAssistantConfigService.ts`: Await `buildApiHeaders()` in GET and PUT.
9. `frontend-official/src/pages/Attendants/AttendantsPage.tsx`: Add `Avatar, AvatarFallback, AvatarImage` imports from `@/components/ui/avatar`.
10. `frontend-official/src/pages/Inbox/components/ConversationRow.tsx`: Add `data?: ConversationRowData; isScrolling?: boolean;` to `ConversationRowProps`.
11. `frontend-official/src/pages/Inbox/components/MessageRow.tsx`: Make audio callback props optional (`onToggleAudio?`, `isAudioLoading?`, etc.) and import `formatPhoneNumber`.
12. `frontend-official/src/pages/Inbox/components/SidebarPanel.tsx`: Add `isOpen?: boolean` to `SidebarPanelProps`.
13. `frontend-official/src/pages/lovable/pages/AnalyticsView.tsx` & `DashboardView.tsx`: Import `cn` and add types.
14. `backend/src/infrastructure/config/database.js`: Export `closeDatabase()`.
15. `backend/services/reactivationService.js`: Add `.unref()` to line 208 recurring interval.
16. `backend/tests/nativeWhatsAppCommerce.test.js`: Update `test.after` to await `closeDatabase()`.

Mandatory Verification:
Execute and verify each of the following:
1. `npm test --prefix frontend-official -- --run` (MUST pass 100% of test suites, 291/291 tests green across 49 files)
2. `npm run tsc --prefix frontend-official` (MUST pass with 0 errors)
3. `npm run build --prefix frontend-official` (MUST pass with exit code 0)
4. `node --test backend/tests/outboundQueueAcceptance.test.js backend/tests/outboundQueuePerformance.test.js` (MUST pass 16/16)
5. `node backend/tests/nativeWhatsAppCommerce.test.js` (MUST pass 10/10 and terminate promptly with exit code 0)
6. `node tests/e2e/run_all_e2e.js` (MUST pass all 43 tests across all 4 tiers with exit code 0)
