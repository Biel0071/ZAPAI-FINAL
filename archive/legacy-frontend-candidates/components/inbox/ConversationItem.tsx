import clsx from 'clsx';
import { Conversation } from '../../types';

interface ConversationItemProps {
  conversation: Conversation;
  selected: boolean;
  onSelect: (conversationId: string) => void;
}

function getConversationTitle(conversation: Conversation): string {
  return conversation.contactName || conversation.name || conversation.phone;
}

export function ConversationItem({ conversation, selected, onSelect }: ConversationItemProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(conversation.id)}
      className={clsx(
        'w-full rounded-lg border px-3 py-2 text-left transition',
        selected ? 'border-accent bg-accent/20' : 'border-borderSoft bg-panelSoft hover:bg-slate-800',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-sm font-medium text-slate-100">{getConversationTitle(conversation)}</p>
        {(conversation.unread || 0) > 0 ? (
          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-white">{conversation.unread}</span>
        ) : null}
      </div>
      <p className="truncate text-xs text-slate-400">{conversation.lastMessage || 'Sem mensagens'}</p>
    </button>
  );
}
