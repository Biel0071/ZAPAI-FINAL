import { useRef, useState, useEffect, useMemo, memo } from "react";
import { Check, ChatCircleDots, Star, CaretRight, CaretLeft, Plus, Trash, Robot, Microphone } from "@phosphor-icons/react";
import { List } from "react-window";
import type { RowComponentProps } from "react-window";
import { ChatSearchBar } from "@/components/inbox/ChatSearchBar";
import { OperationalStatusBadge } from "@/components/enterprise/OperationalStatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/core/lib/utils";
import type { Conversation, SessionInfo } from "@/core/services/apiService";
import { ConversationRow } from "./ConversationRow";
import type { ConversationRowData } from "./ConversationRow";
import {
  isSessionActive,
  getTagColor,
  classifyConversationFunnel,
  getInitials,
  formatPhoneNumber,
  normalizeId,
  inferConversationMessageType,
} from "../utils";
import { useResolvedAvatar } from "@/hooks/useResolvedAvatar";
import { TagIconBadge } from "@/components/inbox/TagIconBadge";
import { WhatsAppContextMenuContent } from "./WhatsAppConversationMenu";

interface ChatListPanelProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  isMultiSelectMode: boolean;
  setIsMultiSelectMode: (updater: boolean | ((prev: boolean) => boolean)) => void;
  selectedChatIds: string[];
  setSelectedChatIds: (ids: string[]) => void;
  filter: string;
  setFilter: (val: string) => void;
  funnelFilter?: string;
  setFunnelFilter?: (val: string) => void;
  filteredConversations: Conversation[];
  allConversations?: Conversation[];
  conversationCounts?: { total: number; active: number; archived: number; unread: number; ai_active: number } | null;
  conversationsLoadFailed: boolean;
  loadingConversations: boolean;
  handleRetryConversations: () => Promise<void>;
  conversationListHeight: number;
  conversationRowData: any;
  activeSession: SessionInfo | null;
  navigate: (path: string) => void;
  handleBulkPin: () => void;
  handleBulkArchive: () => void;
  handleBulkAddTag: (tag: string) => Promise<void>;
  handleBulkDelete: () => Promise<void>;
  handleBulkExportContacts: () => void;
  handleBulkLoadCampaign: () => Promise<void>;
  isMobile: boolean;
  mobileScreen: string;
  showGroups?: boolean;
  setShowGroups?: (val: boolean) => void;
}

const BUSINESS_TAG_OPTIONS = ["Novo Lead", "Cliente", "Orçamento", "Venda", "Suporte", "VIP", "Urgente"] as const;
const CONVERSATION_ROW_HEIGHT = 72;
const COLLAPSED_ROW_HEIGHT = 64;

