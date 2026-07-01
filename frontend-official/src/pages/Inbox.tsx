import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Check,
  Star,
  CaretRight,
  CaretLeft,
  Plus,
  Trash,
  Paperclip,
  PencilSimple,
  CopySimple,
} from "@phosphor-icons/react";
import { Header } from "@/components/layout/Header";
import InboxView from "@/lovable/pages/InboxPageView";
import { createInboxLovableViewModel } from "@/adapters/lovable/inboxAdapter";
import { getInboxUnreadTotal, publishInboxUnreadTotal } from "@/lib/inboxUnread";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiService } from "@/services/apiService";
import { useAppStore } from "@/stores/appStore";

// Modularized components and hook
import { useInboxState } from "./Inbox/hooks/useInboxState";
import { ChatListPanel } from "./Inbox/components/ChatListPanel";
import { ActiveChatPane } from "./Inbox/components/ActiveChatPane";
import { SidebarPanel } from "./Inbox/components/SidebarPanel";
import {
  normalizeConversationTimestamp,
  sortMessagesAsc,
  sanitizeSidebarText,
  getConversationSourceLabel,
  getMediaTypeLabel,
  downloadMediaFile,
  getQuickReplyPreviewText,
  formatPhoneNumber,
  getLeadTemperatureMeta,
} from "./Inbox/utils";

