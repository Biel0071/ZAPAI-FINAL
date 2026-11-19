import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { EvolutionTab } from "@/pages/AI/EvolutionTab";
import { MemoryDetailDrawer } from "@/components/evolution/MemoryDetailDrawer";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const mocks = vi.hoisted(() => ({
  getAIAgents: vi.fn(),
  getMemoryEvolutionOverview: vi.fn(),
  listEnterpriseMemories: vi.fn(),
  getCognitiveEvolution: vi.fn(),
  getResultsAndConversations: vi.fn(),
  requestApiEndpoint: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/core/services/apiService", () => ({
  apiService: {
    getAIAgents: mocks.getAIAgents,
    getMemoryEvolutionOverview: mocks.getMemoryEvolutionOverview,
    listEnterpriseMemories: mocks.listEnterpriseMemories,
    getCognitiveEvolution: mocks.getCognitiveEvolution,
    getResultsAndConversations: mocks.getResultsAndConversations,
    getConnections: vi.fn().mockResolvedValue([]),
    createEnterpriseMemory: vi.fn(),
    updateEnterpriseMemory: vi.fn(),
    deleteEnterpriseMemory: vi.fn(),
  },
  requestApiEndpoint: mocks.requestApiEndpoint,
}));

vi.mock("@/state/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

let root: Root | undefined;
let container: HTMLDivElement | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAIAgents.mockResolvedValue({ success: true, agents: [] });
  mocks.getMemoryEvolutionOverview.mockResolvedValue({
    success: true,
    accumulated: {},
    periodMetrics: {},
    pending: {},
    applied: {},
  });
  mocks.listEnterpriseMemories.mockResolvedValue({
    success: true,
    items: [],
    categoryCounts: {},
    total: 0,
  });
  mocks.getCognitiveEvolution.mockResolvedValue({
    success: true,
    identified: [],
    pendingApproval: [],
    applied: [],
    history: [],
    versions: [],
  });
  mocks.getResultsAndConversations.mockResolvedValue({
    success: true,
    metrics: {},
    byAlgorithm: [],
    conversations: [],
  });
  mocks.requestApiEndpoint.mockResolvedValue({ data: [] });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  container?.remove();
  document.body.innerHTML = "";
});

async function renderEvolution(props: React.ComponentProps<typeof EvolutionTab> = {}) {
  await act(async () => {
    root!.render(
      <MemoryRouter>
        <EvolutionTab initialSubTab="brain" {...props} />
      </MemoryRouter>
    );
  });
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
}

