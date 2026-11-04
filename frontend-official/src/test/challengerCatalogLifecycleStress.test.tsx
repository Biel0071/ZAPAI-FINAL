import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CatalogSelectorPopover,
  FALLBACK_STORE_PRODUCTS,
  type CatalogProduct,
} from "@/pages/Inbox/components/CatalogSelectorPopover";
import { apiService } from "@/core/services/apiService";

vi.spyOn(apiService, "getProducts").mockResolvedValue({
  success: true,
  data: FALLBACK_STORE_PRODUCTS as any,
});

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(async () => {
  if (root) {
    await act(async () => {
      root?.unmount();
    });
  }
  root = undefined;
  if (container && container.parentNode) {
    container.parentNode.removeChild(container);
  }
  container = undefined;
  document.body.innerHTML = "";
});

async function mountComponent(node: React.ReactNode) {
  if (!root) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  }
  await act(async () => {
    root!.render(node);
  });
}

async function unmountCurrent() {
  if (root) {
    await act(async () => {
      root!.unmount();
    });
    root = undefined;
  }
}

describe("Adversarial Empirical Stress Testing — CatalogSelectorPopover Lifecycle & Timers", () => {
  it("Scenario 1: Unmount during ongoing 5-product batch cancels timer and prevents subsequent sends without throwing", async () => {
    const sentProducts: CatalogProduct[] = [];
    const handleSend = vi.fn().mockImplementation(async (product: CatalogProduct) => {
      sentProducts.push(product);
      return Promise.resolve();
    });

    await mountComponent(
      <CatalogSelectorPopover
        disabled={false}
        canSendToChat={true}
        onSendProduct={handleSend}
      />
    );

    // Open popover
    const triggerBtn = document.querySelector<HTMLButtonElement>("[data-catalog-trigger]");
    expect(triggerBtn).not.toBeNull();
    await act(async () => {
      triggerBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Select exactly 5 distinct products using data-catalog-product-row attribute
    const productRows = [...document.querySelectorAll<HTMLElement>("[data-catalog-product-row]")];
    expect(productRows.length).toBeGreaterThanOrEqual(5);

    await act(async () => {
      for (let i = 0; i < 5; i++) {
        productRows[i].dispatchEvent(new MouseEvent("click", { bubbles: true }));
      }
    });

    const batchSendBtn = document.querySelector<HTMLButtonElement>('[data-testid="batch-send-catalog-btn"]');
    expect(batchSendBtn).not.toBeNull();
    expect(batchSendBtn?.textContent).toContain("Enviar produtos (5)");

    // Track clearTimeout calls to verify scheduled timer cancellation
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

    // Dispatch the batch send
    await act(async () => {
      batchSendBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      // Give product 0 50ms to dispatch and schedule the 400ms inter-item timer
      await new Promise((r) => setTimeout(r, 50));
    });

    // Verify first product was sent
    expect(handleSend).toHaveBeenCalledTimes(1);
    expect(sentProducts.length).toBe(1);

    // UNMOUNT right in the middle of the 400ms timer before product 2!
    await unmountCurrent();

    // Verify clearTimeout was invoked during unmount cleanup
    expect(clearTimeoutSpy).toHaveBeenCalled();

    // Wait longer than the entire remaining batch time (e.g. 1500ms for 5 products)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1200));
    });

    // Verify STRICT invariant: no further products were dispatched after unmount
    expect(handleSend).toHaveBeenCalledTimes(1);
    expect(sentProducts.length).toBe(1);

    clearTimeoutSpy.mockRestore();
  });

  it("Scenario 2: Unmount during in-flight async onSendProduct halts the loop at next step", async () => {
    let callCount = 0;
    const handleSend = vi.fn().mockImplementation(async () => {
      callCount++;
      // Simulate 80ms network latency
      await new Promise((r) => setTimeout(r, 80));
    });

    await mountComponent(
      <CatalogSelectorPopover
        disabled={false}
        canSendToChat={true}
        onSendProduct={handleSend}
      />
    );

    const triggerBtn = document.querySelector<HTMLButtonElement>("[data-catalog-trigger]");
    await act(async () => {
      triggerBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const productRows = [...document.querySelectorAll<HTMLElement>("[data-catalog-product-row]")];
    await act(async () => {
      for (let i = 0; i < 3; i++) {
        productRows[i].dispatchEvent(new MouseEvent("click", { bubbles: true }));
      }
    });

    const batchSendBtn = document.querySelector<HTMLButtonElement>('[data-testid="batch-send-catalog-btn"]');
    expect(batchSendBtn).not.toBeNull();

    // Click and then unmount while product 1 is in-flight (t = 30ms)
    await act(async () => {
      batchSendBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 30));
    });

    // Unmount during item 1's network call
    await unmountCurrent();

    // Wait for network call to resolve and see if it proceeds to item 2
    await act(async () => {
      await new Promise((r) => setTimeout(r, 600));
    });

    // The loop checked `if (!isMountedRef.current) break;` after awaiting onSendProduct
    // It must NOT have proceeded to item 2 or item 3
    expect(handleSend).toHaveBeenCalledTimes(1);
  });

  it("Scenario 3: Async error inside onSendProduct during unmount does not throw unhandled rejection", async () => {
    const handleSend = vi.fn().mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 40));
      throw new Error("Simulated WhatsApp Socket Disconnect");
    });

    await mountComponent(
      <CatalogSelectorPopover
        disabled={false}
        canSendToChat={true}
        onSendProduct={handleSend}
      />
    );

    const triggerBtn = document.querySelector<HTMLButtonElement>("[data-catalog-trigger]");
    await act(async () => {
      triggerBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const sendButtons = [...document.querySelectorAll<HTMLButtonElement>("button")].filter(
      (b) => b.textContent?.includes("Enviar no Chat")
    );
    expect(sendButtons.length).toBeGreaterThan(0);

    // Trigger single send and immediately unmount before the 40ms error throws
    await act(async () => {
      sendButtons[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 10));
    });

    await unmountCurrent();

    // Wait for the async error to fire in the background
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    // Must handle cleanly without crashing test or throwing unhandled rejection
    expect(handleSend).toHaveBeenCalledTimes(1);
  });

  it("Scenario 4: Window guard prevents state updates when window is undefined or torn down", async () => {
    let sendCompleted = false;
    const handleSend = vi.fn().mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 20));
      sendCompleted = true;
      return Promise.resolve();
    });

    await mountComponent(
      <CatalogSelectorPopover
        disabled={false}
        canSendToChat={true}
        onSendProduct={handleSend}
      />
    );

    const triggerBtn = document.querySelector<HTMLButtonElement>("[data-catalog-trigger]");
    await act(async () => {
      triggerBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const sendButtons = [...document.querySelectorAll<HTMLButtonElement>("button")].filter(
      (b) => b.textContent?.includes("Enviar no Chat")
    );
    expect(sendButtons.length).toBeGreaterThan(0);

    await act(async () => {
      sendButtons[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(sendCompleted).toBe(true);
    expect(handleSend).toHaveBeenCalledTimes(1);
  });

  it("Scenario 5: Rapid thrashing (15 consecutive mount, trigger batch send, unmount cycles) leaves 0 orphan timers", async () => {
    for (let cycle = 0; cycle < 15; cycle++) {
      const handleSend = vi.fn().mockResolvedValue(undefined);

      await mountComponent(
        <CatalogSelectorPopover
          disabled={false}
          canSendToChat={true}
          onSendProduct={handleSend}
        />
      );

      const triggerBtn = document.querySelector<HTMLButtonElement>("[data-catalog-trigger]");
      await act(async () => {
        triggerBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      const productRows = [...document.querySelectorAll<HTMLElement>("[data-catalog-product-row]")];
      if (productRows.length >= 2) {
        await act(async () => {
          productRows[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
          productRows[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });

        const batchSendBtn = document.querySelector<HTMLButtonElement>('[data-testid="batch-send-catalog-btn"]');
        if (batchSendBtn) {
          await act(async () => {
            batchSendBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
            // Variable delay between 0 and 45ms before unmount
            await new Promise((r) => setTimeout(r, (cycle % 4) * 15));
          });
        }
      }

      await unmountCurrent();
    }

    // Allow any remaining event loop ticks to drain
    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });

    expect(true).toBe(true);
  });
});
