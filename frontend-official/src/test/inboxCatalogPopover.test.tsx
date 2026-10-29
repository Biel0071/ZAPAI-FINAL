import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CatalogSelectorPopover,
  formatProductMessage,
  OFFICIAL_STORE_CATALOG_URL,
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

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined;
  document.body.innerHTML = "";
});

async function renderComponent(node: React.ReactNode) {
  if (!root) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  }
  await act(async () => root!.render(node));
}

describe("WhatsApp Catalog Integration & Inbox Dispatch", () => {
  it("formats WhatsApp catalog message with price, details, and store link", () => {
    const sampleProduct: CatalogProduct = {
      id: "prod_tijolo_8f",
      code: "TIJ-8F-MIL",
      name: "Tijolo Cerâmico 8 Furos 9x19x19cm (Milheiro)",
      description: "Tijolo cerâmico 8 furos padrão 9x19x19cm de alta qualidade.",
      price: 980.0,
      category: "Tijolos & Blocos",
      stock: 45,
      shipping: "Entrega expressa com caminhão próprio",
      promotions: "5% de desconto à vista no PIX",
      whatsapp_url: OFFICIAL_STORE_CATALOG_URL,
    };

    const message = formatProductMessage(sampleProduct);

    expect(message).toContain("[CATÁLOGO WHATSAPP]");
    expect(message).toContain("Tijolo Cerâmico 8 Furos 9x19x19cm (Milheiro)");
    expect(message).toContain("TIJ-8F-MIL");
    expect(message).toContain("R$");
    expect(message).toContain("980,00");
    expect(message).toContain("Entrega expressa com caminhão próprio");
    expect(message).toContain("https://wa.me/c/553193672075");
  });

  it("renders catalog trigger button beside emojis with data-catalog-trigger", async () => {
    const handleSend = vi.fn().mockResolvedValue(undefined);

    await renderComponent(
      <CatalogSelectorPopover
        disabled={false}
        onSendProduct={handleSend}
      />
    );

    const triggerBtn = document.querySelector<HTMLButtonElement>("[data-catalog-trigger]");
    expect(triggerBtn).not.toBeNull();
    expect(triggerBtn?.getAttribute("aria-label")).toContain("catálogo WhatsApp");
  });

  it("opens popover on click and lists products with 'Enviar no Chat' action", async () => {
    const handleSend = vi.fn().mockResolvedValue(undefined);

    await renderComponent(
      <CatalogSelectorPopover
        disabled={false}
        onSendProduct={handleSend}
      />
    );

    const triggerBtn = document.querySelector<HTMLButtonElement>("[data-catalog-trigger]");
    expect(triggerBtn).not.toBeNull();

    await act(async () => {
      triggerBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const popover = document.querySelector("[data-catalog-popover]");
    expect(popover).not.toBeNull();
    expect(popover?.textContent).toContain("Catálogo WhatsApp");
    expect(popover?.textContent).toContain("Depósito Vista Alegre");
    expect(popover?.textContent).toContain("Tijolo Cerâmico 8 Furos");
  });

  it("executes product dispatch callback when 'Enviar no Chat' is clicked", async () => {
    const handleSend = vi.fn().mockResolvedValue(undefined);

    await renderComponent(
      <CatalogSelectorPopover
        disabled={false}
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
    });

    expect(handleSend).toHaveBeenCalledTimes(1);
    expect(handleSend).toHaveBeenCalledWith(
      expect.objectContaining({ name: expect.any(String), price: expect.anything() }),
      expect.stringContaining("[CATÁLOGO WHATSAPP]")
    );
  });
});
