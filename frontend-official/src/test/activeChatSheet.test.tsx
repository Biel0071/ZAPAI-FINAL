import { act, createRef, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActiveChatPane } from "@/pages/Inbox/components/ActiveChatPane";
import { requestApiEndpoint } from "@/core/services/apiService";

vi.mock("@/core/services/apiService", () => ({
  requestApiEndpoint: vi.fn().mockResolvedValue({ suggestedText: "Ficha oficial" }),
  apiService: { getActiveQuickReplyFlow: vi.fn().mockResolvedValue({ flow: null }) },
}));
vi.mock("@/hooks/useResolvedAvatar", () => ({ useResolvedAvatar: () => ({ avatar: null }) }));
vi.mock("@/core/runtime/socket/socketManager", () => ({ getSharedSocket: () => null }));
vi.mock("@/pages/Inbox/components/ZaiAssistantComposer", () => ({ ZaiAssistantComposer: () => null }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root;
beforeEach(() => {
  vi.clearAllMocks();
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); document.body.innerHTML = ""; });

function createProps(): ComponentProps<typeof ActiveChatPane> {
  return {
    selectedConversation: { id: "conversation/a", phone: "5511999990000", contactName: "Ana", lastMessage: "Olá", updatedAt: "2026-10-05T10:00:00Z" },
    messages: [], messageInput: "", setMessageInput: vi.fn(), sending: false,
    isRealtimeConnected: true, isWhatsappConnected: true, backendOnline: true, isTyping: false,
    suggestingResponse: false, replyingTo: null, setReplyingTo: vi.fn(), attachments: [], removeAttachment: vi.fn(), handleAttachFiles: vi.fn(),
    isRecording: false, recordingTime: 0, handleCancelRecording: vi.fn(), handleToggleRecording: vi.fn(),
    showEmojiPicker: false, setShowEmojiPicker: vi.fn(), EmojiPickerComponent: null, emojiPickerData: null, handleInsertEmoji: vi.fn(), handleSendMessage: vi.fn().mockResolvedValue(undefined),
    isDraggingFiles: false, setIsDraggingFiles: vi.fn(), messagesScrollRef: createRef(), loadMoreTriggerRef: createRef(), fileInputRef: createRef(), messageInputRef: createRef(), conversationSearchInputRef: createRef(),
    conversationSearchOpen: false, setConversationSearchOpen: vi.fn(), conversationSearchQuery: "", setConversationSearchQuery: vi.fn(), activeConversationSearchIndex: 0, setActiveConversationSearchIndex: vi.fn(),
    inboxRuntimeState: "ONLINE", canUseBackend: true, canSendMessages: true, aiEnabledForConversation: false, conversationAiOverrideEnabled: false, handleSetConversationAiEnabled: vi.fn().mockResolvedValue(undefined),
    isTabletLayout: false, setShowLeadPanel: vi.fn(), handleClearSelectedConversation: vi.fn(), archivedChatIds: [], handleArchiveSelectedConversation: vi.fn(), handleUnarchiveSelectedConversation: vi.fn(), handleBlockContact: vi.fn(), handleUnblockContact: vi.fn(),
    setRightPanelTab: vi.fn(), setRightPanelCollapsed: vi.fn(), messagesLoadFailed: false, loadingMessages: false, handleRetryMessages: vi.fn().mockResolvedValue(undefined), unseenRealtimeCount: 0, scrollToLatestMessage: vi.fn(), keyboardOffset: 0, isMobile: false,
    messageReactions: {}, handleReactMessage: vi.fn(), setPreviewMedia: vi.fn(), setPreviewZoom: vi.fn(), activeMessageMenuId: null, setActiveMessageMenuId: vi.fn(), activeReactionPickerMessageId: null, setActiveReactionPickerMessageId: vi.fn(),
    handleCopyMessage: vi.fn(), handleReplyMessage: vi.fn(), handleForwardMessage: vi.fn(), handleDeleteMessage: vi.fn().mockResolvedValue(undefined), handleDownloadMedia: vi.fn(), handleToggleAudioPlayback: vi.fn(), loadingAudioMessageId: null, playingAudioMessageId: null, audioProgress: 0, audioDuration: 0,
    quickReplies: [], sendQuickReply: vi.fn().mockResolvedValue(undefined), applyPendingBackgroundUpdates: vi.fn().mockResolvedValue(undefined), pendingBackgroundUpdates: 0, error: null,
  };
}
async function render(props: ComponentProps<typeof ActiveChatPane>) {
  await act(async () => root.render(<MemoryRouter><ActiveChatPane {...props} /></MemoryRouter>));
}
async function generate() {
  await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="Gerar Ficha"]')!.click());
}

describe("Ficha do atendimento", () => {
  it("solicita POST e preenche o rascunho com a resposta recebida", async () => {
    const props = createProps(); await render(props); await generate();
    expect(requestApiEndpoint).toHaveBeenCalledWith("/api/conversations/conversation%2Fa/generate-sheet", "POST");
    expect(props.setMessageInput).toHaveBeenCalledWith("Ficha oficial");
  });
  it("descarta a ficha quando a conversa muda antes da resposta", async () => {
    let resolve: (response: { suggestedText: string }) => void = () => {};
    vi.mocked(requestApiEndpoint).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const props = createProps(); await render(props); await generate();
    await render({ ...props, selectedConversation: { ...props.selectedConversation!, id: "conversation-b" } });
    await act(async () => resolve({ suggestedText: "Ficha da conversa A" }));
    expect(props.setMessageInput).not.toHaveBeenCalled();
  });
});
