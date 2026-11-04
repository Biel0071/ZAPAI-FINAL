# Full Vitest Suite Teardown & Timer Leak Forensic Audit Report — Milestone 3 Iteration 2

**Investigator**: `m3_it2_explorer_2` (Teamwork Explorer / Test Teardown Specialist)  
**Working Directory**: `c:\projetos\ZAPAI-FINAL\.agents\teamwork\m3_it2_explorer_2`  
**Parent Agent**: `3265ab63-b153-484a-b6d7-740defe3b059`  
**Subject**: Exhaustive audit across all 49 Vitest test files in `frontend-official/src/` for floating asynchronous promises, timer leaks (`setTimeout`/`setInterval`), component unmounting during async tasks, and test teardown cleanliness.  
**Date**: 2026-11-04T06:07:00Z  

---

## 1. Observation

### 1.1 Complete Inventory of Test Files in `frontend-official/src` (49 Files)
Vitest configuration (`frontend-official/vitest.config.ts:11`) specifies `include: ["src/**/*.{test,spec}.{ts,tsx}"]`.  
An automated scan of the filesystem detected exactly 49 test files:

1. `src/components/avatar-engine/__tests__/avatarEngine.test.ts` (Core logic, 6 tests)
2. `src/core/lib/utils.test.ts` (Utility functions, 3 tests)
3. `src/core/utils/tagEmojis.test.ts` (Emoji utilities, 7 tests)
4. `src/test/activeChatSheet.test.tsx` (Restored in M3, 5 tests)
5. `src/test/aiMessageFeedback.test.tsx` (AI feedback UI, 1 test)
6. `src/test/aiRuntimeContracts.test.tsx` (AI runtime contracts, 7 tests)
7. `src/test/apiAuthScope.test.ts` (Auth scopes, 5 tests)
8. `src/test/apiServiceMessageTimestamps.test.ts` (Timestamp formatting, 2 tests)
9. `src/test/attendantsComprehensiveSimulation.test.tsx` (Attendant simulation, 7 tests)
10. `src/test/attendantsDesignSystemAndBrainGraph.test.tsx` (Attendant design system, 6 tests)
11. `src/test/attendantsUnified.test.tsx` (Unified attendants, 15 tests)
12. `src/test/campaignBusinessHoursAndAvatar.test.tsx` (Business hours & avatar studio, 8 tests)
13. `src/test/commercialSession.test.tsx` (Commercial session state, 1 test)
14. `src/test/conversationScoresInteractivity.test.tsx` (Score badges & modal, 2 tests)
15. `src/test/conversationSearch.test.tsx` (Restored in M3, 7 tests)
16. `src/test/dashboardTwoHubs.test.tsx` (Dashboard hubs & metrics, 7 tests)
17. `src/test/evolutionTabHonesty.test.tsx` (Memory & evolution tab, 8 tests)
18. `src/test/example.test.ts` (Basic sanity check, 1 test)
19. `src/test/flowExecutionBanner.test.tsx` (Flow execution banner & countdown, 10 tests)
20. `src/test/historyBootstrap.test.tsx` (Restored in M3, 5 tests)
21. `src/test/importWhatsappQuickReplies.test.ts` (Quick reply parser, 3 tests)
22. `src/test/inboxCatalogPopover.test.tsx` (Catalog popover & batch dispatch, 7 tests)
23. `src/test/inboxCircuitBreakerFlashingRed.test.tsx` (Circuit breaker visual indicators, 3 tests)
24. `src/test/inboxDisparoCard.test.tsx` (Disparo card rendering, 2 tests)
25. `src/test/inboxLabelsAndPinSync.test.ts` (Label & pin state sync, 3 tests)
26. `src/test/inboxOrderCard.test.tsx` (Order card rendering, 2 tests)
27. `src/test/inboxPanel.test.tsx` (Inbox sidebar panel, 6 tests)
28. `src/test/inboxRealtimeSync.test.ts` (Realtime socket sync, 5 tests)
29. `src/test/inboxReconstruction.test.tsx` (Restored in M3, 4 tests)
30. `src/test/inboxTimestamp.test.ts` (Inbox timestamp formatting, 2 tests)
31. `src/test/leadAlgorithmAndFollowup.test.ts` (Lead algorithm prompt injection, 7 tests)
32. `src/test/leadDrawerProduction.test.tsx` (Lead drawer & insights, 3 tests)
33. `src/test/mediaAccess.test.ts` (Protected media URLs, 3 tests)
34. `src/test/messageDedupe.test.ts` (Message deduplication logic, 4 tests)
35. `src/test/messageFooter.test.tsx` (Message status icons & menu, 4 tests)
36. `src/test/messageOrdering.test.ts` (Message sorting algorithms, 2 tests)
37. `src/test/mobileApp.test.tsx` (Mobile layout & gestures, 5 tests)
38. `src/test/productionPages.test.tsx` (Settings, connections & copilot, 5 tests)
39. `src/test/quickReplyCategoryAppearance.test.tsx` (Quick reply categories & styling, 4 tests)
40. `src/test/quickReplyFlowContext.test.ts` (Quick reply flow cancellation, 3 tests)
41. `src/test/requestCache.test.ts` (HTTP request caching layer, 2 tests)
42. `src/test/runtimeProviderHistoryRefresh.test.ts` (History refresh debouncing, 3 tests)
43. `src/test/runtimeProviderRealtimeMessage.test.tsx` (Restored in M3, 3 tests)
44. `src/test/stackedTagsBadge.test.tsx` (Tag stack rendering, 5 tests)
45. `src/test/storesPage.test.tsx` (Store manager page, 2 tests)
46. `src/test/unifiedAI.test.tsx` (Unified AI settings & configuration, 8 tests)
47. `src/test/waLabelsSlashBubble.test.tsx` (Slash commands & bubble styling, 6 tests)
48. `src/test/whatsappConversationMenu.test.tsx` (Conversation rail & actions menu, 2 tests)
49. `src/test/zaiPlatformAssistant.test.tsx` (ZAI platform assistant drawer, 6 tests)

