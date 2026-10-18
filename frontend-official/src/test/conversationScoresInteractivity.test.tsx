import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { ConversationScoresSection } from "@/components/evolution/ConversationScoresSection";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const mocks = vi.hoisted(() => ({
  requestApiEndpoint: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/core/services/apiService", () => ({
  apiService: {},
  requestApiEndpoint: mocks.requestApiEndpoint,
}));

vi.mock("@/state/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

let root: Root | undefined;
let container: HTMLDivElement | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  container?.remove();
  document.body.innerHTML = "";
});

const mockScoresData = {
  totalConversations: 2,
  totalEarnedXp: 205,
  averageScore: 102.5,
  totalConversions: 1,
  totalSheets: 1,
  scores: [
    {
      conversationId: 42,
      contactName: "Carlos Silva",
      contactPhone: "11987654321",
      algorithmCode: "ALGO-01",
      algorithmName: "Fechamento Rápido & PIX",
      conversationStyle: "direct_objective",
      cadastralXp: 25,
      productXp: 20,
      sheetXp: 40,
      conversionXp: 50,
      qualityXp: 15,
      totalXp: 150,
      milestones: {
        cadastral: { xp: 25, max: 25, achieved: true, details: "Nome e Bairro confirmados" },
        product: { xp: 20, max: 20, achieved: true, details: "Caixa d'água 5.000 Litros" },
        sheet: { xp: 40, max: 40, achieved: true, details: "Ficha de pedido emitida no catálogo" },
        conversion: { xp: 50, max: 50, achieved: true, details: "Avanço para Aguarda PIX" },
        quality: { xp: 15, max: 15, achieved: true, details: "Zero repetições e zero delírio" },
      },
      breakdown: { cadastralXp: 25, productXp: 20, sheetXp: 40, conversionXp: 50, qualityXp: 15 },
      funnelStage: "aguarda_pix",
      hasOrderSheet: true,
      evaluatedAt: new Date().toISOString(),
    },
    {
      conversationId: 43,
      contactName: "Mariana Costa",
      contactPhone: "15991234567",
      algorithmCode: "ALGO-02",
      algorithmName: "Consultivo Técnico",
      conversationStyle: "consultative_detailed",
      cadastralXp: 20,
      productXp: 20,
      sheetXp: 0,
      conversionXp: 0,
      qualityXp: 15,
      totalXp: 55,
      milestones: {
        cadastral: { xp: 20, max: 25, achieved: true, details: "Nome confirmado" },
        product: { xp: 20, max: 20, achieved: true, details: "Churrasqueira Trio Pré-Moldada" },
        sheet: { xp: 0, max: 40, achieved: false, details: "Aguardando orçamento" },
        conversion: { xp: 0, max: 50, achieved: false, details: "Em consultoria inicial" },
        quality: { xp: 15, max: 15, achieved: true, details: "Zero delírio" },
      },
      breakdown: { cadastralXp: 20, productXp: 20, sheetXp: 0, conversionXp: 0, qualityXp: 15 },
      funnelStage: "interested",
      hasOrderSheet: false,
      evaluatedAt: new Date().toISOString(),
    },
  ],
};

describe("ConversationScoresSection Interactivity", () => {
  it("renders real conversation scores and milestone breakdown accurately", async () => {
    mocks.requestApiEndpoint.mockResolvedValue({
      data: mockScoresData,
    });

    await act(async () => {
      root!.render(
        <MemoryRouter>
          <ConversationScoresSection agentKey="camila" />
        </MemoryRouter>
      );
    });
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

    expect(document.body.textContent).toContain("+205 XP");
    expect(document.body.textContent).toContain("Carlos Silva");
    expect(document.body.textContent).toContain("+150 XP");
    expect(document.body.textContent).toContain("ALGO-01: Fechamento Rápido & PIX");
    expect(document.body.textContent).toContain("Mariana Costa");
    expect(document.body.textContent).toContain("+55 XP");
    expect(document.body.textContent).toContain("ALGO-02: Consultivo Técnico & Catálogo");
  });

  it("opens interactive detail modal upon clicking Detalhes", async () => {
    mocks.requestApiEndpoint.mockResolvedValue({
      data: mockScoresData,
    });

    await act(async () => {
      root!.render(
        <MemoryRouter>
          <ConversationScoresSection agentKey="camila" />
        </MemoryRouter>
      );
    });
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

    const detailButtons = [...document.querySelectorAll("button")].filter((b) => b.textContent?.includes("Detalhes"));
    expect(detailButtons.length).toBeGreaterThan(0);

    await act(async () => {
      detailButtons[0].click();
    });
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

    expect(document.body.textContent).toContain("Auditoria de Evolução: Conversa #42");
    expect(document.body.textContent).toContain("1. Coleta de Dados Cadastrais (+15 a +25 XP)");
    expect(document.body.textContent).toContain("2. Especificação de Produto (+20 XP)");
    expect(document.body.textContent).toContain("3. Geração de Ficha / Orçamento (+40 XP)");
    expect(document.body.textContent).toContain("4. Conversão / Avanço de Funil (+50 XP)");
    expect(document.body.textContent).toContain("5. Qualidade de Atendimento (+15 XP)");
    expect(document.body.textContent).toContain("Abrir Atendimento no Inbox");
  });
});