export default function Inbox() {
  const state = useInboxState();
  const [showGroups, setShowGroups] = useState(false);
  const [isNewChatDialogOpen, setIsNewChatDialogOpen] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState("");
  const [newChatName, setNewChatName] = useState("");
  const [newChatSessionId, setNewChatSessionId] = useState("");
  const [newChatLoading, setNewChatLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isNewChatDialogOpen) {
      setNewChatSessionId(state.preferredSessionId || (state.sessions && state.sessions[0]?.id) || "main");
      setNewChatPhone("");
      setNewChatName("");
    }
  }, [isNewChatDialogOpen, state.preferredSessionId, state.sessions]);

  const handleCreateNewChat = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = newChatPhone.replace(/\D/g, "");
    if (!cleanPhone) {
      toast({ title: "Erro", description: "Por favor, insira um número de telefone válido.", variant: "destructive" });
      return;
    }
    setNewChatLoading(true);
    try {
      const newConv = await apiService.createConversation({
        phone: cleanPhone,
        name: newChatName.trim() || undefined,
        sessionId: newChatSessionId || undefined,
      });

      toast({ title: "Sucesso", description: "Conversa criada com sucesso!" });
      setIsNewChatDialogOpen(false);

      // Force refresh/load of conversations
      await state.handleRetryConversations();
      
      // Select the new conversation
      if (newConv && newConv.id) {
        state.setSelectedConversationId(String(newConv.id));
        void state.loadConversationMessages(String(newConv.id), { force: true }).then(() => {
          state.scrollToLatestMessage("auto");
        });
      }
    } catch (err: any) {
      console.error("Erro ao criar conversa:", err);
      toast({
        title: "Erro ao criar conversa",
        description: err.message || "Ocorreu um erro ao tentar criar a conversa.",
        variant: "destructive",
      });
    } finally {
      setNewChatLoading(false);
    }
  };

  // Persist unread total globally when conversations change
  useEffect(() => {
    publishInboxUnreadTotal(getInboxUnreadTotal(state.conversations));
  }, [state.conversations]);

  const activeSessionId = useAppStore((state) => state.activeSessionId);

  const filteredConversations = useMemo(() => {
    const normalizedSearch = state.searchQuery.trim().toLowerCase();
    const archivedSet = new Set(state.archivedChatIds);
    const pinnedSet = new Set(state.pinnedChatIds);

    return state.conversations
      .filter((conversation) => {
        const convSessionId = String(conversation.sessionId || "main").trim().toLowerCase();
        if (activeSessionId) {
          const targetSessionId = String(activeSessionId).trim().toLowerCase();
          if (convSessionId !== targetSessionId) {
            return false;
          }
        }

        const isArchived = archivedSet.has(String(conversation.id));
        if (state.filter === "archived") return isArchived;
        if (isArchived) return false;
        if (state.filter === "unread" && (conversation.unread ?? 0) <= 0) return false;
        if (state.filter === "ai" && !(state.conversationControls[conversation.id]?.aiEnabled ?? true)) return false;
        if (!showGroups && conversation.isGroup) return false;
        if (!normalizedSearch) return true;

        const draftText = state.draftsByConversationId[conversation.id]?.draft ?? "";
        return (
          conversation.contactName.toLowerCase().includes(normalizedSearch) ||
          conversation.phone.toLowerCase().includes(normalizedSearch) ||
          conversation.lastMessage.toLowerCase().includes(normalizedSearch) ||
          draftText.toLowerCase().includes(normalizedSearch)
        );
      })
      .sort((a, b) => {
        const aPinned = pinnedSet.has(String(a.id));
        const bPinned = pinnedSet.has(String(b.id));
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;

        const aDraftTime = state.draftsByConversationId[a.id]?.timestamp ?? 0;
        const bDraftTime = state.draftsByConversationId[b.id]?.timestamp ?? 0;
        const aActivityTime = Math.max(normalizeConversationTimestamp(a.updatedAt), aDraftTime);
        const bActivityTime = Math.max(normalizeConversationTimestamp(b.updatedAt), bDraftTime);
        return bActivityTime - aActivityTime;
      });
  }, [
    state.archivedChatIds,
    state.pinnedChatIds,
    state.conversations,
    state.conversationControls,
    state.filter,
    state.searchQuery,
    state.draftsByConversationId,
    showGroups,
  ]);

  const conversationRowData = useMemo(
    () => ({
      conversations: filteredConversations,
      conversationControls: state.conversationControls,
      globalAiEnabled: state.aiRuntime.globalEnabled,
      selectedId: state.selectedConversation?.id ?? null,
      onSelect: (id: string) => {
        const normalizedId = String(id);
        state.setSelectedConversationId(normalizedId);
        void state.loadConversationMessages(normalizedId, { force: true }).finally(() => {
          state.scrollToLatestMessage("auto");
          window.setTimeout(() => state.scrollToLatestMessage("auto"), 120);
          window.setTimeout(() => state.scrollToLatestMessage("auto"), 320);
        });
        if (state.isMobile) state.setMobileScreen("chat");
        window.requestAnimationFrame(() => {
          if (state.messageInputRef.current) {
            state.messageInputRef.current.style.height = "auto";
            state.messageInputRef.current.focus();
          }
        });
        state.setConversations((prev) =>
          prev.map((conversation) =>
            String(conversation.id) === normalizedId ? { ...conversation, unread: 0 } : conversation,
          ),
        );
      },
      leadByConversationId: state.leadByConversationId,
      typingByConversationId: state.typingByConversationId,
      draftsByConversationId: state.draftsByConversationId,
      pinnedChatIds: state.pinnedChatIds,
      onTogglePin: state.handleTogglePin,
      archivedChatIds: state.archivedChatIds,
      onToggleArchive: state.handleToggleArchive,
      onDeleteConversation: state.handleDeleteConversation,
      onSetConversationAiEnabled: state.handleSetConversationAiEnabledById,
      isMultiSelectMode: state.isMultiSelectMode,
      selectedChatIds: state.selectedChatIds,
      onToggleSelect: (id: string) => {
          state.setSelectedChatIds(
          state.selectedChatIds.includes(id)
            ? state.selectedChatIds.filter((cid) => cid !== id)
            : [...state.selectedChatIds, id],
          );
      },
      onUpdateTags: state.handleUpdateConversationTags,
    }),
    [
      filteredConversations,
      state.conversationControls,
      state.aiRuntime.globalEnabled,
      state.selectedConversation?.id,
      state.isMultiSelectMode,
      state.selectedChatIds,
      state.leadByConversationId,
      state.typingByConversationId,
      state.draftsByConversationId,
      state.pinnedChatIds,
      state.archivedChatIds,
      state.setSelectedConversationId,
      state.loadConversationMessages,
      state.scrollToLatestMessage,
      state.isMobile,
      state.setMobileScreen,
      state.messageInputRef,
      state.setSelectedChatIds,
      state.handleTogglePin,
      state.handleToggleArchive,
      state.handleDeleteConversation,
      state.handleSetConversationAiEnabledById,
      state.handleUpdateConversationTags,
    ],
  );

  const selectedLead = useMemo(() => {
    if (!state.selectedConversation) return null;
    return state.leadInsight ?? state.leadByConversationId[state.selectedConversation.id] ?? null;
  }, [state.leadByConversationId, state.leadInsight, state.selectedConversation]);

  const lovableInboxViewModel = createInboxLovableViewModel({
    conversations: state.conversations,
    selectedConversation: state.selectedConversation,
    messages: state.messages,
  });

  const selectedLeadMeta = getLeadTemperatureMeta(selectedLead);

  const selectedConversationFunnelStage = String(
    (state.selectedConversation as any)?.funnel_stage ?? selectedLeadMeta.label ?? "Novo Lead",
  );

  const conversationTimeline = useMemo(() => {
    const ordered = sortMessagesAsc(state.messages);
    const items = ordered.slice(-8).map((message) => ({
      id: message.id,
      title: message.fromMe ? "Mensagem enviada" : "Mensagem recebida",
      description:
        message.caption || message.content || getMediaTypeLabel(message.mediaType),
      timestamp: message.createdAt,
    }));

    const summary = sanitizeSidebarText(
      state.aiMemory?.summary ?? state.selectedConversation?.summary ?? "",
    );
    const lastAiUpdate =
      typeof state.aiMemory?.last_updated === "string" ? state.aiMemory.last_updated : null;

    if (lastAiUpdate) {
      items.push({
        id: `ai-${lastAiUpdate}`,
        title: "Resumo IA atualizado",
        description: summary || "Memória da conversa sincronizada.",
        timestamp: lastAiUpdate,
      });
    }

    return items
      .filter((item) => item.timestamp)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [state.aiMemory, state.selectedConversation, state.messages]);

  const conversationMetrics = useMemo(() => {
    const ordered = sortMessagesAsc(state.messages);
    const inbound = ordered.filter((message) => !message.fromMe);
    const outbound = ordered.filter((message) => message.fromMe);

    const summary = sanitizeSidebarText(
      state.aiMemory?.summary ?? state.selectedConversation?.summary ?? "",
    );
    const lastAiUpdate =
      typeof state.aiMemory?.last_updated === "string" ? state.aiMemory.last_updated : null;

    return {
      messagesExchanged: ordered.length,
      inboundMessages: inbound.length,
      outboundMessages: outbound.length,
      averageResponseLabel: "Ainda sem resposta",
      averageResponseMs: null,
      lastInteraction: ordered.at(-1)?.createdAt ?? state.selectedConversation?.updatedAt ?? null,
      firstInteraction: ordered[0]?.createdAt ?? null,
      tags: state.selectedConversation?.tags ?? [],
      leadSource: getConversationSourceLabel(state.selectedConversation),
      summary,
      lastAiUpdate,
      lastAiResponseAt: null,
      lastAiResponseTimeMs: null,
      objective: "Contato em andamento",
      metrics: state.aiMemory?.metrics ?? {},
    };
  }, [state.aiMemory, state.selectedConversation, state.messages]);

  const imageMessages = useMemo(() => {
    return state.messages.filter((msg) => {
      const url = msg.mediaUrl || msg.url;
      return url && (msg.mediaType === "image" || msg.mediaType === "sticker");
    });
  }, [state.messages]);

  const currentImageIndex = useMemo(() => {
    if (!state.previewMedia) return -1;
    return imageMessages.findIndex((msg) => (msg.mediaUrl || msg.url) === state.previewMedia?.url);
  }, [imageMessages, state.previewMedia]);

  const showPreviousImage = useCallback((event?: React.MouseEvent) => {
    event?.stopPropagation();
    if (currentImageIndex > 0) {
      const prevMsg = imageMessages[currentImageIndex - 1];
      state.setPreviewMedia({
        url: prevMsg.mediaUrl || prevMsg.url || "",
        type: prevMsg.mediaType as any,
        fileName: prevMsg.fileName || "Mídia",
        messageId: prevMsg.id,
      });
      state.setPreviewZoom(1);
    }
  }, [imageMessages, currentImageIndex, state.setPreviewMedia, state.setPreviewZoom]);

  const showNextImage = useCallback((event?: React.MouseEvent) => {
    event?.stopPropagation();
    if (currentImageIndex < imageMessages.length - 1 && currentImageIndex !== -1) {
      const nextMsg = imageMessages[currentImageIndex + 1];
      state.setPreviewMedia({
        url: nextMsg.mediaUrl || nextMsg.url || "",
        type: nextMsg.mediaType as any,
        fileName: nextMsg.fileName || "Mídia",
        messageId: nextMsg.id,
      });
      state.setPreviewZoom(1);
    }
  }, [imageMessages, currentImageIndex, state.setPreviewMedia, state.setPreviewZoom]);

  useEffect(() => {
    if (!state.previewMedia) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        showPreviousImage();
      } else if (event.key === "ArrowRight") {
        showNextImage();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [state.previewMedia, showPreviousImage, showNextImage]);

  // Sidebar props mapped
  const sidebarProps = {
    selectedConversation: state.selectedConversation,
    rightPanelTab: state.rightPanelTab,
    setRightPanelTab: state.setRightPanelTab,
    rightPanelCollapsed: state.rightPanelCollapsed,
    setRightPanelCollapsed: state.setRightPanelCollapsed,
    isTabletLayout: state.isTabletLayout,
    aiEnabledForConversation: state.aiEnabledForConversation,
    aiRuntime: state.aiRuntime,
    conversationAiOverrideEnabled: state.conversationAiOverrideEnabled,
    selectedLead,
    suggestingResponse: state.suggestingResponse,
    handleSuggestResponse: state.handleSuggestResponse,
    messages: state.messages,
    aiMemory: state.aiMemory,
    setConversations: state.setConversations,
    leadNotes: state.leadNotes,
    setLeadNotes: state.setLeadNotes,
    handleSaveLeadNotes: state.handleSaveLeadNotes,
    newTagInput: state.newTagInput,
    setNewTagInput: state.setNewTagInput,
    handleAddTagToSelectedConversation: state.handleAddTagToSelectedConversation,
    handleRemoveTagFromSelectedConversation: state.handleRemoveTagFromSelectedConversation,
    handleInsertTag: state.handleInsertTag,
    updatingAiToggle: state.updatingAiToggle,
    handleSetConversationAiEnabled: state.handleSetConversationAiEnabled,
    responseSearchQuery: state.responseSearchQuery,
    setResponseSearchQuery: state.setResponseSearchQuery,
    quickReplies: state.quickReplies,
    openCreateQuickReplyDialog: state.openCreateQuickReplyDialog,
    quickReplyCategory: state.quickReplyCategory,
    setQuickReplyCategory: state.setQuickReplyCategory,
    sendQuickReply: state.sendQuickReply,
    toggleFavoriteQuickReply: state.toggleFavoriteQuickReply,
    openEditQuickReplyDialog: state.openEditQuickReplyDialog,
    duplicateQuickReply: state.duplicateQuickReply,
    deleteQuickReply: state.deleteQuickReply,
    setMessageInput: state.setMessageInput,
    handleOpenMediaPreview: (media: any) => {
      state.setPreviewZoom(1);
      state.setPreviewMedia(media);
    },
    handleDownloadMedia: state.handleDownloadMedia,
    persistConversationMetadata: async (id: string, meta: any) => {
      // Mock persistence for module
    },
    handleArchiveSelectedConversation: state.handleArchiveSelectedConversation,
    aiAgents: state.aiAgents,
    loadingAgents: state.loadingAgents,
    handleSetConversationAgent: state.handleSetConversationAgent,
    onSaveTimelineToMemory: async (evt: any) => {
      if (!state.selectedConversation) return;
      const eventText = `[${new Date(evt.timestamp).toLocaleString("pt-BR")}] ${evt.title}: ${evt.description}`;
      const nextNotes = state.leadNotes ? `${state.leadNotes}\n${eventText}` : eventText;
      state.setLeadNotes(nextNotes);
      await apiService.patchConversation(state.selectedConversation.id, { notes: nextNotes });
      state.setConversations((prev: any) =>
        prev.map((c: any) =>
          c.id === state.selectedConversation.id ? { ...c, notes: nextNotes } : c
        )
      );
      toast({ title: "Salvo na Memória", description: "Evento adicionado às notas do contato!" });
    },
  };

  const leadPanelContent = state.selectedConversation ? (
    <SidebarPanel {...sidebarProps} isDrawer={true} />
  ) : (
    <div className="text-sm text-muted-foreground p-4">Selecione uma conversa para ver detalhes.</div>
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {(!state.isMobile || state.mobileScreen !== "chat") && (
        <Header 
          title="Inbox" 
          subtitle={`${lovableInboxViewModel.conversationCount} conversas ativas`} 
          actions={
            <Button 
              size="sm" 
              onClick={() => setIsNewChatDialogOpen(true)}
              className="h-8 gap-1.5 rounded-xl text-xs shadow-glow bg-primary text-primary-foreground hover:bg-primary/90 md:inline-flex"
            >
              <Plus weight="bold" className="h-3.5 w-3.5" />
              Nova Conversa
            </Button>
          }
        />
      )}

      <InboxView
        isMobile={state.isMobile}
        mobileScreen={state.mobileScreen}
        leftPanel={
          <ChatListPanel
            searchQuery={state.searchQuery}
            setSearchQuery={state.setSearchQuery}
            isMultiSelectMode={state.isMultiSelectMode}
            setIsMultiSelectMode={state.setIsMultiSelectMode}
            selectedChatIds={state.selectedChatIds}
            setSelectedChatIds={state.setSelectedChatIds}
            filter={state.filter}
            setFilter={state.setFilter}
            filteredConversations={filteredConversations}
            conversationsLoadFailed={state.conversationsLoadFailed}
            loadingConversations={state.loadingConversations}
            handleRetryConversations={state.handleRetryConversations}
            conversationListHeight={state.conversationListHeight}
            conversationRowData={conversationRowData}
            activeSession={state.activeSession}
            navigate={() => {}}
            handleBulkPin={state.handleBulkPin}
            handleBulkArchive={state.handleBulkArchive}
            handleBulkAddTag={state.handleBulkAddTag}
            handleBulkDelete={state.handleBulkDelete}
            handleBulkExportContacts={state.handleBulkExportContacts}
            handleBulkLoadCampaign={state.handleBulkLoadCampaign}
            isMobile={state.isMobile}
            mobileScreen={state.mobileScreen}
            showGroups={showGroups}
            setShowGroups={setShowGroups}
          />
        }
        centerPanel={
          <ActiveChatPane
            selectedConversation={state.selectedConversation}
            messages={state.messages}
            messageInput={state.messageInput}
            setMessageInput={state.setMessageInput}
            sending={state.sending}
            isRealtimeConnected={state.isRealtimeConnected}
            isWhatsappConnected={state.isWhatsappConnected}
            backendOnline={state.backendOnline}
            isTyping={state.isTyping}
            suggestingResponse={state.suggestingResponse}
            replyingTo={state.replyingTo}
            setReplyingTo={state.setReplyingTo}
            attachments={state.attachments}
            removeAttachment={state.removeAttachment}
            updateAttachmentCaption={state.updateAttachmentCaption}
            handleAttachFiles={state.handleAttachFiles}
            isRecording={state.isRecording}
            recordingTime={state.recordingTime}
            handleCancelRecording={state.handleCancelRecording}
            handleToggleRecording={state.handleToggleRecording}
            showEmojiPicker={state.showEmojiPicker}
            setShowEmojiPicker={state.setShowEmojiPicker}
            EmojiPickerComponent={state.EmojiPickerComponent}
            emojiPickerData={state.emojiPickerData}
            handleInsertEmoji={state.handleInsertEmoji}
            handleSendMessage={state.handleSendMessage}
            isDraggingFiles={state.isDraggingFiles}
            setIsDraggingFiles={state.setIsDraggingFiles}
            messagesScrollRef={state.messagesScrollRef}
            loadMoreTriggerRef={state.loadMoreTriggerRef}
            fileInputRef={state.fileInputRef}
            messageInputRef={state.messageInputRef}
            conversationSearchInputRef={state.conversationSearchInputRef}
            conversationSearchOpen={state.conversationSearchOpen}
            setConversationSearchOpen={state.setConversationSearchOpen}
            conversationSearchQuery={state.conversationSearchQuery}
            setConversationSearchQuery={state.setConversationSearchQuery}
            activeConversationSearchIndex={state.activeConversationSearchIndex}
            setActiveConversationSearchIndex={state.setActiveConversationSearchIndex}
            inboxRuntimeState={state.inboxRuntimeState}
            canUseBackend={state.canUseBackend}
            canSendMessages={state.canSendMessages}
            aiEnabledForConversation={state.aiEnabledForConversation}
            conversationAiOverrideEnabled={state.conversationAiOverrideEnabled}
            handleSetConversationAiEnabled={state.handleSetConversationAiEnabled}
            aiAgents={state.aiAgents}
            loadingAgents={state.loadingAgents}
            handleSetConversationAgent={state.handleSetConversationAgent}
            isTabletLayout={state.isTabletLayout}
            setShowLeadPanel={state.setShowLeadPanel}
            onBack={() => {
              state.setMobileScreen("conversations");
              state.setSelectedConversationId(null);
            }}
            handleClearSelectedConversation={state.handleClearSelectedConversation}
            archivedChatIds={state.archivedChatIds}
            handleArchiveSelectedConversation={state.handleArchiveSelectedConversation}
            handleUnarchiveSelectedConversation={state.handleUnarchiveSelectedConversation}
            handleBlockContact={state.handleBlockContact}
            handleUnblockContact={state.handleUnblockContact}
            setRightPanelTab={state.setRightPanelTab}
            setRightPanelCollapsed={state.setRightPanelCollapsed}
            messagesLoadFailed={state.messagesLoadFailed}
            loadingMessages={state.loadingMessages}
            handleRetryMessages={state.handleRetryMessages}
            unseenRealtimeCount={state.unseenRealtimeCount}
            scrollToLatestMessage={state.scrollToLatestMessage}
            keyboardOffset={state.keyboardOffset}
            isMobile={state.isMobile}
            messageReactions={state.messageReactions}
            handleReactMessage={state.handleReactMessage}
            setPreviewMedia={state.setPreviewMedia}
            setPreviewZoom={state.setPreviewZoom}
            activeMessageMenuId={state.activeMessageMenuId}
            setActiveMessageMenuId={state.setActiveMessageMenuId}
            activeReactionPickerMessageId={state.activeReactionPickerMessageId}
            setActiveReactionPickerMessageId={state.setActiveReactionPickerMessageId}
            handleCopyMessage={state.handleCopyMessage}
            handleReplyMessage={state.handleReplyMessage}
            handleForwardMessage={state.handleForwardMessage}
            handleDeleteMessage={state.handleDeleteMessage}
            handleDownloadMedia={state.handleDownloadMedia}
            handleToggleAudioPlayback={state.handleToggleAudioPlayback}
            loadingAudioMessageId={state.loadingAudioMessageId}
            playingAudioMessageId={state.playingAudioMessageId}
            audioProgress={state.audioProgress}
            audioDuration={state.audioDuration}
            quickReplies={state.quickReplies}
            applyPendingBackgroundUpdates={state.applyPendingBackgroundUpdates}
            pendingBackgroundUpdates={state.pendingBackgroundUpdates}
            error={state.error}
          />
        }
        rightPanel={!state.isTabletLayout ? <SidebarPanel {...sidebarProps} /> : null}
        tabletLeadSheet={
          state.isTabletLayout ? (
            <Sheet open={state.showLeadPanel} onOpenChange={state.setShowLeadPanel}>
              <SheetContent side="right" className="w-full p-4 sm:max-w-md bg-[#0C0F14]/95 text-foreground border-border/80">
                <SheetHeader>
                  <SheetTitle className="text-foreground">Painel do Lead</SheetTitle>
                </SheetHeader>
                <div className="mt-4 overflow-y-auto pr-1 h-[calc(100vh-80px)]">{leadPanelContent}</div>
              </SheetContent>
            </Sheet>
          ) : undefined
        }
        previewDialog={
          <>
            <Dialog open={Boolean(state.previewMedia)} onOpenChange={(open) => !open && state.setPreviewMedia(null)}>
              <DialogContent className="h-screen w-screen max-w-none border-none bg-black/95 p-0 shadow-none">
                <DialogTitle className="sr-only">Visualização de Mídia</DialogTitle>
                <div className="flex h-full w-full flex-col" onClick={() => state.setPreviewMedia(null)}>
                  <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3 text-white" onClick={(event) => event.stopPropagation()}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{state.previewMedia?.fileName || "Mídia"}</p>
                      <p className="text-xs text-white/60">{getMediaTypeLabel(state.previewMedia?.type)}</p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {(state.previewMedia?.type === "image" || state.previewMedia?.type === "sticker") && (
                        <>
                          <Button type="button" size="sm" variant="outline" className="h-8 border-white/20 bg-white/5 text-white hover:bg-white/10" onClick={() => state.setPreviewZoom((current) => Math.max(0.5, Number((current - 0.25).toFixed(2))))}>
                            -
                          </Button>
                          <Button type="button" size="sm" variant="outline" className="h-8 border-white/20 bg-white/5 text-white hover:bg-white/10" onClick={() => state.setPreviewZoom((current) => Math.min(3, Number((current + 0.25).toFixed(2))))}>
                            +
                          </Button>
                        </>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 border-white/20 bg-white/5 text-white hover:bg-white/10"
                        onClick={() => state.previewMedia && void downloadMediaFile(state.previewMedia.url, state.previewMedia.fileName || "arquivo")}
                      >
                        Download
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 border-white/20 bg-white/5 text-white hover:bg-white/10"
                        onClick={() => {
                          if (!state.previewMedia?.messageId) return;
                          const message = state.messages.find((entry) => entry.id === state.previewMedia?.messageId);
                          if (message) state.handleForwardMessage(message);
                        }}
                      >
                        Encaminhar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 border-white/20 bg-white/5 text-white hover:bg-white/10"
                        onClick={() => state.previewMedia && window.open(state.previewMedia.url, "_blank", "noopener,noreferrer")}
                      >
                        Abrir
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                        onClick={() => state.previewMedia?.messageId && void state.handleDeleteMessage(state.previewMedia.messageId)}
                      >
                        Excluir
                      </Button>
                    </div>
                  </div>
                  <div className="relative flex flex-1 items-center justify-center p-6" onClick={() => state.setPreviewMedia(null)}>
                    {currentImageIndex > 0 && (
                      <button
                        type="button"
                        className="absolute left-6 top-1/2 -translate-y-1/2 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white transition-all border border-white/20 backdrop-blur-sm shadow-lg hover:scale-105"
                        onClick={(e) => {
                          e.stopPropagation();
                          showPreviousImage(e);
                        }}
                      >
                        <CaretLeft size={32} weight="bold" />
                      </button>
                    )}

                    {state.previewMedia?.type === "image" && (
                      <img
                        src={state.previewMedia.url}
                        alt="Preview da imagem"
                        className="max-h-[85vh] max-w-[95vw] rounded-lg border border-border object-contain transition-transform"
                        style={{ transform: `scale(${state.previewZoom})` }}
                        onClick={(event) => event.stopPropagation()}
                      />
                    )}
                    {state.previewMedia?.type === "sticker" && (
                      <img
                        src={state.previewMedia.url}
                        alt="Preview do sticker"
                        className="max-h-[75vh] max-w-[60vw] rounded-lg border border-border bg-white/95 p-4 object-contain transition-transform"
                        style={{ transform: `scale(${state.previewZoom})` }}
                        onClick={(event) => event.stopPropagation()}
                      />
                    )}
                    {state.previewMedia?.type === "video" && (
                      <video
                        src={state.previewMedia.url}
                        controls
                        autoPlay
                        className="max-h-[85vh] max-w-[95vw] rounded-lg border border-border object-contain"
                        onClick={(event) => event.stopPropagation()}
                      />
                    )}
                    {state.previewMedia?.type === "audio" && (
                      <div className="w-full max-w-xl rounded-xl border border-white/10 bg-white/5 p-6" onClick={(event) => event.stopPropagation()}>
                        <p className="mb-4 text-sm font-semibold text-white">{state.previewMedia.fileName || "Áudio"}</p>
                        <audio controls autoPlay src={state.previewMedia.url} className="w-full" />
                      </div>
                    )}
                    {state.previewMedia?.type === "file" && (
                      <div className="w-full max-w-xl rounded-xl border border-white/10 bg-white/5 p-6 text-white" onClick={(event) => event.stopPropagation()}>
                        <p className="mb-2 text-sm font-semibold">{state.previewMedia.fileName || "Documento"}</p>
                        <p className="mb-4 text-xs text-white/60">Use abrir ou download para visualizar o documento completo.</p>
                        <Button type="button" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10" onClick={() => window.open(state.previewMedia.url, "_blank", "noopener,noreferrer")}>
                          Abrir documento
                        </Button>
                      </div>
                    )}

                    {currentImageIndex < imageMessages.length - 1 && currentImageIndex !== -1 && (
                      <button
                        type="button"
                        className="absolute right-6 top-1/2 -translate-y-1/2 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white transition-all border border-white/20 backdrop-blur-sm shadow-lg hover:scale-105"
                        onClick={(e) => {
                          e.stopPropagation();
                          showNextImage(e);
                        }}
                      >
                        <CaretRight size={32} weight="bold" />
                      </button>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={state.isQuickReplyDialogOpen} onOpenChange={state.setIsQuickReplyDialogOpen}>
              <DialogContent className="sm:max-w-2xl border-border/80 bg-card/95 backdrop-blur-xl max-h-[85vh] overflow-y-auto text-foreground">
                <DialogHeader>
                  <DialogTitle className="font-display text-base text-foreground">
                    {state.qrDialogId ? "Editar Resposta Rápida" : "Nova Resposta Rápida"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2 text-xs">
                  <div className="space-y-1.5">
                    <Label htmlFor="qr-title" className="text-xs text-foreground">Título</Label>
                    <Input
                      id="qr-title"
                      placeholder="Ex: Saudação Inicial"
                      value={state.qrDialogTitle}
                      onChange={(e) => state.setQrDialogTitle(e.target.value)}
                      className="h-8 text-xs bg-background/50 text-foreground"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="qr-category" className="text-xs text-foreground">Categoria</Label>
                      <select
                        id="qr-category"
                        value={state.qrDialogCategory}
                        onChange={(e) => state.setQrDialogCategory(e.target.value)}
                        className="flex h-8 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-xs ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
                      >
                        <option value="saudação">Saudação</option>
                        <option value="vendas">Vendas</option>
                        <option value="suporte">Suporte</option>
                      </select>
                    </div>

                    <div className="flex items-center space-x-2 pt-6">
                      <input
                        type="checkbox"
                        id="qr-favorite"
                        checked={state.qrDialogFavorite}
                        onChange={(e) => state.setQrDialogFavorite(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary bg-background"
                      />
                      <Label htmlFor="qr-favorite" className="text-xs cursor-pointer select-none text-foreground">Favorita (Fixar no topo)</Label>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 pt-2 pb-2 border-b border-border/30">
                    <input
                      type="checkbox"
                      id="qr-is-flow"
                      checked={state.qrDialogIsFlow}
                      onChange={(e) => state.setQrDialogIsFlow(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary bg-background"
                    />
                    <Label htmlFor="qr-is-flow" className="text-xs font-semibold cursor-pointer select-none text-foreground">
                      Transformar em Fluxo Sequencial (com delay e ações automáticas)
                    </Label>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-foreground">
                        {state.qrDialogIsFlow ? "Passos do Fluxo Sequencial" : "Sequência de Mensagens / Mídias"}
                      </Label>
                      <div className="flex gap-1.5">
                        <Button type="button" size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={state.addQrDialogTextItem}>
                          <Plus className="h-3 w-3" /> Texto
                        </Button>
                        <Label htmlFor="qr-file-upload" className="flex h-7 items-center justify-center rounded-md border border-input bg-background/50 px-2.5 text-[10px] font-medium hover:bg-accent hover:text-accent-foreground cursor-pointer gap-1 text-foreground border-border/75">
                          <Paperclip className="h-3 w-3" /> Mídia
                        </Label>
                        <input
                          id="qr-file-upload"
                          type="file"
                          multiple
                          className="hidden"
                          onChange={(e) => void state.handleQrDialogMediaUpload(e)}
                        />
                      </div>
                    </div>
 
                    <div className="space-y-2 max-h-[360px] overflow-y-auto border border-border/40 rounded-lg p-2.5 bg-muted/10">
                      {state.qrDialogItems.length === 0 ? (
                        <p className="text-center text-[10px] text-muted-foreground py-4">Nenhum item adicionado à sequência.</p>
                      ) : (
                        state.qrDialogItems.map((item, idx) => (
                          <div key={item.id || idx} className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-background/50 p-2.5 group/item transition-all hover:border-border/80">
                            <div className="flex flex-col gap-0.5 pt-1">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => state.moveQrDialogItem(idx, "up")}
                                className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                disabled={idx === state.qrDialogItems.length - 1}
                                onClick={() => state.moveQrDialogItem(idx, "down")}
                                className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30"
                              >
                                ▼
                              </button>
                            </div>
 
                            <div className="flex-grow min-w-0 space-y-3">
                              {item.type === "text" ? (
                                <textarea
                                  placeholder="Digite o texto da mensagem..."
                                  value={item.value}
                                  onChange={(e) => {
                                    const next = [...state.qrDialogItems];
                                    next[idx].value = e.target.value;
                                    state.setQrDialogItems(next);
                                  }}
                                  className="w-full min-h-[60px] bg-background/30 rounded border border-border/30 p-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring focus:border-input"
                                />
                              ) : (
                                <div className="space-y-2">
                                  {item.type === "image" ? (
                                    <div className="flex flex-col gap-2">
                                      <div className="flex items-center gap-2">
                                        <img
                                          src={item.value}
                                          alt={item.filename || "Preview"}
                                          className="h-14 w-14 rounded object-cover border border-border/40 cursor-pointer hover:opacity-85 transition-opacity"
                                          onClick={() => {
                                            if (typeof window !== "undefined") {
                                              window.open(item.value, "_blank");
                                            }
                                          }}
                                          title="Clique para ver imagem cheia"
                                        />
                                        <div className="min-w-0 flex-grow">
                                          <p className="truncate font-semibold text-[10.5px] text-foreground">{item.filename || "Imagem"}</p>
                                          <p className="text-[9px] text-muted-foreground capitalize">Imagem</p>
                                        </div>
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-[9px] text-muted-foreground">Legenda (caption)</Label>
                                        <Input
                                          placeholder="Adicione uma legenda..."
                                          value={item.caption || ""}
                                          onChange={(e) => {
                                            const next = [...state.qrDialogItems];
                                            next[idx].caption = e.target.value;
                                            state.setQrDialogItems(next);
                                          }}
                                          className="h-7 text-xs bg-background/50"
                                        />
                                      </div>
                                    </div>
                                  ) : item.type === "video" ? (
                                    <div className="flex flex-col gap-2">
                                      <div className="flex items-center gap-2">
                                        <video
                                          src={item.value}
                                          className="h-14 w-14 rounded object-cover border border-border/40 cursor-pointer"
                                          onClick={() => {
                                            if (typeof window !== "undefined") {
                                              window.open(item.value, "_blank");
                                            }
                                          }}
                                        />
                                        <div className="min-w-0 flex-grow">
                                          <p className="truncate font-semibold text-[10.5px] text-foreground">{item.filename || "Vídeo"}</p>
                                          <p className="text-[9px] text-muted-foreground capitalize">Vídeo</p>
                                        </div>
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-[9px] text-muted-foreground">Legenda (caption)</Label>
                                        <Input
                                          placeholder="Adicione uma legenda..."
                                          value={item.caption || ""}
                                          onChange={(e) => {
                                            const next = [...state.qrDialogItems];
                                            next[idx].caption = e.target.value;
                                            state.setQrDialogItems(next);
                                          }}
                                          className="h-7 text-xs bg-background/50"
                                        />
                                      </div>
                                    </div>
                                  ) : item.type === "audio" ? (
                                    <div className="space-y-1.5">
                                      <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">🎵</div>
                                        <div className="min-w-0 flex-grow">
                                          <p className="truncate font-semibold text-[10.5px] text-foreground">{item.filename || "Áudio"}</p>
                                          <p className="text-[9px] text-muted-foreground capitalize">Áudio</p>
                                        </div>
                                      </div>
                                      <audio controls src={item.value} className="w-full h-8" />
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">📄</div>
                                      <div className="min-w-0 flex-grow">
                                        <p className="truncate font-semibold text-[10.5px] text-foreground">{item.filename || "Documento"}</p>
                                        <p className="text-[9px] text-muted-foreground capitalize">{item.type || "Arquivo"}</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
 
                              {/* Delays section visible on all items */}
                              <div className="pt-2 border-t border-border/20 grid grid-cols-2 gap-3">
                                <div className="flex items-center gap-1.5">
                                  <Label className="text-[10px] text-muted-foreground whitespace-nowrap">Espera (delay):</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={Math.round((item.delayMs || 0) / 1000)}
                                    onChange={(e) => {
                                      const next = [...state.qrDialogItems];
                                      next[idx].delayMs = (Number(e.target.value) || 0) * 1000;
                                      state.setQrDialogItems(next);
                                    }}
                                    className="h-6 w-14 text-[10px] bg-background/50 px-1 text-center"
                                  />
                                  <span className="text-[10px] text-muted-foreground">s</span>
                                </div>
 
                                <div className="flex items-center gap-1.5">
                                  <Label className="text-[10px] text-muted-foreground whitespace-nowrap">Digitando (typing):</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={Math.round((item.typingMs ?? 1500) / 1000)}
                                    onChange={(e) => {
                                      const next = [...state.qrDialogItems];
                                      next[idx].typingMs = (Number(e.target.value) || 0) * 1000;
                                      state.setQrDialogItems(next);
                                    }}
                                    className="h-6 w-14 text-[10px] bg-background/50 px-1 text-center"
                                  />
                                  <span className="text-[10px] text-muted-foreground">s</span>
                                </div>
                              </div>
 
                              {state.qrDialogIsFlow && (
                                <div className="mt-2 bg-muted/20 p-2 rounded border border-border/40 space-y-1.5">
                                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Ações pós-envio deste passo:</p>
                                  <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-foreground select-none">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(item.actions?.archiveContact)}
                                        onChange={(e) => {
                                          const next = [...state.qrDialogItems];
                                          next[idx].actions = {
                                            ...(next[idx].actions || {}),
                                            archiveContact: e.target.checked,
                                          };
                                          state.setQrDialogItems(next);
                                        }}
                                        className="h-3 w-3 rounded bg-background"
                                      />
                                      <span>Arquivar conversa</span>
                                    </label>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[9px] text-muted-foreground">Adicionar etiquetas (separadas por vírgula):</Label>
                                    <Input
                                      placeholder="Ex: lead_quente, sem_resposta"
                                      value={(item.actions?.addTags || []).join(", ")}
                                      onChange={(e) => {
                                        const tagsArray = e.target.value
                                          .split(",")
                                          .map((t) => t.trim())
                                          .filter(Boolean);
                                        const next = [...state.qrDialogItems];
                                        next[idx].actions = {
                                          ...(next[idx].actions || {}),
                                          addTags: tagsArray,
                                        };
                                        state.setQrDialogItems(next);
                                      }}
                                      className="h-6 text-[10px] bg-background/50"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
 
                            <div className="flex flex-col gap-1 shrink-0 self-center">
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted"
                                onClick={() => {
                                  const next = [...state.qrDialogItems];
                                  const duplicated = {
                                    ...item,
                                    id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                                    actions: item.actions ? { ...item.actions } : undefined,
                                  };
                                  next.splice(idx + 1, 0, duplicated);
                                  state.setQrDialogItems(next);
                                }}
                                title="Duplicar item"
                              >
                                <CopySimple className="h-3.5 w-3.5" />
                              </Button>
 
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-destructive hover:bg-destructive/10"
                                onClick={() => state.removeQrDialogItem(idx)}
                              >
                                <Trash className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
 
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => state.setIsQuickReplyDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="button" size="sm" onClick={() => void state.saveQuickReplyDialog()}>
                      Salvar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* New Conversation Dialog */}
            <Dialog open={isNewChatDialogOpen} onOpenChange={setIsNewChatDialogOpen}>
              <DialogContent className="sm:max-w-md border-border/80 bg-card/95 backdrop-blur-xl text-foreground">
                <DialogHeader>
                  <DialogTitle className="font-display text-base text-foreground">Nova Conversa</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateNewChat} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="newChatPhone" className="text-xs">Número de WhatsApp</Label>
                    <Input
                      id="newChatPhone"
                      placeholder="Ex: 5531999999999"
                      value={newChatPhone}
                      onChange={(e) => setNewChatPhone(e.target.value)}
                      required
                      className="bg-muted/40"
                    />
                    <p className="text-[10px] text-muted-foreground">Insira o código do país + DDD + número (apenas dígitos).</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="newChatName" className="text-xs">Nome do Contato (Opcional)</Label>
                    <Input
                      id="newChatName"
                      placeholder="Ex: João Silva"
                      value={newChatName}
                      onChange={(e) => setNewChatName(e.target.value)}
                      className="bg-muted/40"
                    />
                  </div>
                  {state.sessions && state.sessions.length > 0 && (
                    <div className="space-y-1.5">
                      <Label htmlFor="newChatSession" className="text-xs">Sessão do WhatsApp</Label>
                      <Select value={newChatSessionId} onValueChange={setNewChatSessionId}>
                        <SelectTrigger className="bg-muted/40">
                          <SelectValue placeholder="Selecione uma sessão" />
                        </SelectTrigger>
                        <SelectContent className="border-border/80 bg-popover/90 backdrop-blur-xl">
                          {state.sessions.map((session) => (
                            <SelectItem key={session.id} value={session.id}>
                              {session.name || session.id} ({session.status === 'connected' ? 'Conectado' : 'Desconectado'})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setIsNewChatDialogOpen(false)} disabled={newChatLoading}>
                      Cancelar
                    </Button>
                    <Button type="submit" size="sm" disabled={newChatLoading}>
                      {newChatLoading ? "Iniciando..." : "Iniciar"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </>
        }
      />
    </div>
  );
}
