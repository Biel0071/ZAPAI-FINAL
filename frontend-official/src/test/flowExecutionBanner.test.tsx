import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FlowExecutionBanner,
  computeProgressPercent,
  computeRemainingSeconds,
  formatCountdown,
  matchesConversationFlow,
  type FlowExecutionData,
} from "@/pages/Inbox/components/FlowExecutionBanner";

vi.mock("@/core/services/apiService", () => ({ apiService: {} }));
vi.mock("@/state/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const NOW = 1_700_000_000_000;
const flow = (over: Partial<FlowExecutionData> = {}): FlowExecutionData => ({
  chatId: "5511999999999", conversationId: "c1", flowName: "Churrasco", currentStep: 5, totalSteps: 12, ...over,
});

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(NOW);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  document.body.innerHTML = "";
  vi.useRealTimers();
});

const text = (id: string) => container.querySelector(`[data-testid="${id}"]`)?.textContent;
const render = (data: FlowExecutionData | null) => act(async () => root.render(<FlowExecutionBanner flowData={data} />));

describe("helpers do banner de fluxo", () => {
  it("timer: max(0, nextSendAt - now), '—' sem dado, mm:ss acima de 60s", () => {
    expect(computeRemainingSeconds(NOW + 4000, NOW)).toBe(4);
    expect(computeRemainingSeconds(NOW - 5000, NOW)).toBe(0);
    expect(computeRemainingSeconds(null, NOW)).toBeNull();
    expect(computeRemainingSeconds(undefined, NOW)).toBeNull();
    expect(formatCountdown(null)).toBe("—");
    expect(formatCountdown(3.2)).toBe("4s");
    expect(formatCountdown(60)).toBe("60s");
    expect(formatCountdown(61)).toBe("01:01");
    expect(formatCountdown(605)).toBe("10:05");
  });
  it("percentual = enviadas/total, com limites", () => {
    expect(computeProgressPercent(5, 12)).toBe(42);
    expect(computeProgressPercent(0, 12)).toBe(0);
    expect(computeProgressPercent(20, 12)).toBe(100);
    expect(computeProgressPercent(3, 0)).toBe(0);
  });
  it("descarta fluxo de outra conversa", () => {
    expect(matchesConversationFlow(flow(), { conversationId: "c2" })).toBe(false);
    expect(matchesConversationFlow(flow(), { conversationId: "c1" })).toBe(true);
  });
});

describe("FlowExecutionBanner", () => {
  it("mostra 'Etapa X de Y', % e raio preenchido pela %", async () => {
    await render(flow({ nextSendAt: NOW + 9000 }));
    expect(text("flow-step-label")).toBe("Etapa 5 de 12");
    expect(text("flow-percent")).toBe("42%");
    const fill = container.querySelector<SVGElement>('[data-testid="flow-bolt-fill"]')!;
    expect(fill.style.clipPath).toContain("58%");
  });
  it("timer decresce em tempo real a partir de nextSendAt", async () => {
    await render(flow({ nextSendAt: NOW + 9000 }));
    expect(text("flow-timer")).toBe("9s");
    await act(async () => { vi.advanceTimersByTime(4000); });
    expect(text("flow-timer")).toBe("5s");
    await act(async () => { vi.advanceTimersByTime(20000); });
    expect(text("flow-timer")).toBe("0s");
  });
  it("sem nextSendAt mostra '—' (nunca contagem inventada)", async () => {
    await render(flow());
    expect(text("flow-timer")).toBe("—");
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(text("flow-timer")).toBe("—");
  });
  it("pausado: '—' e raio âmbar", async () => {
    await render(flow({ nextSendAt: NOW + 9000, isPaused: true, status: "paused" }));
    expect(text("flow-timer")).toBe("—");
    expect(container.querySelector('[data-testid="flow-bolt-fill"]')!.getAttribute("class")).toContain("amber");
  });
  it("não usa pulso/ping paralelo", async () => {
    await render(flow({ nextSendAt: NOW + 9000 }));
    expect(container.innerHTML).not.toContain("animate-ping");
    expect(container.innerHTML).not.toContain("animate-pulse");
  });
});
