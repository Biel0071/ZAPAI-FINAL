import { describe, expect, it, vi } from "vitest";
import { refreshHistoryForActiveConversation } from "@/state/providers/RuntimeProvider";

function message(id: string, content: string, extras: Record<string, unknown> = {}) {
  return { id, conversationId: "chat-a", content, createdAt: "2026-10-01T00:00:00.000Z", timestamp: "2026-10-01T00:00:00.000Z", ...extras } as any;
}

function state(activeConversationId: string | null, messages: any[]) {
  return {
    activeConversationId,
    conversations: [{ id: "chat-a", phone: "5511999990000", contactName: "Contato", lastMessage: "", updatedAt: "2026-10-01T00:00:00.000Z" } as any],
    messagesByConversationId: { "chat-a": messages },
    setMessages: vi.fn(),
  };
}

describe("refreshHistoryForActiveConversation", () => {
  it("merges imported older rows and applies refreshed values for unchanged rows", async () => {
    const old = message("m1", "placeholder");
    const current = state("chat-a", [old]);
    const fetched = [message("m1", "canonical"), message("m0", "older", { timestamp: "2025-09-30T00:00:00.000Z", createdAt: "2025-09-30T00:00:00.000Z" })];
    const result = await refreshHistoryForActiveConversation("chat-a", {
      fetchMessages: async () => fetched,
      getState: () => current,
    });

    expect(result).toBe(true);
    const saved = current.setMessages.mock.calls[0][1];
    expect(saved.map((item: any) => item.id)).toEqual(["m0", "m1"]);
    expect(saved.find((item: any) => item.id === "m1").content).toBe("canonical");
  });

  it("keeps a realtime update that arrived while the history page was loading", async () => {
    const original = message("m1", "old");
    const latest = message("m1", "live update", { status: "read" });
    const current = state("chat-a", [original]);
    const result = await refreshHistoryForActiveConversation("chat-a", {
      fetchMessages: async () => {
        current.messagesByConversationId["chat-a"] = [latest];
        return [message("m1", "server snapshot")];
      },
      getState: () => current,
    });

    expect(result).toBe(true);
    expect(current.setMessages.mock.calls[0][1][0]).toBe(latest);
  });

  it("discards a late result after the user changes conversations", async () => {
    const current = state("chat-b", []);
    let resolveFetch!: (rows: any[]) => void;
    const pending = refreshHistoryForActiveConversation("chat-a", {
      fetchMessages: () => new Promise((resolve) => { resolveFetch = resolve; }),
      getState: () => current,
    });
    resolveFetch([message("m1", "older")]);

    await expect(pending).resolves.toBe(false);
    expect(current.setMessages).not.toHaveBeenCalled();
  });
});
