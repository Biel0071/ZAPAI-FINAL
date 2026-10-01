import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Brain,
  Trash,
  CaretLeft,
  CaretRight,
  Check,
  DotsThreeVertical,
  PaperPlaneTilt,
  MagnifyingGlass,
  ArrowUp,
  ArrowDown,
  X,
  Smiley,
  Paperclip,
  Microphone,
  ChatCircleDots,
  Robot,
  WifiHigh,
  File as FileIcon,
  Warning,
  Info,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useTheme } from "next-themes";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ChatHeaderBar } from "@/components/inbox/ChatHeaderBar";
import { useResolvedAvatar } from "@/hooks/useResolvedAvatar";
import { NewMessagesBanner } from "@/components/inbox/NewMessagesBanner";
import { MessageRow } from "./MessageRow";
import { QuickResponseModal, type QuickResponseItem } from "./QuickResponseModal";
import { FlowExecutionBanner, matchesConversationFlow, type FlowExecutionData } from "./FlowExecutionBanner";
import { ZaiAssistantComposer } from "./ZaiAssistantComposer";
import { useAiCountdown } from "@/state/hooks/useAiCountdown";
import { getSharedSocket } from "@/core/runtime/socket/socketManager";
import { cn } from "@/core/lib/utils";
import { apiService } from "@/core/services/apiService";
import type { ChatMessage, Conversation } from "@/core/services/apiService";
import type { AIResponseProgress } from "@/state/stores/appStore";
import type { ComposerAttachment, PreviewMediaState, QuickReplyItem } from "../types";
import {
  toConversationDateLabel,
  formatPlaybackTime,
  extractMessageAssetUrl,
  getMediaFileName,
  getMediaTypeLabel,
  getQuickReplyPreviewText,
  formatPhoneNumber,
} from "../utils";

interface ActiveChatPaneProps {
  selectedConversation: Conversation | null;
  messages: ChatMessage[];
  messageInput: string;
  setMessageInput: React.Dispatch<React.SetStateAction<string>>;
  sending: boolean;
  isRealtimeConnected: boolean;
  isWhatsappConnected: boolean;
  backendOnline: boolean;
  isTyping: boolean | "composing" | "recording";
  suggestingResponse: boolean;
  aiProgress?: AIResponseProgress | null;
  replyingTo: ChatMessage | null;
  setReplyingTo: (val: ChatMessage | null) => void;
  attachments: ComposerAttachment[];
  removeAttachment: (id: string) => void;
  updateAttachmentCaption?: (id: string, caption: string) => void;
  handleAttachFiles: (e: any) => void;
  isRecording: boolean;
  recordingTime: number;
  handleCancelRecording: () => void;
  handleToggleRecording: () => void;
  showEmojiPicker: boolean;
  setShowEmojiPicker: (val: boolean | ((prev: boolean) => boolean)) => void;
  EmojiPickerComponent: any;
  emojiPickerData: any;
  handleInsertEmoji: (emoji: any) => void;
  handleSendMessage: (text?: string) => Promise<void>;
  isDraggingFiles: boolean;
  setIsDraggingFiles: (val: boolean) => void;
  messagesScrollRef: React.RefObject<HTMLDivElement | null>;
  loadMoreTriggerRef: React.RefObject<HTMLDivElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  messageInputRef: React.RefObject<HTMLTextAreaElement | null>;
  conversationSearchInputRef: React.RefObject<HTMLInputElement | null>;
  conversationSearchOpen: boolean;
  setConversationSearchOpen: (val: boolean) => void;
  conversationSearchQuery: string;
  setConversationSearchQuery: (val: string) => void;
  activeConversationSearchIndex: number;
  setActiveConversationSearchIndex: (val: number | ((prev: number) => number)) => void;
  inboxRuntimeState: "ONLINE" | "DEGRADED" | "WHATSAPP_OFFLINE" | "OFFLINE";
  canUseBackend: boolean;
  canSendMessages: boolean;
  aiEnabledForConversation: boolean;
  conversationAiOverrideEnabled: boolean;
  handleSetConversationAiEnabled: (val: boolean, reactivateAt?: string | null) => Promise<void>;
  isTabletLayout: boolean;
  showLeadPanel?: boolean;
  setShowLeadPanel: (val: boolean) => void;
  onBack?: () => void;
  handleClearSelectedConversation: () => void;
  archivedChatIds: string[];
  handleArchiveSelectedConversation: () => void;
  handleUnarchiveSelectedConversation: () => void;
  handleBlockContact: () => void;
  handleUnblockContact: () => void;
  setRightPanelTab: (val: "ai" | "lead" | "files" | "qr" | "history" | null) => void;
  setRightPanelCollapsed: (val: boolean | ((prev: boolean) => boolean)) => void;
  messagesLoadFailed: boolean;
  loadingMessages: boolean;
  handleRetryMessages: () => Promise<void>;
  unseenRealtimeCount: number;
  scrollToLatestMessage: (behavior?: ScrollBehavior) => void;
  keyboardOffset: number;
  isMobile: boolean;
  messageReactions: Record<string, string>;
  handleReactMessage: (messageId: string, emoji: string) => void;
  setPreviewMedia: (media: PreviewMediaState | null) => void;
  setPreviewZoom: (zoom: number | ((prev: number) => number)) => void;
  activeMessageMenuId: string | null;
  setActiveMessageMenuId: (val: string | null) => void;
  activeReactionPickerMessageId: string | null;
  setActiveReactionPickerMessageId: (val: string | null) => void;
  handleCopyMessage: (message: ChatMessage) => void;
  handleReplyMessage: (message: ChatMessage) => void;
  handleForwardMessage: (message: ChatMessage) => void;
  handleDeleteMessage: (messageId: string, scope?: "local" | "everyone") => Promise<void>;
  handleDownloadMedia: (message: ChatMessage) => void;
  handleToggleAudioPlayback: (messageId: string, url: string) => void;
  loadingAudioMessageId: string | null;
  playingAudioMessageId: string | null;
  audioProgress: number;
  audioDuration: number;
  quickReplies: QuickReplyItem[];
  sendQuickReply: (item: QuickReplyItem, delayMs?: number) => Promise<void>;
  applyPendingBackgroundUpdates: () => Promise<void>;
  pendingBackgroundUpdates: number;
  error: string | null;
  aiAgents?: any[];
  loadingAgents?: boolean;
  handleSetConversationAgent?: (agentName: string) => Promise<void>;
  aiRuntime?: any;
}

const MOBILE_TOUCH_TARGET_CLASS = "h-10 w-10 min-h-10 min-w-10 rounded-full flex items-center justify-center shrink-0";

