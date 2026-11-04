# Forensic Investigation & Remediation Plan — Milestone 3 Iteration 2

**Investigator**: `m3_it2_explorer_1` (Teamwork Explorer)  
**Subject**: Unhandled Rejection `ReferenceError: window is not defined` from `CatalogSelectorPopover.tsx` during `inboxCatalogPopover.test.tsx`  
**Timestamp**: 2026-11-04T06:06:00Z  

---

## 1. Observation

### 1.1 Verbatim Error Log from Full Vitest Suite Run
Running `npm test --prefix frontend-official -- --run` triggered the following unhandled rejection:

```text
⎯⎯⎯⎯ Unhandled Rejection ⎯⎯⎯⎯⎯
ReferenceError: window is not defined
 ❯ getCurrentEventPriority node_modules/react-dom/cjs/react-dom.development.js:10993:22
 ❯ requestUpdateLane node_modules/react-dom/cjs/react-dom.development.js:25495:19
 ❯ setSendingId node_modules/react-dom/cjs/react-dom.development.js:16648:14
 ❯ handleSendSelected src/pages/Inbox/components/CatalogSelectorPopover.tsx:609:7
    607|       toast.error("Falha ao enviar produtos", { description: err?.message });
    608|     } finally {
    609|       setSendingId(null);
       |       ^
    610|     }
    611|   };

This error originated in "src/test/inboxCatalogPopover.test.tsx" test file. It doesn't mean the error was thrown inside the file itself, but while it was running.
This error was caught after test environment was torn down. Make sure to cancel any running tasks before test finishes:
- cancel timeouts using clearTimeout and clearInterval
- wait for promises to resolve using the await keyword
```

### 1.2 Inspection of `CatalogSelectorPopover.tsx` (Lines 576–611)
File: `frontend-official/src/pages/Inbox/components/CatalogSelectorPopover.tsx`
```typescript
576:   const handleSendSelected = async () => {
577:     if (disabled || selectedIds.size === 0 || !canSendToChat) {
578:       if (!canSendToChat) toast.warning("Selecione uma conversa ativa.");
579:       return;
580:     }
581:     const selectedProducts = products.filter((p) => selectedIds.has(p.id));
582:     if (selectedProducts.length === 0) return;
583: 
584:     try {
585:       setSendingId("selected_batch");
586:       if (onSendMultipleProducts) {
587:         await onSendMultipleProducts(selectedProducts);
588:       } else if (selectedProducts.length === 1) {
589:         const p = selectedProducts[0];
590:         const formatted = formatProductMessage(p);
591:         await onSendProduct(p, formatted);
592:         toast.success(`"${p.name}" enviado no chat!`);
593:       } else {
594:         for (let i = 0; i < selectedProducts.length; i++) {
595:           const p = selectedProducts[i];
596:           const formatted = formatProductMessage(p);
597:           await onSendProduct(p, formatted);
598:           if (i < selectedProducts.length - 1) {
599:             await new Promise((r) => setTimeout(r, 400));
600:           }
601:         }
602:         toast.success(`${selectedProducts.length} produtos enviados no chat!`);
603:       }
604:       setSelectedIds(new Set());
605:       setOpen(false);
606:     } catch (err: any) {
607:       toast.error("Falha ao enviar produtos", { description: err?.message });
608:     } finally {
609:       setSendingId(null);
610:     }
611:   };
```
Observations:
1. When `onSendMultipleProducts` is undefined and `selectedProducts.length > 1`, line 599 schedules an untracked, uncancellable `setTimeout(r, 400)` timer on Node's event loop between products.
2. The component does not have an `isMounted` ref or cancellation mechanism to abort the loop if the component unmounts.
3. Lines 604–605 and line 609 unconditionally invoke React state setters (`setSelectedIds`, `setOpen`, `setSendingId`) without checking whether the component is mounted or whether `typeof window !== 'undefined'`.

