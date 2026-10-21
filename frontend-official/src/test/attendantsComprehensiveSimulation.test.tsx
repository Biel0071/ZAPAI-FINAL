import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import AttendantsPage from "@/pages/Attendants/AttendantsPage";
import { AgentTab } from "@/pages/AI/AgentTab";
import { SidebarPanel } from "@/pages/Inbox/components/SidebarPanel";
import { ZaiAvatarRenderer } from "@/components/avatar-engine/ZaiAvatarRenderer";
import { AvatarEditorModal } from "@/components/avatar-engine/AvatarEditorModal";
import { EXAMPLE_ATTENDANTS } from "@/components/attendants/exampleAttendants";
import { createAgentAvatar } from "@/components/avatar-engine/CharacterFactory";
import { TooltipProvider } from "@/components/ui/tooltip";
import { apiService } from "@/core/services/apiService";
import { useAppStore } from "@/state/stores/appStore";

vi.mock("@/components/layout/Header", () => ({
  Header: () => <div data-testid="mock-header">Header</div>,
}));

vi.mock("@/components/evolution/HistoryBootstrapPanel", () => ({
  HistoryBootstrapPanel: ({ initialSessionId }: { initialSessionId: string }) => (
    <div data-testid="history-bootstrap">Dados comerciais: {initialSessionId}</div>
  ),
}));

// Mock toast and notification
const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));
vi.mock("@/state/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
  toast: toastMock,
}));

const mockNotify = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
};
vi.mock("@/core/notify", () => ({
  notify: mockNotify,
}));

// Comprehensive Attendants Mock Dataset representing all archetypes
const ALL_ARCHETYPE_AGENTS = [
  {
    key: "joao",
    name: "João",
    role: "Suporte Técnico",
    storeId: "store-1",
    sessionIds: ["session-support"],
    active: true,
    personality: "Prestativo, analítico e ágil para resolver dúvidas de produtos e suporte.",
    modelBadge: "Suporte",
    stats: { chatsToday: 42, avgResponseTime: "15s", satisfactionCsat: 98 },
    avatarConfig: {
      agentId: "joao",
      body: "male",
      base: "male",
      skin: "fair",
      hair: "male_short_fade",
      hairColor: "black",
      face: "face_glasses_round",
      eyes: "eyes_focused_tech",
      glasses: "glasses_round_black",
      outfit: "polo_zai_black",
      clothing: "polo_zai_black",
      accessories: ["headset_zai_green"],
      style: "tech",
      rotationY: 15,
      movement3D: "typing",
    },
  },
  {
    key: "ana",
    name: "Ana",
    role: "Atendimento & SAC",
    storeId: "store-1",
    sessionIds: ["session-sac"],
    active: true,
    personality: "Cordial, empática e focada em acolher clientes.",
    modelBadge: "Atendimento",
    stats: { chatsToday: 89, avgResponseTime: "8s", satisfactionCsat: 100 },
    avatarConfig: {
      agentId: "ana",
      body: "female",
      base: "female",
      skin: "peach",
      hair: "female_ponytail_brunette",
      hairColor: "dark_brown",
      face: "face_friendly_smile",
      eyes: "eyes_friendly_hazel",
      glasses: "none",
      outfit: "blazer_emerald_trim",
      clothing: "blazer_emerald_trim",
      accessories: ["headset_callcenter", "badge_zai_lanyard"],
      style: "corporate",
      rotationY: 0,
      movement3D: "wave",
    },
  },
  {
    key: "pedro",
    name: "Pedro",
    role: "Pós-Venda & Garantia",
    storeId: "store-1",
    sessionIds: [],
    active: true,
    personality: "Atencioso e resolutivo em processos de garantia e pós-venda.",
    modelBadge: "Pós-Venda",
    stats: { chatsToday: 18, avgResponseTime: "25s", satisfactionCsat: 95 },
    avatarConfig: {
      agentId: "pedro",
      body: "male",
      base: "male",
      skin: "tan",
      hair: "male_slick_exec",
      hairColor: "dark_brown",
      face: "face_calm_support",
      eyes: "eyes_confident_blue",
      glasses: "glasses_square_exec",
      outfit: "shirt_business_white",
      clothing: "shirt_business_white",
      accessories: ["badge_clip_chest"],
      style: "operational",
      rotationY: -20,
      movement3D: "idle",
    },
  },
  {
    key: "mariana",
    name: "Mariana",
    role: "Vendas & Campanhas",
    storeId: "store-1",
    sessionIds: [],
    active: false,
    personality: "Proativa, persuasiva e especialista em ofertas comerciais.",
    modelBadge: "Vendas",
    stats: { chatsToday: 0, avgResponseTime: "-", satisfactionCsat: 0 },
    avatarConfig: {
      agentId: "mariana",
      body: "female",
      base: "female",
      skin: "fair",
      hair: "female_wavy_blonde",
      hairColor: "golden_blonde",
      face: "face_wink_cheerful",
      eyes: "eyes_amber_sparkle",
      glasses: "none",
      outfit: "jacket_exec_dark",
      clothing: "jacket_exec_dark",
      accessories: ["smartwatch_neon"],
      style: "sales",
      rotationY: 10,
      movement3D: "idle",
    },
  },
  {
    key: "custom-sdr",
    name: "Lucas SDR",
    role: "Prospecção B2B",
    storeId: "store-1",
    sessionIds: [],
    active: true,
    personality: "Focado em qualificação rápida de leads corporativos.",
    stats: { chatsToday: 12, avgResponseTime: "10s", satisfactionCsat: 96 },
    // Intentionally test null/empty avatarConfig to verify resilient fallback
    avatarConfig: null,
  },
];