export const CollapsedConversationRow = memo(function CollapsedConversationRow(props: RowComponentProps<ConversationRowData>) {
  const { index, style } = props;
  const data: ConversationRowData = ((props as any).data || props) as ConversationRowData;
  const {
    conversations = [],
    conversationControls = {},
    globalAiEnabled = true,
    selectedId = null,
    onSelect = () => {},
    typingByConversationId,
    pinnedChatIds = [],
    onTogglePin = () => {},
    archivedChatIds = [],
    onToggleArchive = () => {},
    mutedChatIds = [],
    onToggleMute = () => {},
    onToggleUnread = () => {},
    onDeleteConversation = () => {},
    onSetConversationAiEnabled = () => {},
    onUpdateTags = () => {},
  } = data;

  const conversation = conversations[index];
  if (!conversation) return null;

  const { avatar: resolvedAvatar } = useResolvedAvatar(conversation.id, conversation.avatar);

  const cleanDisplayName = useMemo(() => {
    const rawName = (conversation.contactName || "").trim();
    const rawPhone = (conversation.phone || "").trim();
    const isLidName =
      rawName.includes("@lid") ||
      (/^\d{14,16}$/.test(rawName.replace(/@.*$/, "")) && !rawName.startsWith("55"));

    if (isLidName) {
      const cleanPhoneDigits = rawPhone.replace(/@.*$/, "").replace(/\D/g, "");
      if (rawPhone && !rawPhone.includes("@lid") && cleanPhoneDigits.length >= 10 && cleanPhoneDigits.length <= 13) {
        return formatPhoneNumber(rawPhone);
      }
      return formatPhoneNumber(rawName);
    }

    let name = rawName;
    if (name.includes("@s.whatsapp.net")) {
      name = name.replace(/@s\.whatsapp\.net.*/, "").trim();
    }
    const digitsOnly = name.replace(/\D/g, "");
    if (digitsOnly.length >= 10 && (digitsOnly === name || name.startsWith("+") || name.startsWith("55"))) {
      return formatPhoneNumber(name);
    }
    if (!name && rawPhone) {
      return formatPhoneNumber(rawPhone);
    }
    return name || "Contato";
  }, [conversation.contactName, conversation.phone]);

  const getTypingState = () => {
    if (!typingByConversationId) return null;
    const byId = typingByConversationId[conversation.id];
    if (byId !== undefined) return byId;

    if (conversation.chatId) {
      const byChatId = typingByConversationId[conversation.chatId];
      if (byChatId !== undefined) return byChatId;
      const cleanChatId = conversation.chatId.replace(/@s\.whatsapp\.net$/i, "");
      const byCleanChatId = typingByConversationId[cleanChatId];
      if (byCleanChatId !== undefined) return byCleanChatId;
    }

    if (conversation.phone) {
      const byPhone = typingByConversationId[conversation.phone];
      if (byPhone !== undefined) return byPhone;
      const cleanPhone = conversation.phone.replace(/\D/g, "");
      const byCleanPhone = typingByConversationId[cleanPhone];
      if (byCleanPhone !== undefined) return byCleanPhone;
    }

    return conversation.status === "typing" ? "composing" : null;
  };

  const typingState = getTypingState();
  const isTyping = typingState === "composing" || typingState === "recording" || typingState === true;
  const isOnline = isTyping || conversation.status === "online";
  const isAudio = inferConversationMessageType(conversation) === "audio" || typingState === "recording";

  const conversationAiAllowed = conversationControls[conversation.id]?.aiEnabled ?? conversation.aiEnabled ?? true;
  const aiEnabled = globalAiEnabled && conversationAiAllowed;
  const aiWaiting = !globalAiEnabled && conversationAiAllowed;
  const aiTooltip = !globalAiEnabled 
    ? "IA pausada globalmente" 
    : conversationAiAllowed 
      ? "IA ativa (clique para pausar)" 
      : "IA desativada (clique para ativar)";

  const leadStatus = useMemo(() => {
    return classifyConversationFunnel(conversation, {
      globalAiEnabled,
      conversationControls,
    });
  }, [conversation, globalAiEnabled, conversationControls]);

  const isSelected = normalizeId(selectedId) === normalizeId(conversation.id);
  const unread = conversation.unread ?? 0;
  const isPinned = pinnedChatIds.includes(conversation.id);
  const isArchived = archivedChatIds.includes(conversation.id);
  const isMuted = (mutedChatIds || []).includes(conversation.id);

  // Avatar ring color based on funnel
  const avatarRingClass = useMemo(() => {
    if (leadStatus.state === "intervencao") return "ring-2 ring-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse";
    if (leadStatus.state === "chegou") return "ring-2 ring-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.4)]";
    if (leadStatus.state === "rodando") return "ring-2 ring-amber-500/80 shadow-[0_0_8px_rgba(245,158,11,0.4)]";
    if (leadStatus.state === "finalizado") return "ring-2 ring-blue-500/80 shadow-[0_0_8px_rgba(59,130,246,0.3)]";
    if (leadStatus.state === "pago") return "ring-2 ring-teal-500/80 shadow-[0_0_8px_rgba(20,184,166,0.3)]";
    if (leadStatus.state === "pausado") return "ring-2 ring-rose-500/60";
    return "ring-1 ring-border/50";
  }, [leadStatus.state]);

  return (
    <div style={style} className="px-1 py-1 flex items-center justify-center">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div>
            <TooltipProvider delayDuration={120}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onSelect(conversation.id)}
                    className={cn(
                      "relative flex items-center justify-center h-12 w-12 rounded-xl transition-all duration-200 outline-none select-none",
                      isSelected
                        ? "bg-primary/20 ring-2 ring-primary shadow-sm scale-105"
                        : "hover:bg-accent/50 hover:scale-105"
                    )}
                    aria-label={cleanDisplayName}
                  >
                    <Avatar className={cn("h-10 w-10 transition-transform", avatarRingClass)}>
                      {resolvedAvatar ? (
                        <AvatarImage
                          src={resolvedAvatar}
                          alt={cleanDisplayName}
                          loading="lazy"
                          className="object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : null}
                      <AvatarFallback className="bg-primary/10 font-bold text-xs text-primary">
                        {getInitials(cleanDisplayName)}
                      </AvatarFallback>
                    </Avatar>

                    {/* Presença do contato: Bolinha Verde para Online / Vermelha para Offline */}
                    <span
                      className="absolute bottom-0 right-0 z-20 flex h-3 w-3 items-center justify-center pointer-events-none"
                      title={isOnline ? "Online agora" : "Offline"}
                    >
                      {isOnline ? (
                        <>
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border-2 border-background shadow-[0_0_6px_rgba(16,185,129,0.9)]" />
                        </>
                      ) : (
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 border-2 border-background" />
                      )}
                    </span>

                    {/* IA Activation mini button (top-left) */}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSetConversationAiEnabled(conversation.id, !conversationAiAllowed);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.stopPropagation();
                          onSetConversationAiEnabled(conversation.id, !conversationAiAllowed);
                        }
                      }}
                      className={cn(
                        "absolute -top-1 -left-1 z-20 h-4.5 w-4.5 rounded-full flex items-center justify-center border-2 border-background shadow-xs transition-transform hover:scale-110 cursor-pointer",
                        aiWaiting
                          ? "bg-amber-500 text-white"
                          : aiEnabled
                          ? "bg-emerald-600 text-white shadow-[0_0_6px_rgba(16,185,129,0.7)]"
                          : "bg-muted text-muted-foreground/60 border-border"
                      )}
                      title={aiTooltip}
                    >
                      <Robot className="h-2.5 w-2.5" weight="bold" />
                    </span>

                    {/* Unread badge (top-right) */}
                    {unread > 0 && (
                      <span className="absolute -top-1 -right-1 z-20 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white shadow-[0_0_6px_rgba(16,185,129,0.7)]">
                        {unread > 99 ? "99+" : unread}
                      </span>
                    )}

                    {/* Audio note indicator */}
                    {isAudio && !unread && (
                      <span className="absolute -top-1 -right-1 z-20 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-sky-500 text-[8px] text-white shadow-xs" title="Mensagem de áudio">
                        <Microphone className="h-2 w-2" weight="fill" />
                      </span>
                    )}

                    {/* Pinned Star indicator */}
                    {isPinned && !unread && !isAudio && (
                      <span className="absolute -top-1 -right-1 z-20 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500/90 text-white shadow-xs" title="Fixado">
                        <Star className="h-2 w-2" weight="fill" />
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={12} className="p-3 max-w-xs space-y-1.5 shadow-xl bg-popover/95 backdrop-blur border border-border">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-foreground truncate">{cleanDisplayName}</span>
                    {isOnline ? (
                      <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 shrink-0">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                        Online
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground shrink-0">Offline</span>
                    )}
                  </div>
                  {conversation.phone && (
                    <p className="text-[11px] text-muted-foreground/80 font-mono">
                      {formatPhoneNumber(conversation.phone)}
                    </p>
                  )}
                  {/* Lead Funnel status badge */}
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", leadStatus.badgeClass || "bg-muted text-muted-foreground")}>
                      {leadStatus.label}
                    </span>
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-md font-medium", aiEnabled ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground")}>
                      {aiEnabled ? "IA Ativa" : "IA Pausada"}
                    </span>
                  </div>
                  {/* Last message preview */}
                  <p className="text-xs text-muted-foreground/90 line-clamp-2 pt-1 border-t border-border/40">
                    {typingState ? (
                      <span className="text-emerald-400 font-medium italic">
                        {typingState === "recording" ? "Gravando áudio..." : "Digitando..."}
                      </span>
                    ) : (
                      conversation.lastMessage || "Sem mensagens recentes"
                    )}
                  </p>
                  {/* Tags list */}
                  {conversation.tags && conversation.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {conversation.tags.map((tag) => (
                        <TagIconBadge key={tag} tag={tag} colorClass={getTagColor(tag)} size="xs" interactive={false} />
                      ))}
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </ContextMenuTrigger>

        <WhatsAppContextMenuContent
          conversation={conversation}
          isPinned={isPinned}
          isArchived={isArchived}
          isMuted={isMuted}
          aiEnabled={aiEnabled}
          conversationAiAllowed={conversationAiAllowed}
          onSelect={onSelect}
          onTogglePin={onTogglePin}
          onToggleArchive={onToggleArchive}
          onToggleMute={onToggleMute}
          onToggleUnread={onToggleUnread}
          onSetConversationAiEnabled={onSetConversationAiEnabled}
          onUpdateTags={onUpdateTags}
          onDeleteConversation={onDeleteConversation}
          showOpenChat={true}
        />
      </ContextMenu>
    </div>
  );
});

