import { act, type ComponentProps, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SidebarPanel } from "@/pages/Inbox/components/SidebarPanel";
import { QuickResponseModal } from "@/pages/Inbox/components/QuickResponseModal";
import type { QuickReplyItem } from "@/pages/Inbox/types";

vi.mock("@/core/runtime/hooks/useProtectedMediaUrl", () => ({ useProtectedMediaUrl: (url: string | null) => url }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
afterEach(async () => { if (root) await act(async () => root?.unmount()); root = undefined; document.body.innerHTML = ""; });
async function renderPanel(node: ReactNode) {
  if (!root) { const container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); }
  await act(async () => root!.render(node));
}
const button = (text: string) => [...document.querySelectorAll<HTMLButtonElement>("button")].find(element => element.textContent?.includes(text))!;
async function click(element: HTMLElement, props = {}) { await act(async () => element.dispatchEvent(new MouseEvent("click", { bubbles: true, ...props }))); }
const textReply: QuickReplyItem = { id: "reply-text", title: "Saudação salva", category: "Atendimento", text: "Olá {{nome}}!", items: [{ type: "text", value: "Olá {{nome}}!" }] };
const flowReply: QuickReplyItem = { id: "reply-flow", title: "Catálogo salvo", category: "Vendas", text: "", isFlow: true, steps: [{ id: "s1", type: "text", value: "Veja nosso catálogo.", delayMs: 0 }, { id: "s2", type: "file", value: "/media/catalogo.pdf", filename: "catalogo.pdf", caption: "Produtos disponíveis", delayMs: 2000 }] };
function createProps(overrides: Partial<ComponentProps<typeof SidebarPanel>> = {}): ComponentProps<typeof SidebarPanel> {
  return {
    selectedConversation: { id: "conversation-a", contactName: "Contato A", phone: "5511999991111", lastMessage: "Preciso de ajuda", updatedAt: "2026-09-30T10:00:00Z", agent_name: "Agente Persistido", assigned_to: "Agente Antigo" },
    rightPanelTab: "ai", setRightPanelTab: vi.fn(), rightPanelCollapsed: false, setRightPanelCollapsed: vi.fn(), isTabletLayout: false, isDrawer: true,
    aiEnabledForConversation: false, aiRuntime: { globalEnabled: false, aiOn: false, providerReady: true, provider: "Provedor configurado", model: "modelo-real", memoryEnabled: true, loading: false, lastResponseAt: null, lastResponseTimeMs: null, promptTokens: 0, completionTokens: 0 },
    conversationAiOverrideEnabled: true, suggestingResponse: false, handleSuggestResponse: vi.fn().mockResolvedValue(undefined),
    messages: [{ id: "message-a", conversationId: "conversation-a", content: "Preciso de ajuda", fromMe: false, createdAt: "2026-09-30T10:00:00Z" }], aiMemory: null,
    leadNotes: "", setLeadNotes: vi.fn(), handleSaveLeadNotes: vi.fn().mockResolvedValue(undefined), newTagInput: "", setNewTagInput: vi.fn(), handleAddTagToSelectedConversation: vi.fn(), handleRemoveTagFromSelectedConversation: vi.fn(),
    updatingAiToggle: false, handleSetConversationAiEnabled: vi.fn().mockResolvedValue(undefined), responseSearchQuery: "", setResponseSearchQuery: vi.fn(), quickReplies: [textReply, flowReply], sending: false,
    openCreateQuickReplyDialog: vi.fn(), quickReplyCategory: "all", setQuickReplyCategory: vi.fn(), sendQuickReply: vi.fn().mockResolvedValue(undefined), toggleFavoriteQuickReply: vi.fn(), openEditQuickReplyDialog: vi.fn(), duplicateQuickReply: vi.fn(), deleteQuickReply: vi.fn(),
    setMessageInput: vi.fn(), handleOpenMediaPreview: vi.fn(), handleDownloadMedia: vi.fn(), aiAgents: [{ id: "agent-1", name: "Agente Persistido" }, { id: "agent-2", name: "Outro Agente" }], handleSetConversationAgent: vi.fn(), isWhatsappConnected: true,
    ...overrides,
  };
}
describe("Painel do Inbox", () => {
  it("mostra autoria de IA e estados de envio reais na linha do tempo", async () => {
    const props = createProps({
      rightPanelTab: "history",
      messages: [
        { id: "ai-response", content: "Resposta da IA", fromMe: true, isAI: true, status: "pending", createdAt: "2026-09-30T10:01:00Z" },
        { id: "human-response", content: "Resposta do operador", fromMe: true, isAI: false, status: "failed", createdAt: "2026-09-30T10:02:00Z" },
      ],
    });
    await renderPanel(<SidebarPanel {...props} />);
    expect(document.body.textContent).toContain("IA Respondeu");
    expect(document.body.textContent).toContain("Atendente Enviou");
    expect(document.body.textContent).toContain("Na fila de envio");
    expect(document.body.textContent).toContain("Falha no envio");
    expect(document.body.textContent).toContain("Primeira mensagem carregada");
    expect(document.body.textContent).not.toContain("Conversa Iniciada");
  });
  it("distingue ativação global da permissão da conversa e permite sugestão manual", async () => {
    const props = createProps(); await renderPanel(<SidebarPanel {...props} />);
    expect([...document.querySelectorAll('[role="tab"]')].map(tab => tab.textContent)).toEqual(["Atendimento", "Respostas", "Arquivos", "Histórico"]);
    expect(document.getElementById("conversation-ai-toggle")).toHaveAttribute("aria-checked", "true");
    expect(document.body.textContent).toContain("IA global pausada");
    expect(button("Sugerir resposta")).not.toBeDisabled(); await click(button("Sugerir resposta"));
    expect(props.handleSuggestResponse).toHaveBeenCalledOnce();
  });
  it("exibe e altera o agente persistido", async () => {
    const props = createProps(); await renderPanel(<SidebarPanel {...props} />);
    const select = document.getElementById("conversation-agent") as HTMLSelectElement;
    expect(select.value).toBe("Agente Persistido");
    await act(async () => { select.value = "Outro Agente"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(props.handleSetConversationAgent).toHaveBeenCalledWith("Outro Agente");
  });
  it("insere resposta textual no rascunho, inclusive com Shift ou clique duplo", async () => {
    const props = createProps({ rightPanelTab: "qr" }); await renderPanel(<SidebarPanel {...props} />);
    await click(button("Saudação salva"), { shiftKey: true });
    await act(async () => button("Saudação salva").dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
    expect(props.setMessageInput).toHaveBeenCalledWith("Olá Contato A!");
    expect(props.sendQuickReply).not.toHaveBeenCalled(); expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
  it("mostra todas as etapas e envia só após confirmação", async () => {
    const props = createProps({ rightPanelTab: "qr" }); await renderPanel(<SidebarPanel {...props} />); await click(button("Catálogo salvo"));
    expect(document.querySelector('[role="dialog"]')).not.toBeNull(); expect(document.body.textContent).toContain("Veja nosso catálogo."); expect(document.body.textContent).toContain("catalogo.pdf");
    expect(props.sendQuickReply).not.toHaveBeenCalled(); await click(button("Confirmar envio"));
    expect(props.sendQuickReply).toHaveBeenCalledWith(flowReply, 2000);
  });
  it("fecha a prévia ao trocar de conversa", async () => {
    const props = createProps({ rightPanelTab: "qr" }); await renderPanel(<SidebarPanel {...props} />); await click(button("Catálogo salvo"));
    await renderPanel(<SidebarPanel {...props} selectedConversation={{ ...props.selectedConversation!, id: "conversation-b", contactName: "Contato B" }} />);
    expect(document.querySelector('[role="dialog"]')).toBeNull(); expect(props.sendQuickReply).not.toHaveBeenCalled();
  });
  it("mostra erro de carregamento sem inventar respostas", async () => {
    await renderPanel(<SidebarPanel {...createProps({ rightPanelTab: "qr", quickReplies: [], quickRepliesError: true })} />);
    expect(document.querySelector('[role="alert"]')).toHaveTextContent("Não foi possível carregar");
    expect(document.body.textContent).not.toContain("Olá, como posso ajudar?");
  });
});
describe("Confirmação de resposta rápida", () => {
  it("preserva a prévia ao falhar a fila", async () => {
    const onClose = vi.fn(); const onDispatch = vi.fn().mockRejectedValue(new Error("WhatsApp desconectado"));
    await renderPanel(<QuickResponseModal isOpen onClose={onClose} quickReply={flowReply} recipientName="Contato A" onDispatch={onDispatch} />);
    await click(button("Confirmar envio"));
    expect(document.querySelector('[role="alert"]')).toHaveTextContent("WhatsApp desconectado"); expect(onClose).not.toHaveBeenCalled();
  });
});
