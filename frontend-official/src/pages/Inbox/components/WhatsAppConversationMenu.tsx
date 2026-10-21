import { memo } from "react";
import {
  Archive,
  PushPin,
  EnvelopeSimple,
  BellSimple,
  BellSimpleSlash,
  Tag,
  Robot,
  Trash,
  Check,
  ChatCircleDots,
} from "@phosphor-icons/react";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from "@/components/ui/context-menu";
import { cn } from "@/core/lib/utils";
import { TagIconBadge } from "@/components/inbox/TagIconBadge";
import { getTagColor } from "../utils";
import type { Conversation } from "@/core/services/apiService";

export const BUSINESS_TAG_OPTIONS = [
  "Novo Lead",
  "Cliente",
  "Orçamento",
  "Venda",
  "Suporte",
  "VIP",
  "Urgente",
] as const;

export interface WhatsAppConversationMenuProps {
  conversation: Conversation;
  isPinned: boolean;
  isArchived: boolean;
  isMuted?: boolean;
  aiEnabled: boolean;
  conversationAiAllowed: boolean;
  onSelect?: (id: string) => void;
  onTogglePin: (id: string) => void;
  onToggleArchive: (id: string) => void;
  onToggleMute?: (id: string) => void;
  onToggleUnread?: (id: string) => void;
  onSetConversationAiEnabled: (id: string, enabled: boolean) => void;
  onUpdateTags: (id: string, tags: string[]) => void;
  onDeleteConversation: (id: string) => void;
  showOpenChat?: boolean;
}

const MENU_CLASSES = {
  content:
    "w-60 p-1.5 bg-[#233138] border border-[#2a3942] text-[#d1d7db] shadow-2xl rounded-xl backdrop-blur-md select-none",
  item:
    "flex items-center gap-3.5 px-3 py-2 text-sm text-[#d1d7db] hover:text-white hover:bg-[#182229] focus:text-white focus:bg-[#182229] rounded-lg cursor-pointer transition-colors outline-none",
  itemDestructive:
    "flex items-center gap-3.5 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 focus:text-red-300 focus:bg-red-500/10 rounded-lg cursor-pointer transition-colors outline-none",
  icon: "h-4 w-4 shrink-0 text-[#8696a0]",
  separator: "my-1 border-t border-[#2a3942]/70",
  subContent:
    "w-48 p-1.5 bg-[#233138] border border-[#2a3942] text-[#d1d7db] shadow-2xl rounded-xl backdrop-blur-md select-none",
};

/**
 * Dropdown Menu content rendered when clicking the hover CaretDown button
 */