export const ChatListPanel = memo(function ChatListPanel({
  isCollapsed = false,
  onToggleCollapse,
  searchQuery,
  setSearchQuery,
  isMultiSelectMode,
  setIsMultiSelectMode,
  selectedChatIds,
  setSelectedChatIds,
  filter,
  setFilter,
  funnelFilter = "all",
  setFunnelFilter,
  filteredConversations,
  allConversations,
  conversationCounts,
  conversationsLoadFailed,
  loadingConversations,
  handleRetryConversations,
  conversationListHeight,
  conversationRowData,
  activeSession,
  navigate,
  handleBulkPin,
  handleBulkArchive,
  handleBulkAddTag,
  handleBulkDelete,
  handleBulkExportContacts,
  handleBulkLoadCampaign,
  isMobile,
  mobileScreen,
  showGroups = false,
  setShowGroups,
}: ChatListPanelProps) {
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const [dynamicHeight, setDynamicHeight] = useState(conversationListHeight || 600);

  // Drag-to-scroll horizontal handler for funnel filter bar (eliminates clunky scrollbar tracks)
  const funnelScrollRef = useRef<HTMLDivElement | null>(null);
  const isDraggingFunnel = useRef(false);
  const hasDraggedFunnel = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const handleFunnelMouseDown = (e: React.MouseEvent) => {
    if (!funnelScrollRef.current) return;
    isDraggingFunnel.current = true;
    hasDraggedFunnel.current = false;
    startX.current = e.pageX - funnelScrollRef.current.offsetLeft;
    scrollLeft.current = funnelScrollRef.current.scrollLeft;
  };

  const handleFunnelMouseLeave = () => {
    isDraggingFunnel.current = false;
  };

  const handleFunnelMouseUp = () => {
    isDraggingFunnel.current = false;
  };

  const handleFunnelMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingFunnel.current || !funnelScrollRef.current) return;
    const x = e.pageX - funnelScrollRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.4;
    if (Math.abs(walk) > 4) {
      hasDraggedFunnel.current = true;
      e.preventDefault();
      funnelScrollRef.current.scrollLeft = scrollLeft.current - walk;
    }
  };

  const handleFunnelWheel = (e: React.WheelEvent) => {
    if (!funnelScrollRef.current) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    funnelScrollRef.current.scrollLeft += e.deltaY;
  };

  const sourceConversations = filter === "archived"
    ? filteredConversations
    : (allConversations || filteredConversations);

  const funnelCounts = useMemo(() => {
    const rawTotal = filter === "archived"
      ? (conversationCounts?.archived ?? filteredConversations.length)
      : filter === "unread"
      ? (conversationCounts?.unread ?? sourceConversations.length)
      : (conversationCounts?.active ?? sourceConversations.length);

    const counts = { all: rawTotal, chegou: 0, rodando: 0, pausado: 0, finalizado: 0, pago: 0 };
    for (const c of sourceConversations) {
      const info = classifyConversationFunnel(c, {
        globalAiEnabled: conversationRowData?.globalAiEnabled,
        conversationControls: conversationRowData?.conversationControls,
      });
      if (info.state in counts) {
        counts[info.state as keyof typeof counts]++;
      }
    }
    return counts;
  }, [sourceConversations, filteredConversations.length, filter, conversationCounts, conversationRowData?.globalAiEnabled, conversationRowData?.conversationControls]);

  const aiActiveFallbackCount = useMemo(() => {
    return sourceConversations.filter((c) => {
      const aiAllowed = conversationRowData?.conversationControls?.[c.id]?.aiEnabled ?? c.aiEnabled ?? true;
      return (conversationRowData?.globalAiEnabled ?? true) && aiAllowed;
    }).length;
  }, [sourceConversations, conversationRowData?.conversationControls, conversationRowData?.globalAiEnabled]);

  const aiCount = conversationCounts?.ai_active ?? aiActiveFallbackCount;

  useEffect(() => {
    if (!listContainerRef.current) return;
    let frameId: number | null = null;
    const updateHeight = () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        if (listContainerRef.current) {
          const rect = listContainerRef.current.getBoundingClientRect();
          if (rect.height > 100) {
            const nextH = Math.floor(rect.height);
            setDynamicHeight((prev) => (Math.abs(prev - nextH) > 2 ? nextH : prev));
          }
        }
      });
    };
    updateHeight();
    const observer = new ResizeObserver(() => {
      updateHeight();
    });
    observer.observe(listContainerRef.current);
    window.addEventListener("resize", updateHeight);
    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      observer.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, []);

  // Rail colapsado com avatars, status online do WhatsApp, IA, etiquetas e tooltip lateral
  if (isCollapsed) {
    return (
      <div className={cn("flex min-h-0 flex-col border-r border-border bg-card/60 h-full w-full items-center select-none", isMobile && mobileScreen !== "conversations" && "hidden")}>
        {/* Top Rail Controls */}
        <div className="flex flex-col items-center gap-2 p-2 border-b border-border/40 w-full shrink-0">
          {onToggleCollapse && (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onToggleCollapse}
                    className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all hover:scale-105"
                    aria-label="Expandir lista de conversas"
                  >
                    <CaretRight className="h-5 w-5" weight="bold" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Expandir lista de conversas</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Session Status Dot */}
          <div
            onClick={() => navigate("/connections")}
            className="cursor-pointer transition-transform hover:scale-125"
            title={
              activeSession?.isBanned || activeSession?.raw?.status === "banned" || activeSession?.status === "error"
                ? "Sessão Banida"
                : activeSession && isSessionActive(activeSession)
                ? "Sessão Conectada (ON)"
                : "Sessão Desconectada (OFF)"
            }
          >
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full inline-block border border-background shadow-xs",
                activeSession && isSessionActive(activeSession)
                  ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)] animate-pulse"
                  : "bg-amber-500"
              )}
            />
          </div>

          {/* Unread badge count if any */}
          {conversationCounts?.unread != null && conversationCounts.unread > 0 && (
            <span
              className="text-[9px] font-bold text-white bg-emerald-500 px-1 py-0.2 rounded-full min-w-[16px] text-center shadow-xs"
              title={`${conversationCounts.unread} mensagens não lidas`}
            >
              {conversationCounts.unread > 99 ? "99+" : conversationCounts.unread}
            </span>
          )}
        </div>

        {/* Scrollable Rail List */}
        <div ref={listContainerRef} className="min-h-0 flex-1 w-full overflow-hidden py-1">
          {loadingConversations ? (
            <div className="flex flex-col items-center gap-3 p-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-10 rounded-xl" />
              ))}
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-2 text-center text-muted-foreground/50 py-8">
              <ChatCircleDots className="h-6 w-6" />
            </div>
          ) : (
            <List
              rowComponent={CollapsedConversationRow}
              rowCount={filteredConversations.length}
              rowHeight={COLLAPSED_ROW_HEIGHT}
              rowProps={conversationRowData}
              style={{ height: dynamicHeight, width: "100%" }}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-0 flex-col border-r border-border bg-card/50 lg:overflow-auto h-full", isMobile && mobileScreen !== "conversations" && "hidden")}>
      <div className="space-y-2 border-b border-border p-3">
        <div className="flex items-center gap-2">
          {onToggleCollapse && (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onToggleCollapse}
                    className="h-9 w-9 shrink-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    title="Recolher painel de conversas"
                  >
                    <CaretLeft className="h-4 w-4" weight="bold" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Recolher painel</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <div className="flex-1">
            <ChatSearchBar
              value={searchQuery}
              onChange={(value) => setSearchQuery(value.slice(0, 100))}
              placeholder="Buscar conversas..."
            />
          </div>
          <Button
            type="button"
            variant={isMultiSelectMode ? "secondary" : "outline"}
            size="icon"
            onClick={() => {
              setIsMultiSelectMode((prev) => !prev);
              setSelectedChatIds([]);
            }}
            className={cn(
              "h-9 w-9 shrink-0 rounded-lg",
              isMultiSelectMode && "bg-primary/20 hover:bg-primary/30 text-primary border-primary/30"
            )}
            title={isMultiSelectMode ? "Desativar seleção em massa" : "Ativar seleção em massa"}
          >
            <Check className="h-4 w-4" weight={isMultiSelectMode ? "bold" : "regular"} />
          </Button>
        </div>
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList className="grid grid-cols-4 gap-1 w-full h-auto p-1 bg-muted/40 rounded-xl">
            <TabsTrigger
              value="all"
              className="flex flex-col items-center justify-center py-1 px-0.5 rounded-lg text-center transition-all min-w-0 data-[state=active]:font-bold data-[state=active]:bg-card data-[state=active]:shadow-xs"
            >
              <span className="text-[10.5px] leading-tight truncate w-full text-center tracking-tight">Todas</span>
              <span className="text-[10px] font-mono opacity-75 mt-0.5 leading-none">
                {conversationCounts?.active ?? 0}
              </span>
            </TabsTrigger>

            <TabsTrigger
              value="unread"
              className="flex flex-col items-center justify-center py-1 px-0.5 rounded-lg text-center transition-all min-w-0 data-[state=active]:font-bold data-[state=active]:bg-card data-[state=active]:shadow-xs"
            >
              <span className="text-[10.5px] leading-tight truncate w-full text-center tracking-tight">Não lidas</span>
              {conversationCounts?.unread != null && conversationCounts.unread > 0 ? (
                <span className="text-[10px] font-bold text-white bg-emerald-500 px-1.5 py-0.2 rounded-full shadow-[0_0_6px_rgba(16,185,129,0.7)] mt-0.5 leading-none">
                  {conversationCounts.unread}
                </span>
              ) : (
                <span className="text-[10px] font-mono opacity-50 mt-0.5 leading-none">0</span>
              )}
            </TabsTrigger>

            <TabsTrigger
              value="ai"
              className="flex flex-col items-center justify-center py-1 px-0.5 rounded-lg text-center transition-all min-w-0 data-[state=active]:font-bold data-[state=active]:bg-card data-[state=active]:shadow-xs"
            >
              <span className="text-[10.5px] leading-tight truncate w-full text-center tracking-tight">IA ativa</span>
              <span className="text-[10px] font-mono opacity-75 mt-0.5 leading-none">
                {aiCount ?? 0}
              </span>
            </TabsTrigger>

            <TabsTrigger
              value="archived"
              className="flex flex-col items-center justify-center py-1 px-0.5 rounded-lg text-center transition-all min-w-0 data-[state=active]:font-bold data-[state=active]:bg-card data-[state=active]:shadow-xs"
            >
              <span className="text-[10.5px] leading-tight truncate w-full text-center tracking-tight">Arquivadas</span>
              <span className="text-[10px] font-mono opacity-75 mt-0.5 leading-none">
                {conversationCounts?.archived ?? (filter === "archived" ? filteredConversations.length : 0)}
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Funnel Filter Bar Interativa com arrasto suave sem linha feia de scrollbar */}
        <div
          ref={funnelScrollRef}
          onMouseDown={handleFunnelMouseDown}
          onMouseLeave={handleFunnelMouseLeave}
          onMouseUp={handleFunnelMouseUp}
          onMouseMove={handleFunnelMouseMove}
          onWheel={handleFunnelWheel}
          className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1 px-0.5 text-[10px] select-none border-t border-border/30 pt-1.5 cursor-grab active:cursor-grabbing"
        >
          <button
            type="button"
            onClick={() => {
              if (hasDraggedFunnel.current) return;
              setFunnelFilter?.("all");
            }}
            className={cn(
              "px-2 py-0.5 rounded-full font-medium transition-all shrink-0 flex items-center gap-1 border",
              funnelFilter === "all"
                ? "bg-slate-900 text-white border-slate-900 font-bold shadow-xs dark:bg-primary/20 dark:text-primary dark:border-primary/40"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300 dark:bg-muted/30 dark:text-muted-foreground/80 dark:hover:bg-muted/60 dark:border-border/30"
            )}
          >
            <span>Todos</span>
            <span className="text-[9px] opacity-75 font-mono">{funnelCounts.all}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (hasDraggedFunnel.current) return;
              setFunnelFilter?.(funnelFilter === "chegou" ? "all" : "chegou");
            }}
            className={cn(
              "px-2 py-0.5 rounded-full font-medium transition-all shrink-0 flex items-center gap-1.5 border",
              funnelFilter === "chegou"
                ? "bg-emerald-600 text-white border-emerald-600 font-bold shadow-xs dark:bg-emerald-500/25 dark:text-emerald-300 dark:border-emerald-400 dark:shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border-emerald-300 dark:bg-muted/30 dark:text-emerald-400/90 dark:hover:bg-emerald-500/10 dark:border-border/30"
            )}
            title="Filtrar por Chegou (Novos leads / Não lidas)"
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", funnelFilter === "chegou" ? "bg-white dark:bg-emerald-400" : "bg-emerald-600 dark:bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.7)]")} />
            <span>Chegou</span>
            <span className="text-[9px] opacity-85 font-mono">{funnelCounts.chegou}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (hasDraggedFunnel.current) return;
              setFunnelFilter?.(funnelFilter === "rodando" ? "all" : "rodando");
            }}
            className={cn(
              "px-2 py-0.5 rounded-full font-medium transition-all shrink-0 flex items-center gap-1.5 border",
              funnelFilter === "rodando"
                ? "bg-amber-500 text-slate-950 border-amber-600 font-bold shadow-xs dark:bg-amber-500/25 dark:text-amber-300 dark:border-amber-400 dark:shadow-[0_0_8px_rgba(251,191,36,0.3)]"
                : "bg-amber-50 text-amber-900 hover:bg-amber-100 border-amber-300 dark:bg-muted/30 dark:text-amber-400/90 dark:hover:bg-amber-500/10 dark:border-border/30"
            )}
            title="Filtrar por Rodando (IA em atendimento ativo)"
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", funnelFilter === "rodando" ? "bg-slate-950 dark:bg-amber-300" : "bg-amber-600 dark:bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.7)]")} />
            <span>Rodando</span>
            <span className="text-[9px] opacity-85 font-mono">{funnelCounts.rodando}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (hasDraggedFunnel.current) return;
              setFunnelFilter?.(funnelFilter === "finalizado" ? "all" : "finalizado");
            }}
            className={cn(
              "px-2 py-0.5 rounded-full font-medium transition-all shrink-0 flex items-center gap-1.5 border",
              funnelFilter === "finalizado"
                ? "bg-blue-600 text-white border-blue-600 font-bold shadow-xs dark:bg-blue-600 dark:text-white dark:border-blue-400 dark:shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                : "bg-blue-50 text-blue-800 hover:bg-blue-100 border-blue-300 dark:bg-muted/30 dark:text-blue-400 dark:hover:bg-blue-500/10 dark:border-border/30"
            )}
            title="Filtrar por Aguardando Pagamento (Ficha gerada / aguardando pagamento)"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-80" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500" />
            </span>
            <span>Pagamento</span>
            <span className="text-[9px] opacity-85 font-mono">{funnelCounts.finalizado}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (hasDraggedFunnel.current) return;
              setFunnelFilter?.(funnelFilter === "pausado" ? "all" : "pausado");
            }}
            className={cn(
              "px-2 py-0.5 rounded-full font-medium transition-all shrink-0 flex items-center gap-1.5 border",
              funnelFilter === "pausado"
                ? "bg-rose-600 text-white border-rose-600 font-bold shadow-xs dark:bg-rose-500/25 dark:text-rose-300 dark:border-rose-400 dark:shadow-[0_0_8px_rgba(244,63,94,0.3)]"
                : "bg-rose-50 text-rose-800 hover:bg-rose-100 border-rose-300 dark:bg-muted/30 dark:text-rose-400/90 dark:hover:bg-rose-500/10 dark:border-border/30"
            )}
            title="Filtrar por Pausado (Operador humano / IA desligada)"
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", funnelFilter === "pausado" ? "bg-white dark:bg-rose-300" : "bg-rose-600 dark:bg-rose-500 shadow-[0_0_4px_rgba(244,63,94,0.7)]")} />
            <span>Pausado</span>
            <span className="text-[9px] opacity-85 font-mono">{funnelCounts.pausado}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (hasDraggedFunnel.current) return;
              setFunnelFilter?.(funnelFilter === "pago" ? "all" : "pago");
            }}
            className={cn(
              "px-2 py-0.5 rounded-full font-medium transition-all shrink-0 flex items-center gap-1.5 border",
              funnelFilter === "pago"
                ? "bg-teal-600 text-white border-teal-600 font-bold shadow-xs dark:bg-teal-500/25 dark:text-teal-300 dark:border-teal-400 dark:shadow-[0_0_8px_rgba(20,184,166,0.3)]"
                : "bg-teal-50 text-teal-800 hover:bg-teal-100 border-teal-300 dark:bg-muted/30 dark:text-teal-400/90 dark:hover:bg-teal-500/10 dark:border-border/30"
            )}
            title="Filtrar por Pago (Pedido aprovado / comprovante recebido)"
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", funnelFilter === "pago" ? "bg-white dark:bg-teal-300" : "bg-teal-600 dark:bg-teal-400 shadow-[0_0_4px_rgba(20,184,166,0.7)]")} />
            <span>Pago</span>
            <span className="text-[9px] opacity-85 font-mono">{funnelCounts.pago}</span>
          </button>
        </div>

        {isMultiSelectMode && (
          <div className="flex items-center justify-between px-2 py-1.5 text-xs text-muted-foreground border-b border-border/40 animate-fade-in bg-muted/10 rounded-md">
            <span>{selectedChatIds.length} selecionadas</span>
            <div className="flex gap-2">
              <button
                type="button"
                className="hover:text-foreground transition-colors font-medium"
                onClick={() => {
                  setSelectedChatIds(filteredConversations.map((c) => c.id));
                }}
              >
                Selecionar todas
              </button>
              <span className="text-muted-foreground/30">|</span>
              <button
                type="button"
                className="hover:text-foreground transition-colors font-medium text-destructive"
                onClick={() => {
                  setSelectedChatIds([]);
                }}
              >
                Limpar
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-0.5 pb-0.5">
          <div
            onClick={() => {
              navigate("/connections");
            }}
            className="cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <OperationalStatusBadge
              label={
                activeSession?.isBanned || activeSession?.raw?.status === "banned" || activeSession?.status === "error"
                  ? "Sessão Banida"
                  : activeSession && isSessionActive(activeSession)
                  ? "Sessão ON"
                  : "Sessão OFF"
              }
              tone={
                activeSession?.isBanned || activeSession?.raw?.status === "banned" || activeSession?.status === "error"
                  ? "offline"
                  : activeSession && isSessionActive(activeSession)
                  ? "online"
                  : "warning"
              }
              pulse={Boolean(activeSession && isSessionActive(activeSession))}
            />
          </div>

          <div className="flex items-center gap-2">
            {!(activeSession && isSessionActive(activeSession)) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 rounded-md px-2 text-[10px] font-semibold text-warning hover:bg-warning/10"
                onClick={() => navigate("/connections")}
              >
                Conectar
              </Button>
            )}

            {setShowGroups && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/20 rounded-lg border border-border/40 text-[11px] animate-fade-in">
                <span className="font-medium text-muted-foreground select-none">Grupos</span>
                <button
                  type="button"
                  onClick={() => setShowGroups(!showGroups)}
                  className={cn(
                    "relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                    showGroups ? "bg-primary" : "bg-muted"
                  )}
                  title={showGroups ? "Ocultar grupos" : "Exibir grupos"}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      showGroups ? "translate-x-3" : "translate-x-0"
                    )}
                  />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div ref={listContainerRef} className="min-h-0 flex-1 overflow-hidden p-2">
        {conversationsLoadFailed && filteredConversations.length > 0 && (
          <div className="mb-2 rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-sm text-muted-foreground">Falha temporária ao atualizar conversas. Mantendo os últimos dados em tela.</p>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={handleRetryConversations}>
              Tentar novamente
            </Button>
          </div>
        )}

        {loadingConversations ? (
          <div className="space-y-3 p-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-11 w-11 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-5/6" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          conversationsLoadFailed ? (
            <div className="rounded-lg border border-border bg-card p-4 text-center">
              <p className="text-sm text-muted-foreground">Falha ao carregar conversas. O backend está online, mas o banco local pode estar indisponível.</p>
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={handleRetryConversations}>
                Tentar novamente
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 gap-3 animate-fade-in">
              <div className="rounded-2xl bg-muted/30 p-4 ring-1 ring-border/40">
                <ChatCircleDots className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">Nenhuma conversa encontrada</p>
                <p className="mt-1 text-xs text-muted-foreground/70">Tente ajustar os filtros ou aguarde novas mensagens.</p>
              </div>
            </div>
          )
        ) : (
          <List
            rowComponent={ConversationRow}
            rowCount={filteredConversations.length}
            rowHeight={CONVERSATION_ROW_HEIGHT}
            rowProps={conversationRowData}
            style={{ height: dynamicHeight, width: "100%" }}
          />
        )}
      </div>

      {isMultiSelectMode && selectedChatIds.length > 0 && (
        <div className="border-t border-border bg-popover/80 backdrop-blur p-3 space-y-2 shrink-0 animate-slide-up shadow-lg">
          <p className="text-xs font-semibold text-foreground">{selectedChatIds.length} selecionadas</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs justify-start gap-1.5"
              onClick={handleBulkPin}
            >
              <Star className="h-3.5 w-3.5" />
              Fixar/Desfixar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs justify-start gap-1.5"
              onClick={handleBulkArchive}
            >
              <CaretRight className="h-3.5 w-3.5" />
              Arquivar/Des.
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs justify-start gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Etiquetar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {BUSINESS_TAG_OPTIONS.map((tag) => (
                  <DropdownMenuItem
                    key={tag}
                    onClick={() => handleBulkAddTag(tag)}
                    className="text-xs cursor-pointer py-1.5"
                  >
                    <TagIconBadge
                      tag={tag}
                      colorClass={getTagColor(tag)}
                      size="xs"
                      interactive={false}
                    />
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs justify-start gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleBulkDelete}
            >
              <Trash className="h-3.5 w-3.5" />
              Excluir
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-1.5 border-t border-border/40 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 text-xs w-full gap-1.5"
              onClick={handleBulkExportContacts}
            >
              Exportar Contatos
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 text-xs w-full gap-1.5"
              onClick={handleBulkLoadCampaign}
            >
              Carregar Disparos
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});
