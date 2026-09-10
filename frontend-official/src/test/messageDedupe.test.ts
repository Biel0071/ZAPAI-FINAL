import { describe, expect, it } from "vitest";
import { isSameOrDuplicateMessage, useAppStore } from "@/stores/appStore";
import type { ChatMessage } from "@/types";

describe("Message Deduplication & Regression Scenarios (A to E)", () => {
  it("Cenário A: Uma operação -> uma mensagem (exatamente o mesmo ID)", () => {
    const msgA: ChatMessage = {
      id: "101",
      conversationId: "conv-1",
      content: "Mensagem A",
      sender: "me",
      fromMe: true,
      createdAt: new Date().toISOString(),
      status: "sent",
    };
    const msgB: ChatMessage = { ...msgA };

    expect(isSameOrDuplicateMessage(msgA, msgB)).toBe(true);
  });

  it("Cenário B / C: Mensagem otimista (temp-) substituída pela mensagem confirmada com mesmo texto", () => {
    const tempMsg: ChatMessage = {
      id: "temp-12345",
      conversationId: "conv-1",
      content: "Mensagem rápida",
      sender: "me",
      fromMe: true,
      createdAt: new Date().toISOString(),
      status: "pending",
    };
    const confirmedMsg: ChatMessage = {
      id: "102",
      conversationId: "conv-1",
      content: "Mensagem rápida",
      sender: "me",
      fromMe: true,
      createdAt: new Date().toISOString(),
      status: "sent",
      whatsappMessageId: "3EB0ABC123",
    };

    expect(isSameOrDuplicateMessage(tempMsg, confirmedMsg)).toBe(true);
  });

  it("Cenário D: Retry legítimo ou mensagens com whatsappMessageId distintos não são duplicadas", () => {
    const msg1: ChatMessage = {
      id: "103",
      conversationId: "conv-1",
      content: "Olá tudo bem?",
      sender: "me",
      fromMe: true,
      createdAt: new Date().toISOString(),
      status: "sent",
      whatsappMessageId: "WA-ID-1",
    };
    const msg2: ChatMessage = {
      id: "104",
      conversationId: "conv-1",
      content: "Olá tudo bem?",
      sender: "me",
      fromMe: true,
      createdAt: new Date().toISOString(),
      status: "sent",
      whatsappMessageId: "WA-ID-2",
    };

    expect(isSameOrDuplicateMessage(msg1, msg2)).toBe(false);
  });

  it("Cenário E: Duas operações intencionais com exatamente o mesmo conteúdo -> DUAS mensagens legítimas", () => {
    const now = new Date();
    const msg1: ChatMessage = {
      id: "117732",
      conversationId: "conv-4",
      content: "duas operacoes intencionais iguais",
      sender: "me",
      fromMe: true,
      createdAt: now.toISOString(),
      status: "sent",
      whatsappMessageId: "WA-E1-FIRST",
    };
    const msg2: ChatMessage = {
      id: "117733",
      conversationId: "conv-4",
      content: "duas operacoes intencionais iguais",
      sender: "me",
      fromMe: true,
      createdAt: new Date(now.getTime() + 1000).toISOString(),
      status: "sent",
      whatsappMessageId: "WA-E1-SECOND",
    };

    // A regra ingênua anterior tratava 'mesmo texto em < 5s' como duplicada.
    // Com a correção, como ambos têm IDs confirmados e diferentes, NÃO devem ser tratados como duplicados.
    expect(isSameOrDuplicateMessage(msg1, msg2)).toBe(false);

    // Testar também via setMessages do store
    const store = useAppStore.getState();
    store.setMessages("conv-4", [msg1, msg2]);

    const storedMessages = useAppStore.getState().messagesByConversationId["conv-4"];
    expect(storedMessages).toBeDefined();
    expect(storedMessages.length).toBe(2);
    expect(storedMessages[0].id).toBe("117732");
    expect(storedMessages[1].id).toBe("117733");
  });
});
