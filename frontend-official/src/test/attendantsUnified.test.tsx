import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import AttendantsPage from "@/pages/Attendants/AttendantsPage";
import { AvatarEditorModal } from "@/components/avatar-engine/AvatarEditorModal";
import { TooltipProvider } from "@/components/ui/tooltip";
import { apiService } from "@/core/services/apiService";
import { useAppStore } from "@/state/stores/appStore";

vi.mock("@/components/layout/Header", () => ({
  Header: () => <div data-testid="mock-header">Header</div>,
}));
vi.mock("@/components/evolution/HistoryBootstrapPanel", () => ({ HistoryBootstrapPanel: ({ initialSessionId }: { initialSessionId: string }) => <div>Dados comerciais: {initialSessionId}</div> }));

// Mock apiService
vi.mock("@/core/services/apiService", () => ({
  apiService: {
    getAIAgents: vi.fn().mockResolvedValue({
      success: true,
      agents: [
        {
          key: "camila",
          name: "Camila",
          role: "Especialista em Vendas",
          storeId: "store-1",
          sessionIds: ["default"],
          active: true,
          stats: {
            chatsToday: 142,
            avgResponseTime: "12s",
            satisfactionCsat: 99,
          },
          avatarConfig: {
            agentId: "camila",
            body: "female",
            hair: "female_ponytail_brunette",
            clothing: "polo_zai_black",
            workObject: "laptop_zai",
            badge: true,
            branding: {
              storeName: "Loja Exemplo",
              primaryColor: "#10b981",
              logo: "LOJA",
            },
          },
        },
        {
          key: "carlos",
          name: "Carlos",
          role: "Suporte Técnico",
          storeId: "store-1",
          sessionIds: [],
          active: false,
          stats: {
            chatsToday: 35,
            avgResponseTime: "24s",
            satisfactionCsat: 94,
          },
        },
      ],
    }),
    getStores: vi.fn().mockResolvedValue({
      success: true,
      stores: [
        {
          id: "store-1",
          name: "Loja Principal Matriz",
          numbers: [{ sessionId: "default" }],
          settings: {
            primaryColor: "#10b981",
          },
        },
      ],
    }),
    getConnections: vi.fn().mockResolvedValue([
      {
        sessionId: "default",
        sessionName: "WhatsApp Vendas",
        phone: "+55 11 98765-4321",
        status: "connected",
        storeId: "store-1",
      },
    ]),
    getAIStatus: vi.fn().mockResolvedValue({ enabled: true }),
    getAIMetrics: vi.fn().mockResolvedValue({ messagesToday: 0, tokensToday: 0 }),
    testAIMessage: vi.fn().mockResolvedValue({ success: true, result: { ok: true, response: "Resposta real do serviço" } }),
    getSystemHealth: vi.fn().mockResolvedValue({ status: "ok" }),
    toggleAIAgent: vi.fn().mockResolvedValue({ success: true }),
    updateAgentAvatar: vi.fn().mockResolvedValue({ success: true }),
    updateStoreVisualDNA: vi.fn().mockResolvedValue({ success: true }),
    assignAttendantToConnection: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock("@/state/hooks/useAdminAuth", () => ({
  useAdminAuth: () => ({ isAuthenticated: true, user: { role: "admin" }, logout: vi.fn() }),
}));

vi.mock("@/state/hooks/useUserRole", () => ({
  useUserRole: () => ({ role: "admin", isLoading: false, roleLevel: { admin: 10, user: 1, viewer: 0 } }),
}));

vi.mock("@/state/hooks/use-mobile", () => ({
  useIsMobile: () => false,
  useViewMode: () => ["desktop", vi.fn()],
  setViewMode: vi.fn(),
  getViewMode: () => "desktop",
}));

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", MockResizeObserver);

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | undefined;
let container: HTMLDivElement | undefined;

beforeEach(() => {
  useAppStore.setState({ sessions: [], aiProgressByConversationId: {} });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  if (root) {
    await act(async () => {
      root?.unmount();
    });
  }
  if (container) {
    container.remove();
  }
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

describe("Unified Attendants & Assistente ZAI Integration Tests", () => {
  it("requires an explicit owner choice for conflicting legacy WhatsApp links", async () => {
    vi.mocked(apiService.getAIAgents).mockResolvedValueOnce({ success: true, agents: [
      { key: "a", name: "Ana", active: true, sessionIds: ["default"] },
      { key: "b", name: "Bruno", active: false, sessionIds: ["default"] },
    ] });
    await act(async () => root!.render(<MemoryRouter initialEntries={["/attendants?sessionId=default"]}><TooltipProvider><AttendantsPage /></TooltipProvider></MemoryRouter>));
    expect((document.getElementById("whatsapp-attendant") as HTMLSelectElement).value).toBe("");
    expect(document.body.textContent).toContain("vínculos antigos com mais de um atendente");
    expect(apiService.assignAttendantToConnection).not.toHaveBeenCalled();
  });
  it("does not reload the four operation datasets when closing an unchanged instruction editor", async () => {
    await act(async () => root!.render(<MemoryRouter><TooltipProvider><AttendantsPage /></TooltipProvider></MemoryRouter>));
    const before = vi.mocked(apiService.getAIAgents).mock.calls.length;
    await act(async () => Array.from(document.querySelectorAll("button")).find(button => button.textContent?.trim() === "Configurar IA")!.click());
    await act(async () => Array.from(document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find(button => button.textContent?.trim() === "Fechar")!.click());
    expect(apiService.getAIAgents).toHaveBeenCalledTimes(before);
  });
  it("switches the responsible agent in the selected WhatsApp without toggling activation", async () => {
    await act(async () => root!.render(<MemoryRouter initialEntries={["/attendants?sessionId=default&section=business"]}><TooltipProvider><AttendantsPage /></TooltipProvider></MemoryRouter>));
    expect(document.body.textContent).toContain("Dados comerciais: default");
    const select = document.getElementById("whatsapp-attendant") as HTMLSelectElement;
    expect(select.textContent).toContain("Carlos · Pausado");
    await act(async () => { select.value = "carlos"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(apiService.assignAttendantToConnection).toHaveBeenCalledWith("default", "carlos");
    expect(apiService.toggleAIAgent).not.toHaveBeenCalled();
    expect(apiService.updateStoreVisualDNA).not.toHaveBeenCalled();
  });
  async function renderPage() {
    await act(async () => {
      root!.render(<MemoryRouter><TooltipProvider><AttendantsPage /></TooltipProvider></MemoryRouter>);
    });
  }

  it("uses the store linked to WhatsApp instead of a conflicting agent store", async () => {
    vi.mocked(apiService.getStores).mockResolvedValueOnce({ success: true, stores: [
      { id: "store-1", name: "Loja antiga" },
      { id: "store-2", name: "Loja do WhatsApp", numbers: [{ sessionId: "default" }] },
    ] });
    await renderPage();
    const card = document.querySelector('[data-agent-key="camila"]');
    expect(card?.textContent).toContain("Loja do WhatsApp");
    expect(card?.textContent).not.toContain("Loja antiga");
  });

  it("preserves zero metrics and never substitutes made-up statistics", async () => {
    vi.mocked(apiService.getAIAgents).mockResolvedValueOnce({ success: true, agents: [
      { key: "empty", name: "Sem métricas", active: false, sessionIds: [] },
      { key: "zero", name: "Métricas zero", active: false, sessionIds: [], stats: { chatsToday: 0, avgResponseTime: "0s", satisfactionCsat: 0 } },
    ] });
    await renderPage();
    const empty = document.querySelector('[data-agent-key="empty"]');
    expect(empty?.textContent).toContain("Sem loja vinculada");
    expect(empty?.textContent).not.toMatch(/127|18s|96%/);
    expect(empty?.textContent).toContain("—");
    const zero = document.querySelector('[data-agent-key="zero"]');
    expect(zero?.textContent).not.toMatch(/127|18s|96%|0s|0%/);
    expect(zero?.textContent).toContain("WhatsApps0");
  });

  it("does not claim to operate when the assigned WhatsApp is disconnected", async () => {
    vi.mocked(apiService.getConnections).mockResolvedValueOnce([
      { sessionId: "default", phone: "11999999999", status: "disconnected" },
    ]);
    await renderPage();
    expect(document.body.textContent).toContain("WhatsApp desconectado");
    expect(document.body.textContent).not.toContain("No PC Operando");
    expect(document.body.textContent).not.toContain("Conectado ao WhatsApp");
  });

  it("keeps the current status when pausing fails", async () => {
    vi.mocked(apiService.toggleAIAgent).mockRejectedValueOnce(new Error("Falha ao pausar"));
    await renderPage();
    const button = Array.from(document.querySelectorAll('button')).find(b => b.textContent === "Pausar")!;
    await act(async () => { button.click(); });
    expect(document.querySelector('[data-agent-key="camila"]')?.textContent).toContain("Pausar");
  });

  it("uses actual response progress and returns to waiting when it completes", async () => {
    await renderPage();
    await act(async () => useAppStore.getState().updateAIResponseProgress("chat", {
      conversationId: "chat", sessionId: "default", agentName: "Camila", status: "typing", startedAt: new Date().toISOString(),
    }));
    expect(document.querySelector('[data-agent-key="camila"]')?.textContent).toContain("Conversando");
    await act(async () => useAppStore.getState().clearAIResponseProgress("chat"));
    expect(document.querySelector('[data-agent-key="camila"]')?.textContent).toContain("Aguardando conversa");
  });

  it("drops late sandbox replies after switching attendants", async () => {
    let resolveReply: (value: any) => void = () => {};
    vi.mocked(apiService.testAIMessage).mockReturnValueOnce(new Promise(resolve => { resolveReply = resolve; }));
    await renderPage();
    const input = document.querySelector('input[placeholder^="Pergunte algo"]') as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Qual o horário?");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => Array.from(document.querySelectorAll("button")).find(button => button.textContent === "Enviar")!.click());
    expect(apiService.testAIMessage).toHaveBeenCalledWith(expect.objectContaining({ agentKey: "camila", sessionId: "default" }));
    await act(async () => (document.querySelector('[data-agent-key="carlos"]') as HTMLElement).click());
    await act(async () => resolveReply({ success: true, result: { ok: true, response: "Resposta exclusiva da Camila" } }));
    expect(document.body.textContent).not.toContain("Resposta exclusiva da Camila");
    expect(document.body.textContent).not.toContain("Carlos está digitando");
  });

  it("removes every WhatsApp binding when leaving an attendant unassigned", async () => {
    vi.mocked(apiService.getAIAgents).mockResolvedValueOnce({ success: true, agents: [
      { key: "camila", name: "Camila", active: false, sessionIds: ["default", "second"] },
    ] });
    await renderPage();
    await act(async () => Array.from(document.querySelectorAll("button")).find(button => button.textContent === "Trocar WhatsApp")!.click());
    await act(async () => Array.from(document.querySelectorAll("button")).find(button => button.textContent?.includes("Nenhum número"))!.click());
    await act(async () => Array.from(document.querySelectorAll("button")).find(button => button.textContent === "Salvar Vínculo")!.click());
    expect(apiService.assignAttendantToConnection).toHaveBeenCalledWith("default", null);
    expect(apiService.assignAttendantToConnection).toHaveBeenCalledWith("second", null);
  });

  it("includes an attendant in every linked store and previews that store's WhatsApp", async () => {
    vi.mocked(apiService.getAIAgents).mockResolvedValueOnce({ success: true, agents: [{ key: "camila", name: "Camila", active: true, sessionIds: ["default", "second"] }] });
    vi.mocked(apiService.getStores).mockResolvedValueOnce({ success: true, stores: [
      { id: "first", name: "Matriz", numbers: [{ sessionId: "default" }] },
      { id: "second", name: "Filial", numbers: [{ sessionId: "second" }] },
    ] });
    vi.mocked(apiService.getConnections).mockResolvedValueOnce([
      { sessionId: "default", sessionName: "Número Matriz", status: "connected" },
      { sessionId: "second", sessionName: "Número Filial", status: "connected" },
    ]);
    await renderPage();
    const filial = Array.from(document.querySelectorAll("button")).find(button => button.textContent?.includes("Filial"))!;
    expect(filial.textContent).toContain("(1)");
    await act(async () => filial.click());
    const card = document.querySelector('[data-agent-key="camila"]');
    expect(card?.textContent).toContain("Filial");
    expect(card?.textContent).toContain("Número Filial");
    expect(card?.textContent).not.toContain("Matriz");
  });

  it("renders unified tabs and attendant cards with Store and WhatsApp data", async () => {
    await act(async () => {
      root!.render(
        <MemoryRouter initialEntries={["/attendants"]}>
          <TooltipProvider>
            <AttendantsPage />
          </TooltipProvider>
        </MemoryRouter>
      );
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const text = document.body.textContent || "";
    // Top Tabs
    expect(text).toContain("Atendente IA");
    expect(text).toContain("Assistente ZAI");

    // Attendant Card details
    expect(text).toContain("Camila");
    expect(text).toContain("Carlos");
    expect(text).toContain("Loja Principal Matriz");
    expect(text).toContain("+55 11 98765-4321");

    // Summarized Visual KPI Chips
    expect(text).toContain("WhatsApps");
    expect(text).toContain("Respostas IA hoje0");
    expect(text).toContain("Tokens hoje0");
    expect(text).not.toContain("99%");

    // Workstation status
    expect(text).toContain("Aguardando conversa");
  });

  it("renders Assistente ZAI view when ?tab=copilot", async () => {
    await act(async () => {
      root!.render(
        <MemoryRouter initialEntries={["/attendants?tab=copilot"]}>
          <TooltipProvider>
            <AttendantsPage />
          </TooltipProvider>
        </MemoryRouter>
      );
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const text = document.body.textContent || "";
    expect(text).toContain("Assistente ZAI");
    expect(text).toContain("Copiloto da Plataforma");
  });

  it("surfaces ambiguous WhatsApp ownership in the all-attendants view and lets the user open that connection", async () => {
    vi.mocked(apiService.getAIAgents).mockResolvedValueOnce({
      success: true,
      agents: [
        { key: "camila", name: "Camila", sessionIds: ["default"], active: true },
        { key: "joao", name: "João", sessionIds: ["default"], active: true },
      ],
    } as any);
    await act(async () => {
      root!.render(
        <MemoryRouter initialEntries={["/attendants"]}>
          <TooltipProvider><AttendantsPage /></TooltipProvider>
        </MemoryRouter>
      );
    });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });

    expect(document.body.textContent).toContain("1 WhatsApp(s) têm mais de um atendente vinculado.");
    const conflictSelect = document.querySelector<HTMLSelectElement>("#resolve-assignment-conflict");
    expect(conflictSelect?.options[1]?.textContent).toContain("Camila, João");

    await act(async () => {
      conflictSelect!.value = "default";
      conflictSelect!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(document.querySelector("#whatsapp-attendant")).not.toBeNull();
  });

  it("renders AvatarEditorModal without legacy badges, simulator or sprite debug text", async () => {
    const mockAgent = {
      key: "camila",
      name: "Camila",
      role: "Vendas",
      storeId: "store-1",
    };
    const mockStore = {
      id: "store-1",
      name: "Loja Principal Matriz",
          numbers: [{ sessionId: "default" }],
    };

    await act(async () => {
      root!.render(
        <TooltipProvider>
          <AvatarEditorModal
            open={true}
            onOpenChange={() => {}}
            agent={mockAgent}
            store={mockStore}
          />
        </TooltipProvider>
      );
    });

    const text = document.body.textContent || "";
    // Clean header & agent store on top
    expect(text).toContain("ZAI Avatar Studio");
    expect(text).toContain("Camila");
    expect(text).toContain("Loja Principal Matriz");

    // Must NOT contain old simulator or debug elements
    expect(text).not.toContain("Modular 2.5D");
    expect(text).not.toContain("Modular 2,5d");
    expect(text).not.toContain("Simular Estado");
    expect(text).not.toContain("Sprite ativo");

    // Verify dialog close button has emerald styling
    const closeBtn = document.querySelector('button[class*="border-emerald-500"]');
    expect(closeBtn).not.toBeNull();
  });
});