export function ActiveChatPane({
  selectedConversation,
  messages,
  messageInput,
  setMessageInput,
  sending,
  isRealtimeConnected,
  isWhatsappConnected,
  backendOnline,
  isTyping,
  suggestingResponse,
  aiProgress,
  replyingTo,
  setReplyingTo,
  attachments,
  removeAttachment,
  updateAttachmentCaption,
  handleAttachFiles,
  isRecording,
  recordingTime,
  handleCancelRecording,
  handleToggleRecording,
  showEmojiPicker,
  setShowEmojiPicker,
  EmojiPickerComponent,
  emojiPickerData,
  handleInsertEmoji,
  handleSendMessage,
  isDraggingFiles,
  setIsDraggingFiles,
  messagesScrollRef,
  loadMoreTriggerRef,
  fileInputRef,
  messageInputRef,
  conversationSearchInputRef,
  conversationSearchOpen,
  setConversationSearchOpen,
  conversationSearchQuery,
  setConversationSearchQuery,
  activeConversationSearchIndex,
  setActiveConversationSearchIndex,
  inboxRuntimeState,
  canUseBackend,
  canSendMessages,
  aiEnabledForConversation,
  conversationAiOverrideEnabled,
  handleSetConversationAiEnabled,
  isTabletLayout,
  showLeadPanel = false,
  setShowLeadPanel,
  onBack,
  handleClearSelectedConversation,
  archivedChatIds,
  handleArchiveSelectedConversation,
  handleUnarchiveSelectedConversation,
  handleBlockContact,
  handleUnblockContact,
  setRightPanelTab,
  setRightPanelCollapsed,
  messagesLoadFailed,
  loadingMessages,
  handleRetryMessages,
  unseenRealtimeCount,
  scrollToLatestMessage,
  keyboardOffset,
  isMobile,
  messageReactions,
  handleReactMessage,
  setPreviewMedia,
  setPreviewZoom,
  activeMessageMenuId,
  setActiveMessageMenuId,
  activeReactionPickerMessageId,
  setActiveReactionPickerMessageId,
  handleCopyMessage,
  handleReplyMessage,
  handleForwardMessage,
  handleDeleteMessage,
  handleDownloadMedia,
  handleToggleAudioPlayback,
  loadingAudioMessageId,
  playingAudioMessageId,
  audioProgress,
  audioDuration,
  quickReplies,
  sendQuickReply,
  applyPendingBackgroundUpdates,
  pendingBackgroundUpdates,
  error,
  aiAgents = [],
  loadingAgents = false,
  handleSetConversationAgent,
  aiRuntime,
}: ActiveChatPaneProps) {
  const navigate = useNavigate();

  const [selectedQuickReplyModal, setSelectedQuickReplyModal] = useState<QuickResponseItem | null>(null);
  const [isQuickReplyModalOpen, setIsQuickReplyModalOpen] = useState(false);
  const [activeFlowData, setActiveFlowData] = useState<FlowExecutionData | null>(null);
  const quickReplyDispatchRef = useRef(false);
  const { resolvedTheme } = useTheme();

  const { avatar: activeChatAvatar } = useResolvedAvatar(
    selectedConversation?.id,
    selectedConversation?.avatar || (selectedConversation as any)?.profilePictureUrl,
  );

  useEffect(() => {
    setSelectedQuickReplyModal(null);
    setIsQuickReplyModalOpen(false);
  }, [selectedConversation?.id]);

  useEffect(() => {
    let active = true;
    const phone = selectedConversation?.phone;
    setActiveFlowData(null);
    if (!phone || !selectedConversation?.id) return () => { active = false; };
    const context = { conversationId: selectedConversation.id, sessionId: selectedConversation.sessionId };
    const matches = (data: Partial<FlowExecutionData> | null | undefined) => matchesConversationFlow(data, context);
    apiService.getActiveQuickReplyFlow(phone, context).then((res) => {
      if (active) setActiveFlowData(matches(res?.flow) ? res.flow : null);
    }).catch((error) => console.warn("[FLOW_TIMELINE] active flow load failed", error));
    const socket = getSharedSocket();
    if (!socket) return () => { active = false; };
    const started = (data: FlowExecutionData) => { if (matches(data)) { console.info("[FLOW_TIMELINE] started", data); setActiveFlowData(data); } };
    const updated = (data: FlowExecutionData) => { if (matches(data)) { console.info("[FLOW_TIMELINE] updated", data); setActiveFlowData((prev) => ({ ...(prev || {}), ...data })); } };
    const ended = (data: any) => { if (matches(data)) { console.info("[FLOW_TIMELINE] completed", data); setActiveFlowData(null); } };
    socket.on("flow:started", started); socket.on("flow:step_updated", updated); socket.on("flow:cancelled", ended); socket.on("flow:finished", ended);
    return () => { active = false; socket.off("flow:started", started); socket.off("flow:step_updated", updated); socket.off("flow:cancelled", ended); socket.off("flow:finished", ended); };
  }, [selectedConversation?.id, selectedConversation?.phone, selectedConversation?.sessionId]);

  const targetReactivateAt = selectedConversation?.ai_reactivate_at || selectedConversation?.aiReactivateAt || selectedConversation?.aiPausedUntil;
  const { timeLeft, isWaiting: isAiCountdownActive } = useAiCountdown(targetReactivateAt);



  const handleDispatchQuickReply = async (item: QuickResponseItem, customDelayMs: number) => {
    if (!selectedConversation?.phone || !isWhatsappConnected) throw new Error("Conecte o WhatsApp antes de enviar.");
    if (quickReplyDispatchRef.current) throw new Error("Aguarde o envio atual.");
    quickReplyDispatchRef.current = true;
    try {
      await sendQuickReply(item, customDelayMs);
    } finally {
      quickReplyDispatchRef.current = false;
    }
  };
  const [activeSlashIndex, setActiveSlashIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'emoji' | 'sticker'>('emoji');
  const [stickers, setStickers] = useState<{ id: string; url: string; name: string }[]>([]);
  const [loadingStickers, setLoadingStickers] = useState(false);
  const [aiRemainingSeconds, setAiRemainingSeconds] = useState(0);
  const [dismissedBanners, setDismissedBanners] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setDismissedBanners({});
  }, [selectedConversation?.id]);

  const aiProgressActive = Boolean(aiProgress && ["analyzing", "generating", "queued", "waiting", "typing", "sending"].includes(aiProgress.status));

  useEffect(() => {
    if (!aiProgressActive || !aiProgress?.estimatedCompletionAt) {
      setAiRemainingSeconds(0);
      return;
    }

    const updateRemaining = () => {
      const remainingMs = Math.max(0, new Date(aiProgress.estimatedCompletionAt as string).getTime() - Date.now());
      setAiRemainingSeconds(Math.ceil(remainingMs / 1000));
    };
    updateRemaining();
    const timer = window.setInterval(updateRemaining, 250);
    return () => window.clearInterval(timer);
  }, [aiProgress?.estimatedCompletionAt, aiProgressActive]);

  const loadStickers = useCallback(async () => {
    setLoadingStickers(true);
    try {
      const list = await apiService.getStickers();
      setStickers(list);
    } catch (err) {
      console.error("Failed to load stickers:", err);
    } finally {
      setLoadingStickers(false);
    }
  }, []);

  const handleSendSticker = async (stickerUrl: string) => {
    if (!selectedConversation) return;
    if (quickReplyDispatchRef.current) return;
    quickReplyDispatchRef.current = true;
    try {
      const fileName = stickerUrl.split('/').pop() || 'sticker.webp';
      const response = await fetch(stickerUrl);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = (reader.result as string).split(',')[1];
        try {
          const res = await apiService.sendMediaMessage({
            phone: selectedConversation.phone,
            fileName,
            mimeType: 'image/webp',
            mediaType: 'sticker',
            dataBase64: base64data,
            conversationId: selectedConversation.id,
            contactId: selectedConversation.contactId,
            sessionId: selectedConversation.sessionId || undefined,
            requestId: `inbox-sticker-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          });
          if (res.success) {
            setShowEmojiPicker(false);
          }
        } catch (err) {
          console.error('Failed to send sticker media message:', err);
        } finally {
          quickReplyDispatchRef.current = false;
        }
      };
    } catch (err) {
      console.error('Failed to process sticker for sending:', err);
      quickReplyDispatchRef.current = false;
    }
  };

  const handleOpenMediaPreview = useCallback(
    (media: PreviewMediaState) => {
      setPreviewZoom(1);
      setPreviewMedia(media);
    },
    [setPreviewMedia, setPreviewZoom],
  );

  const handleToggleMessageMenu = useCallback(
    (messageId: string) => {
      setActiveMessageMenuId(activeMessageMenuId === messageId ? null : messageId);
    },
    [activeMessageMenuId, setActiveMessageMenuId],
  );

  const handleToggleReactionPicker = useCallback(
    (messageId: string) => {
      setActiveReactionPickerMessageId(
        activeReactionPickerMessageId === messageId ? null : messageId,
      );
    },
    [activeReactionPickerMessageId, setActiveReactionPickerMessageId],
  );

  const messageGroups = useMemo(() => {
    const groups = new Map<string, ChatMessage[]>();
    messages.forEach((message) => {
      const key = toConversationDateLabel(message.createdAt);
      const previous = groups.get(key) ?? [];
      groups.set(key, [...previous, message]);
    });

    return [...groups.entries()].map(([label, entries]) => ({ label, entries }));
  }, [messages]);

  const conversationSearchMatches = useMemo(() => {
    const query = conversationSearchQuery.trim().toLowerCase();
    if (!query) return [];
    return messages.filter((message) => {
      const searchableText = [
        message.content,
        message.caption,
        extractMessageAssetUrl(message) ? getMediaFileName(message) : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchableText.includes(query);
    });
  }, [conversationSearchQuery, messages]);

  const activeConversationSearchMessageId =
    conversationSearchMatches[activeConversationSearchIndex]?.id ?? null;

  const navigateConversationSearch = useCallback(
    (direction: 1 | -1) => {
      setActiveConversationSearchIndex((current) => {
        const total = conversationSearchMatches.length;
        if (total === 0) return 0;
        return (current + direction + total) % total;
      });
    },
    [conversationSearchMatches.length, setActiveConversationSearchIndex],
  );

  useEffect(() => {
    setActiveConversationSearchIndex(0);
  }, [conversationSearchQuery, selectedConversation?.id, setActiveConversationSearchIndex]);

  useEffect(() => {
    if (!activeConversationSearchMessageId) return;
    const escapedId =
      typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(activeConversationSearchMessageId)
        : activeConversationSearchMessageId.replace(/["\\]/g, "\\$&");
    const target = document.querySelector<HTMLElement>(`[data-message-id="${escapedId}"]`);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeConversationSearchMessageId]);

  const slashSuggestions = useMemo(() => {
    if (!messageInput.startsWith("/")) return [] as { cmd: string; desc: string; text: string }[];
    const needle = messageInput.slice(1).toLowerCase();

    // Add default slash commands
    const defaultCmds = [
      {
        cmd: "/catalogo",
        desc: "Link do catálogo oficial",
        text: "Aqui está o link para o nosso catálogo digital: https://zapflow.ai/catalogo",
      },
      {
        cmd: "/desconto",
        desc: "Cupom de 15% de desconto",
        text: "Consegui um desconto de 15% para você fechar hoje! Use o cupom ZAPVIP15.",
      },
      {
        cmd: "/agendar",
        desc: "Link para agendamento de demo",
        text: "Claro! Vamos agendar uma demonstração de 15 minutos? Escolha o melhor dia/horário aqui: calendly.com/zapflow",
      },
      { cmd: "/saudar", desc: "Saudação amigável padrão", text: "Olá! Como posso te ajudar hoje?" },
      {
        cmd: "/preço",
        desc: "Valores das assinaturas",
        text: "Temos planos de assinatura a partir de R$ 97/mês. Gostaria de ver nossa tabela detalhada?",
      },
      {
        cmd: "/ajuda",
        desc: "Link da base de conhecimento",
        text: "Se precisar de ajuda com a configuração, acesse nossa base de conhecimento em docs.zapflow.ai.",
      },
    ];

    // Combine with quick replies
    const qrCmds = quickReplies.map((qr) => ({
      cmd: `/${qr.text
        .split(" ")
        .slice(0, 2)
        .join("_")
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "")}`,
      desc: `Resposta Rápida: ${qr.category}`,
      text: qr.text,
    }));

    return [...defaultCmds, ...qrCmds].filter(
      (item) =>
        item.cmd.toLowerCase().includes(needle) ||
        item.text.toLowerCase().includes(needle) ||
        item.desc.toLowerCase().includes(needle),
    );
  }, [messageInput, quickReplies]);

  useEffect(() => {
    setActiveSlashIndex(0);
  }, [slashSuggestions.length]);

  return (
    <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
    <div className="flex flex-1 flex-col h-full min-w-0 overflow-hidden relative bg-background">
      {selectedConversation ? (
        <div className="flex flex-1 flex-col h-full min-w-0 overflow-hidden">
          <ChatHeaderBar
            contactName={
              (selectedConversation.contactName || "").replace(/@lid.*/, "").replace(/@s\.whatsapp\.net.*/, "").trim() ||
              (selectedConversation.phone ? formatPhoneNumber(selectedConversation.phone) : "Contato")
            }
            avatar={activeChatAvatar || ""}
            tags={selectedConversation.tags ?? []}
            initials={(selectedConversation.contactName || "C").slice(0, 2).toUpperCase()}
            isMobile={isMobile}
            onBack={onBack ?? (() => setShowLeadPanel(false))}
            onContactClick={() => {
              if (isTabletLayout || isMobile) setShowLeadPanel(true);
            }}
            phoneLabel={
              selectedConversation.phone && !selectedConversation.phone.includes("@lid")
                ? formatPhoneNumber(selectedConversation.phone)
                : undefined
            }
            statusLabel={
              isTyping === "recording"
                ? "gravando áudio..."
                : (isTyping === "composing" || isTyping === true)
                  ? "digitando..."
                  : (isWhatsappConnected && inboxRuntimeState !== "OFFLINE")
                    ? "online"
                    : "offline"
            }
            rightActions={
              <div className="flex min-w-0 items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="hidden h-8 px-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted gap-1 2xl:flex"
                  onClick={() => setConversationSearchOpen(true)}
                  title="Buscar na conversa"
                >
                  <MagnifyingGlass className="h-4 w-4" />
                  Buscar
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn(
                        "h-8 px-1.5 sm:px-2 text-[11px] font-semibold gap-1 shrink-0",
                        aiEnabledForConversation
                          ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/30"
                          : isAiCountdownActive
                          ? "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/30"
                          : "bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/30"
                      )}
                      title="Controle da IA"
                    >
                      <Robot className="h-4 w-4 shrink-0" weight={aiEnabledForConversation ? "fill" : "regular"} />
                      <span className="hidden lg:inline">
                        {aiEnabledForConversation ? "IA ativa" : isAiCountdownActive ? `IA pausada (${timeLeft})` : aiRuntime?.globalEnabled === false ? "IA global pausada" : "Humano"}
                      </span>
                      <span className="inline lg:hidden text-[10px]">
                        {aiEnabledForConversation ? "IA ativa" : isAiCountdownActive ? timeLeft : aiRuntime?.globalEnabled === false ? "Pausada" : "Humano"}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 bg-popover/95 border-border/80 text-popover-foreground">
                    <DropdownMenuItem 
                      onClick={() => {
                        if (aiRuntime?.globalEnabled === false) {
                          navigate("/ai?tab=dashboard");
                        } else {
                          void handleSetConversationAiEnabled(true, null);
                        }
                      }}
                      className="gap-2 cursor-pointer focus:bg-emerald-500/10 focus:text-emerald-500"
                    >
                      <Robot className="h-4 w-4 text-emerald-500" weight="fill" />
                      <span>{aiRuntime?.globalEnabled === false ? "Configurar automação" : "Permitir IA nesta conversa"}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => void handleSetConversationAiEnabled(false, new Date(Date.now() + 86400000).toISOString())}
                      className="gap-2 cursor-pointer focus:bg-amber-500/10 focus:text-amber-500"
                    >
                      <Robot className="h-4 w-4 text-amber-500" weight="fill" />
                      <span>Pausar IA (24h)</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => void handleSetConversationAiEnabled(false, null)}
                      className="gap-2 cursor-pointer focus:bg-red-500/10 focus:text-red-500 text-red-500"
                    >
                      <Robot className="h-4 w-4 text-red-500" weight="fill" />
                      <span>Desativar IA</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {aiAgents && aiAgents.length > 0 && handleSetConversationAgent && (
                  <div className="flex min-w-0 items-center gap-1 bg-muted/50 border border-border/40 rounded-md px-2 py-0.5 text-[10px]">
                    <span className="hidden text-[10px] text-muted-foreground uppercase font-semibold xl:inline">Agente:</span>
                    <Select
                      value={selectedConversation?.agent_name || selectedConversation?.assigned_to || selectedConversation?.assignedAgentName || "default"}
                      onValueChange={(val) => void handleSetConversationAgent(val === "default" ? "" : val)}
                    >
                      <SelectTrigger className="h-6 min-w-[62px] max-w-[96px] bg-transparent border-none text-[11px] font-semibold text-primary focus:ring-0 p-0 gap-1 hover:text-primary-foreground justify-between">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border/80 text-popover-foreground">
                        <SelectItem value="default" className="text-xs">Padrão da conexão</SelectItem>
                        {aiAgents.map((agent) => (
                          <SelectItem
                            key={agent.id || agent.name}
                            value={agent.name}
                            className="text-xs cursor-pointer hover:bg-muted text-foreground focus:bg-muted focus:text-foreground"
                          >
                            {agent.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {(isTabletLayout || isMobile) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 xl:w-auto xl:px-2.5 rounded-lg text-xs font-medium text-foreground hover:bg-muted flex items-center justify-center gap-1.5 transition-colors border border-border/40 shrink-0"
                    onClick={() => setShowLeadPanel(true)}
                    title="Abrir painel de atendimento e ferramentas"
                    aria-label="Abrir painel da conversa"
                  >
                    <Info className="h-4 w-4 text-primary shrink-0" weight="bold" />
                    <span className="hidden xl:inline text-xs font-semibold">Painel</span>
                  </Button>
                )}

                {/* Contact Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
                      title="Opções do contato"
                    >
                      <DotsThreeVertical className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem
                      className="flex items-center gap-2 text-xs cursor-pointer text-foreground hover:bg-muted"
                      onClick={() => {
                        handleClearSelectedConversation();
                      }}
                    >
                      <Trash className="h-3.5 w-3.5" />
                      Limpar conversa
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="flex items-center gap-2 text-xs cursor-pointer text-foreground hover:bg-muted"
                      onClick={() => {
                        const isArchived = archivedChatIds.includes(selectedConversation.id) || String(selectedConversation.status).toLowerCase() === 'archived';
                        if (isArchived) {
                          handleUnarchiveSelectedConversation();
                        } else {
                          handleArchiveSelectedConversation();
                        }
                      }}
                    >
                      {(archivedChatIds.includes(selectedConversation.id) || String(selectedConversation.status).toLowerCase() === 'archived') ? (
                        <>
                          <CaretLeft className="h-3.5 w-3.5" />
                          Desarquivar conversa
                        </>
                      ) : (
                        <>
                          <CaretRight className="h-3.5 w-3.5" />
                          Arquivar conversa
                        </>
                      )}
                    </DropdownMenuItem>
                    {selectedConversation.isBlocked ? (
                      <DropdownMenuItem
                        className="flex items-center gap-2 text-xs cursor-pointer text-green-500 hover:bg-green-500/10 focus:bg-green-500/10 focus:text-green-500"
                        onClick={() => {
                          handleUnblockContact();
                        }}
                      >
                        <Check className="h-3.5 w-3.5 text-green-500" />
                        Desbloquear contato
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        className="flex items-center gap-2 text-xs cursor-pointer text-destructive hover:bg-destructive/10 focus:bg-destructive/10 focus:text-destructive"
                        onClick={() => {
                          handleBlockContact();
                        }}
                      >
                        <Check className="h-3.5 w-3.5 text-destructive" />
                        Bloquear contato
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator className="border-t border-border/40 my-1" />
                    <DropdownMenuItem
                      className="flex items-center gap-2 text-xs cursor-pointer text-foreground hover:bg-muted"
                      onClick={() => {
                        setRightPanelTab("lead");
                        setRightPanelCollapsed(false);
                      }}
                    >
                      <PaperPlaneTilt className="h-3.5 w-3.5" />
                      Etiquetar & Exportar Lead
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            }
          />

          {conversationSearchOpen && (
            <div className="flex items-center gap-2 border-b border-border bg-card/70 px-3 py-2">
              <div className="relative min-w-0 flex-1">
                <MagnifyingGlass className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={conversationSearchInputRef}
                  value={conversationSearchQuery}
                  onChange={(event) => setConversationSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") navigateConversationSearch(event.shiftKey ? -1 : 1);
                    if (event.key === "Escape") {
                      setConversationSearchOpen(false);
                      setConversationSearchQuery("");
                    }
                  }}
                  placeholder="Buscar nas mensagens..."
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <span className="w-24 text-center text-[11px] tabular-nums text-muted-foreground">
                {conversationSearchMatches.length > 0
                  ? `${activeConversationSearchIndex + 1} de ${conversationSearchMatches.length}`
                  : conversationSearchQuery.trim()
                    ? "0 resultados"
                    : "Digite para buscar"}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => navigateConversationSearch(-1)}
                disabled={conversationSearchMatches.length === 0}
                title="Resultado anterior"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => navigateConversationSearch(1)}
                disabled={conversationSearchMatches.length === 0}
                title="Próximo resultado"
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setConversationSearchOpen(false);
                  setConversationSearchQuery("");
                }}
                title="Fechar busca"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Connection & Realtime Status Banners */}
          {inboxRuntimeState === "DEGRADED" && !dismissedBanners["degraded"] && (
            <div className="border-b border-yellow-500/20 bg-yellow-500/10 px-3 py-1 flex items-center justify-between gap-2 text-[11px] text-yellow-400 select-none animate-fade-in shrink-0">
              <div className="flex items-center gap-1.5 min-w-0 truncate">
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-yellow-500"></span>
                </span>
                <span className="truncate">Conexão degradada. Sincronização automática ativa.</span>
              </div>
              <button
                type="button"
                onClick={() => setDismissedBanners((prev) => ({ ...prev, degraded: true }))}
                className="text-yellow-400/70 hover:text-yellow-300 p-0.5 rounded shrink-0 transition-colors"
                aria-label="Dispensar aviso de conexão degradada"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {inboxRuntimeState === "OFFLINE" && !dismissedBanners["offline"] && (
            <div className="border-b border-red-500/20 bg-red-500/10 px-3 py-1 flex items-center justify-between gap-2 text-[11px] text-red-400 select-none shrink-0 animate-fade-in">
              <div className="flex items-center gap-1.5 min-w-0 truncate">
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                </span>
                <span className="truncate">Servidor offline. Exibindo dados locais.</span>
              </div>
              <button
                type="button"
                onClick={() => setDismissedBanners((prev) => ({ ...prev, offline: true }))}
                className="text-red-400/70 hover:text-red-300 p-0.5 rounded shrink-0 transition-colors"
                aria-label="Dispensar aviso de servidor offline"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {inboxRuntimeState === "WHATSAPP_OFFLINE" && !dismissedBanners["wa_offline"] && (
            <div className="border-b border-amber-500/25 bg-amber-500/10 px-3 py-1 flex items-center justify-between gap-2 text-[11px] text-amber-400 select-none shrink-0 animate-fade-in">
              <div className="flex items-center gap-1.5 min-w-0 truncate">
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                </span>
                <span className="truncate">WhatsApp desconectado</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-5 rounded px-2 text-[10px] font-semibold bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 transition-all"
                  onClick={() => navigate("/connections")}
                >
                  Conectar
                </Button>
                <button
                  type="button"
                  onClick={() => setDismissedBanners((prev) => ({ ...prev, wa_offline: true }))}
                  className="text-amber-400/70 hover:text-amber-300 p-0.5 rounded transition-colors"
                  aria-label="Dispensar aviso de WhatsApp desconectado"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}

          {aiRuntime?.globalEnabled === false && selectedConversation && !dismissedBanners["ai_paused"] && (
            <div className="border-b border-primary/20 bg-primary/5 px-3 py-1.5 flex items-center justify-between gap-2 text-[11px] text-foreground select-none shrink-0 animate-fade-in">
              <div className="flex items-center gap-1.5 min-w-0 truncate">
                <Robot className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="truncate">
                  Automação pausada na loja. Você pode responder ou usar sugestões.
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-6 rounded px-2 text-[10px] font-semibold border-primary/30 text-primary hover:bg-primary/10 transition-all shrink-0"
                  onClick={() => {
                    setRightPanelTab("ai");
                    setRightPanelCollapsed(false);
                    if (isTabletLayout || isMobile) setShowLeadPanel(true);
                  }}
                >
                  Sugestões
                </Button>
                <button
                  type="button"
                  onClick={() => setDismissedBanners((prev) => ({ ...prev, ai_paused: true }))}
                  className="text-muted-foreground hover:text-foreground p-0.5 rounded shrink-0 transition-colors"
                  aria-label="Dispensar aviso de IA pausada"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}

          {pendingBackgroundUpdates > 0 && (
            <div className="border-b border-border bg-muted/40 px-4 py-2">
              <div className="mx-auto flex max-w-3xl items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {pendingBackgroundUpdates === 1
                    ? "Nova mensagem disponível em segundo plano."
                    : `${pendingBackgroundUpdates} novas mensagens disponíveis em segundo plano.`}
                </p>
                <Button type="button" size="sm" variant="ghost" onClick={applyPendingBackgroundUpdates}>
                  Atualizar chat
                </Button>
              </div>
            </div>
          )}



          {activeFlowData && (
            <div className="animate-fade-in transition-opacity duration-300">
              <FlowExecutionBanner flowData={activeFlowData} onCancelFlow={() => setActiveFlowData(null)} />
            </div>
          )}
          <ScrollArea className="min-h-0 flex-1 chat-area-bg">
            <div
              ref={messagesScrollRef}
              className={cn(
                "mx-auto max-w-3xl space-y-3 p-4 pb-24 md:pb-16",
                isDraggingFiles && "rounded-xl border border-dashed border-primary p-3",
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingFiles(true);
              }}
              onDragLeave={() => setIsDraggingFiles(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingFiles(false);
                if (e.dataTransfer.files.length > 0) {
                  const fakeEvent = {
                    target: { files: e.dataTransfer.files },
                  };
                  handleAttachFiles(fakeEvent);
                }
              }}
            >
              <div ref={loadMoreTriggerRef} className="h-1 w-full" aria-hidden />
              {isDraggingFiles && <p className="text-xs text-muted-foreground">Solte arquivos aqui para anexar.</p>}

              {messagesLoadFailed && messages.length > 0 && (
                <div className="rounded-lg border border-border bg-card p-3 text-center">
                  <p className="text-sm text-muted-foreground">
                    Falha temporária ao atualizar mensagens. Mantendo os últimos dados em tela.
                  </p>
                  <Button type="button" variant="outline" size="sm" className="mt-3" onClick={handleRetryMessages}>
                    Tentar novamente
                  </Button>
                </div>
              )}

              {loadingMessages ? (
                <div className="space-y-4 animate-fade-in">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton
                      key={i}
                      className={cn("h-14 rounded-2xl", i % 2 === 0 ? "w-3/4" : "ml-auto w-1/2")}
                    />
                  ))}
                </div>
              ) : messages.length === 0 ? (
                messagesLoadFailed ? (
                  <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
                    <p className="text-sm text-muted-foreground">Não foi possível carregar as mensagens.</p>
                    <Button type="button" variant="outline" size="sm" className="mt-3" onClick={handleRetryMessages}>
                      Tentar novamente
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 animate-fade-in">
                    <div className="rounded-2xl bg-muted/30 p-4 ring-1 ring-border/40">
                      <ChatCircleDots className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-foreground">Nenhuma mensagem nesta conversa</p>
                      <p className="mt-1 text-xs text-muted-foreground/70">Envie a primeira mensagem abaixo.</p>
                    </div>
                  </div>
                )
              ) : (
                <div className="animate-fade-in">
                  {messageGroups.map((group) => (
                    <div key={group.label} className="space-y-3 mb-3">
                      <div className="flex justify-center">
                        <Badge variant="secondary" className="text-[10px]">
                          {group.label}
                        </Badge>
                      </div>
                      {group.entries.map((message) => (
                        <MessageRow
                          key={message.id}
                          message={message}
                          reaction={messageReactions[message.id]}
                          onReact={handleReactMessage}
                          onOpenMediaPreview={handleOpenMediaPreview}
                          isMenuOpen={activeMessageMenuId === message.id}
                          isReactionPickerOpen={activeReactionPickerMessageId === message.id}
                          onToggleMenu={handleToggleMessageMenu}
                          onToggleReactionPicker={handleToggleReactionPicker}
                          onCopyMessage={handleCopyMessage}
                          onReplyMessage={handleReplyMessage}
                          onForwardMessage={handleForwardMessage}
                          onDeleteMessage={handleDeleteMessage}
                          onDownloadMedia={handleDownloadMedia}
                          onToggleAudio={handleToggleAudioPlayback}
                          isAudioLoading={loadingAudioMessageId === message.id}
                          isAudioPlaying={playingAudioMessageId === message.id}
                          audioProgress={playingAudioMessageId === message.id ? audioProgress : 0}
                          audioDuration={playingAudioMessageId === message.id ? audioDuration : 0}
                          backendOnline={inboxRuntimeState !== "OFFLINE"}
                          searchQuery={conversationSearchQuery}
                          isActiveSearchMatch={activeConversationSearchMessageId === message.id}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {aiProgress && (
                <div className="mt-3 flex justify-end" aria-live="polite" aria-label="Progresso da resposta da IA">
                  <div
                    className={cn(
                      "w-fit max-w-[85%] rounded-2xl rounded-br-md border px-3.5 py-3 shadow-sm",
                      aiProgressActive
                        ? "border-primary/30 bg-primary/10 text-foreground"
                        : aiProgress.status === "failed" || aiProgress.status === "no_agent"
                          ? "border-amber-500/30 bg-amber-500/10"
                          : "border-border bg-muted/50",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Robot className={cn("h-4 w-4 shrink-0", aiProgressActive ? "text-primary" : "text-muted-foreground")} />
                      <span className="text-xs font-semibold">
                        {aiProgress.agentName || "IA da loja"}
                      </span>
                      {aiProgressActive && (
                        <div className="ml-1 flex gap-1">
                          {[0, 1, 2].map((index) => (
                            <span
                              key={index}
                              className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary"
                              style={{ animationDelay: `${index * 140}ms` }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {aiProgress.message || "Preparando resposta..."}
                    </p>
                    {aiProgressActive && aiRemainingSeconds > 0 && (
                      <p className="mt-1.5 text-[10px] font-medium text-primary">
                        Tempo estimado: {aiRemainingSeconds}s
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <NewMessagesBanner
            unseenRealtimeCount={unseenRealtimeCount}
            onScrollToLatest={scrollToLatestMessage}
          />

          <div
            className={cn(
              "border-t border-border bg-card/95 p-3 md:relative md:p-4 shrink-0",
              isMobile && "fixed inset-x-0 bottom-0 z-30 pb-[calc(0.75rem+env(safe-area-inset-bottom))]",
              isMobile && showLeadPanel && "hidden pointer-events-none opacity-0"
            )}
            style={isMobile ? { bottom: `calc(${keyboardOffset}px + env(safe-area-inset-bottom))` } : undefined}
          >
            <div className="mx-auto max-w-3xl space-y-3">
              {selectedConversation?.isBlocked && (
                <div className="flex items-center justify-between gap-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-destructive animate-fade-in mb-2">
                  <div className="flex items-center gap-2">
                    <Warning className="h-4.5 w-4.5 shrink-0" />
                    <span className="text-xs font-medium">Este contato está bloqueado.</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 bg-destructive text-white hover:bg-destructive/95 text-xs font-semibold px-3 rounded-lg"
                    onClick={handleUnblockContact}
                  >
                    Desbloquear
                  </Button>
                </div>
              )}
               {((isTyping === "composing" || isTyping === "recording" || isTyping === true) || suggestingResponse) && (
                <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground animate-pulse">
                  <div className="flex space-x-1">
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    />
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    />
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                  <span>{suggestingResponse ? "IA analisando..." : (isTyping === "recording" ? "gravando áudio..." : "digitando...")}</span>
                </div>
              )}

              {replyingTo && (
                <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/40 p-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-muted-foreground">Respondendo</p>
                    <p className="truncate text-xs">{(replyingTo.caption ?? replyingTo.content ?? "Mensagem").trim()}</p>
                  </div>
                  <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setReplyingTo(null)}>
                    Cancelar
                  </Button>
                </div>
              )}

              {attachments.length > 0 && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {attachments.map((attachment) => (
                    <div key={attachment.id} className="relative rounded-lg border border-border bg-muted/40 p-2">
                      <p className="truncate text-xs font-medium">{attachment.file.name}</p>
                      {attachment.mediaType === "image" && (
                        <img
                          src={attachment.previewUrl}
                          alt={attachment.file.name}
                          className="mt-2 h-20 w-full rounded object-cover"
                        />
                      )}
                      {attachment.mediaType === "video" && (
                        <video src={attachment.previewUrl} className="mt-2 h-20 w-full rounded object-cover" />
                      )}
                      {attachment.mediaType === "audio" && (
                        <audio src={attachment.previewUrl} controls className="mt-2 w-full" />
                      )}
                      {attachment.mediaType === "file" && <FileIcon className="mt-2 h-8 w-8 text-muted-foreground" />}
                      {(attachment.mediaType === "image" || attachment.mediaType === "video") && (
                        <div className="mt-2">
                          <input
                            type="text"
                            placeholder="Legenda..."
                            value={attachment.caption || ""}
                            onChange={(e) => updateAttachmentCaption?.(attachment.id, e.target.value)}
                            className="w-full text-[10px] bg-background/50 rounded border border-border/30 px-2 py-1 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeAttachment(attachment.id)}
                        className="absolute right-1 top-1 rounded-md bg-background p-1 text-muted-foreground md:hover:text-foreground"
                      >
                        <Trash className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {!selectedConversation?.isBlocked && canSendMessages && !isRecording && (() => {
                const list = quickReplies.slice(0, 5);
                if (list.length === 0) return null;

                return (
                  <div className="flex items-center gap-1.5 px-1 py-1 mb-0.5 select-none w-full max-w-full overflow-x-auto no-scrollbar scroll-smooth flex-nowrap">
                    {list.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        title={item.isFlow || item.items?.some(entry => entry.type !== "text") ? "Abrir prévia antes de enviar" : "Inserir no rascunho para revisar"}
                        onClick={() => {
                          if (item.isFlow || item.items?.some(entry => entry.type !== "text")) {
                            setSelectedQuickReplyModal(item);
                            setIsQuickReplyModalOpen(true);
                          } else {
                            setMessageInput(getQuickReplyPreviewText(item, { contactName: selectedConversation.contactName, phone: selectedConversation.phone }));
                            messageInputRef.current?.focus();
                          }
                        }}
                        className="px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/70 border border-border/40 rounded-full transition-all duration-150 active:scale-95 shrink-0"
                      >
                        {item.title || item.text}
                      </button>
                    ))}
                    {quickReplies.length > 5 && <button type="button" className="px-2 py-1 text-xs font-medium text-primary" onClick={() => { setRightPanelTab("ai"); setRightPanelCollapsed(false); if (isTabletLayout) setShowLeadPanel(true); }}>Todas as respostas</button>}
                  </div>
                );
              })()}

              {sending && <p role="status" className="mb-2 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary"><span className="h-2 w-2 animate-pulse rounded-full bg-primary" />Colocando mensagem na fila de envio…</p>}

              <div className="relative flex items-center gap-2 w-full">
                {isRecording ? (
                  /* Audio Recording Mode UI */
                  <div className="flex flex-1 items-center justify-between bg-muted/40 rounded-xl px-4 py-1 h-11 border border-border/60 animate-pulse">
                    <div className="flex items-center">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                      </span>
                      <span className="text-xs font-semibold text-foreground/95 ml-2.5 font-mono">
                        Gravando áudio: {formatPlaybackTime(recordingTime)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/10"
                        onClick={handleCancelRecording}
                        title="Descartar gravação"
                      >
                        <Trash className="h-4.5 w-4.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        className="h-8 w-8 rounded-full bg-[#25D366] hover:bg-[#25D366]/90 text-white"
                        onClick={handleToggleRecording}
                        title="Enviar gravação"
                      >
                        <Check className="h-4.5 w-4.5" weight="bold" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Standard Input Mode UI */
                  <>
                    {/* Floating Slash Commands Autocomplete */}
                    {slashSuggestions.length > 0 && (
                      <div className="absolute bottom-full left-0 right-0 z-40 mb-2 max-h-52 overflow-y-auto rounded-lg border border-border bg-popover/95 text-popover-foreground p-1.5 shadow-2xl backdrop-blur scrollbar-thin">
                        <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider border-b border-border/40 mb-1">
                          Comandos e Respostas Rápidas
                        </div>
                        {slashSuggestions.map((item, index) => (
                          <button
                            key={item.cmd + index}
                            type="button"
                            onClick={() => {
                              setMessageInput(item.text);
                              messageInputRef.current?.focus();
                            }}
                            className={cn(
                              "flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-xs transition-colors",
                              index === activeSlashIndex
                                ? "bg-primary text-primary-foreground font-semibold"
                                : "hover:bg-muted text-foreground",
                            )}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span
                                className={cn(
                                  "font-mono font-bold text-[11px]",
                                  index === activeSlashIndex ? "text-primary-foreground" : "text-primary",
                                )}
                              >
                                {item.cmd}
                              </span>
                              <span className="truncate opacity-90">{item.text}</span>
                            </div>
                            <span
                              className={cn(
                                "text-[10px] shrink-0 ml-3",
                                index === activeSlashIndex ? "text-primary-foreground/75" : "text-muted-foreground/60",
                              )}
                            >
                              {item.desc}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={MOBILE_TOUCH_TARGET_CLASS}
                      aria-label="Abrir emojis"
                      data-emoji-trigger
                      disabled={!selectedConversation || !canSendMessages}
                    >
                      <Smiley className="h-5 w-5" />
                    </Button>
                    </PopoverTrigger>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={MOBILE_TOUCH_TARGET_CLASS}
                      onClick={() => fileInputRef.current?.click()}
                      aria-label="Anexar mídia"
                      disabled={!selectedConversation || !canSendMessages}
                    >
                      <Paperclip className="h-5 w-5" />
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      accept="*/*"
                      onChange={handleAttachFiles}
                    />

                    {selectedConversation && (
                      <ZaiAssistantComposer
                        key={selectedConversation.id}
                        selectedConversation={selectedConversation}
                        messages={messages}
                        handleSendMessage={handleSendMessage}
                        setMessageInput={setMessageInput}
                        messageInputRef={messageInputRef}
                        disabled={!canSendMessages}
                      />
                    )}

                    <textarea
                      ref={messageInputRef}
                      rows={1}
                      placeholder={
                        !canUseBackend
                          ? "Reconectando..."
                          : !isWhatsappConnected
                            ? "WhatsApp offline"
                            : selectedConversation
                              ? "Mensagem..."
                              : "Selecione uma conversa"
                      }
                      className="flex min-h-[40px] max-h-[140px] w-full flex-1 resize-none rounded-2xl border border-input bg-background/90 px-3.5 py-2 sm:py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 scrollbar-none text-foreground leading-snug overflow-y-auto"
                      value={messageInput}
                      disabled={!selectedConversation || !canSendMessages}
                      onChange={(event) => {
                        setMessageInput(event.target.value);
                        const textarea = event.target;
                        textarea.style.height = "auto";
                        textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`;
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const text = e.dataTransfer.getData("text/plain");
                        if (text) {
                          setMessageInput((prev) => (prev ? `${prev} ${text}` : text));
                        }
                      }}
                      onKeyDown={(event) => {
                        if (slashSuggestions.length > 0) {
                          if (event.key === "ArrowDown") {
                            event.preventDefault();
                            setActiveSlashIndex((prev) => (prev + 1) % slashSuggestions.length);
                            return;
                          }
                          if (event.key === "ArrowUp") {
                            event.preventDefault();
                            setActiveSlashIndex(
                              (prev) => (prev - 1 + slashSuggestions.length) % slashSuggestions.length,
                            );
                            return;
                          }
                          if (event.key === "Enter" || event.key === "Tab") {
                            event.preventDefault();
                            const selected = slashSuggestions[activeSlashIndex];
                            if (selected) {
                              setMessageInput(selected.text);
                            }
                            return;
                          }
                          if (event.key === "Escape") {
                            event.preventDefault();
                            setMessageInput("");
                            return;
                          }
                        }

                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void handleSendMessage();
                          if (messageInputRef.current) {
                            messageInputRef.current.style.height = "auto";
                          }
                        }
                      }}
                    />

                    {messageInput.trim().length === 0 && attachments.length === 0 ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className={cn("rounded-full text-muted-foreground hover:text-foreground", MOBILE_TOUCH_TARGET_CLASS)}
                        onClick={handleToggleRecording}
                        disabled={!selectedConversation || !canSendMessages || sending}
                        title="Gravar áudio"
                      >
                        <Microphone className="h-5 w-5" />
                      </Button>
                    ) : (
                      <Button
                        size="icon"
                        className={cn("rounded-full bg-primary text-primary-foreground", MOBILE_TOUCH_TARGET_CLASS)}
                        onClick={() => void handleSendMessage()}
                        disabled={!selectedConversation || !canSendMessages || sending}
                        aria-label="Enviar mensagem"
                      >
                        {sending ? (
                          <span className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                        ) : (
                          <PaperPlaneTilt weight="fill" className="h-5 w-5" />
                        )}
                      </Button>
                    )}
                  </>
                )}

                {showEmojiPicker && (
                  <PopoverContent
                    side="top"
                    align="start"
                    sideOffset={8}
                    collisionPadding={12}
                    onOpenAutoFocus={(event) => event.preventDefault()}
                    onCloseAutoFocus={(event) => { event.preventDefault(); messageInputRef.current?.focus(); }}
                    aria-label="Emojis e figurinhas"
                    data-emoji-picker
                    className="emoji-popover flex w-[352px] max-w-[calc(100vw-24px)] flex-col gap-2 overflow-hidden rounded-2xl border-border bg-popover p-2 shadow-xl"
                  >
                    {/* Tab Header */}
                    <div className="flex border-b border-border pb-1.5 px-1 gap-4 text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setActiveTab('emoji')}
                        className={cn(
                          "pb-1 transition-colors",
                          activeTab === 'emoji' ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        Emojis
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('sticker');
                          void loadStickers();
                        }}
                        className={cn(
                          "pb-1 transition-colors",
                          activeTab === 'sticker' ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        Figurinhas
                      </button>
                    </div>

                    {/* Tab Content */}
                    {activeTab === 'emoji' ? (
                      EmojiPickerComponent && emojiPickerData ? (
                        <EmojiPickerComponent
                          data={emojiPickerData}
                          onEmojiSelect={handleInsertEmoji}
                          previewPosition="none"
                          skinTonePosition="none"
                          theme={resolvedTheme === "light" ? "light" : "dark"}
                          dynamicWidth
                          locale="pt"
                          perLine={8}
                          emojiVersion={15}
                        />
                      ) : (
                        <div className="w-full p-3 text-xs text-muted-foreground text-center">Carregando emojis...</div>
                      )
                    ) : (
                      <div className="w-full min-h-0 flex-1 max-h-[300px] overflow-y-auto scrollbar-thin">
                        {loadingStickers ? (
                          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                            Carregando figurinhas...
                          </div>
                        ) : stickers.length === 0 ? (
                          <div className="flex items-center justify-center h-full text-xs text-muted-foreground text-center p-4">
                            Nenhuma figurinha recebida ou enviada ainda.
                          </div>
                        ) : (
                          <div className="grid grid-cols-4 gap-2 p-1">
                            {stickers.map((sticker) => (
                              <button
                                key={sticker.id}
                                type="button"
                                onClick={() => void handleSendSticker(sticker.url)}
                                className="group relative flex items-center justify-center rounded-md border border-border/40 bg-muted/20 p-1 hover:bg-muted/40 hover:border-primary/50 transition-all aspect-square"
                              >
                                <img
                                  src={sticker.url}
                                  alt="Sticker"
                                  className="h-14 w-14 object-contain transition-transform group-hover:scale-110"
                                />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </PopoverContent>
                )}
              </div>
            </div>

            {error && <p className="mt-2 text-center text-xs text-destructive">{error}</p>}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 text-muted-foreground animate-fade-in h-full">
          <div className="rounded-2xl bg-muted/30 p-6 ring-1 ring-border/40">
            <ChatCircleDots className="h-12 w-12 text-muted-foreground/40" />
          </div>
          <div className="text-center max-w-[220px]">
            <p className="text-sm font-semibold text-foreground">Selecione uma conversa</p>
            <p className="mt-1.5 text-xs text-muted-foreground/70 leading-relaxed">
              Escolha um contato na lista ao lado para visualizar as mensagens.
            </p>
          </div>
        </div>
      )}
      {selectedConversation && (
        <QuickResponseModal
          isOpen={isQuickReplyModalOpen}
          onClose={() => setIsQuickReplyModalOpen(false)}
          quickReply={selectedQuickReplyModal}
          recipientName={selectedConversation.contactName}
          disabled={!isWhatsappConnected || sending}
          onDispatch={handleDispatchQuickReply}
        />
      )}
    </div>
    </Popover>
  );
}
