import React, { useEffect } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RuntimeProvider } from "@/state/providers/RuntimeProvider";
import { useAppStore } from "@/state/stores/appStore";

const mocks = vi.hoisted(() => ({
  subscriber: null as null | { onNewMessage?: (message: any) => void },
  getConversations: vi.fn(),
  listSessions: vi.fn(),
  getMetrics: vi.fn(),
  recoverSessions: vi.fn(),
  getMessages: vi.fn(),
}));

vi.mock("@/core/runtime/socket/socketManager", () => ({
  connectInboxSocket: vi.fn((subscriber) => {
    mocks.subscriber = subscriber;
    return () => {};
  }),
  forceReconnectInboxSocket: vi.fn(),
}));

vi.mock("@/core/services/apiService", () => ({
  apiService: {
    getConversations: mocks.getConversations,
    listSessions: mocks.listSessions,
    getMetrics: mocks.getMetrics,
    recoverSessions: mocks.recoverSessions,
    getMessages: mocks.getMessages,
  },
}));

vi.mock("@/core/runtime/services/runtimeCoherenceService", () => ({
  buildRuntimeCoherenceSnapshot: vi.fn(() => ({})),
  persistRuntimeCoherenceSnapshot: vi.fn(),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | undefined;
let container: HTMLDivElement | undefined;
let projectionMounts = 0;

const conversation = {
  id: "qa-conversation",
  chatId: "qa-contact@s.whatsapp.net",
  contactName: "Contato de QA",
  phone: "5500000000000",
  sessionId: "qa-session",
  lastMessage: "Mensagem anterior",
  lastMessageAt: "2026-10-13T11:59:00.000Z",
  unread: 0,
  status: "online",
};

const EMPTY_MESSAGES: any[] = [];

function InboxProjection() {
  const conversations = useAppStore((state) => state.conversations);
  const activeConversationId = useAppStore((state) => state.activeConversationId);
  const activeConversation = conversations.find((item) => item.id === activeConversationId);
  const messages = useAppStore((state) => state.messagesByConversationId[activeConversationId || ""] || EMPTY_MESSAGES);

  useEffect(() => {
    projectionMounts += 1;
  }, []);

  return (
    <>
      <aside data-testid="conversation-list">
        {conversations.map((item) => <p key={item.id}>{item.contactName}: {item.lastMessage}</p>)}
      </aside>
      <section data-testid="active-conversation">
        <h1>{activeConversation?.contactName}</h1>
        {messages.map((message) => <p key={message.id}>{message.content}</p>)}
      </section>
    </>
  );
}

describe("RuntimeProvider delivers inbound messages to live Inbox state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.subscriber = null;
    projectionMounts = 0;
    mocks.listSessions.mockResolvedValue([]);
    mocks.getConversations.mockResolvedValue([conversation]);
    mocks.getMetrics.mockResolvedValue({});
    mocks.recoverSessions.mockResolvedValue({ success: true });
    mocks.getMessages.mockResolvedValue([]);
    useAppStore.getState().reset();
    useAppStore.getState().setConversations([conversation] as any);
    useAppStore.getState().setActiveConversationId(conversation.id);
    useAppStore.getState().setMessages(conversation.id, [{
      id: "qa-message-old",
      conversationId: conversation.id,
      content: "Mensagem anterior",
      fromMe: false,
      createdAt: "2026-10-13T11:59:00.000Z",
      timestamp: "2026-10-13T11:59:00.000Z",
    }] as any);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    useAppStore.getState().reset();
    container?.remove();
    document.body.innerHTML = "";
    root = undefined;
    container = undefined;
  });

  it("updates the conversation preview and active message list without remounting", async () => {
    await act(async () => {
      root!.render(
        <RuntimeProvider>
          <InboxProjection />
        </RuntimeProvider>
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.subscriber?.onNewMessage).toBeTypeOf("function");
    expect(document.querySelector('[data-testid="conversation-list"]')?.textContent).toContain("Mensagem anterior");
    expect(document.querySelector('[data-testid="active-conversation"]')?.textContent).toContain("Mensagem anterior");
    const initialMountCount = projectionMounts;

    await act(async () => {
      mocks.subscriber?.onNewMessage?.({
        id: "qa-message-live",
        conversationId: conversation.id,
        chatId: conversation.chatId,
        sessionId: conversation.sessionId,
        content: "Mensagem recebida sem recarregar",
        fromMe: false,
        createdAt: "2026-10-13T12:00:00.000Z",
        timestamp: "2026-10-13T12:00:00.000Z",
      });
    });

    expect(document.querySelector('[data-testid="conversation-list"]')?.textContent).toContain("Contato de QA: Mensagem recebida sem recarregar");
    expect(document.querySelector('[data-testid="active-conversation"]')?.textContent).toContain("Mensagem recebida sem recarregar");
    expect(projectionMounts).toBe(initialMountCount);
    expect(mocks.getConversations).toHaveBeenCalledTimes(1);
  });

  it("normalizes numeric socket timestamps before storing the message and preview", async () => {
    await act(async () => {
      root!.render(
        <RuntimeProvider>
          <InboxProjection />
        </RuntimeProvider>
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const timestamp = Date.UTC(2026, 9, 13, 12, 0, 0);
    await act(async () => {
      mocks.subscriber?.onNewMessage?.({
        id: "qa-message-numeric-time",
        conversationId: conversation.id,
        chatId: conversation.chatId,
        sessionId: conversation.sessionId,
        content: "Timestamp numérico",
        fromMe: false,
        createdAt: timestamp,
        timestamp,
      } as any);
    });

    const storedMessage = useAppStore.getState().messagesByConversationId[conversation.id]?.find((item) => item.id === "qa-message-numeric-time");
    const updatedConversation = useAppStore.getState().conversations.find((item) => item.id === conversation.id);
    expect(storedMessage?.createdAt).toBe(new Date(timestamp).toISOString());
    expect(updatedConversation?.lastMessageAt).toBe(new Date(timestamp).toISOString());
  });

  it("does not double-increment unread on duplicate Socket.IO message delivery or regress preview on out-of-order older messages", async () => {
    useAppStore.getState().setActiveConversationId("other-conversation");
    await act(async () => {
      root!.render(
        <RuntimeProvider>
          <InboxProjection />
        </RuntimeProvider>
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const payload = {
      id: "qa-message-dup",
      conversationId: conversation.id,
      chatId: conversation.chatId,
      sessionId: conversation.sessionId,
      content: "Mensagem única",
      fromMe: false,
      createdAt: "2026-10-13T12:05:00.000Z",
      timestamp: "2026-10-13T12:05:00.000Z",
    };

    await act(async () => {
      mocks.subscriber?.onNewMessage?.(payload);
      mocks.subscriber?.onNewMessage?.(payload);
    });

    let updatedConversation = useAppStore.getState().conversations.find((item) => item.id === conversation.id);
    expect(updatedConversation?.unread).toBe(1);
    expect(updatedConversation?.lastMessage).toBe("Mensagem única");
    expect(updatedConversation?.lastMessageAt).toBe("2026-10-13T12:05:00.000Z");

    await act(async () => {
      mocks.subscriber?.onNewMessage?.({
        id: "qa-message-older-out-of-order",
        conversationId: conversation.id,
        chatId: conversation.chatId,
        sessionId: conversation.sessionId,
        content: "Mensagem antiga atrasada",
        fromMe: false,
        createdAt: "2026-10-13T12:01:00.000Z",
        timestamp: "2026-10-13T12:01:00.000Z",
      });
    });

    updatedConversation = useAppStore.getState().conversations.find((item) => item.id === conversation.id);
    expect(updatedConversation?.lastMessage).toBe("Mensagem única");
    expect(updatedConversation?.lastMessageAt).toBe("2026-10-13T12:05:00.000Z");
    expect(updatedConversation?.unread).toBe(2);
  });
});
