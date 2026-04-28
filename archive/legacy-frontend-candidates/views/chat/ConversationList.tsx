import { useDeferredValue, useMemo } from 'react';
import { MonochromeIcon } from '../../components/icons/MonochromeIcon';
import { StatePanel } from '../../components/ui/StatePanel';
import { Conversation } from '../../types';
import { conversationDisplayName } from '../../utils/inbox';

type ConversationListProps = {
  conversations: Conversation[];
  selectedConversationId: string | null;
  search: string;
  loading: boolean;
  error: string | null;
  onSearch: (value: string) => void;
  onSelectConversation: (id: string) => void;
};

function getInitials(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return '??';
  }

  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function formatConversationTime(updatedAt?: string): string {
  if (!updatedAt) {
    return '';
  }

  const parsed = new Date(updatedAt);

  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  const now = new Date();
  const isSameDay =
    parsed.getDate() === now.getDate() &&
    parsed.getMonth() === now.getMonth() &&
    parsed.getFullYear() === now.getFullYear();

  return isSameDay
    ? parsed.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : parsed.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function ConversationList({
  conversations,
  selectedConversationId,
  search,
  loading,
  error,
  onSearch,
  onSelectConversation,
}: ConversationListProps) {
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const filtered = useMemo(() => {
    if (!deferredSearch) {
      return conversations;
    }

    return conversations.filter((conversation) => {
      const haystack = [
        conversationDisplayName(conversation),
        conversation.phone,
        conversation.lastMessage,
        conversation.assignedAgent,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(deferredSearch);
    });
  }, [conversations, deferredSearch]);

  return (
    <section className="crm-card flex h-[calc(100vh-196px)] flex-col p-3">
      <header className="mb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-textPrimary">Lista de conversas</h3>
            <p className="mt-1 text-xs text-textSecondary">
              Selecionada por `conversationId`, evitando lookup instavel por preview.
            </p>
          </div>
          <span className="rounded-full border border-borderSoft bg-panelSoft/80 px-2.5 py-1 text-[11px] text-textSecondary">
            {filtered.length}
          </span>
        </div>
      </header>

      <label className="mb-3 flex items-center gap-2 rounded-xl border border-borderSoft bg-panelSoft/80 px-3 py-2">
        <MonochromeIcon name="search" className="h-4 w-4 text-textMuted" />
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Buscar contato, numero ou ultima mensagem"
          className="w-full bg-transparent text-sm text-textPrimary outline-none placeholder:text-textMuted"
        />
      </label>

      {loading && conversations.length === 0 ? (
        <StatePanel
          compact
          tone="loading"
          title="Carregando conversas"
          description="O painel lateral permanece funcional mesmo antes do primeiro snapshot."
        />
      ) : null}

      {error ? (
        <div className="mb-3">
          <StatePanel compact tone="info" title="Fallback ativo" description={error} />
        </div>
      ) : null}

      <div className="flex-1 space-y-1.5 overflow-auto pr-1">
        {filtered.length === 0 ? (
          <StatePanel
            compact
            tone="empty"
            title="Nenhuma conversa encontrada"
            description="A busca nao encontrou resultados ou a base ainda nao retornou conversas validas."
          />
        ) : (
          filtered.map((conversation) => {
            const selected = selectedConversationId === conversation.id;
            const title = conversationDisplayName(conversation);

            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => onSelectConversation(conversation.id)}
                className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                  selected
                    ? 'border-slate-200/18 bg-slate-100/8'
                    : 'border-borderSoft bg-panelSoft/70 hover:border-slate-200/10 hover:bg-hoverSoft/80'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-borderSoft bg-panel text-xs font-semibold text-textPrimary">
                    {getInitials(title)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-textPrimary">{title}</p>
                      <span className="shrink-0 text-[11px] text-textMuted">
                        {formatConversationTime(conversation.updatedAt)}
                      </span>
                    </div>

                    <p className="mt-1 truncate text-xs text-textSecondary">
                      {conversation.lastMessage || 'Sem historico recente.'}
                    </p>

                    <div className="mt-2 flex items-center gap-2">
                      {conversation.assignedAgent ? (
                        <span className="rounded-full border border-borderSoft bg-panel px-2 py-1 text-[10px] text-textMuted">
                          {conversation.assignedAgent}
                        </span>
                      ) : null}
                      {(conversation.unread || 0) > 0 ? (
                        <span className="rounded-full border border-slate-100/15 bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-900">
                          {conversation.unread}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