describe("EvolutionTab uses only returned memory and evolution data", () => {
  it("does not assume Camila or request her memory when no attendants exist", async () => {
    await renderEvolution();

    expect(document.body.textContent).not.toContain("Camila");
    expect(document.body.textContent).not.toContain("PIX com 5% de Desconto");
    expect(mocks.listEnterpriseMemories).not.toHaveBeenCalledWith(
      expect.objectContaining({ agentKey: "camila" })
    );
  });

  it("selects the first actual attendant when one is supplied without an explicit selection", async () => {
    await renderEvolution({ agents: [{ key: "agent-nina", name: "Nina" }] });

    expect(document.body.textContent).toContain("Nina");
    expect(mocks.listEnterpriseMemories).toHaveBeenCalledWith(
      expect.objectContaining({ agentKey: "agent-nina" })
    );
  });

  it("shows an empty graph and true zero category counts when the API returns no memories", async () => {
    mocks.listEnterpriseMemories.mockResolvedValue({
      success: true,
      items: [],
      categoryCounts: {
        preferences: { total: 0, active: 0 },
        products: { total: 0, active: 0 },
        pricing_conditions: { total: 0, active: 0 },
        objections: { total: 0, active: 0 },
        commercial_rules: { total: 0, active: 0 },
        attendance_strategies: { total: 0, active: 0 },
        insights: { total: 0, active: 0 },
      },
      total: 0,
    });
    await renderEvolution({
      agentKey: "agent-maria",
      agents: [{ key: "agent-maria", name: "Maria" }],
    });

    expect(document.body.textContent).toContain("Nenhuma memória registrada para este filtro");
    expect(document.body.textContent).not.toContain("PIX com 5% de Desconto");
    expect(document.body.textContent).toContain("Preferências0");
    expect(document.body.textContent).not.toContain("Pagamentos & PIX");
  });

  it("shows graph request errors without substituting example memories", async () => {
    mocks.listEnterpriseMemories.mockRejectedValue(new Error("Falha de rede"));
    await renderEvolution({
      agentKey: "agent-maria",
      agents: [{ key: "agent-maria", name: "Maria" }],
    });

    expect(document.body.textContent).toContain("Não foi possível carregar as memórias");
    expect(document.body.textContent).not.toContain("PIX com 5% de Desconto");
  });

  it("shows unavailable metrics as dashes and preserves API-confirmed zero values", async () => {
    mocks.getMemoryEvolutionOverview.mockResolvedValue({
      success: true,
      accumulated: {},
      periodMetrics: {},
      pending: {},
      applied: {},
    });
    await renderEvolution({
      initialSubTab: "overview",
      agentKey: "agent-maria",
      agents: [{ key: "agent-maria", name: "Maria" }],
    });
    expect(document.body.textContent).toContain("Memórias Ativas—");
    expect(document.body.textContent).toContain("Objeções Identificadas—");

    mocks.getMemoryEvolutionOverview.mockResolvedValue({
      success: true,
      accumulated: { activeMemories: 0, objectionsIdentified: 0 },
      periodMetrics: {},
      pending: {},
      applied: {},
    });
    await renderEvolution({
      initialSubTab: "overview",
      agentKey: "agent-zero",
      agents: [{ key: "agent-zero", name: "Zero" }],
    });
    expect(document.body.textContent).toContain("Memórias Ativas0");
    expect(document.body.textContent).toContain("Objeções Identificadas0");
  });

  it("uses confidence and relationships from the graph, including an explicit zero", async () => {
    mocks.listEnterpriseMemories.mockResolvedValue({
      success: true,
      items: [
        {
          id: "memory-1",
          category: "preferences",
          categoryLabel: "Preferências",
          title: "Preferência PIX registrada",
          content: "Preferência confirmada pela cliente.",
          confidence: 0,
          status: "active",
          memoryScope: "agent",
          agentKey: "agent-maria",
        },
      ],
      categoryCounts: { preferences: { total: 1, active: 1 } },
      total: 1,
    });
    await renderEvolution({
      agentKey: "agent-maria",
      agents: [{ key: "agent-maria", name: "Maria" }],
    });

    expect(document.body.textContent).toContain("Preferência PIX registrada");
    expect(document.body.textContent).toContain("Confiança: 0%");
    expect(document.body.textContent).toContain("Preferências1");
    expect(document.body.textContent).toContain("Preferência confirmada pela cliente.");
    expect(document.body.textContent).not.toContain("Taxa de conversão 28% superior");
  });

  it("keeps candidate learning fields honest when the API omits them and preserves zero confidence", async () => {
    mocks.getCognitiveEvolution.mockResolvedValue({
      success: true,
      identified: [{ id: "candidate-empty", title: "Candidato em observação", observedFrequency: 0 }],
      pendingApproval: [],
      applied: [],
      history: [],
    });
    await renderEvolution({ agentKey: "agent-maria", agents: [{ key: "agent-maria", name: "Maria" }] });
    const cognitiveTab = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Evolução Cognitiva"));
    await act(async () => cognitiveTab?.click());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

    expect(document.body.textContent).toContain("0 ocorrências");
    expect(document.body.textContent).not.toContain("Alta Relevância");
    expect(document.body.textContent).not.toContain("Situação identificada em conversas");
    expect(document.body.textContent).not.toContain("Resposta recomendada para fechamento assertivo");
  });

  it("does not invent confidence, facts, connections, or a conversation snippet", async () => {
    await act(async () => {
      root!.render(
        <MemoryDetailDrawer
          memory={{ id: "memory-unknown", label: "Memória sem detalhes", type: "topic" }}
          onClose={() => {}}
        />
      );
    });

    expect(document.body.textContent).not.toContain("Assertividade 85%");
    expect(document.body.textContent).not.toContain("Camila (Atendente)");
    expect(document.body.textContent).not.toContain("Exemplo de Conversa");
    expect(container?.querySelector('[aria-label="Detalhes da Memória"]')?.textContent).toContain("—");
    expect(document.body.textContent).not.toContain("Sem resumo disponível.");
  });
});
