import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiService } from "@/core/services/apiService";
import { matchesConversationFlow } from "@/pages/Inbox/components/FlowExecutionBanner";

const transport = vi.hoisted(() => vi.fn());
vi.mock("axios", () => ({ default: { create: () => ({ request: transport, interceptors: { response: { use: vi.fn() } } }), isAxiosError: () => false } }));
vi.mock("@/core/lib/backendConfig", () => ({ API_BASE_URL: "http://localhost:4025", API_ORIGIN: "http://localhost:4025" }));
vi.mock("@/core/lib/apiGuard", () => ({ buildApiHeaders: async () => ({ Authorization: "Bearer test-token" }) }));

beforeEach(() => { transport.mockReset(); transport.mockResolvedValue({ status: 200, data: { success: true, flow: null } }); });

describe("Contexto do fluxo de resposta rápida", () => {
  it("consulta o fluxo na conversa e conexão selecionadas, inclusive ao reabrir o Inbox", async () => {
    await apiService.getActiveQuickReplyFlow("5531999991111", { conversationId: "conversation-a", sessionId: "sales" });
    const request = transport.mock.calls[0][0];
    const url = new URL(request.url, "http://localhost:4025");
    expect(url.pathname).toContain("/quick-replies/active-flow/5531999991111");
    expect(url.searchParams.get("conversationId")).toBe("conversation-a");
    expect(url.searchParams.get("sessionId")).toBe("sales");
  });

  it("envia o contexto para cancelar somente as etapas deste atendimento", async () => {
    await apiService.cancelQuickReplyFlow("5531999991111", { conversationId: "conversation-a", sessionId: "sales" });
    const request = transport.mock.calls[0][0];
    expect(request.method).toBe("POST");
    expect(request.data).toEqual({ phone: "5531999991111", conversationId: "conversation-a", sessionId: "sales" });
  });

  it("ignora eventos de outra conversa ou conexão mesmo para o mesmo telefone", () => {
    const context = { conversationId: "conversation-a", sessionId: "sales" };
    const ownFlow = { chatId: "5531999991111", conversationId: "conversation-a", sessionId: "sales" };
    expect(matchesConversationFlow(ownFlow, context)).toBe(true);
    expect(matchesConversationFlow({ ...ownFlow, conversationId: "conversation-b" }, context)).toBe(false);
    expect(matchesConversationFlow({ ...ownFlow, sessionId: "support" }, context)).toBe(false);
    expect(matchesConversationFlow({ chatId: ownFlow.chatId }, context)).toBe(false);
    expect(matchesConversationFlow(null, context)).toBe(false);
  });
});
