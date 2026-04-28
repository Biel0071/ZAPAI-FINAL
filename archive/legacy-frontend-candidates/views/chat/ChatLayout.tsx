import { FormEvent } from 'react';
import { Badge } from '../../components/ui/Badge';
import { AiEngineStatus } from '../../lib/aiEngine';
import { ChatMessage, Conversation, QuickReply } from '../../types';
import { ConversationList } from './ConversationList';
import { MessageArea } from './MessageArea';
import { RightPanel } from './RightPanel';

type ChatLayoutProps = {
  aiStatus: AiEngineStatus | null;
  connectionStatus: 'offline' | 'connecting' | 'connected' | 'qr';
  conversations: Conversation[];
  conversationsError: string | null;
  draft: string;
  loadingConversations: boolean;
  loadingMessages: boolean;
  messages: ChatMessage[];
  messagesError: string | null;
  quickReplies: QuickReply[];
  search: string;
  selectedConversation: Conversation | null;
  selectedConversationId: string | null;
  typingText?: string;
  updatingConversationState: boolean;
  onAppendQuickReply: (content: string) => void;
  onDraftChange: (value: string) => void;
  onSearch: (value: string) => void;
  onSelectConversation: (id: string) => void;
  onSendMessage: (event: FormEvent<HTMLFormElement>) => void;
  onSendQuickReply: (content: string) => void;
  onSetConversationMode: (mode: 'ai' | 'human') => void;
  onToggleConversationAi: (value: boolean) => void;
};

function connectionLabel(status: ChatLayoutProps['connectionStatus']) {
  switch (status) {
    case 'connected':
      return 'WhatsApp conectado';
    case 'connecting':
      return 'Sincronizando sessao';
    case 'qr':
      return 'Aguardando leitura do QR';
    default:
      return 'Sessao offline';
  }
}

export function ChatLayout({
  aiStatus,
  connectionStatus,
  conversations,
  conversationsError,
  draft,
  loadingConversations,
  loadingMessages,
  messages,
  messagesError,
  quickReplies,
  search,
  selectedConversation,
  selectedConversationId,
  typingText,
  updatingConversationState,
  onAppendQuickReply,
  onDraftChange,
  onSearch,
  onSelectConversation,
  onSendMessage,
  onSendQuickReply,
  onSetConversationMode,
  onToggleConversationAi,
}: ChatLayoutProps) {
  return (
    <div className="space-y-4">
      <header className="crm-card flex flex-col gap-3 p-5 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-textPrimary">Inbox</h2>
          <p className="mt-1 text-sm text-textSecondary">
            Lista de conversas, painel de mensagens e acoes desacoplados, com fallback seguro para dados vazios.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="neutral">{conversations.length} conversas</Badge>
          <Badge
            variant={
              connectionStatus === 'connected'
                ? 'success'
                : connectionStatus === 'offline'
                  ? 'neutral'
                  : 'warning'
            }
          >
            {connectionLabel(connectionStatus)}
          </Badge>
          <Badge variant={aiStatus?.active ? 'success' : 'warning'}>
            {aiStatus?.active ? 'AI online' : 'AI fallback'}
          </Badge>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[320px,minmax(0,1fr),320px]">
        <ConversationList
          conversations={conversations}
          error={conversationsError}
          loading={loadingConversations}
          onSearch={onSearch}
          onSelectConversation={onSelectConversation}
          search={search}
          selectedConversationId={selectedConversationId}
        />

        <MessageArea
          connectionStatus={connectionStatus}
          conversation={selectedConversation}
          draft={draft}
          error={messagesError}
          loading={loadingMessages}
          messages={messages}
          onDraftChange={onDraftChange}
          onSendMessage={onSendMessage}
          typingText={typingText}
        />

        <RightPanel
          aiStatus={aiStatus}
          connectionStatus={connectionStatus}
          onAppendQuickReply={onAppendQuickReply}
          onSendQuickReply={onSendQuickReply}
          onSetConversationMode={onSetConversationMode}
          onToggleConversationAi={onToggleConversationAi}
          quickReplies={quickReplies}
          selectedConversation={selectedConversation}
          updatingConversationState={updatingConversationState}
        />
      </div>
    </div>
  );
}
