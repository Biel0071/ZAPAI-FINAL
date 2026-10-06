import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZaiPlatformAssistantView } from "@/components/ai/ZaiPlatformAssistantView";
import { apiService } from "@/core/services/apiService";

vi.mock("@/core/services/apiService", () => ({ apiService: {
  getAIAgents: vi.fn().mockResolvedValue({ success: true, agents: [{ key: "lia", name: "Lia", active: true }, { key: "ana", name: "Ana", active: true }] }),
  getStores: vi.fn().mockResolvedValue({ success: true, stores: [] }),
  getConnections: vi.fn().mockResolvedValue([]),
  getQueueStats: vi.fn().mockResolvedValue({ customersWaiting: 0, messagesSentToday: 0 }),
  getAIMetrics: vi.fn().mockResolvedValue({ messagesToday: 0, tokensToday: 0 }),
  toggleAIAgent: vi.fn().mockResolvedValue({ success: true }),
}, requestApiEndpoint: vi.fn().mockResolvedValue({ waiting: 0 }) }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
beforeEach(() => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

async function send(message: string) {
  const input = document.querySelector("input")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, message);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    Array.from(document.querySelectorAll("button")).find(button => button.textContent === "Enviar")!.click();
  });
}
async function render() {
  await act(async () => root.render(<MemoryRouter><ZaiPlatformAssistantView /></MemoryRouter>));
}

describe("Assistente com dados reais", () => {
  it("points to the inbox instead of fabricating waiting customers", async () => {
    await render();
    await send("Mostre os clientes que não receberam resposta hoje");
    expect(document.body.textContent).not.toMatch(/98765-4321|3 clientes|14:20/);
    expect(document.querySelector('a[href="/inbox"]')).not.toBeNull();
  });

  it("never defaults to a different agent for an ambiguous pause request", async () => {
    await render();
    await send("Desative alguém");
    expect(document.body.textContent).toContain("Informe o nome");
    expect(apiService.toggleAIAgent).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain("Pausar Lia");
  });

  it("shows zero measured responses without invented CSAT or SLA", async () => {
    await render();
    await send("Ver desempenho dos agentes");
    expect(apiService.getAIMetrics).toHaveBeenCalled();
    expect(document.body.textContent).toContain("0 respostas");
    expect(document.body.textContent).not.toMatch(/98%|96%|18s|127/);
  });

  it("does not announce an automation creation that never reached an API", async () => {
    await render();
    await send("Crie um follow-up para orçamentos sem resposta");
    expect(document.querySelector('a[href="/ai?tab=flows"]')).not.toBeNull();
    expect(document.body.textContent).not.toContain("Autorizar Automação");
    expect(document.body.textContent).not.toContain("Regra de Automação Preparada");
  });

  it("keeps the action available when the service rejects pausing", async () => {
    vi.mocked(apiService.toggleAIAgent).mockResolvedValueOnce({ success: false, agent: null });
    await render();
    await send("Desative Lia");
    const pause = Array.from(document.querySelectorAll("button")).find(button => button.textContent === "Pausar Lia")!;
    expect(pause).toBeDefined();
    await act(async () => pause.click());
    expect(document.body.textContent).not.toContain("executada com sucesso");
    expect(document.body.textContent).toContain("Pausar Lia");
  });
});
