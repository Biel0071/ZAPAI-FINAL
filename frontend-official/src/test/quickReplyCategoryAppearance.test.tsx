import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SidebarPanel } from "@/pages/Inbox/components/SidebarPanel";
import type { QuickReplyItem } from "@/pages/Inbox/types";

vi.mock("@/core/runtime/hooks/useProtectedMediaUrl", () => ({ useProtectedMediaUrl: (url: string | null) => url }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
afterEach(async () => { if (root) await act(async () => root?.unmount()); root = undefined; document.body.innerHTML = ""; });

const reply: QuickReplyItem = { id: "reply-a", title: "Boas-vindas", category: "Vendas", text: "Olá!", items: [{ type: "text", value: "Olá!" }] };
function createProps(overrides: Partial<ComponentProps<typeof SidebarPanel>> = {}): ComponentProps<typeof SidebarPanel> {
  return {
    selectedConversation: { id: "conversation-a", contactName: "Contato A", phone: "5511999991111", lastMessage: "Olá", updatedAt: "2026-10-06T10:00:00Z" },
    rightPanelTab: "qr", setRightPanelTab: vi.fn(), rightPanelCollapsed: false, setRightPanelCollapsed: vi.fn(), isTabletLayout: false, isDrawer: true,
    aiEnabledForConversation: false, aiRuntime: { globalEnabled: false, memoryEnabled: true, provider: "", model: "", lastResponseAt: null, lastResponseTimeMs: null, promptTokens: 0, completionTokens: 0, loading: false },
    conversationAiOverrideEnabled: false, suggestingResponse: false, handleSuggestResponse: vi.fn().mockResolvedValue(undefined), messages: [], aiMemory: null,
    leadNotes: "", setLeadNotes: vi.fn(), handleSaveLeadNotes: vi.fn().mockResolvedValue(undefined), newTagInput: "", setNewTagInput: vi.fn(), handleAddTagToSelectedConversation: vi.fn(), handleRemoveTagFromSelectedConversation: vi.fn(),
    updatingAiToggle: false, handleSetConversationAiEnabled: vi.fn().mockResolvedValue(undefined), responseSearchQuery: "", setResponseSearchQuery: vi.fn(), quickReplies: [reply], sending: false,
    openCreateQuickReplyDialog: vi.fn(), quickReplyCategory: "all", setQuickReplyCategory: vi.fn(), sendQuickReply: vi.fn().mockResolvedValue(undefined), toggleFavoriteQuickReply: vi.fn(), openEditQuickReplyDialog: vi.fn(), duplicateQuickReply: vi.fn(), deleteQuickReply: vi.fn(),
    setMessageInput: vi.fn(), handleOpenMediaPreview: vi.fn(), handleDownloadMedia: vi.fn(),
    ...overrides,
  };
}
async function renderPanel(props: ComponentProps<typeof SidebarPanel>) {
  if (!root) { const container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); }
  await act(async () => root!.render(<SidebarPanel {...props} />));
}
async function click(element: HTMLElement) { await act(async () => { element.dispatchEvent(new MouseEvent("click", { bubbles: true })); await new Promise(resolve => setTimeout(resolve, 0)); }); }
async function inputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

describe("edição da aparência da categoria", () => {
  it("expõe falha ao carregar aparências e permite tentar de novo", async () => {
    const retry = vi.fn().mockResolvedValue(undefined);
    await renderPanel(createProps({ quickReplyCategoryAppearanceError: true, onRetryQuickReplyCategoryAppearance: retry }));
    expect(document.querySelector('[role="alert"]')).toHaveTextContent("Não foi possível carregar emoji e cor");
    await click([...document.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent?.includes("Tentar novamente"))!);
    expect(retry).toHaveBeenCalledOnce();
  });

  it("salva emoji e cor da categoria selecionada", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    await renderPanel(createProps({ saveQuickReplyCategoryAppearance: save }));
    await click([...document.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent?.trim() === "Editar")!);
    const emoji = document.querySelector<HTMLInputElement>('[aria-label="Emoji da categoria"]')!;
    const color = document.querySelector<HTMLInputElement>('[aria-label="Cor da categoria"]')!;
    expect(emoji.value).toBe("📁"); expect(color.value).toBe("#16a34a");
    await inputValue(emoji, "💰"); await inputValue(color, "#123abc");
    await click([...document.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent?.trim() === "Salvar categoria")!);
    expect(save).toHaveBeenCalledWith("vendas", { emoji: "💰", color: "#123abc" });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("mantém o diálogo aberto e mostra falha quando o salvamento falha", async () => {
    const save = vi.fn().mockRejectedValue(new Error("indisponível"));
    await renderPanel(createProps({ saveQuickReplyCategoryAppearance: save }));
    await click([...document.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent?.trim() === "Editar")!);
    await click([...document.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent?.trim() === "Salvar categoria")!);
    expect(save).toHaveBeenCalledOnce();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.querySelector('[role="alert"]')).toHaveTextContent("Não foi possível salvar");
  });
});