### 1.3 Inspection of `inboxCatalogPopover.test.tsx` (Lines 163–202)
File: `frontend-official/src/test/inboxCatalogPopover.test.tsx`
```typescript
163:   it("allows selecting multiple products via checkboxes and dispatches batch message", async () => {
164:     const handleSend = vi.fn().mockResolvedValue(undefined);
165: 
166:     await renderComponent(
167:       <CatalogSelectorPopover
168:         disabled={false}
169:         onSendProduct={handleSend}
170:       />
171:     );
172: 
173:     const triggerBtn = document.querySelector<HTMLButtonElement>("[data-catalog-trigger]");
174:     await act(async () => {
175:       triggerBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
176:     });
177: 
178:     const rows = [...document.querySelectorAll<HTMLElement>("[data-catalog-popover] .cursor-pointer")].filter(
179:       (el) => el.textContent?.includes("BLOCO 10") || el.textContent?.includes("ARGAMASSA - AC3")
180:     );
181:     expect(rows.length).toBeGreaterThanOrEqual(2);
182: 
183:     await act(async () => {
184:       rows[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
185:       rows[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
186:     });
187: 
188:     const batchSendBtn = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
189:       (b) => b.textContent?.includes("Enviar produtos (2)")
190:     );
191:     expect(batchSendBtn).toBeDefined();
192: 
193:     await act(async () => {
194:       batchSendBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
195:     });
196: 
197:     expect(handleSend).toHaveBeenCalledTimes(1);
198:     expect(handleSend).toHaveBeenCalledWith(
199:       expect.anything(),
200:       expect.stringContaining("[CATÁLOGO WHATSAPP]")
201:     );
202:   });
```
Observations:
1. Line 194 dispatches the click on `batchSendBtn`. Because `handleSendSelected` is an async click handler, `batchSendBtn.dispatchEvent` returns synchronously.
2. Inside `handleSendSelected`, product 0 is dispatched (`handleSend` called once), and then execution hits `await new Promise((r) => setTimeout(r, 400))`.
3. The test does NOT await the 400ms delay.
4. Line 197 asserts `expect(handleSend).toHaveBeenCalledTimes(1)`. This only checks the first item because the test author noticed that at the immediate end of `act`, only 1 item had fired.
5. The test terminates immediately while the 400ms timer is pending in Node's timer queue.
6. The test runner proceeds to `afterEach`:
   ```typescript
   afterEach(async () => {
     if (root) await act(async () => root?.unmount());
     root = undefined;
     document.body.innerHTML = "";
   });
   ```
   The component unmounts.
7. During full suite runs across 49 test files, Vitest tears down the jsdom environment for this worker thread, destroying `global.window`.
8. When the 400ms timer fires, `handleSendSelected` resumes inside the dead jsdom worker, proceeds to the `finally` block at line 609, and calls `setSendingId(null)`.

### 1.4 Inspection of React DOM Internals (`react-dom.development.js:10992–11000`)
File: `frontend-official/node_modules/react-dom/cjs/react-dom.development.js`
```javascript
10992: function getCurrentEventPriority() {
10993:   var currentEvent = window.event;
10994: 
10995:   if (currentEvent === undefined) {
10996:     return DefaultEventPriority;
10997:   }
10998: 
10999:   return getEventPriority(currentEvent.type);
11000: }
```
When `setSendingId(null)` is called:
`setSendingId` -> `dispatchSetState` -> `requestUpdateLane` -> `getCurrentEventPriority()`.
Evaluating `window.event` throws `ReferenceError: window is not defined` because `window` was deleted during test environment teardown.

---

## 2. Logic Chain

1. **Root Mechanism**:
   - `inboxCatalogPopover.test.tsx` selects 2 products and clicks the batch send button.
   - `CatalogSelectorPopover.tsx` executes `handleSendSelected`, sending product 0 and pausing for 400ms before product 1 (`setTimeout(r, 400)`).
   - The test exits prematurely without awaiting this 400ms delay, expecting only 1 call (`toHaveBeenCalledTimes(1)`).

2. **The Flaky Race Condition**:
   - If Vitest is running in single file mode or finishes tearing down jsdom AFTER the timer fires, the test appears to pass.
   - During the 49-file parallel run, jsdom environment teardown completes while the 400ms timer is still queued.
   - When the timer resolves, React schedules a state update on an unmounted component whose environment has no `window`.
   - Accessing `window.event` in React DOM throws `ReferenceError: window is not defined` inside an unhandled promise rejection.
   - Vitest intercepts the unhandled rejection, logs `Errors 1 error`, and exits with code `1`.

3. **Production Risk Beyond Tests**:
   - If a real WhatsApp operator sends a batch of 5 products (which takes ~1.6s) and closes the popover or navigates away after 500ms, the unmounted component continues to loop in the background, firing unmonitored WhatsApp message requests and updating state on unmounted fibers.
   - Therefore, remediation requires BOTH a **Component Defense** (lifecycle management, timer cancellation, unmount guards) and a **Test Suite Defense** (awaiting full batch execution and asserting complete delivery).

---

## 3. Caveats

- Backend services, WebSocket gateway, outbound queue concurrency, and database cleanup were verified 100% clean by `m3_auditor_1` and require no changes.
- The 5 test files restored in Milestone 3 pass 24/24.
- No workarounds (such as deleting tests, silencing Vitest unhandled errors in config, or artificially hacking global window in teardown) are acceptable. The remediation must be genuine, surgical, and production-grade.

---

## 4. Conclusion & Precise Remediation Plan

### Architecture of the Fix (Two-Layer Defense)

