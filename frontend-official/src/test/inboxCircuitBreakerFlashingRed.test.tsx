import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConversationRow } from "@/pages/Inbox/components/ConversationRow";

vi.mock("@/hooks/useResolvedAvatar", () => ({ useResolvedAvatar: () => ({ avatar: null }) }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

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
  document.body.innerHTML = "";
});

describe("Inbox Sidebar - Flashing Red Indicator (Piscando Vermelho) for Human Intervention", () => {
  it("renders dual-layer pulsing red beacon and INTERVENÇÃO badge when conversation has intervencao_humana tag", async () => {
    const conversation = {
      id: "conv-intervencao-1",
      contactName: "João Silva",
      phone: "5511999998888",
      lastMessage: "Vou confirmar esse detalhe com a nossa equipe aqui no balcão e um atendente já te responde por aqui! 😊",
      updatedAt: new Date().toISOString(),
      tags: ["intervencao_humana", "precisa_humano", "delirio_evitado"],
      status: "pending_human" as const,
      funnel_stage: "intervencao_humana",
      aiEnabled: false,
    };

    const rowData = {
      conversations: [conversation],
      conversationControls: {},
      globalAiEnabled: true,
      selectedId: null,
      onSelect: vi.fn(),
      leadByConversationId: {},
      pinnedChatIds: [],
      onTogglePin: vi.fn(),
      archivedChatIds: [],
      onToggleArchive: vi.fn(),
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
          style={{ height: 72, width: 320 }}
          data={rowData}
          isScrolling={false}
        />
      );
    });

    const badge = container.querySelector("span[title*='Intervenção']") || container.querySelector("span[title*='intervenção']");
    expect(badge).not.toBeNull();
    expect(container.textContent).toContain("INTERVENÇÃO");

    // Dual-layer pulsing red beacon
    const pingDot = container.querySelector(".animate-ping.bg-red-400");
    expect(pingDot).not.toBeNull();
    const coreBeacon = container.querySelector(".bg-red-600.ring-red-400\\/80");
    expect(coreBeacon).not.toBeNull();

    // Flashing red card glow / border
    const card = container.querySelector(".border-2.border-red-500\\/80");
    expect(card).not.toBeNull();
  });

  it("renders normal green dot for fresh new lead", async () => {
    const conversation = {
      id: "conv-new-lead",
      contactName: "Carlos Souza",
      phone: "5511977776666",
      lastMessage: "Olá, boa tarde!",
      updatedAt: new Date().toISOString(),
      tags: ["novo"],
      status: "open" as const,
      funnel_stage: "new_lead",
      aiEnabled: true,
      unread: 1,
    };

    const rowData = {
      conversations: [conversation],
      conversationControls: {},
      globalAiEnabled: true,
      selectedId: null,
      onSelect: vi.fn(),
      leadByConversationId: {},
      pinnedChatIds: [],
      onTogglePin: vi.fn(),
      archivedChatIds: [],
      onToggleArchive: vi.fn(),
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
          style={{ height: 72, width: 320 }}
          data={rowData}
          isScrolling={false}
        />
      );
    });

    expect(container.textContent).not.toContain("INTERVENÇÃO");
    const greenDot = container.querySelector(".bg-emerald-500");
    expect(greenDot).not.toBeNull();
  });

  it("renders blue pulsing beacon for closed order waiting for PIX", async () => {
    const conversation = {
      id: "conv-pix",
      contactName: "Mariana Costa",
      phone: "5511966665555",
      lastMessage: "Aqui está o resumo do seu pedido.",
      updatedAt: new Date().toISOString(),
      tags: ["aguarda_pix"],
      status: "closed_won" as const,
      funnel_stage: "fechamento",
      aiEnabled: false,
    };

    const rowData = {
      conversations: [conversation],
      conversationControls: {},
      globalAiEnabled: true,
      selectedId: null,
      onSelect: vi.fn(),
      leadByConversationId: {},
      pinnedChatIds: [],
      onTogglePin: vi.fn(),
      archivedChatIds: [],
      onToggleArchive: vi.fn(),
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
          style={{ height: 72, width: 320 }}
          data={rowData}
          isScrolling={false}
        />
      );
    });

    expect(container.textContent).toContain("AGUARDA PIX");
    const bluePing = container.querySelector(".animate-ping.bg-blue-400");
    expect(bluePing).not.toBeNull();
  });
});
