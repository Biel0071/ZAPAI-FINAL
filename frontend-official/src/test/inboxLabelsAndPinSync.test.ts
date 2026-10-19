import { describe, expect, it } from "vitest";
import { normalizeConversation, apiService } from "@/core/services/apiService";

describe("WhatsApp Labels and Pinned/Archived Realtime Sync", () => {
  it("normalizes conversation with is_pinned and archived flags correctly", () => {
    const raw = {
      id: "conv-101",
      phone: "5511999998888",
      name: "Cliente VIP",
      is_pinned: true,
      pinned_at: "2026-10-19T14:00:00Z",
      archived: false,
      tags: ["Novo Cliente", "Importante"],
      unread_count: 0,
      last_message: "Olá, tudo bem?",
    };

    const normalized = normalizeConversation(raw as any);

    expect(normalized.is_pinned).toBe(true);
    expect(normalized.pinned).toBe(true);
    expect(normalized.pinned_at).toBe("2026-10-19T14:00:00Z");
    expect(normalized.archived).toBe(false);
    expect(normalized.tags).toEqual(["Novo Cliente", "Importante"]);
  });

  it("prioritizes pinned conversations when sorting inbox list", () => {
    const conv1 = normalizeConversation({
      id: "conv-1",
      phone: "5511900000001",
      name: "Contato 1",
      is_pinned: false,
      last_message_at: "2026-10-19T14:10:00Z",
    } as any);

    const conv2 = normalizeConversation({
      id: "conv-2",
      phone: "5511900000002",
      name: "Contato 2 (Fixado)",
      is_pinned: true,
      last_message_at: "2026-10-19T12:00:00Z",
    } as any);

    const conv3 = normalizeConversation({
      id: "conv-3",
      phone: "5511900000003",
      name: "Contato 3",
      is_pinned: false,
      last_message_at: "2026-10-19T14:20:00Z",
    } as any);

    const list = [conv1, conv2, conv3];

    // Sorting logic matching canonical inbox: pinned first, then last_message_at DESC
    const sorted = [...list].sort((a, b) => {
      const aPinned = Boolean(a.is_pinned || a.pinned);
      const bPinned = Boolean(b.is_pinned || b.pinned);
      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      return new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime();
    });

    expect(sorted[0].id).toBe("conv-2");
    expect(sorted[1].id).toBe("conv-3");
    expect(sorted[2].id).toBe("conv-1");
  });

  it("exposes getWhatsAppLabels on apiService", () => {
    expect(typeof apiService.getWhatsAppLabels).toBe("function");
  });
});
