import { ReactNode } from 'react';
import { Conversation, ChatMessage } from '../../types';
import { MessageBubble } from './MessageBubble';

interface ChatWindowProps {
  conversation: Conversation | null;
  messages: ChatMessage[];
  loading?: boolean;
  composer: ReactNode;
}

function getConversationTitle(conversation: Conversation): string {
  return conversation.contactName || conversation.name || conversation.phone;
}

export function ChatWindow({ conversation, messages, loading, composer }: ChatWindowProps) {
  if (!conversation) {
    return <p className="text-sm text-slate-400">Selecione uma conversa para comecar.</p>;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 border-b border-borderSoft pb-2">
        <h3 className="text-sm font-semibold text-slate-100">{getConversationTitle(conversation)}</h3>
        <p className="text-xs text-slate-400">{conversation.phone}</p>
      </div>

      {loading ? <p className="mb-2 text-xs text-slate-400">Carregando mensagens...</p> : null}

      <div className="mb-3 max-h-[520px] flex-1 space-y-2 overflow-auto rounded-lg border border-borderSoft p-3">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>

      {composer}
    </div>
  );
}