Total test count across all 49 files: **291 tests**.

---

### 1.2 Automated Static Analysis of Test Files (`test_files_analysis.json`)
Using a custom AST and pattern-scanning script (`audit_test_files.js`), all 49 test files were parsed:
- **Total TSX (UI Component) Test Files**: 32 files.
- **Total Non-UI (Pure TypeScript / Service / Utility) Test Files**: 17 files.
- **Files directly invoking `setTimeout`**: 4 files (`attendantsUnified.test.tsx`, `conversationScoresInteractivity.test.tsx`, `evolutionTabHonesty.test.tsx`, `quickReplyCategoryAppearance.test.tsx`).
- **Files directly invoking `setInterval` / `useFakeTimers`**: 2 files (`flowExecutionBanner.test.tsx`, `conversationSearch.test.tsx`).
- **Files containing event dispatches (`dispatchEvent` / `.click()`)**: 22 files (89 distinct occurrences).
- **Files containing `afterEach` teardown hooks**: 29 of 32 TSX files.
  - The 3 TSX files without explicit `afterEach` were inspected:
    1. `campaignBusinessHoursAndAvatar.test.tsx`: Uses `renderToStaticMarkup` (server-side string rendering, zero DOM state, no timers).
    2. `waLabelsSlashBubble.test.tsx`: Calls `act(() => root.unmount())` inline at the end of each test block.
    3. `whatsappConversationMenu.test.tsx`: Calls `root.unmount(); container.remove();` inline at the end of each test block.

---

### 1.3 Deep Inspection of Rendered Components with Timers (`rendered_components_timers.json`)
By tracing all component imports across all 32 TSX test files (`scan_rendered_components.js`), 18 component/page files were found to define `setTimeout` or `setInterval`. Each was checked for timer cleanup:

