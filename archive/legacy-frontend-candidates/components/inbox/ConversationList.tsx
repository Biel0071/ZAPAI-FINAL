import { TextInput } from '../ui/FormField';
import { Conversation } from '../../types';
import { ConversationItem } from './ConversationItem';

interface ConversationListProps {
  conversations: Conversation[];
  selectedConversationId: string | null;
  searchQuery: string;
  onSearch: (value: string) => void;
  onSelect: (conversationId: string) => void;
}

export function ConversationList({
  conversations,
  selectedConversationId,
  searchQuery,
  onSearch,
  onSelect,
}: ConversationListProps) {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filtered = conversations.filter((item) => {
    if (!normalizedQuery) {
      return true;
    }

    const haystack = `${item.contactName || item.name || ''} ${item.phone} ${item.lastMessage || ''}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  return (
    <div className="space-y-3">
      <TextInput placeholder="Buscar conversa" value={searchQuery} onChange={(event) => onSearch(event.target.value)} />

      <div className="max-h-[650px] space-y-2 overflow-auto">
        {filtered.length === 0 ? (
          <p className="rounded-lg border border-borderSoft bg-panelSoft px-3 py-6 text-center text-xs text-slate-400">
            Nenhuma conversa encontrada.
          </p>
        ) : (
          filtered.map((conversation) => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
              selected={selectedConversationId === conversation.id}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}
