import { useState, useEffect, useMemo } from "react";
import type { RowComponentProps } from "react-window";
import {
  Star,
  Paperclip,
  Robot,
  User,
  DotsThreeVertical,
  Trash,
  Plus,
  CaretRight,
  CaretLeft,
  ImageSquare,
  VideoCamera,
  Microphone,
  Sparkle,
} from "@phosphor-icons/react";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/core/lib/utils";
import type { Conversation } from "@/core/services/apiService";
import type { ConversationControl } from "../types";
import { useAiCountdown } from "@/state/hooks/useAiCountdown";
import {
  getInitials,
  formatTime,
  formatConversationTimestamp,
  inferConversationMessageType,
  normalizeId,
  getTagColor,
  formatPhoneNumber,
} from "../utils";
import { useResolvedAvatar } from "@/hooks/useResolvedAvatar";
import { TagIconBadge } from "@/components/inbox/TagIconBadge";
import { getTagEmoji, cleanTagName } from "@/core/utils/tagEmojis";

export interface ConversationRowData {
  conversations: Conversation[];
  conversationControls: Record<string, ConversationControl>;
  globalAiEnabled: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  leadByConversationId: Record<string, any>;
  typingByConversationId?: Record<string, boolean | "composing" | "recording">;
  draftsByConversationId?: Record<string, { draft: string; timestamp: number }>;
  pinnedChatIds: string[];
  onTogglePin: (id: string) => void;
  archivedChatIds: string[];
  onToggleArchive: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onSetConversationAiEnabled: (id: string, enabled: boolean) => void;
  isMultiSelectMode: boolean;
  selectedChatIds: string[];
  onToggleSelect: (id: string) => void;
  onUpdateTags: (id: string, tags: string[]) => void;
}

const BUSINESS_TAG_OPTIONS = ["Novo Lead", "Cliente", "Orçamento", "Venda", "Suporte", "VIP", "Urgente"] as const;