| Component File | `setInterval` Count | `clearInterval` Count | `setTimeout` Count | `clearTimeout` Count | Cleanup Status & Mechanism |
|---|---|---|---|---|---|
| `ActiveChatPane.tsx` | 2 | 2 | 2 | 0 | **Clean**: Intervals clean up in `useEffect` returns (L470, L539). The 2 `setTimeout`s are in event handlers (`messageInputRef` resize at L506 and `scrollToLatestMessage` at L939). |
| `OperationsTab.tsx` | 1 | 1 | 0 | 0 | **Clean**: Interval cleans up on unmount. |
| `AttendantsPage.tsx` | 1 | 3 | 1 | 0 | **Latent Risk Found**: `fetchData` retry has version cancellation (`requestVersion.current += 1` on unmount). However, `handleSendSandbox` (L1274) starts `timerInterval` without storing it in a ref for unmount cleanup. Safe in current tests because `resolveReply` is awaited. |
| `SidebarPanel.tsx` | 0 | 0 | 2 | 0 | **Clean**: `setCopiedPhone(false)` at 2000ms. No tests click copy phone. |
| `Campaigns.tsx` | 9 | 1 | 0 | 0 | **Clean**: Interval at L1295 has `return () => window.clearInterval(timer)`. (The other 8 occurrences are state setter `setIntervalSeconds`). |
| `HistoryBootstrapPanel.tsx` | 1 | 1 | 2 | 1 | **Clean**: Polling timer cleans up via `stopped = true; clearTimeout(timer)` (L346) and interval cleans up via `alive = false; clearInterval(timer)` (L318). |
| `useInboxState.ts` | 3 | 3 | 6 | 8 | **Clean**: All intervals and timeouts are stored in refs (`scrollTimerRef`, `fallbackTimerId`) and cleared on effect teardown. |
| `Inbox.tsx` | 0 | 0 | 2 | 0 | **Clean**: Debounced scroll timers. |
| `Dashboard.tsx` | 2 | 2 | 0 | 0 | **Clean**: Both polling intervals (L108, L139) clean up via `window.clearInterval` on unmount. |
| `FlowExecutionBanner.tsx` | 1 | 1 | 0 | 0 | **Clean**: Interval (L115) cleans up via `() => clearInterval(timer)`. |
| `CatalogSelectorPopover.tsx` | 0 | 0 | 1 | 0 | **CRITICAL DEFECT**: L599 `await new Promise((r) => setTimeout(r, 400))` runs in an untracked async loop without an unmount guard. |
| `MessageRow.tsx` | 0 | 0 | 1 | 1 | **Clean**: Media loading timeout (L490) cleans up via `() => window.clearTimeout(timeoutId)` (L491). |
| `QuickResponseModal.tsx` | 0 | 0 | 2 | 0 | **Clean**: Textarea cursor focus adjustment (50ms). |
| `ZaiAssistantComposer.tsx` | 2 | 3 | 4 | 4 | **Clean**: `timerIntervalRef.current` and timeline progression timers are cleared in unmount effect (L98) and in `finally` block (L220-221). |
| `LeadDrawer.tsx` | 0 | 0 | 1 | 0 | **Clean**: `setCopiedPhone(false)` at 2000ms. No test triggers copy button. |
| `Connections.tsx` | 3 | 3 | 0 | 0 | **Clean**: All 3 polling intervals (L302, L336, L413) clean up on unmount. |
| `RuntimeProvider.tsx` | 0 | 0 | 8 | 11 | **Clean**: All timers stored in maps/refs and cleared on conversation switch or unmount. |
| `Sidebar.tsx` | 0 | 0 | 2 | 2 | **Clean**: Resize dispatch timeouts clean up on unmount. |

---

### 1.4 Detailed Root Cause Trace: `CatalogSelectorPopover.tsx` vs `inboxCatalogPopover.test.tsx`

1. **In `CatalogSelectorPopover.tsx:594–610`**:
   ```typescript
   for (let i = 0; i < selectedProducts.length; i++) {
     const p = selectedProducts[i];
     const formatted = formatProductMessage(p);
     await onSendProduct(p, formatted);
     if (i < selectedProducts.length - 1) {
       await new Promise((r) => setTimeout(r, 400)); // Floating uncancelled timer!
     }
   }
   toast.success(`${selectedProducts.length} produtos enviados no chat!`);
   setSelectedIds(new Set());
   setOpen(false);
   } catch (err: any) {
     toast.error("Falha ao enviar produtos", { description: err?.message });
   } finally {
     setSendingId(null); // Unconditional state update on dead fiber!
   }
   ```

2. **In `inboxCatalogPopover.test.tsx:163–202`**:
   ```typescript
   it("allows selecting multiple products via checkboxes and dispatches batch message", async () => {
     ...
     await act(async () => {
       rows[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
       rows[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
     });
     ...
     await act(async () => {
       batchSendBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
     });

     expect(handleSend).toHaveBeenCalledTimes(1); // Exits immediately after 1st product!
   });
   ```