#### Layer 1: Component Defense (`frontend-official/src/pages/Inbox/components/CatalogSelectorPopover.tsx`)
1. Import `useRef`.
2. Add `isMountedRef` (tracking mount lifecycle) and `batchTimeoutRef` (tracking active batch delay timers).
3. On unmount, set `isMountedRef.current = false` and invoke `clearTimeout(batchTimeoutRef.current)`.
4. In `handleSendSelected`:
   - Store the 400ms timer in `batchTimeoutRef.current`.
   - Before each iteration and after each delay, check `if (!isMountedRef.current) break;`.
   - Guard all state setters (`setSelectedIds`, `setOpen`, `setSendingId`) with `if (isMountedRef.current && typeof window !== "undefined")`.
5. Apply the same mount and window guards to `handleSendSingle` and `handleSendCatalogLink`.
6. Guard the secondary `getProducts()` effect when `open` changes so unmounting during prefetch does not trigger state updates.

#### Layer 2: Test Suite Defense (`frontend-official/src/test/inboxCatalogPopover.test.tsx`)
1. In test `"allows selecting multiple products via checkboxes and dispatches batch message"`:
   - Within `act(async () => ...)`, await the batch dispatch delay (`await new Promise((r) => setTimeout(r, 450));`).
   - Update assertion to `expect(handleSend).toHaveBeenCalledTimes(2);` confirming authentic completion of the 2-product batch.
2. In `afterEach`, ensure clean unmount and flush.

---

### Exact Surgical Diffs for Worker

#### Diff 1: `frontend-official/src/pages/Inbox/components/CatalogSelectorPopover.tsx`

```diff
--- a/frontend-official/src/pages/Inbox/components/CatalogSelectorPopover.tsx
+++ b/frontend-official/src/pages/Inbox/components/CatalogSelectorPopover.tsx
@@ -1,4 +1,4 @@
-import React, { useState, useEffect, useMemo } from "react";
+import React, { useState, useEffect, useMemo, useRef } from "react";
 import {
   Storefront,
   ShoppingBag,
@@ -424,6 +424,19 @@ export function CatalogSelectorPopover({
   const [sendingId, setSendingId] = useState<string | null>(null);
   const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
   const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
+  const isMountedRef = useRef(true);
+  const batchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
+
+  useEffect(() => {
+    isMountedRef.current = true;
+    return () => {
+      isMountedRef.current = false;
+      if (batchTimeoutRef.current) {
+        clearTimeout(batchTimeoutRef.current);
+        batchTimeoutRef.current = null;
+      }
+    };
+  }, []);
 
   // Fetch real products from backend repository on mount, on open, and whenever WhatsApp connects/syncs
   useEffect(() => {
@@ -493,7 +506,8 @@ export function CatalogSelectorPopover({
   // Also refresh when popover is explicitly opened
   useEffect(() => {
     if (open) {
+      let openMounted = true;
       apiService.getProducts().then((res) => {
-        if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
+        if (openMounted && isMountedRef.current && res?.success && Array.isArray(res.data) && res.data.length > 0) {
           const mapped: CatalogProduct[] = res.data.map((item: any) => ({
             id: item.id || `prod_${Math.random()}`,
@@ -512,6 +526,9 @@ export function CatalogSelectorPopover({
           setProducts(mapped);
         }
       }).catch(() => {});
+      return () => {
+        openMounted = false;
+      };
     }
   }, [open]);
 
@@ -561,16 +578,22 @@ export function CatalogSelectorPopover({
       return;
     }
     try {
-      setSendingId(product.id);
+      if (isMountedRef.current && typeof window !== "undefined") {
+        setSendingId(product.id);
+      }
       const formatted = formatProductMessage(product);
       await onSendProduct(product, formatted);
-      setOpen(false);
+      if (isMountedRef.current) {
+        setOpen(false);
+      }
     } catch (err: any) {
-      toast.error("Falha ao enviar produto", {
-        description: err?.message || "Tente novamente.",
-      });
+      if (isMountedRef.current) {
+        toast.error("Falha ao enviar produto", {
+          description: err?.message || "Tente novamente.",
+        });
+      }
     } finally {
-      setSendingId(null);
+      if (isMountedRef.current && typeof window !== "undefined") {
+        setSendingId(null);
+      }
     }
   };
 
@@ -583,28 +606,44 @@ export function CatalogSelectorPopover({
     if (selectedProducts.length === 0) return;
 
     try {
-      setSendingId("selected_batch");
+      if (isMountedRef.current && typeof window !== "undefined") {
+        setSendingId("selected_batch");
+      }
       if (onSendMultipleProducts) {
         await onSendMultipleProducts(selectedProducts);
       } else if (selectedProducts.length === 1) {
         const p = selectedProducts[0];
         const formatted = formatProductMessage(p);
         await onSendProduct(p, formatted);
-        toast.success(`"${p.name}" enviado no chat!`);
+        if (isMountedRef.current) {
+          toast.success(`"${p.name}" enviado no chat!`);
+        }
       } else {
         for (let i = 0; i < selectedProducts.length; i++) {
+          if (!isMountedRef.current) break;
           const p = selectedProducts[i];
           const formatted = formatProductMessage(p);
           await onSendProduct(p, formatted);
+          if (!isMountedRef.current) break;
           if (i < selectedProducts.length - 1) {
-            await new Promise((r) => setTimeout(r, 400));
+            await new Promise<void>((resolve) => {
+              batchTimeoutRef.current = setTimeout(() => {
+                batchTimeoutRef.current = null;
+                resolve();
+              }, 400);
+            });
           }
         }
-        toast.success(`${selectedProducts.length} produtos enviados no chat!`);
+        if (isMountedRef.current) {
+          toast.success(`${selectedProducts.length} produtos enviados no chat!`);
+        }
       }
-      setSelectedIds(new Set());
-      setOpen(false);
+      if (isMountedRef.current) {
+        setSelectedIds(new Set());
+        setOpen(false);
+      }
     } catch (err: any) {
-      toast.error("Falha ao enviar produtos", { description: err?.message });
+      if (isMountedRef.current) {
+        toast.error("Falha ao enviar produtos", { description: err?.message });
+      }
     } finally {
-      setSendingId(null);
+      if (isMountedRef.current && typeof window !== "undefined") {
+        setSendingId(null);
+      }
     }
   };
 
@@ -620,7 +649,9 @@ export function CatalogSelectorPopover({
     }
 
     try {
-      setSendingId("catalog_root");
+      if (isMountedRef.current && typeof window !== "undefined") {
+        setSendingId("catalog_root");
+      }
       const formattedCatalog = `📦 *[CATÁLOGO WHATSAPP]*\n${OFFICIAL_STORE_CATALOG_URL}`;
       await onSendProduct(
         {
@@ -633,13 +664,17 @@ export function CatalogSelectorPopover({
         },
         formattedCatalog
       );
-      toast.success("Catálogo enviado no chat!");
-      setOpen(false);
+      if (isMountedRef.current) {
+        toast.success("Catálogo enviado no chat!");
+        setOpen(false);
+      }
     } catch (err: any) {
-      toast.error("Falha ao enviar catálogo", { description: err?.message });
+      if (isMountedRef.current) {
+        toast.error("Falha ao enviar catálogo", { description: err?.message });
+      }
     } finally {
-      setSendingId(null);
+      if (isMountedRef.current && typeof window !== "undefined") {
+        setSendingId(null);
+      }
     }
   };
```

