import { describe, it, expect, vi } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { CollapsedConversationRow } from "@/pages/Inbox/components/ChatListPanel";
import { ConversationRow } from "@/pages/Inbox/components/ConversationRow";
import type { Conversation } from "@/core/services/apiService";

describe("WhatsApp Style Conversation Rail & Menu", () => {
  const baseConversation: Conversation = {
    id: "conv-123",
    contactName: "João Silva",
    phone: "5511999998888",
    avatar: "",
    unread: 3,
    lastMessage: "Olá, gostaria de saber mais.",
    updatedAt: new Date().toISOString(),
    tags: ["Novo Lead", "Orçamento"],
    status: "open" as const,
    funnel_stage: "qualificacao",
    aiEnabled: true,
  };

  it("Barra lateral recolhida: avatar limpo sem texto de etiqueta sobreposto", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const rowData = {
      conversations: [baseConversation],
      conversationControls: {},
      globalAiEnabled: true,
      selectedId: null,
      onSelect: vi.fn(),
      leadByConversationId: {},
      pinnedChatIds: [],
      onTogglePin: vi.fn(),
      archivedChatIds: [],
      onToggleArchive: vi.fn(),
      mutedChatIds: [],
      onToggleMute: vi.fn(),
      onToggleUnread: vi.fn(),
      onDeleteConversation: vi.fn(),
      onSetConversationAiEnabled: vi.fn(),
      isMultiSelectMode: false,
      selectedChatIds: [],
      onToggleSelect: vi.fn(),
      onUpdateTags: vi.fn(),
    };

    await act(async () => {
      root.render(
        <CollapsedConversationRow
          index={0}
          style={{ height: 64, width: 64 }}
          data={rowData as any}
          isScrolling={false}
        />
      );
    });

    // O avatar exibe as iniciais
    expect(container.textContent).toContain("JS");
    // O badge de não lidas é exibido
    expect(container.textContent).toContain("3");
    // O texto da tag NÃO deve estar estampado diretamente sobre o avatar
    // (anteriormente "Novo Lead" ou "Orçamento" ficava impresso sobre a foto)
    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    // No texto visível direto do botão não deve ter "Novo Lead" ou "Orçamento"
    expect(button?.textContent).not.toContain("Novo Lead");
    expect(button?.textContent).not.toContain("Orçamento");

    root.unmount();
    container.remove();
  });

  it("ConversationRow: exibe botão CaretDown de hover e ícones de fixado e silenciado", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const rowData = {
      conversations: [baseConversation],
      conversationControls: {},
      globalAiEnabled: true,
      selectedId: null,
      onSelect: vi.fn(),
      leadByConversationId: {},
      pinnedChatIds: ["conv-123"],
      onTogglePin: vi.fn(),
      archivedChatIds: [],
      onToggleArchive: vi.fn(),
      mutedChatIds: ["conv-123"],
      onToggleMute: vi.fn(),
      onToggleUnread: vi.fn(),
      onDeleteConversation: vi.fn(),
      onSetConversationAiEnabled: vi.fn(),
      isMultiSelectMode: false,
      selectedChatIds: [],
      onToggleSelect: vi.fn(),
      onUpdateTags: vi.fn(),
    };

    await act(async () => {
      root.render(
        <ConversationRow
          index={0}
          style={{ height: 72, width: 340 }}
          data={rowData as any}
          isScrolling={false}
        />
      );
    });

    expect(container.textContent).toContain("João Silva");
    // Deve conter o gatilho de dropdown com aria-label "Mais opções da conversa"
    const moreBtn = container.querySelector('button[aria-label="Mais opções da conversa"]');
    expect(moreBtn).not.toBeNull();

    // Deve conter o título de silenciado
    const mutedIcon = container.querySelector('[title="Silenciado"]');
    expect(mutedIcon).not.toBeNull();

    root.unmount();
    container.remove();
  });
});
