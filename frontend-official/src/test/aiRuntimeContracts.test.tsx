import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentProfileModal } from "@/components/ai/AgentProfileModal";
import { FlowsTab } from "@/pages/AI/FlowsTab";
import { OperationsTab } from "@/pages/AI/OperationsTab";
import { AgentCustomizerModal } from "@/components/ai/AgentCustomizerModal";
import { VoiceStudioDrawer } from "@/components/ai/VoiceStudioDrawer";
import { NewAgentWizardModal } from "@/components/ai/NewAgentWizardModal";
import { EvolutionTab } from "@/pages/AI/EvolutionTab";
import { apiService } from "@/core/services/apiService";

const { toast, voiceNotify } = vi.hoisted(() => ({ toast: vi.fn(), voiceNotify: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }));
vi.mock("@/state/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/core/services/notifyService", () => ({ notify: voiceNotify }));
vi.mock("@/state/stores/appStore", () => ({ useAppStore: (select: (state: unknown) => unknown) => select({ sessions: [], websocketHealth: "disconnected" }) }));
vi.mock("@/components/ai/DigitalTeamView", () => ({
  getEmployeeAvatar: () => "/avatar.png",
  getAgentStatusBadge: () => ({ label: "Pausado", className: "" }),
}));
vi.mock("@/components/evolution/OfficialKnowledgeManager", () => ({ OfficialKnowledgeManager: () => null }));
vi.mock("@/components/evolution/PlaybookManager", () => ({ PlaybookManager: () => null }));
vi.mock("@/components/evolution/ObsidianMemoryModal", () => ({ ObsidianMemoryModal: () => null }));
vi.mock("@phosphor-icons/react", () => ({
  X: () => null, Microphone: () => null, Play: () => null, Pause: () => null,
  Sliders: () => null, CheckCircle: () => null, ArrowClockwise: () => null,
  Copy: () => null, Sparkle: () => null, FloppyDisk: () => null,
  MusicNotes: () => null, Waveform: () => null,
}));
vi.mock("@/core/services/apiService", () => ({
  requestApiEndpoint: vi.fn().mockResolvedValue([]),
  apiService: {
    testAIMessage: vi.fn().mockResolvedValue({ success: true, result: { ok: true, response: "Resposta oficial do provedor.", responseTimeMs: 24 } }),
    getAIProviders: vi.fn().mockResolvedValue({ success: true, providers: [{ provider: "openai", name: "OpenAI", model: "gpt-4o-mini", enabled: true, configured: true }] }),
    toggleAIAgent: vi.fn().mockResolvedValue({ success: true }),
    getBusinessHours: vi.fn().mockResolvedValue({ openTime: "09:30", closeTime: "17:15", timezone: "America/Sao_Paulo", autoReplyOutsideHours: false }),
    getAbsenceMessage: vi.fn().mockResolvedValue({ enabled: false, message: "Voltamos às 9h30." }),
    saveBusinessHours: vi.fn().mockResolvedValue({ success: true }),
    saveAbsenceMessage: vi.fn().mockResolvedValue({ success: true }),
    fetchOperationsMetrics: vi.fn().mockResolvedValue({ success: false }),
    getQueueStats: vi.fn().mockResolvedValue({ customersWaiting: 2, batchSize: 5, delaySeconds: 60, reactivationMessage: "Olá!" }),
    processQueue: vi.fn().mockRejectedValue(new Error("Fila indisponível")),
    testVoiceSynthesis: vi.fn().mockResolvedValue({ success: true, voiceId: "zapflow-aurora", durationSeconds: 6 }),
    saveVoiceProfile: vi.fn().mockResolvedValue({ success: true }),
    getAgentEvolution: vi.fn().mockResolvedValue({}),
    getAgentLearning: vi.fn().mockResolvedValue({ pending: [] }),
    getLearnedPatterns: vi.fn().mockResolvedValue({ data: [] }),
    getStores: vi.fn().mockResolvedValue({ success: true, stores: [{ id: "loja-centro", name: "Loja Centro" }] }),
    getConnections: vi.fn().mockResolvedValue([{ id: "wa-centro", sessionId: "wa-centro", name: "WhatsApp Centro" }]),
    createAIAgent: vi.fn().mockResolvedValue({ success: true, agent: { key: "camila", name: "Camila" } }),
    assignAttendantToConnection: vi.fn().mockRejectedValue(new Error("Vínculo indisponível")),
  },
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
vi.stubGlobal("ResizeObserver", class {
  observe() {}
  unobserve() {}
  disconnect() {}
});
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
async function render(component: React.ReactNode, route = "/") {
  await act(async () => root.render(<MemoryRouter initialEntries={[route]}>{component}</MemoryRouter>));
}
async function click(name: string) {
  const button = [...document.querySelectorAll("button")].find(item => item.textContent?.trim() === name);
  expect(button, name).toBeDefined();
  await act(async () => button?.click());
}
async function typeMessage(message: string) {
  const input = document.querySelector('input[placeholder^="Envie uma mensagem"]') as HTMLInputElement;
  expect(input).not.toBeNull();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, message);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const agent = { key: "camila", name: "Camila", role: "Vendas", personality: "Use apenas fatos oficiais.", sessionIds: ["loja-centro"], active: false };

describe("Contratos reais da operação de IA", () => {
  it("envia o teste do perfil ao endpoint canônico e mostra a resposta recebida", async () => {
    await render(<AgentProfileModal open onOpenChange={vi.fn()} agent={agent} />);
    await click("Conversar (Sandbox)");
    await typeMessage("Qual o horário?");
    await click("Enviar");
    expect(apiService.testAIMessage).toHaveBeenCalledWith(expect.objectContaining({
      message: "Qual o horário?", prompt: agent.personality, agentKey: agent.key, sessionId: "loja-centro",
    }));
    expect(document.body.textContent).toContain("Resposta oficial do provedor.");
  });

  it("mostra a falha de teste e não inventa resposta ou indicadores do agente", async () => {
    vi.mocked(apiService.testAIMessage).mockRejectedValueOnce(new Error("Provedor indisponível"));
    await render(<AgentProfileModal open onOpenChange={vi.fn()} agent={agent} />);
    expect(document.body.textContent).not.toContain("127");
    expect(document.body.textContent).not.toContain("100% automatizados");
    await click("Atividade");
    expect(document.body.textContent).not.toContain("10:42");
    await click("Conversar (Sandbox)");
    await typeMessage("Qual o horário?");
    await click("Enviar");
    expect(document.querySelector('[role="alert"]')).toHaveTextContent("Provedor indisponível");
    expect(document.body.textContent).not.toContain("Compreendido! Estou à disposição");
  });

  it("carrega e salva horário/ausência com os contratos oficiais", async () => {
    await render(<FlowsTab />, "/ai?sub=hours");
    expect(apiService.getBusinessHours).toHaveBeenCalled();
    expect([...document.querySelectorAll('input[type="time"]')].map(input => (input as HTMLInputElement).value)).toEqual(["09:30", "17:15"]);
    await click("Salvar Regras de Horário");
    expect(apiService.saveBusinessHours).toHaveBeenCalledWith({ openTime: "09:30", closeTime: "17:15", timezone: "America/Sao_Paulo", autoReplyOutsideHours: false });
    expect(apiService.saveAbsenceMessage).toHaveBeenCalledWith({ enabled: false, message: "Voltamos às 9h30." });
  });

  it("mede provedor somente após resposta real e não exibe latências fictícias", async () => {
    await render(<OperationsTab />, "/ai?sub=providers");
    expect(document.body.textContent).not.toContain("140ms");
    expect([...document.querySelectorAll("div,span")].some(element => element.textContent === "Operacional")).toBe(false);
    await click("Testar Ping");
    expect(apiService.testAIMessage).toHaveBeenCalledWith(expect.objectContaining({ providerId: "openai" }));
    expect(document.body.textContent).toContain("24ms");
  });

  it("encaminha para a fila real sem consultar ou acionar a reativação simulada", async () => {
    await render(<OperationsTab />, "/ai?sub=queue");
    expect(document.querySelector('a[href="/settings?tab=queue"]')).toHaveTextContent("Abrir fila de mensagens");
    expect(document.body.textContent).not.toContain("Disparar Próximo Lote Agora");
    expect(document.body.textContent).not.toContain("leads aguardando");
    expect(apiService.getQueueStats).not.toHaveBeenCalled();
    expect(apiService.processQueue).not.toHaveBeenCalled();
  });

  it("não declara saúde de banco ou vazão de fila sem uma medição", async () => {
    await render(<OperationsTab />, "/ai?sub=dashboard");
    expect(document.body.textContent).not.toContain("Pool estável & replicado");
    expect(document.body.textContent).not.toContain("Ativo (0 DLQ)");
    expect(document.body.textContent).not.toContain("Vazão normal sem gargalos");
    expect(document.querySelector('a[href="/settings?tab=diagnostics"]')).toHaveTextContent("Consultar diagnóstico");
    expect(document.querySelector('a[href="/settings?tab=queue"]')).toHaveTextContent("Consultar fila");
    expect(document.body.textContent).toContain("Desconectado");
  });

  it("rotula o histórico de conversas encerradas como total em vez de hoje", async () => {
    vi.mocked(apiService.fetchOperationsMetrics).mockResolvedValueOnce({ success: true, data: {
      metrics: { totalConversations: 20, openConversations: 5, waitingConversations: 3, closedConversations: 12, avgResponseTimeSeconds: null, avgHandlingTimeMinutes: null, slaCompliancePercent: null, transfersToday: null, productivityIndex: null },
      operators: [],
    } });
    await render(<OperationsTab />, "/ai?sub=dashboard");
    expect(document.body.textContent).toContain("Conversas encerradas (total)");
    expect(document.body.textContent).not.toContain("Encerradas Hoje");
    expect(document.body.textContent).toContain("12");
  });

  it("preserva os ajustes avançados existentes ao salvar a identidade do agente", async () => {
    const onSave = vi.fn();
    const configured = {
      ...agent,
      personalitySliders: { formalidade: 35, energia: 55, humor: 10, objetividade: 70, empatia: 60, proatividade: 40 },
      behavior: { autonomia: "assistida", exigirConfirmacao: false, delayResposta: 25 },
      memory: "Use apenas condições comerciais confirmadas pela loja.",
      permissions: { consultarCatalogo: false, informarPrecos: false, gerarOrcamento: false, concederDesconto: false, confirmarPedidos: false, dispararCampanhas: false },
    };
    await render(<AgentCustomizerModal open onOpenChange={vi.fn()} agent={configured} onSave={onSave} />);
    await click("Salvar Configuração");
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      personalitySliders: configured.personalitySliders, behavior: configured.behavior, memory: configured.memory, permissions: configured.permissions,
    }));
  });

  it("não confirma áudio sintetizado quando o backend retorna somente parâmetros", async () => {
    await render(<VoiceStudioDrawer open onClose={vi.fn()} agentId="camila" />);
    await click("Testar Voz ao Vivo");
    expect(apiService.testVoiceSynthesis).toHaveBeenCalled();
    expect(voiceNotify.error).toHaveBeenCalledWith(expect.stringContaining("áudio"));
    expect(voiceNotify.success).not.toHaveBeenCalled();
  });

  it("não salva perfil vocal global quando não há atendente selecionado", async () => {
    await render(<VoiceStudioDrawer open onClose={vi.fn()} />);
    await click("Salvar Perfil Vocal");
    expect(apiService.saveVoiceProfile).not.toHaveBeenCalled();
  });

  it("informa vínculo pendente quando o agente foi criado mas a atribuição WhatsApp falha", async () => {
    const onCreated = vi.fn();
    await render(<NewAgentWizardModal open onOpenChange={vi.fn()} onCreated={onCreated} />);
    for (let step = 0; step < 4; step++) await click("Avançar");
    await click("Ativar Atendente");
    expect(apiService.createAIAgent).toHaveBeenCalledTimes(1);
    expect(onCreated).toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Atendente criado; vínculo pendente", variant: "destructive" }));
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: "Atendente criado com sucesso!" }));
  });

  it("não mostra dados de evolução fictícios na indisponibilidade do backend", async () => {
    await render(<EvolutionTab />);
    expect(document.body.textContent).not.toContain("18.722");
    expect(document.body.textContent).not.toContain("98% Naturalidade");
    expect(document.body.textContent).toContain("Sem dados de evolução");
  });

  it("distingue falha ao carregar padrões e permite tentar novamente", async () => {
    vi.mocked(apiService.getLearnedPatterns)
      .mockRejectedValueOnce(new Error("Padrões indisponíveis"))
      .mockResolvedValueOnce({ data: [] } as any);

    await render(<EvolutionTab />);
    expect(document.body.textContent).toContain("Não foi possível carregar métricas e padrões deste atendente");
    await click("Tentar novamente");
    expect(document.body.textContent).not.toContain("Não foi possível carregar métricas e padrões deste atendente");
  });
});