export const WhatsAppDropdownMenuContent = memo(function WhatsAppDropdownMenuContent({
  conversation,
  isPinned,
  isArchived,
  isMuted = false,
  aiEnabled,
  conversationAiAllowed,
  onSelect,
  onTogglePin,
  onToggleArchive,
  onToggleMute,
  onToggleUnread,
  onSetConversationAiEnabled,
  onUpdateTags,
  onDeleteConversation,
  showOpenChat = false,
}: WhatsAppConversationMenuProps) {
  const unreadCount = Number(conversation.unread ?? (conversation as any).unreadCount ?? (conversation as any).unread_count ?? 0);

  return (
    <DropdownMenuContent align="end" className={MENU_CLASSES.content}>
      {showOpenChat && onSelect && (
        <DropdownMenuItem
          className={MENU_CLASSES.item}
          onClick={() => onSelect(conversation.id)}
        >
          <ChatCircleDots className={MENU_CLASSES.icon} />
          <span>Abrir conversa</span>
        </DropdownMenuItem>
      )}

      {/* Arquivar / Desarquivar conversa */}
      <DropdownMenuItem
        className={MENU_CLASSES.item}
        onClick={() => onToggleArchive(conversation.id)}
      >
        <Archive className={MENU_CLASSES.icon} />
        <span>{isArchived ? "Desarquivar conversa" : "Arquivar conversa"}</span>
      </DropdownMenuItem>

      {/* Silenciar notificações */}
      <DropdownMenuItem
        className={MENU_CLASSES.item}
        onClick={() => onToggleMute?.(conversation.id)}
      >
        {isMuted ? (
          <BellSimple className={cn(MENU_CLASSES.icon, "text-amber-400")} weight="fill" />
        ) : (
          <BellSimpleSlash className={MENU_CLASSES.icon} />
        )}
        <span>{isMuted ? "Reativar notificações" : "Silenciar notificações"}</span>
      </DropdownMenuItem>

      {/* Fixar / Desfixar conversa */}
      <DropdownMenuItem
        className={MENU_CLASSES.item}
        onClick={() => onTogglePin(conversation.id)}
      >
        <PushPin
          className={cn(MENU_CLASSES.icon, isPinned && "text-amber-400")}
          weight={isPinned ? "fill" : "regular"}
        />
        <span>{isPinned ? "Desafixar conversa" : "Fixar conversa"}</span>
      </DropdownMenuItem>

      {/* Marcar como lida / não lida */}
      <DropdownMenuItem
        className={MENU_CLASSES.item}
        onClick={() => onToggleUnread?.(conversation.id)}
      >
        <EnvelopeSimple className={MENU_CLASSES.icon} />
        <span>{unreadCount > 0 ? "Marcar como lida" : "Marcar como não lida"}</span>
      </DropdownMenuItem>

      {/* Submenu de Etiquetas */}
      <DropdownMenuSub>
        <DropdownMenuSubTrigger className={MENU_CLASSES.item}>
          <Tag className={MENU_CLASSES.icon} />
          <span className="flex-1">Trocar Etiquetas</span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className={MENU_CLASSES.subContent}>
          {BUSINESS_TAG_OPTIONS.map((tag) => {
            const currentTags = conversation.tags ?? [];
            const hasTag = currentTags.includes(tag);
            return (
              <DropdownMenuItem
                key={tag}
                onClick={() => {
                  const nextTags = hasTag
                    ? currentTags.filter((t) => t !== tag)
                    : [...currentTags, tag];
                  onUpdateTags(conversation.id, nextTags);
                }}
                className={cn(MENU_CLASSES.item, "py-1.5 text-xs justify-between")}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <TagIconBadge
                    tag={tag}
                    colorClass={getTagColor(tag)}
                    size="xs"
                    showName={false}
                    interactive={false}
                  />
                  <span className="truncate">{tag}</span>
                </div>
                {hasTag && <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuSubContent>
      </DropdownMenuSub>

      {/* Controle de IA no Contato */}
      <DropdownMenuItem
        className={MENU_CLASSES.item}
        onClick={() => onSetConversationAiEnabled(conversation.id, !conversationAiAllowed)}
      >
        <Robot
          className={cn(MENU_CLASSES.icon, aiEnabled ? "text-emerald-400" : "text-[#8696a0]")}
          weight={aiEnabled ? "fill" : "regular"}
        />
        <span>{aiEnabled ? "Pausar IA no contato" : "Ativar IA no contato"}</span>
      </DropdownMenuItem>

      <DropdownMenuSeparator className={MENU_CLASSES.separator} />

      {/* Excluir Conversa */}
      <DropdownMenuItem
        className={MENU_CLASSES.itemDestructive}
        onClick={() => onDeleteConversation(conversation.id)}
      >
        <Trash className="h-4 w-4 shrink-0 text-red-400" />
        <span>Excluir conversa</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
});

/**
 * Context Menu content rendered when right-clicking on a conversation row
 */
export const WhatsAppContextMenuContent = memo(function WhatsAppContextMenuContent({
  conversation,
  isPinned,
  isArchived,
  isMuted = false,
  aiEnabled,
  conversationAiAllowed,
  onSelect,
  onTogglePin,
  onToggleArchive,
  onToggleMute,
  onToggleUnread,
  onSetConversationAiEnabled,
  onUpdateTags,
  onDeleteConversation,
  showOpenChat = false,
}: WhatsAppConversationMenuProps) {
  const unreadCount = Number(conversation.unread ?? (conversation as any).unreadCount ?? (conversation as any).unread_count ?? 0);

  return (
    <ContextMenuContent className={MENU_CLASSES.content}>
      {showOpenChat && onSelect && (
        <ContextMenuItem
          className={MENU_CLASSES.item}
          onClick={() => onSelect(conversation.id)}
        >
          <ChatCircleDots className={MENU_CLASSES.icon} />
          <span>Abrir conversa</span>
        </ContextMenuItem>
      )}

      {/* Arquivar / Desarquivar conversa */}
      <ContextMenuItem
        className={MENU_CLASSES.item}
        onClick={() => onToggleArchive(conversation.id)}
      >
        <Archive className={MENU_CLASSES.icon} />
        <span>{isArchived ? "Desarquivar conversa" : "Arquivar conversa"}</span>
      </ContextMenuItem>

      {/* Silenciar notificações */}
      <ContextMenuItem
        className={MENU_CLASSES.item}
        onClick={() => onToggleMute?.(conversation.id)}
      >
        {isMuted ? (
          <BellSimple className={cn(MENU_CLASSES.icon, "text-amber-400")} weight="fill" />
        ) : (
          <BellSimpleSlash className={MENU_CLASSES.icon} />
        )}
        <span>{isMuted ? "Reativar notificações" : "Silenciar notificações"}</span>
      </ContextMenuItem>

      {/* Fixar / Desfixar conversa */}
      <ContextMenuItem
        className={MENU_CLASSES.item}
        onClick={() => onTogglePin(conversation.id)}
      >
        <PushPin
          className={cn(MENU_CLASSES.icon, isPinned && "text-amber-400")}
          weight={isPinned ? "fill" : "regular"}
        />
        <span>{isPinned ? "Desafixar conversa" : "Fixar conversa"}</span>
      </ContextMenuItem>

      {/* Marcar como lida / não lida */}
      <ContextMenuItem
        className={MENU_CLASSES.item}
        onClick={() => onToggleUnread?.(conversation.id)}
      >
        <EnvelopeSimple className={MENU_CLASSES.icon} />
        <span>{unreadCount > 0 ? "Marcar como lida" : "Marcar como não lida"}</span>
      </ContextMenuItem>

      {/* Submenu de Etiquetas */}
      <ContextMenuSub>
        <ContextMenuSubTrigger className={MENU_CLASSES.item}>
          <Tag className={MENU_CLASSES.icon} />
          <span className="flex-1">Trocar Etiquetas</span>
        </ContextMenuSubTrigger>
        <ContextMenuSubContent className={MENU_CLASSES.subContent}>
          {BUSINESS_TAG_OPTIONS.map((tag) => {
            const currentTags = conversation.tags ?? [];
            const hasTag = currentTags.includes(tag);
            return (
              <ContextMenuItem
                key={tag}
                onClick={() => {
                  const nextTags = hasTag
                    ? currentTags.filter((t) => t !== tag)
                    : [...currentTags, tag];
                  onUpdateTags(conversation.id, nextTags);
                }}
                className={cn(MENU_CLASSES.item, "py-1.5 text-xs justify-between")}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <TagIconBadge
                    tag={tag}
                    colorClass={getTagColor(tag)}
                    size="xs"
                    showName={false}
                    interactive={false}
                  />
                  <span className="truncate">{tag}</span>
                </div>
                {hasTag && <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
              </ContextMenuItem>
            );
          })}
        </ContextMenuSubContent>
      </ContextMenuSub>

      {/* Controle de IA no Contato */}
      <ContextMenuItem
        className={MENU_CLASSES.item}
        onClick={() => onSetConversationAiEnabled(conversation.id, !conversationAiAllowed)}
      >
        <Robot
          className={cn(MENU_CLASSES.icon, aiEnabled ? "text-emerald-400" : "text-[#8696a0]")}
          weight={aiEnabled ? "fill" : "regular"}
        />
        <span>{aiEnabled ? "Pausar IA no contato" : "Ativar IA no contato"}</span>
      </ContextMenuItem>

      <ContextMenuSeparator className={MENU_CLASSES.separator} />

      {/* Excluir Conversa */}
      <ContextMenuItem
        className={MENU_CLASSES.itemDestructive}
        onClick={() => onDeleteConversation(conversation.id)}
      >
        <Trash className="h-4 w-4 shrink-0 text-red-400" />
        <span>Excluir conversa</span>
      </ContextMenuItem>
    </ContextMenuContent>
  );
});
