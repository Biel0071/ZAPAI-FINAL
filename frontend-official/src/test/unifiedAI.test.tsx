import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Routes, Route, Navigate } from "react-router-dom";
import UnifiedAIPage from "@/pages/AI";
import { Sidebar } from "@/components/layout/Sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { apiService } from "@/core/services/apiService";
const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock("@/state/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

// Mock apiService
vi.mock("@/core/services/apiService", () => ({
  apiService: {
    getAIStatus: vi.fn().mockResolvedValue({ enabled: true }),
    updateAIStatus: vi.fn().mockResolvedValue({ success: true }),
    getAIAgents: vi.fn().mockResolvedValue({ success: true, agents: [{ key: "camila", name: "Ana", role: "Suporte", personality: "Instrução salva", tone: "consultative", temperature: 0.2, responseStyle: "detailed", objective: "suporte", active: false }] }),
    updateAIAgent: vi.fn().mockResolvedValue({ success: true }),
    getAIPrompt: vi.fn().mockResolvedValue({ prompt: "Você é o assistente virtual." }),
    saveAIPrompt: vi.fn().mockResolvedValue({ success: true }),
    getAIProviders: vi.fn().mockResolvedValue({ providers: [] }),
    saveUserProvider: vi.fn().mockResolvedValue({ success: true }),
    getBusinessHours: vi.fn().mockResolvedValue({ openTime: "08:00", closeTime: "18:00", timezone: "America/Sao_Paulo", autoReplyOutsideHours: true }),
    getAbsenceMessage: vi.fn().mockResolvedValue({ message: "Estamos ausentes." }),
    saveBusinessHours: vi.fn().mockResolvedValue({ success: true }),
    saveAbsenceMessage: vi.fn().mockResolvedValue({ success: true }),
    getQueueStats: vi.fn().mockResolvedValue({ customersWaiting: 0 }),
    fetchOperationsMetrics: vi.fn().mockResolvedValue({
      success: true,
      data: {
        metrics: {
          totalConversations: 10,
          openConversations: 5,
          waitingConversations: 2,
          closedConversations: 3,
          avgResponseTimeSeconds: 15,
          avgHandlingTimeMinutes: 5,
          slaCompliancePercent: 95,
          transfersToday: 1,
          productivityIndex: 90,
        },
        operators: [{ id: "op-1", name: "Carlos", role: "Operador", status: "online", activeChats: 2, totalToday: 8 }],
      },
    }),
    getAgentEvolution: vi.fn().mockResolvedValue({
      success: true,
      evolution: {
        score: 85,
        level: "Avançado",
        goal: { current: 17, target: 20, percentage: 85 },
        components: { answers: 36, refinements: 26, coverage: 17, queue: 6 },
      },
      history: [{ id: 1, description: "Prompt refinado com sucesso", scoreChange: 5, createdAt: "Hoje" }],
    }),
    getAgentLearning: vi.fn().mockResolvedValue({
      success: true,
      pending: [{ id: 101, customerQuestion: "Vocês aceitam Pix parcelado?" }],
    }),
    getLearnedPatterns: vi.fn().mockResolvedValue({
      patterns: [],
      goldSamplesCount: 58,
      naturalnessScore: 98,
      humanMessagesCount: 18722,
    }),
    syncManualAttendance: vi.fn().mockResolvedValue({
      success: true,
      minedCount: 10,
      totalLearned: 58,
      xpGained: 50,
      newLevel: 4,
    }),
    detectAgentGaps: vi.fn().mockResolvedValue({ success: true, createdCount: 2 }),
    testAIMessage: vi.fn().mockResolvedValue({ success: true, result: { ok: true, response: "Olá, conexão OK!", responseTimeMs: 120, totalTokens: 42 } }),
  },
  requestApiEndpoint: vi.fn().mockImplementation((url: string) => {
    if (url.includes("/api/flows")) {
      return Promise.resolve([
        { id: "f1", name: "Fluxo Preços", trigger: "preco", response: "Nossa tabela de preços é..." },
      ]);
    }
    if (url.includes("/api/ai/queue/status")) {
      return Promise.resolve({ waiting: 3 });
    }
    return Promise.resolve({});
  }),
  API_ORIGIN: "http://localhost:3000",
}));

// Mock hooks
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

vi.mock("@/state/stores/systemHealthStore", () => {
  const store = {
    health: { status: "ok" },
    startPolling: vi.fn(),
  };
  return {
    useSystemHealthStore: (selector?: (state: any) => any) =>
      typeof selector === "function" ? selector(store) : store,
  };
});

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
vi.mock("@/components/evolution/OfficialKnowledgeManager", () => ({ OfficialKnowledgeManager: () => null }));
vi.mock("@/components/evolution/PlaybookManager", () => ({ PlaybookManager: () => null }));

let root: Root | undefined;
let container: HTMLDivElement | undefined;

beforeEach(() => {
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

describe("Unified AI & Automação Page and Route Simplification", () => {
  it("renders the 4 unified tabs on the AI page", async () => {
    await act(async () => {
      root!.render(
        <MemoryRouter initialEntries={["/ai"]}>
          <UnifiedAIPage />
        </MemoryRouter>
      );
    });

    const text = document.body.textContent || "";
    expect(text).toContain("IA & Automação");
    expect(text).toContain("Configurações da IA");
    expect(text).toContain("Automação & Fluxos");
    expect(text).toContain("Operações & Filas");
    expect(text).toContain("Evolução & Score");
  });

  it("switches to Automação & Fluxos tab when ?tab=flows is in URL", async () => {
    await act(async () => {
      root!.render(
        <MemoryRouter initialEntries={["/ai?tab=flows"]}>
          <UnifiedAIPage />
        </MemoryRouter>
      );
    });

    const text = document.body.textContent || "";
    expect(text).toContain("Horário de Atendimento");
    expect(text).toContain("Fluxos de Conversa");
    expect(text).toContain("Playbooks de Negociação");
  });

  it("switches to Operações & Filas tab when ?tab=operations is in URL", async () => {
    await act(async () => {
      root!.render(
        <MemoryRouter initialEntries={["/ai?tab=operations"]}>
          <UnifiedAIPage />
        </MemoryRouter>
      );
    });

    const text = document.body.textContent || "";
    expect(text).toContain("Fila de Espera");
    expect(text).toContain("Status dos Nós de Conexão");
    expect(text).toContain("Fila de mensagens");
    expect(document.querySelector('a[href="/settings?tab=queue"]')).toHaveTextContent("Consultar fila");
  });

  it("switches to Evolução & Score tab when ?tab=evolution is in URL", async () => {
    await act(async () => {
      root!.render(
        <MemoryRouter initialEntries={["/ai?tab=evolution"]}>
          <UnifiedAIPage />
        </MemoryRouter>
      );
    });

    const text = document.body.textContent || "";
    expect(text).toContain("Nível de Maturidade do Atendente");
    expect(text).toContain("Pilares da Inteligência Cognitiva");
    expect(text).toContain("Central de Aprendizado");
  });

  it("sidebar has the unified attendants entry and stores without duplicate navigation", async () => {
    await act(async () => {
      root!.render(
        <MemoryRouter initialEntries={["/dashboard"]}>
          <TooltipProvider>
            <Sidebar />
          </TooltipProvider>
        </MemoryRouter>
      );
    });

    const text = document.body.textContent || "";
    expect(text).toContain("Atendentes");
    expect(document.querySelector('a[href="/stores"]')).toBeNull();
    expect(text).toContain("Atendentes & Assistente ZAI");
    expect(document.querySelectorAll('a[href="/attendants"]').length).toBe(1);
    for (const [path, label] of [["/dashboard", "Dashboard"], ["/inbox", "Inbox"], ["/contacts", "Contatos"], ["/connections", "Conexões"], ["/campaigns", "Campanhas"], ["/settings", "Configurações"]]) {
      expect(document.querySelector(`a[href="${path}"]`)?.textContent).toContain(label);
    }

    // MUST NOT contain the old separate navigation entries in CRM menu
    expect(text).not.toContain("Evolução IA");
    expect(text).not.toContain("Operações");
    expect(text).not.toContain("Fluxos");
  });

  it("handles redirect routes properly: /operations, /flows, /evolution to /ai?tab=...", async () => {
    const currentPath = "";

    function LocationWatcher() {
      const location = window.location;
      return <div id="loc">{location.pathname + location.search}</div>;
    }

    await act(async () => {
      root!.render(
        <MemoryRouter initialEntries={["/operations"]}>
          <Routes>
            <Route path="/operations" element={<Navigate to="/ai?tab=operations" replace />} />
            <Route path="/flows" element={<Navigate to="/ai?tab=flows" replace />} />
            <Route path="/evolution" element={<Navigate to="/ai?tab=evolution" replace />} />
            <Route path="/ai" element={<UnifiedAIPage />} />
          </Routes>
        </MemoryRouter>
      );
    });

    const text = document.body.textContent || "";
    // Should be on the unified AI page on the operations tab
    expect(text).toContain("IA & Automação");
    expect(text).toContain("Operações & Filas");
  });
});

it("saves the selected agent's actual identity, prompt and settings instead of legacy defaults", async () => {
  await act(async () => root!.render(<MemoryRouter initialEntries={["/ai"]}><UnifiedAIPage /></MemoryRouter>));
  const save = Array.from(document.querySelectorAll("button")).find(button => button.textContent?.includes("Salvar Configurações do Agente"));
  expect(save).toBeDefined();
  await act(async () => save!.click());
  expect(apiService.updateAIAgent).toHaveBeenCalledWith("camila", expect.objectContaining({ name: "Ana", role: "Suporte", personality: "Instrução salva", tone: "consultative", temperature: 0.2, responseStyle: "detailed", objective: "suporte" }));
  expect(apiService.saveAIPrompt).not.toHaveBeenCalled();
});

it("keeps the selected agent's store context and discards test replies after switching agents", async () => {
  vi.mocked(apiService.getAIAgents).mockResolvedValueOnce({ success: true, agents: [
    { key: "alpha", name: "Ana", active: true, sessionIds: ["loja-a"], personality: "Instrução A", temperature: 0.2, responseStyle: "detailed" },
    { key: "beta", name: "Bruno", active: false, sessionIds: ["loja-b"], personality: "Instrução B" },
  ] });
  let resolveReply: (value: any) => void = () => {};
  vi.mocked(apiService.testAIMessage).mockReturnValueOnce(new Promise(resolve => { resolveReply = resolve; }));
  await act(async () => root!.render(<MemoryRouter><UnifiedAIPage /></MemoryRouter>));
  const input = document.querySelector('input[placeholder="Digite como se fosse um cliente..."]') as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Qual o prazo?");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => input.closest("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  expect(apiService.testAIMessage).toHaveBeenCalledWith(expect.objectContaining({ agentKey: "alpha", sessionId: "loja-a", temperature: 0.2, responseStyle: "detailed" }));
  const select = document.getElementById("ai-config-agent") as HTMLSelectElement;
  await act(async () => { select.value = "beta"; select.dispatchEvent(new Event("change", { bubbles: true })); });
  await act(async () => resolveReply({ success: true, result: { ok: true, response: "Resposta exclusiva da Ana" } }));
  expect(document.body.textContent).not.toContain("Resposta exclusiva da Ana");
  expect(document.body.textContent).toContain("Testando com as regras de Bruno");
});

it("updates the configuration form after saving instructions in the popup", async () => {
  await act(async () => root!.render(<MemoryRouter><UnifiedAIPage /></MemoryRouter>));
  await act(async () => Array.from(document.querySelectorAll("button")).find(button => button.textContent === "Editar instruções")!.click());
  const input = document.getElementById("agent-config-name") as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Ana revisada");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => Array.from(document.querySelectorAll("button")).find(button => button.textContent === "Salvar Configuração")!.click());
  expect(document.body.textContent).toContain("Testando com as regras de Ana revisada");
  await act(async () => Array.from(document.querySelectorAll("button")).find(button => button.textContent === "Salvar Configurações do Agente")!.click());
  expect(apiService.updateAIAgent).toHaveBeenLastCalledWith("camila", expect.objectContaining({ name: "Ana revisada", personality: "Instrução salva" }));
});

it("shows a save failure instead of confirming an agent configuration rejected by the API", async () => {
  vi.mocked(apiService.updateAIAgent).mockResolvedValueOnce({ success: false, agent: null });
  await act(async () => root!.render(<MemoryRouter><UnifiedAIPage /></MemoryRouter>));
  await act(async () => Array.from(document.querySelectorAll("button")).find(button => button.textContent === "Salvar Configurações do Agente")!.click());
  expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Erro ao salvar agente", variant: "destructive" }));
  expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: "Agente salvo com sucesso!" }));
});