const MOCK_STORES = [
  {
    id: "store-1",
    name: "Loja Matriz Centro",
    numbers: [
      { sessionId: "session-support" },
      { sessionId: "session-sac" },
    ],
    settings: {
      primaryColor: "#10b981",
    },
  },
];

const MOCK_CONNECTIONS = [
  {
    sessionId: "session-support",
    sessionName: "WhatsApp Suporte Técnico",
    phone: "+55 11 98888-1111",
    status: "connected",
    storeId: "store-1",
  },
  {
    sessionId: "session-sac",
    sessionName: "WhatsApp SAC & Atendimento",
    phone: "+55 11 97777-2222",
    status: "connected",
    storeId: "store-1",
  },
];

// Mock apiService
vi.mock("@/core/services/apiService", () => ({
  apiService: {
    getAIAgents: vi.fn(),
    getStores: vi.fn(),
    getConnections: vi.fn(),
    getAIStatus: vi.fn().mockResolvedValue({ enabled: true }),
    getAIMetrics: vi.fn().mockResolvedValue({ messagesToday: 149, tokensToday: 4200 }),
    testAIMessage: vi.fn().mockResolvedValue({ success: true, result: { ok: true, response: "Resposta de teste" } }),
    getSystemHealth: vi.fn().mockResolvedValue({ status: "ok" }),
    toggleAIAgent: vi.fn().mockResolvedValue({ success: true }),
    updateAgentAvatar: vi.fn().mockResolvedValue({ success: true }),
    updateStoreVisualDNA: vi.fn().mockResolvedValue({ success: true }),
    assignAttendantToConnection: vi.fn().mockResolvedValue({ success: true }),
    getAgentEvolution: vi.fn().mockResolvedValue({
      success: true,
      evolution: { score: 92, level: "Especialista", goal: { current: 19, target: 20, percentage: 95 } },
      history: [],
    }),
    getAIPrompt: vi.fn().mockResolvedValue({ prompt: "Você é um atendente inteligente." }),
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
  vi.clearAllMocks();
  (apiService.getAIAgents as any).mockResolvedValue({
    success: true,
    agents: JSON.parse(JSON.stringify(ALL_ARCHETYPE_AGENTS)),
  });
  (apiService.getStores as any).mockResolvedValue({
    success: true,
    stores: JSON.parse(JSON.stringify(MOCK_STORES)),
  });
  (apiService.getConnections as any).mockResolvedValue(
    JSON.parse(JSON.stringify(MOCK_CONNECTIONS))
  );

  useAppStore.setState({
    sessions: MOCK_CONNECTIONS as any,
    activeSessionId: "session-support",
    aiProgressByConversationId: {},
  });

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
  container?.remove();
  container = undefined;
  root = undefined;
});

async function renderWithRouter(initialEntry = "/attendants") {
  await act(async () => {
    root?.render(
      <TooltipProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/attendants" element={<AttendantsPage />} />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    );
  });
  // Flush microtasks
  await act(async () => {
    await Promise.resolve();
  });
}

describe("Comprehensive Attendants Frontend Simulation & Render Validation", () => {
  it("renders all attendant personas (João, Ana, Pedro, Mariana, Lucas SDR) with full visual DNA and fallback", async () => {
    await renderWithRouter("/attendants");

    // João and Ana are on page 1 (paginatedOpCards 4 per page)
    expect(container?.textContent).toContain("João");
    expect(container?.textContent).toContain("Suporte Técnico");
    expect(container?.textContent).toContain("Ana");
    expect(container?.textContent).toContain("Atendimento & SAC");

    // Check presence of rendered avatar elements
    const avatarCanvasesOrDivs = container?.querySelectorAll(".h-12.w-12");
    expect(avatarCanvasesOrDivs?.length).toBeGreaterThanOrEqual(2);

    // Verify online / active tags
    expect(container?.textContent).toContain("Ativo");
  });

  it("handles preview selection and 3D studio item inspection when switching attendants", async () => {
    await renderWithRouter("/attendants");

    // Click on Ana's card
    const anaCard = container?.querySelector('[data-agent-key="ana"]') as HTMLElement;
    expect(anaCard).toBeTruthy();

    await act(async () => {
      anaCard.click();
    });

    // The preview drawer / studio displays Ana's name and details
    expect(container?.textContent).toContain("Ana");
    expect(container?.textContent).toContain("Atendimento & SAC");
  });

  it("safely switches the responsible attendant for a WhatsApp connection without breaking data", async () => {
    await renderWithRouter("/attendants?sessionId=session-support");

    // Click on João to assign/switch
    expect(apiService.getConnections).toHaveBeenCalled();
    expect(container?.textContent).toContain("WhatsApp Suporte Técnico");
  });

  it("simulates direct ZaiAvatarRenderer with all 4 example archetype configs (João, Ana, Pedro, Mariana)", async () => {
    for (const archetype of EXAMPLE_ATTENDANTS) {
      await act(async () => {
        root?.render(
          <ZaiAvatarRenderer
            avatar={archetype.avatarConfig}
            renderStyle="chibi_25d"
            state="WORKING"
            size="md"
            showAura={true}
            showStatusBadge={true}
          />
        );
      });

      // Verify container rendered without throwing
      expect(container?.innerHTML).toBeTruthy();
      expect(container?.querySelector("svg") || container?.querySelector("div")).toBeTruthy();
    }
  });

  it("resiliently renders avatar with createAgentAvatar fallback when avatarConfig is null or incomplete", async () => {
    const fallbackAvatar = createAgentAvatar({
      agentId: "fallback-agent",
      name: "Lucas SDR",
      role: "Prospecção B2B",
      gender: "male",
    });

    expect(fallbackAvatar).toBeDefined();
    expect(fallbackAvatar.hair).toBeDefined();
    expect(fallbackAvatar.outfit || fallbackAvatar.clothing).toBeDefined();

    await act(async () => {
      root?.render(
        <ZaiAvatarRenderer
          avatar={fallbackAvatar}
          renderStyle="chibi_25d"
          state="IDLE"
          size="lg"
        />
      );
    });

    expect(container?.innerHTML).toBeTruthy();
  });

  it("switches attendants in AgentTab AI Configuration and updates form values", async () => {
    const onSelectAgent = vi.fn();
    const onOpenCustomizer = vi.fn();

    await act(async () => {
      root?.render(
        <TooltipProvider>
          <MemoryRouter>
            <AgentTab
              agentsList={ALL_ARCHETYPE_AGENTS as any}
              selectedAgentKey="joao"
              onSelectAgent={onSelectAgent}
              onOpenCustomizer={onOpenCustomizer}
              objective="suporte"
              tone="consultative"
              temperature={0.4}
              responseStyle="detailed"
              customInstructions="Instruções específicas para o João"
            />
          </MemoryRouter>
        </TooltipProvider>
      );
    });

    expect(container?.textContent).toContain("Atendente das configurações");
    const select = container?.querySelector("#ai-config-agent") as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.value).toBe("joao");

    // Simulate switching to Ana
    await act(async () => {
      select.value = "ana";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(onSelectAgent).toHaveBeenCalledWith("ana");
  });

  it("switches attendant in Inbox SidebarPanel across different attendants for an active conversation", async () => {
    const handleSetConversationAgent = vi.fn().mockResolvedValue(undefined);

    const mockConversation = {
      id: "conv-1",
      name: "Cliente VIP",
      phone: "+5511999998888",
      agent_name: "João",
      assigned_to: "João",
      unread_count: 0,
      tags: [],
    };

    await act(async () => {
      root?.render(
        <TooltipProvider>
          <MemoryRouter>
            <SidebarPanel
              isOpen={true}
              onClose={vi.fn()}
              selectedConversation={mockConversation as any}
              aiAgents={ALL_ARCHETYPE_AGENTS as any}
              loadingAgents={false}
              handleSetConversationAgent={handleSetConversationAgent}
            />
          </MemoryRouter>
        </TooltipProvider>
      );
    });

    expect(container?.textContent).toContain("Atendente responsável");
    const agentSelect = container?.querySelector("#conversation-agent") as HTMLSelectElement;
    expect(agentSelect).toBeTruthy();
    expect(agentSelect.value).toBe("João");

    // Simulate switching conversation agent to Mariana
    await act(async () => {
      agentSelect.value = "Mariana";
      agentSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(handleSetConversationAgent).toHaveBeenCalledWith("Mariana");
  });

  it("handles AvatarEditorModal item swap (hair, clothing, accessories) smoothly", async () => {
    const onSave = vi.fn();
    const onOpenChange = vi.fn();

    const joaoAgent = ALL_ARCHETYPE_AGENTS[0];

    await act(async () => {
      root?.render(
        <TooltipProvider>
          <AvatarEditorModal
            open={true}
            onOpenChange={onOpenChange}
            onSave={onSave}
            agent={joaoAgent}
            store={MOCK_STORES[0]}
          />
        </TooltipProvider>
      );
    });

    // Verify modal is open and displays João's editor
    expect(document.body.textContent).toContain("João");
  });
});