3. **Execution Timeline & Race Condition**:
   - `batchSendBtn.dispatchEvent` fires `handleSendSelected()`.
   - Iteration `i = 0`: calls `await onSendProduct(p, formatted)`. Mock resolves synchronously.
   - Condition `i < selectedProducts.length - 1` (0 < 1) evaluates to `true`.
   - Execution hits `await new Promise((r) => setTimeout(r, 400))`. The promise suspends, registering a 400ms timer on Node's timer queue.
   - The test's `await act(async () => ...)` block returns because synchronous execution yielded.
   - The test executes `expect(handleSend).toHaveBeenCalledTimes(1)`, which evaluates to `true`.
   - The test block terminates.
   - `afterEach` executes: `root.unmount(); document.body.innerHTML = "";`. The React fiber is marked unmounted.
   - Vitest proceeds to tear down the JSDOM test worker environment, destroying `global.window`.
   - **400ms after the initial click**, Node's event loop executes the timer callback, resolving the promise.
   - `handleSendSelected` resumes at iteration `i = 1`. It invokes `onSendProduct` for the second product, and reaches `finally { setSendingId(null); }`.
   - React's `dispatchSetState` invokes `requestUpdateLane()`, which calls `getCurrentEventPriority()`.
   - Inside React DOM (`react-dom.development.js:10993`), `var currentEvent = window.event;` is evaluated.
   - Because `window` has been deleted by JSDOM teardown, Node throws:
     ```text
     ReferenceError: window is not defined
     ❯ getCurrentEventPriority node_modules/react-dom/cjs/react-dom.development.js:10993:22
     ❯ requestUpdateLane node_modules/react-dom/cjs/react-dom.development.js:25495:19
     ❯ setSendingId node_modules/react-dom/cjs/react-dom.development.js:16648:14
     ❯ handleSendSelected src/pages/Inbox/components/CatalogSelectorPopover.tsx:609:7
     ```
   - Vitest intercepts this asynchronous exception as an **Unhandled Rejection**, marks `Errors 1 error`, and forces process exit code `1`.

---

## 2. Logic Chain

1. **Singularity of the Defect**:
   - An exhaustive review across all 49 test files and 18 timer-bearing components revealed that only **one single test** (`inboxCatalogPopover.test.tsx`) leaves an unresolved asynchronous timer scheduled on Node's event loop after the test block finishes.
   - All other 48 test files either:
     - Run purely synchronous or microtask-based tests.
     - Properly await all asynchronous promises inside `act(async () => ...)`.
     - Explicitly clean up all intervals and timeouts in `afterEach` or `useEffect` returns.
     - Mock asynchronous dependencies (`requestApiEndpoint`, `apiService`) with resolved promises that complete before test assertion.

2. **Why the Error is Intermittent When Run in Isolation vs. Consistent in Full Suite**:
   - Running `npm test --prefix frontend-official -- src/test/inboxCatalogPopover.test.tsx --run` alone can sometimes exit before the 400ms timer fires, or the single worker process terminates immediately, masking the unhandled rejection.
   - Running the full suite (`npm test --prefix frontend-official -- --run`) takes ~54 seconds across multiple parallel worker threads. The JSDOM environment for `inboxCatalogPopover.test.tsx` is torn down while the worker thread remains alive to execute subsequent tasks or collect test results. When the 400ms timer fires into the destroyed JSDOM context, the `ReferenceError: window is not defined` is deterministically caught by Vitest's unhandled error listener.

3. **Two-Tier Remediation is Required**:
   - **Component-Level Defense**: `CatalogSelectorPopover.tsx` must track component mount lifecycle (`isMountedRef`), store the batch delay timer in a ref (`batchTimeoutRef`), cancel the timer on unmount, break the send loop if unmounted, and guard all React state setters with `if (isMountedRef.current && typeof window !== 'undefined')`.
   - **Test-Level Defense**: `inboxCatalogPopover.test.tsx` must await the full duration of the batch dispatch (`await new Promise((r) => setTimeout(r, 450));`) so that both products are sent and the loop completes cleanly inside `act()`. The test assertion must be updated to `expect(handleSend).toHaveBeenCalledTimes(2)` to verify authentic batch delivery.

4. **Global Vitest Hardening**:
   - In addition to fixing the component and test, `frontend-official/src/test/setup.ts` should include global teardown guards (`afterEach(() => { vi.clearAllTimers(); })`) and unmount safeguards to ensure future tests cannot leak timers into subsequent suites.

---

## 3. Caveats

1. **Scope of Investigation**:
   - All 49 test files in `frontend-official/src/` were examined via automated static analysis and manual verification of timer patterns.
   - Backend test suites (`nativeWhatsAppCommerce.test.js`, `outboundQueueAcceptance.test.js`, `outboundQueuePerformance.test.js`) and Master E2E tests (`tests/e2e/run_all_e2e.js`) were verified green and unimpacted by frontend changes.
2. **Latent Component in `AttendantsPage.tsx`**:
   - In `AttendantsPage.tsx:1274`, `const timerInterval = setInterval(...)` inside `handleSendSandbox` is not stored in a component ref. In the current test `attendantsUnified.test.tsx`, this timer is cleared because `resolveReply` is explicitly awaited before unmount. However, as good engineering hygiene, storing this timer in a `useRef` and clearing it in `useEffect(() => () => ..., [])` is recommended to prevent future leaks if sandbox testing is cancelled mid-flight.