#### Diff 2: `frontend-official/src/test/inboxCatalogPopover.test.tsx`

```diff
--- a/frontend-official/src/test/inboxCatalogPopover.test.tsx
+++ b/frontend-official/src/test/inboxCatalogPopover.test.tsx
@@ -192,9 +192,11 @@ describe("WhatsApp Catalog Integration & Inbox Dispatch", () => {
 
     await act(async () => {
       batchSendBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
+      // Await batch dispatch loop (400ms delay between products) so all timers resolve before teardown
+      await new Promise((r) => setTimeout(r, 450));
     });
 
-    expect(handleSend).toHaveBeenCalledTimes(1);
+    expect(handleSend).toHaveBeenCalledTimes(2);
     expect(handleSend).toHaveBeenCalledWith(
       expect.anything(),
       expect.stringContaining("[CATÁLOGO WHATSAPP]")
```

---

## 5. Verification Method

To verify that the remediation completely clears the integrity violation:

1. **Verify `inboxCatalogPopover.test.tsx` in isolation**:
   ```powershell
   npm test --prefix frontend-official -- src/test/inboxCatalogPopover.test.tsx --run
   ```
   *Expected Result*: 7 passed (7), 0 errors, Exit code 0.

2. **Verify Full Vitest Suite (Stress Teardown)**:
   ```powershell
   npm test --prefix frontend-official -- --run
   ```
   *Expected Result*:
   - `Test Files  49 passed (49)`
   - `Tests  291 passed (291)`
   - `Errors  0 error` (NO `⎯⎯⎯⎯ Unhandled Rejection ⎯⎯⎯⎯⎯`)
   - Exit code: `0`

3. **Verify TypeScript Typecheck & Build**:
   ```powershell
   npm run tsc --prefix frontend-official
   npm run build --prefix frontend-official
   ```
   *Expected Result*: Exit code 0 for both commands.

4. **Verify Backend & E2E Suites**:
   ```powershell
   node --test backend/tests/outboundQueueAcceptance.test.js backend/tests/outboundQueuePerformance.test.js
   node backend/tests/nativeWhatsAppCommerce.test.js
   node tests/e2e/run_all_e2e.js
   ```
   *Expected Result*: 100% green with zero regressions.
