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
  getAgentEvolution: vi.fn(),
  getAgentLearning: vi.fn(),
  getLearnedPatterns: vi.fn(),
  requestApiEndpoint: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/core/services/apiService", () => ({
  apiService: {
    getAIAgents: mocks.getAIAgents,
    getAgentEvolution: mocks.getAgentEvolution,
    getAgentLearning: mocks.getAgentLearning,
    getLearnedPatterns: mocks.getLearnedPatterns,
    syncManualAttendance: vi.fn(),
    detectAgentGaps: vi.fn(),
    answerLearningEvent: vi.fn(),
    applyLearningAnswer: vi.fn(),
    ignoreLearningEvent: vi.fn(),
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
  mocks.getAgentEvolution.mockResolvedValue({ success: true });
  mocks.getAgentLearning.mockResolvedValue({ success: true, pending: [] });
  mocks.getLearnedPatterns.mockResolvedValue({ data: [] });
  mocks.requestApiEndpoint.mockImplementation((url: string) => {
    if (url.includes("/api/ai/memory/graph")) {
      return Promise.resolve({ data: { nodes: [], edges: [] } });
    }
    if (url.includes("/agent-level")) return Promise.resolve({ data: {} });
    return Promise.resolve({ data: [] });
  });
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
        <EvolutionTab {...props} />
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
    expect(mocks.requestApiEndpoint).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/ai/memory/graph?agentKey=camila")
    );
  });

  it("selects the first actual attendant when one is supplied without an explicit selection", async () => {
    await renderEvolution({ agents: [{ key: "agent-nina", name: "Nina" }] });

    expect(document.body.textContent).toContain("Nina");
    expect(mocks.requestApiEndpoint).toHaveBeenCalledWith(
      expect.stringContaining("/api/ai/memory/graph?agentKey=agent-nina")
    );
  });

  it("shows an empty graph and true zero category counts when the API returns no memories", async () => {
    mocks.getAgentEvolution.mockResolvedValue({ success: true, evolution: { score: 0 } });
    await renderEvolution({
      agentKey: "agent-maria",
      agents: [{ key: "agent-maria", name: "Maria" }],
    });

    expect(document.body.textContent).toContain("Nenhuma memória registrada");
    expect(document.body.textContent).not.toContain("PIX com 5% de Desconto");
    expect(document.body.textContent).toContain("Todos os Nós0");
    expect(document.body.textContent).not.toContain("Pagamentos & PIX");
  });

  it("shows graph request errors without substituting example memories", async () => {
    mocks.requestApiEndpoint.mockImplementation((url: string) => {
      if (url.includes("/api/ai/memory/graph")) return Promise.reject(new Error("Falha de rede"));
      if (url.includes("/agent-level")) return Promise.resolve({ data: {} });
      return Promise.resolve({ data: [] });
    });
    await renderEvolution({
      agentKey: "agent-maria",
      agents: [{ key: "agent-maria", name: "Maria" }],
    });

    expect(document.body.textContent).toContain("Não foi possível carregar as memórias");
    expect(document.body.textContent).not.toContain("PIX com 5% de Desconto");
  });

  it("shows unavailable metrics as dashes and preserves API-confirmed zero values", async () => {
    mocks.requestApiEndpoint.mockImplementation((url: string) => {
      if (url.includes("/api/ai/memory/graph")) return Promise.resolve({ data: { nodes: [], edges: [] } });
      if (url.includes("/agent-level")) return Promise.resolve({ data: {} });
      return Promise.resolve({ data: [] });
    });
    await renderEvolution({ agentKey: "agent-maria", agents: [{ key: "agent-maria", name: "Maria" }] });
    expect(document.body.textContent).toContain("Objeções Aprendidas—");
    expect(document.body.textContent).toContain("Atendimentos Analisados—");

    mocks.requestApiEndpoint.mockImplementation((url: string) => {
      if (url.includes("/api/ai/memory/graph")) return Promise.resolve({ data: { nodes: [], edges: [] } });
      if (url.includes("/agent-level")) return Promise.resolve({ data: { objectionsLearned: 0, totalAnalyzed: 0 } });
      return Promise.resolve({ data: [] });
    });
    await renderEvolution({ agentKey: "agent-zero", agents: [{ key: "agent-zero", name: "Zero" }] });
    expect(document.body.textContent).toContain("Objeções Aprendidas0");
    expect(document.body.textContent).toContain("Atendimentos Analisados0");
  });

  it("uses confidence and relationships from the graph, including an explicit zero", async () => {
    mocks.requestApiEndpoint.mockImplementation((url: string) => {
      if (url.includes("/api/ai/memory/graph")) {
        return Promise.resolve({
          data: {
            nodes: [
              {
                id: "memory-1",
                type: "preference",
                label: "Preferência PIX registrada",
                desc: "A cliente informou que prefere PIX.",
                confidence: 0,
                properties: { facts: ["Preferência confirmada pela cliente."] },
              },
              { id: "customer-1", type: "contact", label: "Cliente Ana" },
            ],
            edges: [{ source: "memory-1", target: "customer-1" }],
          },
        });
      }
      if (url.includes("/agent-level")) return Promise.resolve({ data: {} });
      return Promise.resolve({ data: [] });
    });
    mocks.getAgentEvolution.mockResolvedValue({ success: true, evolution: { score: 0 } });
    await renderEvolution({
      agentKey: "agent-maria",
      agents: [{ key: "agent-maria", name: "Maria" }],
    });

    expect(document.body.textContent).toContain("Preferência PIX registrada");
    expect(document.body.textContent).toContain("Assertividade 0%");
    expect(document.body.textContent).toContain("Cliente Ana");
    expect(document.body.textContent).toContain("Preferências1");
    expect(document.body.textContent).toContain("Clientes1");
    expect(document.querySelectorAll('[data-testid="memory-relationship"]')).toHaveLength(1);
    expect(document.body.textContent).toContain("Preferência confirmada pela cliente.");
    expect(document.body.textContent).not.toContain("Taxa de conversão 28% superior");
  });

  it("keeps candidate learning fields honest when the API omits them and preserves zero confidence", async () => {
    mocks.getAgentEvolution.mockResolvedValue({ success: true, evolution: { score: 0 } });
    mocks.requestApiEndpoint.mockImplementation((url: string) => {
      if (url.includes("/api/ai/evolution/suggestions")) {
        return Promise.resolve({ data: [{ id: "candidate-empty", confidence_score: 0 }] });
      }
      if (url.includes("/api/ai/memory/graph")) return Promise.resolve({ data: { nodes: [], edges: [] } });
      if (url.includes("/agent-level")) return Promise.resolve({ data: {} });
      return Promise.resolve({ data: [] });
    });
    await renderEvolution({ agentKey: "agent-maria", agents: [{ key: "agent-maria", name: "Maria" }] });
    const timelineTab = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Linha do Tempo"));
    await act(async () => timelineTab?.click());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

    expect(document.body.textContent).toContain("0% confiança");
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
  });
});
