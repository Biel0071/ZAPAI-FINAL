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
import { cn } from "@/lib/utils";
import type { Conversation } from "@/services/apiService";
import type { ConversationControl } from "../types";
import {
  getInitials,
  formatTime,
  inferConversationMessageType,
  normalizeId,
  getTagColor,
} from "../utils";

export interface ConversationRowData {
  conversations: Conversation[];
  conversationControls: Record<string, ConversationControl>;
  globalAiEnabled: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  leadByConversationId: Record<string, any>;
  typingByConversationId?: Record<string, boolean>;
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
  const conversationAiAllowed = conversationControls[conversation.id]?.aiEnabled ?? conversation.aiEnabled ?? true;
  const aiEnabled = globalAiEnabled && conversationAiAllowed;
  const aiWaiting = !globalAiEnabled && conversationAiAllowed;
  const hasAttachment = Boolean(conversation.lastMessageType && conversation.lastMessageType !== "text");
  const wasAnsweredByAi = Boolean(conversation.isAI);
  const humanActive = Boolean(conversation.humanActive || conversation.controlMode === "human_active");
  const aiTooltip = aiWaiting ? "IA aguardando" : aiEnabled ? "Desativar IA" : "Ativar IA";

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
          "inbox-message w-full text-left rounded-lg flex items-center gap-3 px-3 py-2 group/row",
          "h-11 min-h-11 md:h-full md:min-h-0",
          !isMultiSelectMode && normalizeId(selectedId) === normalizeId(conversation.id) && "inbox-message-active"
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
          <Avatar className="h-11 w-11 border border-border/40">
            {conversation.avatar ? <AvatarImage src={conversation.avatar} alt={conversation.contactName} loading="lazy" /> : null}
            <AvatarFallback className="bg-primary/10 font-bold text-xs text-primary">{getInitials(conversation.contactName)}</AvatarFallback>
          </Avatar>
        </div>

        <div className="min-w-0 flex-1 flex flex-col justify-between h-full py-0.5">
          <div className="flex items-center justify-between gap-1">
            <h4 className="truncate text-xs md:text-sm font-semibold text-foreground/95 leading-none flex items-baseline gap-1.5 min-w-0">
              <span className="truncate">{conversation.contactName}</span>
              {conversation.phone && (
                <span className="text-[10px] font-normal text-muted-foreground/85 font-mono truncate hidden sm:inline">
                  {conversation.lid && conversation.phone !== conversation.lid ? (
                    `${conversation.lid}@lid`
                  ) : (
                    conversation.phone.includes("@lid") ? conversation.phone : `+${conversation.phone}`
                  )}
                </span>
              )}
            </h4>
            <div className="flex items-center gap-1.5 shrink-0">
              {pinnedChatIds.includes(conversation.id) && (
                <Star weight="fill" className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              )}
              <span className="text-[10px] text-muted-foreground/70">{formatTime(conversation.updatedAt)}</span>
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
            <div className="flex items-center justify-between gap-1">
              <p className="flex items-center gap-1 truncate text-xs text-muted-foreground/80 leading-normal min-w-0">
                {inferConversationMessageType(conversation) === "image" && <ImageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />}
                {inferConversationMessageType(conversation) === "video" && <VideoCamera className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />}
                {inferConversationMessageType(conversation) === "audio" && <Microphone className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />}
                {inferConversationMessageType(conversation) === "file" && <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground/60" />}
                {draftPreview ? (
                  <span className="truncate">
                    <span className="font-semibold text-primary">Rascunho:</span> {draftPreview}
                  </span>
                ) : (
                  <span className="truncate">{conversation.lastMessage || "Sem mensagens"}</span>
                )}
              </p>
              <div className="flex items-center gap-1 shrink-0">
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
                  <div className="opacity-0 group-hover/row:opacity-100 transition-opacity duration-200" data-dropdown-trigger>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50"
                          onClick={(e) => e.stopPropagation()}
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
                          {archivedChatIds.includes(conversation.id) ? (
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
                          <DropdownMenuSubContent className="w-40">
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
                                  className="text-xs cursor-pointer"
                                >
                                  {tag}
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
