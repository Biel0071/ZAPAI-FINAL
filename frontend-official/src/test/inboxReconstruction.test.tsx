import { act, createRef, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActiveChatPane } from "@/pages/Inbox/components/ActiveChatPane";
import { ZaiAssistantComposer } from "@/pages/Inbox/components/ZaiAssistantComposer";
import { TagIconBadge } from "@/components/inbox/TagIconBadge";
import { apiService } from "@/core/services/apiService";

vi.mock("@/core/services/apiService", () => ({
  requestApiEndpoint: vi.fn().mockResolvedValue({ suggestedText: "Ficha oficial" }),
  apiService: {
    getActiveQuickReplyFlow: vi.fn().mockResolvedValue({ flow: null }),
    aiCompose: vi.fn().mockResolvedValue({
      message: "Olá! Temos tijolos a pronta entrega com frete grátis.",
      detectedContext: { product: "Tijolos", intent: "Vendas" },
      suggestions: ["Consultar frete", "Enviar orçamento"],
    }),
  },
}));
vi.mock("@/hooks/useResolvedAvatar", () => ({ useResolvedAvatar: () => ({ avatar: null }) }));
vi.mock("@/core/runtime/socket/socketManager", () => ({ getSharedSocket: () => null }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root;
beforeEach(() => {
  vi.clearAllMocks();
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  document.body.innerHTML = "";
});

function createActiveChatProps(): ComponentProps<typeof ActiveChatPane> {
  return {
    selectedConversation: {
      id: "conversation/test-1",
      phone: "5511999990000",
      contactName: "Sueli Silva",
      lastMessage: "Gostaria de ver o catálogo",
      updatedAt: "2026-10-07T10:00:00Z",
    },
    messages: [
      {
        id: "msg-1",
        conversationId: "conversation/test-1",
        content: "Gostaria de ver o catálogo",
        fromMe: false,
        createdAt: "2026-10-07T10:00:00Z",
        timestamp: "2026-10-07T10:00:00Z",
      } as any,
    ],
    messageInput: "",
    setMessageInput: vi.fn(),
    sending: false,
    isRealtimeConnected: true,
    isWhatsappConnected: true,
    backendOnline: true,
    isTyping: false,
    suggestingResponse: false,
    replyingTo: null,
    setReplyingTo: vi.fn(),
    attachments: [],
    removeAttachment: vi.fn(),
    handleAttachFiles: vi.fn(),
    isRecording: false,
    recordingTime: 0,
    handleCancelRecording: vi.fn(),
    handleToggleRecording: vi.fn(),
    showEmojiPicker: false,
    setShowEmojiPicker: vi.fn(),
    EmojiPickerComponent: null,
    emojiPickerData: null,
    handleInsertEmoji: vi.fn(),
    handleSendMessage: vi.fn().mockResolvedValue(undefined),
    isDraggingFiles: false,
    setIsDraggingFiles: vi.fn(),
    messagesScrollRef: createRef(),
    loadMoreTriggerRef: createRef(),
    fileInputRef: createRef(),
    messageInputRef: createRef(),
    conversationSearchInputRef: createRef(),
    conversationSearchOpen: false,
    setConversationSearchOpen: vi.fn(),
    conversationSearchQuery: "",
    setConversationSearchQuery: vi.fn(),
    activeConversationSearchIndex: 0,
    setActiveConversationSearchIndex: vi.fn(),
    inboxRuntimeState: "ONLINE",
    canUseBackend: true,
    canSendMessages: true,
    aiEnabledForConversation: false,
    conversationAiOverrideEnabled: false,
    handleSetConversationAiEnabled: vi.fn().mockResolvedValue(undefined),
    aiAgents: [{ id: "ag-1", name: "Camila", active: true }],
    handleSetConversationAgent: vi.fn(),
    isTabletLayout: false,
    setShowLeadPanel: vi.fn(),
    handleClearSelectedConversation: vi.fn(),
    archivedChatIds: [],
    handleArchiveSelectedConversation: vi.fn(),
    handleUnarchiveSelectedConversation: vi.fn(),
    handleBlockContact: vi.fn(),
    handleUnblockContact: vi.fn(),
    setRightPanelTab: vi.fn(),
    setRightPanelCollapsed: vi.fn(),
    messagesLoadFailed: false,
    loadingMessages: false,
    loadingOlderMessages: false,
    historySyncStatus: "idle",
    handleLoadOlderMessages: vi.fn().mockResolvedValue(undefined),
    handleRetryMessages: vi.fn().mockResolvedValue(undefined),
    unseenRealtimeCount: 0,
    scrollToLatestMessage: vi.fn(),
    keyboardOffset: 0,
    isMobile: false,
    messageReactions: {},
    handleReactMessage: vi.fn(),
    setPreviewMedia: vi.fn(),
    setPreviewZoom: vi.fn(),
    activeMessageMenuId: null,
    setActiveMessageMenuId: vi.fn(),
    activeReactionPickerMessageId: null,
    setActiveReactionPickerMessageId: vi.fn(),
    handleCopyMessage: vi.fn(),
    handleReplyMessage: vi.fn(),
    handleForwardMessage: vi.fn(),
    handleDeleteMessage: vi.fn().mockResolvedValue(undefined),
    handleDownloadMedia: vi.fn(),
    handleToggleAudioPlayback: vi.fn(),
    loadingAudioMessageId: null,
    playingAudioMessageId: null,
    audioProgress: 0,
    audioDuration: 0,
    quickReplies: [],
    sendQuickReply: vi.fn().mockResolvedValue(undefined),
    applyPendingBackgroundUpdates: vi.fn().mockResolvedValue(undefined),
    pendingBackgroundUpdates: 0,
    error: null,
  };
}

describe("Reconstrução Visual & UX do Inbox (Mudanças 1, 2, 3 e 4)", () => {
  it("Mudança 1: toolbar superior renderiza botões priorizados Buscar, Gerar Ficha, Transferir e Finalizar", async () => {
    const props = createActiveChatProps();
    await act(async () => {
      root.render(
        <MemoryRouter>
          <ActiveChatPane {...props} />
        </MemoryRouter>
      );
    });

    const buscarBtn = document.querySelector('button[aria-label="Buscar na conversa"]');
    expect(buscarBtn).not.toBeNull();

    const gerarFichaBtn = document.querySelector('button[aria-label="Gerar Ficha"]');
    expect(gerarFichaBtn).not.toBeNull();

    const transferirBtn = document.querySelector('button[aria-label="Transferir atendimento"]');
    expect(transferirBtn).not.toBeNull();

    const finalizarBtn = document.querySelector('button[aria-label="Finalizar atendimento"]');
    expect(finalizarBtn).not.toBeNull();
  });

  it("Mudança 2: elementos duplicados 'IA ativa' e 'Agente: Padrão da conexão' foram removidos do cabeçalho da conversa", async () => {
    const props = createActiveChatProps();
    await act(async () => {
      root.render(
        <MemoryRouter>
          <ActiveChatPane {...props} />
        </MemoryRouter>
      );
    });

    // O cabeçalho NÃO deve ter o botão "Controle da IA"
    const aiControlBtn = document.querySelector('button[title="Controle da IA"]');
    expect(aiControlBtn).toBeNull();

    // Nem o seletor "Padrão da conexão"
    expect(document.querySelector('select')).toBeNull();
  });

  it("Mudanças 3 + 4: ZaiAssistantComposer inicia fechado em botão compacto e expande inline com micro-timeline", async () => {
    const setMessageInput = vi.fn();
    const messageInputRef = { current: document.createElement("textarea") };

    await act(async () => {
      root.render(
        <ZaiAssistantComposer
          selectedConversation={{ id: "conv-1", contactName: "Sueli Silva" } as any}
          messages={[{ id: "m1", content: "Olá", fromMe: false } as any]}
          setMessageInput={setMessageInput}
          messageInputRef={messageInputRef}
        />
      );
    });

    // Estado fechado: botão compacto presente
    const compactBtn = document.querySelector('button[aria-label="Resposta IA disponível"]');
    expect(compactBtn).not.toBeNull();

    // Ao clicar, expande inline
    await act(async () => {
      compactBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Cabeçalho expandido
    expect(document.body.textContent).toContain("✨ IA — Resposta sugerida");
    // Micro-timeline presente
    expect(document.body.textContent).toContain("Lendo conversa");
    expect(document.body.textContent).toContain("Identificando intenção");
    expect(document.body.textContent).toContain("Consultando contexto");
    expect(document.body.textContent).toContain("Gerando resposta");
    expect(document.body.textContent).toContain("Resposta pronta");

    // Botões de ação presentes
    expect(document.body.textContent).toContain("Melhorar");
    expect(document.body.textContent).toContain("Gerar novamente");
  });

  it("Etiquetas compactas: TagIconBadge com size='xs' renderiza formato reduzido", async () => {
    await act(async () => {
      root.render(
        <TagIconBadge
          tag="Lead Quente"
          size="xs"
          interactive={false}
        />
      );
    });

    const badge = document.querySelector('span[title="Lead Quente"]');
    expect(badge).not.toBeNull();
    expect(badge?.className).toContain("h-5");
    expect(badge?.className).toContain("text-[10px]");
  });
});
