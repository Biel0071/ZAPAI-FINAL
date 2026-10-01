import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Routes, Route, Navigate } from "react-router-dom";
import UnifiedAIPage from "@/pages/AI";
import { Sidebar } from "@/components/layout/Sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

// Mock apiService
vi.mock("@/core/services/apiService", () => ({
  apiService: {
    getAIStatus: vi.fn().mockResolvedValue({ enabled: true }),
    updateAIStatus: vi.fn().mockResolvedValue({ success: true }),
    getAIAgents: vi.fn().mockResolvedValue({ success: true, agents: [{ id: "1", name: "Agente ZAI", role: "Vendas" }] }),
    getAIPrompt: vi.fn().mockResolvedValue({ prompt: "Você é o assistente virtual." }),
    saveAIPrompt: vi.fn().mockResolvedValue({ success: true }),
    getAIProviders: vi.fn().mockResolvedValue({ providers: [] }),
    saveAIProviders: vi.fn().mockResolvedValue({ success: true }),
    getAIBusinessHours: vi.fn().mockResolvedValue({ businessHours: { opening: "08:00", closing: "18:00", autoReply: true } }),
    getAIAbsenceMessage: vi.fn().mockResolvedValue({ message: "Estamos ausentes." }),
    saveAIBusinessHours: vi.fn().mockResolvedValue({ success: true }),
    saveAIAbsenceMessage: vi.fn().mockResolvedValue({ success: true }),
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
    detectAgentGaps: vi.fn().mockResolvedValue({ success: true, createdCount: 2 }),
    testAIConnection: vi.fn().mockResolvedValue({ ok: true, response: "Olá, conexão OK!", responseTimeMs: 120, totalTokens: 42 }),
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
    expect(text).toContain("Agente & Inteligência");
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
    expect(text).toContain("Fila de Reativação Automática");
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
    expect(text).toContain("Score de Inteligência do Agente");
    expect(text).toContain("Composição dos Pilares de Inteligência");
    expect(text).toContain("Central de Aprendizado");
  });

  it("sidebar contains ONLY unified 'IA & Automação' and does NOT have separate Operações, Fluxos, or Evolução IA entries", async () => {
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
    // MUST contain IA & Automação
    expect(text).toContain("IA & Automação");

    // MUST NOT contain the old separate navigation entries in CRM menu
    expect(text).not.toContain("Evolução IA");
    expect(text).not.toContain("Operações");
    expect(text).not.toContain("Fluxos");
  });

  it("handles redirect routes properly: /operations, /flows, /evolution to /ai?tab=...", async () => {
    let currentPath = "";

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
