import { describe, expect, it } from "vitest";
import {
  mergeFetchedMessagesWithRealtimeUpdates,
  shouldSyncInboxMessageDivergence,
} from "@/pages/Inbox/utils";
import type { ChatMessage } from "@/core/services/apiService";

function message(id: string, content: string, createdAt: string): ChatMessage {
  return { id, conversationId: "conversation-1", content, fromMe: false, createdAt, timestamp: createdAt };
}

describe("Inbox realtime synchronization", () => {
  it("does not repeat the same stale-sidebar refetch", () => {
    expect(shouldSyncInboxMessageDivergence({
      sidebarText: "new inbound",
      panelText: "older message",
      syncKey: "conversation-1:2026-10-13T12:00:00Z:new inbound",
      lastSyncKey: "conversation-1:2026-10-13T12:00:00Z:new inbound",
    })).toBe(false);
  });

  it("allows a new inbound preview to trigger a fresh synchronization", () => {
    expect(shouldSyncInboxMessageDivergence({
      sidebarText: "new inbound",
      panelText: "older message",
      syncKey: "conversation-1:2026-10-13T12:00:01Z:new inbound",
      lastSyncKey: "conversation-1:2026-10-13T12:00:00Z:new inbound",
    })).toBe(true);
  });

  it("ignores empty, matching, and media-placeholder previews", () => {
    const base = { syncKey: "key", lastSyncKey: "other" };
    expect(shouldSyncInboxMessageDivergence({ ...base, sidebarText: "", panelText: "older" })).toBe(false);
    expect(shouldSyncInboxMessageDivergence({ ...base, sidebarText: "same", panelText: "same" })).toBe(false);
    expect(shouldSyncInboxMessageDivergence({ ...base, sidebarText: "[image]", panelText: "older" })).toBe(false);
  });

  it("keeps a realtime inbound message that arrived while a stale API snapshot was loading", () => {
    const existing = message("old", "older message", "2026-10-13T11:59:00Z");
    const incoming = message("live", "new inbound", "2026-10-13T12:00:00Z");
    const fetched = [message("old", "canonical older message", "2026-10-13T11:59:00Z")];

    const merged = mergeFetchedMessagesWithRealtimeUpdates(fetched, [existing], [existing, incoming]);

    expect(merged.map((entry) => entry.id)).toEqual(["old", "live"]);
    expect(merged[0].content).toBe("canonical older message");
    expect(merged[1]).toBe(incoming);
  });

  it("keeps temporary outgoing messages while accepting the API's canonical unchanged rows", () => {
    const old = message("old", "outdated local text", "2026-10-13T11:59:00Z");
    const canonical = message("old", "canonical server text", "2026-10-13T11:59:00Z");
    const pending = message("temp-1", "sending", "2026-10-13T12:00:00Z");

    const merged = mergeFetchedMessagesWithRealtimeUpdates([canonical], [old, pending], [old, pending]);

    expect(merged.map((entry) => entry.id)).toEqual(["old", "temp-1"]);
    expect(merged[0]).toBe(canonical);
    expect(merged[1]).toBe(pending);
  });
});