3. **No Project Files Modified**:
   - In strict compliance with the Explorer archetype and the mandatory read-only rules, no project source code or test files were modified during this investigation. All analysis artifacts were written exclusively to `.agents/teamwork/m3_it2_explorer_2/`.

---

## 4. Conclusion & Concrete Recommendations

### 4.1 Root Assessment
The full Vitest test suite (`npm test --prefix frontend-official -- --run`) failure (Exit Code 1) is **100% attributed to the asynchronous timer leak and unmounted state update in `CatalogSelectorPopover.tsx` during `inboxCatalogPopover.test.tsx`**.  
All other 48 test files in the repository are clean, properly torn down, and have zero active timer leaks.

### 4.2 Concrete Remediation Recommendations for Worker

#### Recommendation 1: Patch `frontend-official/src/pages/Inbox/components/CatalogSelectorPopover.tsx`
1. Add `useRef` to React imports.
2. Initialize `isMountedRef = useRef(true)` and `batchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)`.
3. Add lifecycle cleanup effect:
   ```typescript
   useEffect(() => {
     isMountedRef.current = true;
     return () => {
       isMountedRef.current = false;
       if (batchTimeoutRef.current) {
         clearTimeout(batchTimeoutRef.current);
         batchTimeoutRef.current = null;
       }
     };
   }, []);
   ```
4. In `handleSendSelected`:
   - Store the delay timer in `batchTimeoutRef.current`.
   - Check `if (!isMountedRef.current) break;` before and after each product dispatch.
   - Wrap state updates (`setSelectedIds`, `setOpen`, `setSendingId`) in:
     ```typescript
     if (isMountedRef.current && typeof window !== "undefined") {
       setSendingId(null);
     }
     ```
5. Apply identical guards to `handleSendSingle` and `handleSendCatalogLink`.

#### Recommendation 2: Patch `frontend-official/src/test/inboxCatalogPopover.test.tsx`
In the batch send test (`allows selecting multiple products via checkboxes and dispatches batch message`):
1. Await the batch loop inside `act()`:
   ```typescript
   await act(async () => {
     batchSendBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
     await new Promise((r) => setTimeout(r, 450));
   });
   ```
2. Update the assertion to verify that **both** selected products were dispatched:
   ```typescript
   expect(handleSend).toHaveBeenCalledTimes(2);
   ```

#### Recommendation 3: Secondary Defense in `frontend-official/src/test/setup.ts`
Add global teardown hygiene in `setup.ts`:
```typescript
import { afterEach, vi } from "vitest";

afterEach(() => {
  vi.clearAllTimers();
});
```

#### Recommendation 4: Defensive Latent Hardening in `frontend-official/src/pages/Attendants/AttendantsPage.tsx`
Store `timerInterval` in `sandboxTimerRef` and clear it on unmount to guarantee zero interval leaks if sandbox tests are aborted.

---

## 5. Verification Method

To independently verify that the entire Vitest suite and project verification gates pass with 0 errors and exit code 0:

### 1. Isolated Unit Verification
```powershell
npm test --prefix frontend-official -- src/test/inboxCatalogPopover.test.tsx --run
```
- **Expected Exit Code**: `0`
- **Expected Output**: `Test Files 1 passed (1)`, `Tests 7 passed (7)`.

### 2. Full Vitest Test Suite Execution
```powershell
npm test --prefix frontend-official -- --run
```
- **Expected Exit Code**: `0`
- **Expected Output**:
  ```text
  Test Files  49 passed (49)
       Tests  291 passed (291)
    Duration  ~50s
  ```
- **Invalidation Condition**: Any appearance of `Errors X error`, `Unhandled Errors`, `Unhandled Rejection`, or non-zero exit code invalidates the fix.

### 3. Frontend Typecheck & Build
```powershell
npm run tsc --prefix frontend-official
npm run build --prefix frontend-official
```
- **Expected Exit Code**: `0` for both commands with 0 errors.

### 4. Master E2E & Backend Verification
```powershell
node --test backend/tests/outboundQueueAcceptance.test.js backend/tests/outboundQueuePerformance.test.js
node backend/tests/nativeWhatsAppCommerce.test.js
node tests/e2e/run_all_e2e.js
```
- **Expected Exit Code**: `0` across all backend suites and all 4 Tiers (43/43 tests passed) of Master E2E.
