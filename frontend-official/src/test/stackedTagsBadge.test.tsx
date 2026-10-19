import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StackedTagsBadge } from "@/components/inbox/StackedTagsBadge";
import { getTagDescriptor } from "@/core/utils/tagEmojis";

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
  await act(async () => {
    root!.render(node);
  });
}

describe("StackedTagsBadge & Monochromatic Standard", () => {
  it("defaults to monochromatic descriptor for all tag descriptors", () => {
    const descVip = getTagDescriptor("VIP");
    expect(descVip.isMonochrome).toBe(true);

    const descLead = getTagDescriptor("Lead Quente");
    expect(descLead.isMonochrome).toBe(true);

    const descOrcamento = getTagDescriptor("Orçamento");
    expect(descOrcamento.isMonochrome).toBe(true);
  });

  it("renders stacked overlapping circular badges with overflow indicator", async () => {
    const tags = ["VIP", "Orçamento", "Lead Quente", "Follow-up", "Novo Lead"];
    await renderComponent(
      <StackedTagsBadge tags={tags} maxVisible={3} showCountLabel={true} />
    );

    // Check count label and overflow indicator
    expect(document.body.textContent).toContain("5 etiquetas");
    expect(document.body.textContent).toContain("+2");

    // Check stacked overlapping negative space class
    const stack = document.querySelector(".-space-x-1\\.5");
    expect(stack).not.toBeNull();
  });

  it("renders empty state placeholder when no tags exist", async () => {
    await renderComponent(<StackedTagsBadge tags={[]} />);
    expect(document.body.textContent).toContain("Adicionar etiqueta");
  });

  it("opens popover card when clicked and triggers tag callbacks", async () => {
    const handleAdd = vi.fn();
    const handleRemove = vi.fn();
    const tags = ["VIP", "Orçamento"];

    await renderComponent(
      <StackedTagsBadge
        tags={tags}
        onAddTag={handleAdd}
        onRemoveTag={handleRemove}
        showCountLabel={true}
      />
    );

    // Trigger click on the stack
    const trigger = document.querySelector(".group.cursor-pointer");
    expect(trigger).not.toBeNull();

    await act(async () => {
      trigger!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Verify popover card elements exist in DOM
    expect(document.body.textContent).toContain("Etiquetas do Lead");
    expect(document.body.textContent).toContain("Etiquetas Atribuídas");

    const suggestionBtn = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
      (btn) => btn.textContent?.includes("Follow-up")
    );
    expect(suggestionBtn).toBeDefined();

    await act(async () => {
      suggestionBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(handleAdd).toHaveBeenCalledWith("Follow-up");

    // Test remove button on VIP tag
    const removeVipBtn = document.querySelector<HTMLButtonElement>("button[aria-label='Remover etiqueta VIP']");
    expect(removeVipBtn).not.toBeNull();

    await act(async () => {
      removeVipBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(handleRemove).toHaveBeenCalledWith("VIP");
  });
});
