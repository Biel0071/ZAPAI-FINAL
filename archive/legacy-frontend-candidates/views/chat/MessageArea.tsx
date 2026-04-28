import { ChangeEvent, FormEvent, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MonochromeIcon } from '../../components/icons/MonochromeIcon';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { StatePanel } from '../../components/ui/StatePanel';
import { ChatMessage, Conversation } from '../../types';
import { conversationDisplayName, resolveMediaUrl, toUnixMillis } from '../../utils/inbox';

type MessageAreaProps = {
  conversation: Conversation | null;
  messages: ChatMessage[];
  draft: string;
  connectionStatus: 'offline' | 'connecting' | 'connected' | 'qr';
  typingText?: string;
  loading: boolean;
  error: string | null;
  onDraftChange: (value: string) => void;
  onSendMessage: (event: FormEvent<HTMLFormElement>) => void;
};

type MediaModalState =
  | {
      type: 'image' | 'video';
      url: string;
    }
  | null;

function formatMessageTime(message: ChatMessage) {
  const parsed = new Date(toUnixMillis(message.timestamp || message.createdAt));

  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function normalizeMessageType(message: ChatMessage) {
  const raw = String(message.type || message.mediaType || 'text').toLowerCase();

  if (raw.includes('image')) return 'image';
  if (raw.includes('video')) return 'video';
  if (raw.includes('audio')) return 'audio';
  if (raw.includes('document') || raw.includes('file')) return 'document';
  return 'text';
}

function statusLabel(status: MessageAreaProps['connectionStatus']) {
  switch (status) {
    case 'connected':
      return 'Online';
    case 'connecting':
      return 'Conectando';
    case 'qr':
      return 'Aguardando QR';
    default:
      return 'Offline';
  }
}

function statusVariant(status: MessageAreaProps['connectionStatus']) {
  switch (status) {
    case 'connected':
      return 'success';
    case 'connecting':
    case 'qr':
      return 'warning';
    default:
      return 'neutral';
  }
}

function MessageStatus({ status }: { status?: string }) {
  const normalized = String(status || 'sent').toLowerCase();
  const label =
    normalized === 'read'
      ? 'Lido'
      : normalized === 'delivered'
        ? 'Entregue'
        : normalized === 'failed'
          ? 'Falhou'
          : 'Enviado';

  return <span className="text-[10px] text-textMuted">{label}</span>;
}

function AttachmentContent({
  message,
  onOpenMedia,
}: {
  message: ChatMessage;
  onOpenMedia: (type: 'image' | 'video', url: string) => void;
}) {
  const type = normalizeMessageType(message);
  const url = resolveMediaUrl(message.url || message.mediaUrl || message.mediaPath || null);
  const body = message.content || message.text || message.caption || '';

  if (type === 'image' && url) {
    return (
      <button type="button" onClick={() => onOpenMedia('image', url)} className="block w-full overflow-hidden rounded-xl bg-black/15">
        <img src={url} alt={body || 'Imagem'} className="max-h-72 w-full object-cover" loading="lazy" />
      </button>
    );
  }

  if (type === 'video' && url) {
    return (
      <video
        src={url}
        controls
        className="max-h-72 w-full rounded-xl bg-black"
        preload="metadata"
        onClick={() => onOpenMedia('video', url)}
      />
    );
  }

  if (type === 'audio' && url) {
    return <audio src={url} controls preload="metadata" className="max-w-full" />;
  }

  if (type === 'document' && url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-xl border border-borderSoft bg-panel px-3 py-2 text-sm text-textPrimary"
      >
        <MonochromeIcon name="attachment" className="h-4 w-4" />
        Abrir arquivo
      </a>
    );
  }

  return <p className="whitespace-pre-wrap text-sm leading-6">{body || 'Mensagem sem conteudo.'}</p>;
}

