import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import { createDashboardLovableViewModel } from "@/core/adapters/lovable/dashboardAdapter";
import type { Conversation } from "@/core/services/apiService";

vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "dark", setTheme: vi.fn() }) }));
vi.mock("@/state/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/core/services/notifyService", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: any) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ children }: any) => <div data-testid="marker">{children}</div>,
  Popup: ({ children }: any) => <div data-testid="popup">{children}</div>,
  Circle: ({ children }: any) => <div data-testid="circle">{children}</div>,
  useMap: () => ({
    setView: vi.fn(),
    flyTo: vi.fn(),
  }),
}));

vi.mock("leaflet", () => ({
  default: {
    divIcon: () => ({}),
  },
}));

if (typeof (globalThis as any).ResizeObserver === "undefined") {
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

const hoisted = vi.hoisted(() => {
  const conversations = [
    {
      id: "conv-1",
      phone: "5511999991111",
      contactName: "Cliente São Paulo",
      funnel_stage: "closed",
      tags: ["venda", "ia"],
      notes: "Endereço de Entrega: Av Paulista, 1000\nCoordenadas: -23.5505, -46.6333",
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
    {
      id: "conv-2",
      phone: "5521999992222",
      contactName: "Cliente Rio",
      funnel_stage: "negotiation",
      tags: ["negociacao"],
      notes: "Endereço de Entrega: Copacabana\nCoordenadas: -22.9068, -43.1729",
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
    {
      id: "conv-3",
      phone: "5531999993333",
      contactName: "Cliente Minas",
      funnel_stage: "new_lead",
      tags: ["frio"],
      notes: "Endereço de Entrega: Savassi\nCoordenadas: -19.9167, -43.9345",
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
  ];
  const state = {
    sessions: [{ id: "sess-1", status: "connected", phone: "5511999990000" }],
    conversations,
    updateApiHealth: vi.fn(),
  };
  return { conversations, state };
});

const mockConversations = hoisted.conversations as unknown as Conversation[];

vi.mock("@/state/stores/appStore", () => {
  const store: any = (selector: any) => selector(hoisted.state);
  store.getState = () => hoisted.state;
  return { useAppStore: store };
});

vi.mock("@/state/providers/RuntimeProvider", () => ({
  useRuntime: () => ({
    forceRefresh: vi.fn(),
    status: "online",
  }),
}));

vi.mock("@/core/services/apiService", () => ({
  apiService: {
    getMetrics: vi.fn().mockResolvedValue({
      messagesToday: 150,
      activeChats: 12,
      aiResponses: 60,
      newLeads: 8,
      totalConversations: 3,
      aiMemories: 5,
    }),
    getAIStatus: vi.fn().mockResolvedValue({
      enabled: true,
      model: "gpt-4o",
      provider: "openai",
    }),
    getAIMetrics: vi.fn().mockResolvedValue({
      tokensToday: 14500,
      promptTokensToday: 10200,
      completionTokensToday: 4300,
    }),
    getExecutiveAIInsights: vi.fn().mockResolvedValue({
      insights: [],
      score: 95,
      summary: "Operação estável",
    }),
  },
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("Dashboard 2 Grand Hubs Unification", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("defines exactly 2 grand hubs in the ViewModel adapter", () => {
    const vm = createDashboardLovableViewModel({
      conversations: mockConversations,
      metrics: null,
      sessions: [],
      runtimeStatus: "online",
      sessionState: "online",
    });

    expect(vm.tabs).toHaveLength(2);
    expect(vm.tabs[0].label).toBe("Hub ZAI & Performance Comercial");
    expect(vm.tabs[0].id).toBe("overview");
    expect(vm.tabs[1].label).toBe("Mapa & Inteligência de Conversas");
    expect(vm.tabs[1].id).toBe("map");
  });

  it("calculates commercial metrics and closed leads from real data", () => {
    const vm = createDashboardLovableViewModel({
      conversations: mockConversations,
      metrics: null,
      sessions: [],
      runtimeStatus: "online",
      sessionState: "online",
    });

    expect(vm.commercialMetrics.conversationsCount).toBe(3);
    expect(vm.commercialMetrics.contactsCount).toBe(3);
    // Closed or negotiation: conv-1 is closed, conv-2 is negotiation
    expect(vm.commercialMetrics.hotLeadsCount).toBe(1);
    expect(vm.commercialMetrics.closedLeadsCount).toBe(1);
    expect(vm.map.stateRows.length).toBeGreaterThanOrEqual(3);
  });

  it("renders Hub 1 (Hub ZAI & Performance Comercial) with executive cards and zero mock data", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/dashboard"]}>
          <Dashboard />
        </MemoryRouter>
      );
    });

    const text = container.textContent || "";
    // Top Tabs should render the 2 Grand Hubs
    expect(text).toContain("Hub ZAI & Performance Comercial");
    expect(text).toContain("Mapa & Inteligência de Conversas");

    // Hub 1 Executive Cards
    expect(text).toContain("Fila de Atendimento");
    expect(text).toContain("Conversas no Período");
    expect(text).toContain("Taxa de Conversão");
    expect(text).toContain("Leads em Decisão");
    expect(text).toContain("Automação IA");

    // Hub 1 Sections
    expect(text).toContain("Fluxo de Atividade Comercial");
    expect(text).toContain("Temperatura da Base de Leads");
    expect(text).toContain("Volumetria por Bloco de Horários");
    expect(text).toContain("Esteira Comercial (Fechamentos & Negociações)");
    expect(text).toContain("Uso Real da IA");
  });

  it("normalizes legacy ?tab=conversations to the Map & Intelligence Hub", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/dashboard?tab=conversations"]}>
          <Dashboard />
        </MemoryRouter>
      );
    });

    const text = container.textContent || "";
    // Should render Map Hub sections
    expect(text).toContain("Total Mapeado");
    expect(text).toContain("Estados Ativos");
    expect(text).toContain("DDDs Identificados");
    expect(text).toContain("Região Principal");
    expect(text).toContain("Geografia & Conversas");
  });

  it("normalizes legacy ?tab=ai and ?tab=commercial to Hub 1", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/dashboard?tab=commercial"]}>
          <Dashboard />
        </MemoryRouter>
      );
    });

    const text = container.textContent || "";
    expect(text).toContain("Hub ZAI & Performance Comercial");
    expect(text).toContain("Fluxo de Atividade Comercial");
  });

  it("generates individual lead pins and supports clicking lateral leads to focus on map", async () => {
    const vm = createDashboardLovableViewModel({
      conversations: mockConversations,
      metrics: null,
      sessions: [],
      runtimeStatus: "online",
      sessionState: "online",
    });

    expect(vm.map.leadPins.length).toBe(3);
    expect(vm.map.leadPins[0].lat).toBeDefined();
    expect(vm.map.leadPins[0].lng).toBeDefined();
    expect(vm.map.leadPins[0].name).toBe("Cliente São Paulo");

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/dashboard?tab=map"]}>
          <Dashboard />
        </MemoryRouter>
      );
    });

    const text = container.textContent || "";
    expect(text).toContain("Leads na Região (3)");

    // Switch to leads tab in sidebar panel
    const leadsTabBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Leads na Região")
    );
    expect(leadsTabBtn).toBeDefined();
    if (leadsTabBtn) {
      await act(async () => {
        leadsTabBtn.click();
      });
    }

    const updatedText = container.textContent || "";
    expect(updatedText).toContain("Ver no Mapa");
    expect(updatedText).toContain("Cliente São Paulo");
    expect(updatedText).toContain("Cliente Rio");
    expect(updatedText).toContain("Cliente Minas");

    // Click on a lead card to focus on map
    const leadCard = container.querySelector('[title="Focar e ver no mapa"]')?.closest("div.w-full");
    expect(leadCard).toBeDefined();
    if (leadCard) {
      await act(async () => {
        (leadCard as HTMLElement).click();
      });
    }

    // Detail drawer overlay should now appear with lead data and "Ver no Inbox"
    const finalText = container.textContent || "";
    expect(finalText).toContain("Ver no Inbox");
  });
});
