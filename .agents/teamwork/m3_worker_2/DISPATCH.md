## 2026-11-04T06:08:37Z
You are m3_worker_2 in the Teamwork multi-agent hierarchy.
Your working directory is: c:\projetos\ZAPAI-FINAL\.agents\teamwork\m3_worker_2

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

MANDATORY CONTEXT:
Read these files before touching any code:
1. c:\projetos\ZAPAI-FINAL\.agents\teamwork\ORIGINAL_REQUEST.md
2. c:\projetos\ZAPAI-FINAL\PROJECT.md
3. c:\projetos\ZAPAI-FINAL\.agents\teamwork\m3_auditor_1\handoff.md (Full Forensic Audit Evidence Report)
4. c:\projetos\ZAPAI-FINAL\.agents\teamwork\m3_it2_explorer_1\handoff.md (Exact Two-Layer Diff Plan)
5. c:\projetos\ZAPAI-FINAL\.agents\teamwork\m3_it2_explorer_2\handoff.md (49-File Vitest Suite Sweep)
6. c:\projetos\ZAPAI-FINAL\.agents\teamwork\m3_it2_explorer_3\handoff.md (6-Gate Verification Protocol)

WRITE OWNERSHIP:
You own exclusively:
- frontend-official/src/pages/Inbox/components/CatalogSelectorPopover.tsx
- frontend-official/src/test/inboxCatalogPopover.test.tsx
- frontend-official/src/test/setup.ts (optional, for global afterEach timer hygiene)

OBJECTIVE:
Milestone 3 Iteration 1 was rejected by the Forensic Auditor because `npm test --prefix frontend-official -- --run` exited with code 1 due to an unhandled rejection (`ReferenceError: window is not defined` inside `CatalogSelectorPopover.tsx:609` triggered by `inboxCatalogPopover.test.tsx`).

TASKS:
1. Apply Layer 1 Component Defense to `frontend-official/src/pages/Inbox/components/CatalogSelectorPopover.tsx`:
   - Import `useRef`.
   - Add `isMountedRef` and `batchTimeoutRef`.
   - On unmount, set `isMountedRef.current = false` and `clearTimeout(batchTimeoutRef.current)`.
   - In `handleSendSelected`, store the 400ms delay in `batchTimeoutRef.current`, break if `!isMountedRef.current`, and guard all state updates (`setSelectedIds`, `setOpen`, `setSendingId`) with `if (isMountedRef.current && typeof window !== "undefined")`.
   - Apply mount and window guards to `handleSendSingle` and `handleSendCatalogLink`.
   - Guard `getProducts()` open-effect with `openMounted`.
2. Apply Layer 2 Test Suite Defense to `frontend-official/src/test/inboxCatalogPopover.test.tsx`:
   - In test `"allows selecting multiple products via checkboxes and dispatches batch message"`:
     Within `act(async () => ...)`, await the batch dispatch delay (`await new Promise((r) => setTimeout(r, 450));`).
     Assert `expect(handleSend).toHaveBeenCalledTimes(2);`.
3. (Optional) In `frontend-official/src/test/setup.ts`:
   - Add timer clearing in `afterEach` (`vi.clearAllTimers();`) for global safety.
4. Execute the Official 6-Gate Verification Protocol:
   - Command 1: `npm test --prefix frontend-official -- --run` (MUST exit with code 0, 49 passed, 291 passed, 0 errors, ZERO unhandled rejections).
   - Command 2: `npm run tsc --prefix frontend-official` (MUST exit with code 0).
   - Command 3: `npm run build --prefix frontend-official` (MUST exit with code 0).
   - Command 4: `node --test backend/tests/outboundQueueAcceptance.test.js backend/tests/outboundQueuePerformance.test.js` (16 passed).
   - Command 5: `node backend/tests/nativeWhatsAppCommerce.test.js` (10 passed, clean pool close).
   - Command 6: `node tests/e2e/run_all_e2e.js` (43 passed).
5. Document all code changes, test outputs, exit codes, and findings in `c:\projetos\ZAPAI-FINAL\.agents\teamwork\m3_worker_2\handoff.md`.
6. Send completion message back to parent using send_message.