const MessageBubble = memo(function MessageBubble({
  message,
  onOpenMedia,
}: {
  message: ChatMessage;
  onOpenMedia: (type: 'image' | 'video', url: string) => void;
}) {
  return (
    <div className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[82%] rounded-2xl border px-3 py-2.5 ${
          message.fromMe
            ? 'border-slate-100/16 bg-slate-100/8 text-textPrimary'
            : 'border-borderSoft bg-panel text-textPrimary'
        }`}
      >
        {!message.fromMe && message.isGroup && message.participant ? (
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-textMuted">
            {message.participant}
          </p>
        ) : null}

        <AttachmentContent message={message} onOpenMedia={onOpenMedia} />

        <div className="mt-2 flex items-center justify-end gap-2">
          <span className="text-[10px] text-textMuted">{formatMessageTime(message)}</span>
          {message.fromMe ? <MessageStatus status={message.status} /> : null}
        </div>
      </div>
    </div>
  );
});

export function MessageArea({
  conversation,
  messages,
  draft,
  connectionStatus,
  typingText,
  loading,
  error,
  onDraftChange,
  onSendMessage,
}: MessageAreaProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previousMessageCountRef = useRef(0);
  const isAtBottomRef = useRef(true);
  const [pendingMessages, setPendingMessages] = useState(0);
  const [mediaModal, setMediaModal] = useState<MediaModalState>(null);

  const visibleMessages = useMemo(() => messages || [], [messages]);
  const canSend = Boolean(conversation) && connectionStatus === 'connected' && draft.trim().length > 0;

  useEffect(() => {
    const container = scrollRef.current;

    if (!container || !isAtBottomRef.current) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [visibleMessages]);

  useEffect(() => {
    if (visibleMessages.length > previousMessageCountRef.current && !isAtBottomRef.current) {
      setPendingMessages((current) => current + (visibleMessages.length - previousMessageCountRef.current));
    }

    previousMessageCountRef.current = visibleMessages.length;
  }, [visibleMessages.length]);

  useEffect(() => {
    setPendingMessages(0);
    previousMessageCountRef.current = visibleMessages.length;
    isAtBottomRef.current = true;
  }, [conversation?.id, visibleMessages.length]);

  const handleScroll = useCallback(() => {
    const container = scrollRef.current;

    if (!container) {
      return;
    }

    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    isAtBottomRef.current = distanceToBottom < 40;

    if (isAtBottomRef.current) {
      setPendingMessages(0);
    }
  }, []);

  const handleScrollToBottom = useCallback(() => {
    const container = scrollRef.current;

    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
    isAtBottomRef.current = true;
    setPendingMessages(0);
  }, []);

  const handleAttachmentChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      if (!file) {
        return;
      }

      const prefix = draft.trim() ? `${draft.trim()}\n` : '';
      onDraftChange(`${prefix}[arquivo] ${file.name}`);
      event.target.value = '';
    },
    [draft, onDraftChange],
  );

  return (
    <section className="crm-card flex h-[calc(100vh-196px)] flex-col p-4">
      <header className="mb-3 flex items-start justify-between gap-3 border-b border-borderSoft pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-borderSoft bg-panel text-xs font-semibold text-textPrimary">
            {conversationDisplayName(conversation).slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-textPrimary">
              {conversation ? conversationDisplayName(conversation) : 'Selecione uma conversa'}
            </h3>
            <p className="truncate text-xs text-textMuted">
              {conversation?.phone || 'A lista lateral continua disponivel mesmo sem preview selecionado.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {conversation?.humanActive ? <Badge variant="warning">Atendimento manual</Badge> : null}
          {conversation?.aiEnabled !== false ? <Badge variant="neutral">IA habilitada</Badge> : null}
          <Badge variant={statusVariant(connectionStatus)}>{statusLabel(connectionStatus)}</Badge>
        </div>
      </header>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="chat-grid-bg relative flex-1 overflow-auto rounded-2xl border border-borderSoft bg-panelSoft px-3 py-3"
      >
        <div className="space-y-3">
          {!conversation ? (
            <StatePanel
              tone="empty"
              title="Nenhuma conversa selecionada"
              description="Escolha um item na lateral para abrir o historico. O painel nao depende de preview previo para existir."
            />
          ) : null}

          {loading && visibleMessages.length === 0 && conversation ? (
            <StatePanel
              tone="loading"
              title="Carregando historico"
              description="As mensagens desta conversa estao sendo carregadas a partir do backend ou do fallback local."
            />
          ) : null}

          {error && conversation ? (
            <StatePanel tone="info" title="Historico com fallback" description={error} />
          ) : null}

          {conversation && !loading && visibleMessages.length === 0 && !error ? (
            <StatePanel
              tone="empty"
              title="Sem mensagens nesta conversa"
              description="O painel permanece ativo para rascunho, envio manual e acompanhamento do status."
            />
          ) : null}

          {visibleMessages.map((message) => (
            <MessageBubble key={message.id} message={message} onOpenMedia={(type, url) => setMediaModal({ type, url })} />
          ))}

          {typingText ? <p className="text-xs text-textMuted">{typingText}</p> : null}
        </div>
      </div>

      {pendingMessages > 0 ? (
        <div className="-mt-12 mb-2 flex justify-center">
          <Button type="button" variant="secondary" onClick={handleScrollToBottom} className="rounded-full px-3 py-1 text-xs">
            {pendingMessages} novas mensagens
          </Button>
        </div>
      ) : null}

      <form onSubmit={onSendMessage} className="mt-3 flex items-end gap-2">
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleAttachmentChange} />
        <Button
          type="button"
          variant="secondary"
          onClick={() => fileInputRef.current?.click()}
          disabled={!conversation}
          className="h-11 w-11 rounded-2xl p-0"
          title="Selecionar arquivo"
        >
          <MonochromeIcon name="attachment" className="mx-auto h-4 w-4" />
        </Button>

        <textarea
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder={conversation ? 'Escreva uma mensagem...' : 'Selecione uma conversa para escrever'}
          disabled={!conversation}
          className="min-h-[60px] flex-1 rounded-3xl border border-borderSoft bg-panelSoft px-4 py-3 text-sm text-textPrimary outline-none transition placeholder:text-textMuted focus:border-accentBlue"
        />

        <Button type="submit" disabled={!canSend} className="inline-flex h-11 items-center gap-2 rounded-2xl px-4">
          <MonochromeIcon name="send" className="h-4 w-4" />
          Enviar
        </Button>
      </form>

      {mediaModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setMediaModal(null)}>
          {mediaModal.type === 'image' ? (
            <img
              src={mediaModal.url}
              alt="Visualizacao"
              className="max-h-[92vh] max-w-[92vw] rounded-2xl object-contain"
              onClick={(event) => event.stopPropagation()}
            />
          ) : (
            <video
              src={mediaModal.url}
              controls
              autoPlay
              className="max-h-[92vh] max-w-[92vw] rounded-2xl bg-black"
              onClick={(event) => event.stopPropagation()}
            />
          )}
        </div>
      ) : null}
    </section>
  );
}