export function ConversationRow(props: RowComponentProps<ConversationRowData>) {
  const { index, style, ...data } = props;
  const {
    conversations,
    conversationControls,
    globalAiEnabled,
    selectedId,
    onSelect,
    typingByConversationId,
    draftsByConversationId,
    pinnedChatIds,
    onTogglePin,
    archivedChatIds,
    onToggleArchive,
    onDeleteConversation,
    onSetConversationAiEnabled,
    isMultiSelectMode,
    selectedChatIds,
    onToggleSelect,
    onUpdateTags,
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

  const [tagVersion, setTagVersion] = useState(0);

  useEffect(() => {
    const handleUpdate = () => setTagVersion((v) => v + 1);
    if (typeof window !== "undefined") {
      window.addEventListener("zapflow:tag-icons-updated", handleUpdate);
      return () => window.removeEventListener("zapflow:tag-icons-updated", handleUpdate);
    }
  }, []);

  const tagEmojis = useMemo(() => {
    if (!conversation.tags || !Array.isArray(conversation.tags) || conversation.tags.length === 0) {
      return [];
    }
    const results: { tag: string; emoji: string; name: string }[] = [];
    for (const t of conversation.tags) {
      const emoji = getTagEmoji(t);
      if (emoji) {
        results.push({
          tag: t,
          emoji,
          name: cleanTagName(t) || t,
        });
      }
    }
    return results;
  }, [conversation.tags, tagVersion]);
  
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
  const draftPreview = draftsByConversationId?.[conversation.id]?.draft?.trim() || "";
  const isSelected = selectedChatIds.includes(conversation.id);
  const { timeLeft, isWaiting: isAiCountdownActive } = useAiCountdown(conversation.ai_reactivate_at);
  const conversationAiAllowed = conversationControls[conversation.id]?.aiEnabled ?? conversation.aiEnabled ?? true;
  const aiEnabled = globalAiEnabled && conversationAiAllowed;
  const aiWaiting = !globalAiEnabled && conversationAiAllowed;
  const hasAttachment = Boolean(conversation.lastMessageType && conversation.lastMessageType !== "text");
  const wasAnsweredByAi = Boolean(conversation.isAI);
  const humanActive = Boolean(conversation.humanActive || conversation.controlMode === "human_active");
  const aiTooltip = !globalAiEnabled 
    ? "IA pausada globalmente" 
    : isAiCountdownActive 
      ? `IA inativa (retorna em ${timeLeft})` 
      : conversationAiAllowed 
        ? "Desativar IA" 
        : "Ativar IA";

  const leadStatus = useMemo(() => {
    const tags = Array.isArray(conversation.tags) ? conversation.tags : [];
    const status = String(conversation.status || "").toLowerCase();
    const funnelStage = String((conversation as any).funnel_stage || (conversation as any).funnelStage || "").toLowerCase();
    const leadTemp = String((conversation as any).lead_temperature || (conversation as any).leadTemperature || "").toLowerCase();
    const hasSheet = Boolean((conversation as any).hasSheet || (conversation as any).orderSheet);

    // 1. AZUL PISCANDO: Atendimento finalizado / Ficha gerada aguardando PIX
    const isFinalizado =
      tags.some((t) => {
        const lower = String(t).toLowerCase();
        return (
          lower.includes("aguarda_pix") ||
          lower.includes("pix") ||
          lower.includes("finalizado") ||
          lower.includes("fechamento")
        );
      }) ||
      status === "aguarda_pix" ||
      status === "finalizado" ||
      status === "closed_won" ||
      funnelStage === "fechamento" ||
      funnelStage === "aguarda_pix";

    if (isFinalizado) {
      return {
        state: "finalizado" as const,
        label: "Aguarda PIX",
        tooltip: "Atendimento finalizado com Ficha de Pedido — Aguardando PIX do cliente",
        dotColor: "bg-blue-500",
        ping: true,
      };
    }

    // 2. VERMELHO: Pausado / Atendimento Humano
    const isPaused =
      humanActive ||
      !globalAiEnabled ||
      !conversationAiAllowed ||
      status === "paused" ||
      status === "pending_human" ||
      tags.some((t) => String(t).toLowerCase().includes("pausado") || String(t).toLowerCase().includes("humano"));

    if (isPaused) {
      return {
        state: "pausado" as const,
        label: "Pausado",
        tooltip: "Atendimento pausado — Operador humano no controle",
        dotColor: "bg-rose-500",
        ping: false,
      };
    }

    // 3. VERDE: Chegou / Novo Lead / Frio
    const isChegou =
      (conversation.unread ?? 0) > 0 ||
      funnelStage === "new_lead" ||
      funnelStage === "lead" ||
      leadTemp === "cold" ||
      tags.some((t) => {
        const lower = String(t).toLowerCase();
        return lower.includes("novo") || lower.includes("chegou") || lower.includes("primeiro");
      });

    if (isChegou) {
      return {
        state: "chegou" as const,
        label: "Chegou",
        tooltip: "Novo lead recebido do tráfego / Mensagem não lida",
        dotColor: "bg-emerald-500",
        ping: false,
      };
    }

    // 4. AMARELO: Rodando / IA em Atendimento Ativo
    return {
      state: "rodando" as const,
      label: "Rodando",
      tooltip: "Atendimento em andamento pela IA (anúncio rodando)",
      dotColor: "bg-amber-400",
      ping: false,
    };
  }, [
    conversation.tags,
    conversation.status,
    (conversation as any).funnel_stage,
    (conversation as any).funnelStage,
    (conversation as any).lead_temperature,
    (conversation as any).leadTemperature,
    (conversation as any).hasSheet,
    (conversation as any).orderSheet,
    humanActive,
    globalAiEnabled,
    conversationAiAllowed,
    conversation.unread,
  ]);

  const handleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-radix-menu-content]") || (e.target as HTMLElement).closest("[data-dropdown-trigger]")) {
      return;
    }
    if (isMultiSelectMode) {
      onToggleSelect(conversation.id);
    } else {
      onSelect(conversation.id);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    if (isMultiSelectMode) {
      onToggleSelect(conversation.id);
    } else {
      onSelect(conversation.id);
    }
  };

  return (
    <div style={style} className="px-1 py-0.5">
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "inbox-message w-full text-left rounded-lg flex items-center gap-3 px-3 py-2 group/row transition-all duration-200",
          "h-full min-h-0",
          !isMultiSelectMode && normalizeId(selectedId) === normalizeId(conversation.id) && "inbox-message-active",
          leadStatus.state === "finalizado" && "border border-blue-500/50 bg-blue-500/[0.06] shadow-[0_0_14px_rgba(59,130,246,0.25)]"
        )}
      >
        {isMultiSelectMode && (
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect(conversation.id)}
            className="shrink-0 border-muted-foreground/60 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            onClick={(e) => e.stopPropagation()}
          />
        )}

        <div className="relative shrink-0 flex items-center">
          <Avatar className="h-12 w-12 border border-border/40 shrink-0">
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

          {/* Indicador Visual: Verde (Chegou), Amarelo (Rodando), Vermelho (Pausado), Azul Piscando (Finalizado / Aguarda PIX) */}
          <div className="absolute -bottom-0.5 -right-0.5 z-10 flex items-center justify-center pointer-events-none">
            {leadStatus.ping ? (
              <span className="relative flex h-3.5 w-3.5" title={leadStatus.tooltip}>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-80" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-blue-600 border-2 border-background shadow-[0_0_10px_rgba(37,99,235,0.9)]" />
              </span>
            ) : (
              <span
                className={cn(
                  "inline-flex rounded-full h-3.5 w-3.5 border-2 border-background",
                  leadStatus.dotColor,
                  leadStatus.state === "chegou" && "shadow-[0_0_6px_rgba(16,185,129,0.7)]",
                  leadStatus.state === "rodando" && "shadow-[0_0_6px_rgba(251,191,36,0.7)]",
                  leadStatus.state === "pausado" && "shadow-[0_0_6px_rgba(244,63,94,0.7)]"
                )}
                title={leadStatus.tooltip}
              />
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1 flex flex-col justify-between h-full py-0.5">
          <div className="flex items-center justify-between gap-1.5">
            <h4 className="text-xs md:text-sm font-semibold text-foreground/95 leading-none flex items-center gap-1.5 min-w-0 flex-1">
              <span className="truncate min-w-0">{cleanDisplayName}</span>
              {leadStatus.state === "finalizado" && (
                <span
                  title={leadStatus.tooltip}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500 text-white border border-blue-400 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.6)] shrink-0"
                >
                  <Sparkle weight="fill" className="h-2.5 w-2.5 text-yellow-300" />
                  AGUARDA PIX
                </span>
              )}
              {tagEmojis.length > 0 && (
                <span className="inline-flex items-center gap-1 shrink-0 ml-0.5">
                  {tagEmojis.slice(0, 3).map((item, idx) => (
                    <span
                      key={idx}
                      title={item.name}
                      className="text-xs md:text-sm leading-none select-none inline-block hover:scale-110 transition-transform cursor-default"
                    >
                      {item.emoji}
                    </span>
                  ))}
                  {tagEmojis.length > 3 && (
                    <span className="text-[10px] text-muted-foreground/70 font-mono font-normal">
                      +{tagEmojis.length - 3}
                    </span>
                  )}
                </span>
              )}
            </h4>
            <div className="flex items-center gap-1.5 shrink-0 ml-1">
              {pinnedChatIds.includes(conversation.id) && (
                <Star weight="fill" className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              )}
              <span className="text-[10px] text-muted-foreground/70 font-medium tabular-nums">
                {formatConversationTimestamp((conversation as any).lastMessageAt || (conversation as any).lastInteractionAt || (conversation as any).timestamp || conversation.updatedAt)}
              </span>
            </div>
          </div>

          {isTyping ? (
            <div className="flex items-center justify-between gap-1">
              <span className="truncate text-xs text-emerald-400 font-semibold leading-normal animate-pulse">
                {typingState === "recording" ? "gravando áudio..." : "digitando..."}
              </span>
              {(conversation.unread ?? 0) > 0 && (
                <span className="h-5 min-w-[20px] rounded-full px-1.5 py-0.5 flex items-center justify-center text-[10px] font-bold text-white bg-emerald-500 shrink-0">
                  {conversation.unread}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-1.5">
              <p className="flex items-center gap-1 truncate text-xs text-muted-foreground/80 leading-normal min-w-0 flex-1">
                {inferConversationMessageType(conversation) === "image" && <ImageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />}
                {inferConversationMessageType(conversation) === "video" && <VideoCamera className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />}
                {inferConversationMessageType(conversation) === "audio" && <Microphone className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />}
                {inferConversationMessageType(conversation) === "file" && <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground/60" />}
                {draftPreview ? (
                  <span className="truncate min-w-0">
                    <span className="font-semibold text-primary">Rascunho:</span> {draftPreview}
                  </span>
                ) : (
                  <span className="truncate min-w-0">{conversation.lastMessage || "Sem mensagens"}</span>
                )}
              </p>
              <div className="flex items-center gap-1 shrink-0 pr-0.5">
                <span className="flex items-center gap-0.5 text-muted-foreground/70">
                  <TooltipProvider delayDuration={120}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            "inline-flex h-5 w-5 items-center justify-center rounded-full text-[12px] transition-all duration-200 hover:scale-105 hover:bg-muted",
                            aiWaiting ? "text-amber-400" : aiEnabled ? "text-emerald-400" : "text-red-400",
                          )}
                          aria-label={aiTooltip}
                          onClick={(event) => {
                            event.stopPropagation();
                            onSetConversationAiEnabled(conversation.id, !conversationAiAllowed);
                          }}
                        >
                          <Robot className="h-4 w-4 shrink-0" aria-hidden />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{aiTooltip}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  {isAiCountdownActive && timeLeft && (
                    <span className="text-[10px] font-medium text-amber-500 bg-amber-500/10 px-1 rounded truncate max-w-[60px]" title={`Retorna em ${timeLeft}`}>
                      {timeLeft}
                    </span>
                  )}
                  {hasAttachment && <Paperclip className="h-3 w-3" aria-label="Possui anexos" />}
                  {wasAnsweredByAi && <Robot className="h-3 w-3 text-sky-400" aria-label="Respondido pela IA" />}
                  {humanActive && <User className="h-3 w-3 text-amber-400" aria-label="Atendimento humano" />}
                </span>
                {(conversation.unread ?? 0) > 0 && (
                  <span className="h-5 min-w-[20px] rounded-full px-1.5 py-0.5 flex items-center justify-center text-[10px] font-bold text-white bg-emerald-500 shrink-0">
                    {conversation.unread}
                  </span>
                )}

                {!isMultiSelectMode && (
                  <div className="opacity-100 sm:opacity-0 sm:group-hover/row:opacity-100 focus-within:opacity-100 data-[state=open]:opacity-100 transition-opacity duration-150 flex items-center" data-dropdown-trigger>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Mais opções da conversa"
                        >
                          <DotsThreeVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          className="flex items-center gap-2 text-xs cursor-pointer text-foreground hover:bg-muted"
                          onClick={() => onTogglePin(conversation.id)}
                        >
                          <Star className="h-3.5 w-3.5" weight={pinnedChatIds.includes(conversation.id) ? "fill" : "regular"} />
                          {pinnedChatIds.includes(conversation.id) ? "Desfixar" : "Fixar"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="flex items-center gap-2 text-xs cursor-pointer text-foreground hover:bg-muted"
                          onClick={() => onToggleArchive(conversation.id)}
                        >
                          {(archivedChatIds.includes(conversation.id) || String(conversation.status).toLowerCase() === 'archived') ? (
                            <>
                              <CaretLeft className="h-3.5 w-3.5" />
                              Desarquivar
                            </>
                          ) : (
                            <>
                              <CaretRight className="h-3.5 w-3.5" />
                              Arquivar
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger className="flex items-center gap-2 text-xs cursor-pointer text-foreground hover:bg-muted">
                            <Plus className="h-3.5 w-3.5" />
                            Trocar Etiqueta
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-48">
                            {BUSINESS_TAG_OPTIONS.map((tag) => {
                              const hasTag = (conversation.tags ?? []).includes(tag);
                              return (
                                <DropdownMenuCheckboxItem
                                  key={tag}
                                  checked={hasTag}
                                  onCheckedChange={(checked) => {
                                    const currentTags = conversation.tags ?? [];
                                    const nextTags = checked
                                      ? [...currentTags, tag]
                                      : currentTags.filter((t) => t !== tag);
                                    onUpdateTags(conversation.id, nextTags);
                                  }}
                                  className="text-xs cursor-pointer py-1.5"
                                >
                                  <TagIconBadge
                                    tag={tag}
                                    colorClass={getTagColor(tag)}
                                    size="xs"
                                    interactive={false}
                                  />
                                </DropdownMenuCheckboxItem>
                              );
                            })}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuSeparator className="border-t border-border/40 my-1" />
                        <DropdownMenuItem
                          className="flex items-center gap-2 text-xs cursor-pointer text-destructive hover:bg-destructive/10 focus:bg-destructive/10 focus:text-destructive"
                          onClick={() => onDeleteConversation(conversation.id)}
                        >
                          <Trash className="h-3.5 w-3.5" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
