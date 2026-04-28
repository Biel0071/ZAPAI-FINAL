import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAIEngineStatus, type AiEngineStatus } from '../lib/aiEngine';
import { api } from '../lib/api';
import { mockConversations, mockMessagesByConversation, mockQuickReplies } from '../lib/mocks';
import { socket } from '../lib/socket';
import { useSessionRuntime } from '../hooks/useSessionRuntime';
import { useAppStore } from '../store/appStore';
import { ChatMessage, Conversation, QuickReply } from '../types';
import {
  conversationDisplayName,
  normalizeChatMessages,
  normalizeConversation,
  normalizeConversations,
  normalizePhoneToken,
  normalizeRealtimeEnvelope,
  toIsoDate,
  toUnixMillis,
} from '../utils/inbox';
import { ChatLayout } from '../views/chat/ChatLayout';

function sortConversations(items: Conversation[]) {
  return [...items].sort((left, right) => toUnixMillis(right.updatedAt) - toUnixMillis(left.updatedAt));
}

function upsertConversation(previous: Conversation[], incoming: Conversation) {
  const next = Array.isArray(previous) ? [...previous] : [];
  const normalizedIncomingPhone = normalizePhoneToken(incoming.phone);
  const index = next.findIndex(
    (entry) => entry.id === incoming.id || normalizePhoneToken(entry.phone) === normalizedIncomingPhone,
  );

  if (index >= 0) {
    next[index] = {
      ...next[index],
      ...incoming,
    };
  } else {
    next.unshift(incoming);
  }

  return sortConversations(next);
}

function dedupeMessages(items: ChatMessage[]) {
  const bucket = new Map<string, ChatMessage>();

  for (const item of items) {
    if (!item?.id) {
      continue;
    }

    bucket.set(String(item.id), item);
  }

  return Array.from(bucket.values()).sort(
    (left, right) => toUnixMillis(left.timestamp || left.createdAt) - toUnixMillis(right.timestamp || right.createdAt),
  );
}

export default function ChatPage() {
  const {
    conversations,
    selectedConversationId,
    setConversations,
    setSelectedConversationId,
    quickReplies,
    setQuickReplies,
  } = useAppStore();
  const runtime = useSessionRuntime();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [loadingConversations, setLoadingConversations] = useState(conversations.length === 0);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [conversationsError, setConversationsError] = useState<string | null>(null);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<AiEngineStatus | null>(null);
  const [typingText, setTypingText] = useState('');
  const [updatingConversationState, setUpdatingConversationState] = useState(false);

  const conversationsRef = useRef<Conversation[]>(conversations);
  const selectedConversationIdRef = useRef<string | null>(selectedConversationId);
  const selectedChatIdRef = useRef('');
  const messageIdsRef = useRef<Set<string>>(new Set());
  const lastMessageTimestampRef = useRef(0);
  const messageRequestRef = useRef(0);
  const conversationRefreshTimerRef = useRef<number | null>(null);
  const messageRefreshTimerRef = useRef<number | null>(null);
  const draftPersistTimerRef = useRef<number | null>(null);
  const draftReadyRef = useRef(false);

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.id === selectedConversationId) || null,
    [conversations, selectedConversationId],
  );

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  useEffect(() => {
    selectedChatIdRef.current = normalizePhoneToken(selectedConversation?.phone || '');
  }, [selectedConversation?.phone]);

  const applyMessages = useCallback((nextMessages: ChatMessage[]) => {
    const normalized = dedupeMessages(nextMessages);
    messageIdsRef.current = new Set(normalized.map((entry) => String(entry.id)));
    lastMessageTimestampRef.current = normalized.length
      ? Math.max(...normalized.map((entry) => toUnixMillis(entry.timestamp || entry.createdAt)))
      : 0;
    setMessages(normalized);
  }, []);

  const applyConversationUpdate = useCallback(
    (incoming: Conversation | null) => {
      if (!incoming) {
        return;
      }

      setConversations((previous) => upsertConversation(previous, incoming));
    },
    [setConversations],
  );

  const patchConversationByChatId = useCallback(
    (chatId: string, updater: (conversation: Conversation) => Conversation) => {
      setConversations((previous) =>
        sortConversations(
          previous.map((conversation) =>
            normalizePhoneToken(conversation.phone) === chatId ? updater(conversation) : conversation,
          ),
        ),
      );
    },
    [setConversations],
  );

  const loadConversations = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!silent) {
        setLoadingConversations(true);
      }

      setConversationsError(null);

      try {
        const payload = await api.get<unknown[]>('/conversations');
        const normalized = normalizeConversations(payload);
        const nextConversations = normalized.length > 0 ? normalized : mockConversations;

        setConversations(nextConversations);

        const currentSelectedId = selectedConversationIdRef.current;
        const hasSelected = currentSelectedId
          ? nextConversations.some((conversation) => conversation.id === currentSelectedId)
          : false;

        if (!hasSelected) {
          setSelectedConversationId(nextConversations[0]?.id ?? null);
        }

        if (normalized.length === 0) {
          setConversationsError('A API retornou a lista vazia. Fallback local ativado para manter a tela utilizavel.');
        }
      } catch (error) {
        const fallbackConversations =
          conversationsRef.current.length > 0 ? conversationsRef.current : mockConversations;

        setConversations(fallbackConversations);

        if (!selectedConversationIdRef.current) {
          setSelectedConversationId(fallbackConversations[0]?.id ?? null);
        }

        setConversationsError('Falha ao carregar conversas reais. Exibindo fallback local sem interromper o Inbox.');
        console.warn('[Chat] loadConversations falhou:', error);
      } finally {
        setLoadingConversations(false);
      }
    },
    [setConversations, setSelectedConversationId],
  );

  const loadQuickReplies = useCallback(async () => {
    try {
      const payload = await api.get<QuickReply[]>('/api/quick-replies');
      setQuickReplies(Array.isArray(payload) && payload.length > 0 ? payload : mockQuickReplies);
    } catch (error) {
      setQuickReplies(mockQuickReplies);
      console.warn('[Chat] loadQuickReplies falhou:', error);
    }
  }, [setQuickReplies]);

  const loadMessages = useCallback(
    async (conversationId: string, { silent = false }: { silent?: boolean } = {}) => {
      const requestId = ++messageRequestRef.current;
      draftReadyRef.current = false;

      if (!silent) {
        setLoadingMessages(true);
      }

      setMessagesError(null);

      try {
        const [messagesPayload, draftPayload] = await Promise.all([
          api.get<unknown[]>(`/conversations/${conversationId}/messages`),
          api
            .get<{ conversationId: string; draft: string }>(`/conversations/${conversationId}/draft`)
            .catch(() => ({ conversationId, draft: '' })),
        ]);

        if (requestId !== messageRequestRef.current || selectedConversationIdRef.current !== conversationId) {
          return;
        }

        const normalizedMessages = normalizeChatMessages(messagesPayload);
        const fallbackMessages = mockMessagesByConversation[conversationId] || [];

        applyMessages(normalizedMessages.length > 0 ? normalizedMessages : fallbackMessages);
        setDraft(String(draftPayload?.draft || ''));
        draftReadyRef.current = true;

        setConversations((previous) =>
          previous.map((conversation) =>
            conversation.id === conversationId
              ? {
                  ...conversation,
                  unread: 0,
                }
              : conversation,
          ),
        );
      } catch (error) {
        if (requestId !== messageRequestRef.current || selectedConversationIdRef.current !== conversationId) {
          return;
        }

        applyMessages(mockMessagesByConversation[conversationId] || []);
        setDraft('');
        draftReadyRef.current = true;
        setMessagesError('As mensagens reais nao responderam. O painel segue ativo com fallback seguro.');
        console.warn('[Chat] loadMessages falhou:', error);
      } finally {
        if (requestId === messageRequestRef.current) {
          setLoadingMessages(false);
        }
      }
    },
    [applyMessages, setConversations],
  );

  const scheduleConversationsRefresh = useCallback(() => {
    if (conversationRefreshTimerRef.current) {
      window.clearTimeout(conversationRefreshTimerRef.current);
    }

    conversationRefreshTimerRef.current = window.setTimeout(() => {
      conversationRefreshTimerRef.current = null;
      void loadConversations({ silent: true });
    }, 600);
  }, [loadConversations]);

  const scheduleMessageRefresh = useCallback(() => {
    if (!selectedConversationIdRef.current) {
      return;
    }

    if (messageRefreshTimerRef.current) {
      window.clearTimeout(messageRefreshTimerRef.current);
    }

    messageRefreshTimerRef.current = window.setTimeout(() => {
      messageRefreshTimerRef.current = null;
      if (selectedConversationIdRef.current) {
        void loadMessages(selectedConversationIdRef.current, { silent: true });
      }
    }, 500);
  }, [loadMessages]);

  useEffect(() => {
    void Promise.all([loadConversations(), loadQuickReplies(), getAIEngineStatus().then(setAiStatus)]);
  }, [loadConversations, loadQuickReplies]);

  useEffect(() => {
    if (!selectedConversationId) {
      applyMessages([]);
      setDraft('');
      draftReadyRef.current = false;
      return;
    }

    void loadMessages(selectedConversationId);
  }, [applyMessages, loadMessages, selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId || !draftReadyRef.current) {
      return;
    }

    if (draftPersistTimerRef.current) {
      window.clearTimeout(draftPersistTimerRef.current);
    }

    draftPersistTimerRef.current = window.setTimeout(() => {
      void api
        .post(`/conversations/${selectedConversationId}/draft`, { draft })
        .catch((error) => console.warn('[Chat] persistDraft falhou:', error));
    }, 350);

    return () => {
      if (draftPersistTimerRef.current) {
        window.clearTimeout(draftPersistTimerRef.current);
        draftPersistTimerRef.current = null;
      }
    };
  }, [draft, selectedConversationId]);

  useEffect(() => {
    const onMessagesSnapshot = (payload: unknown) => {
      const envelope = payload as { chatId?: string; messages?: unknown[] };
      const eventChatId = normalizePhoneToken(String(envelope?.chatId || ''));

      if (!selectedChatIdRef.current || eventChatId !== selectedChatIdRef.current) {
        return;
      }

      applyMessages(normalizeChatMessages(envelope?.messages));
    };

    const onConversationSnapshot = (payload: unknown) => {
      const envelope = payload as {
        chatId?: string;
        lastMessage?: unknown;
        messages?: unknown[];
      };
      const eventChatId = normalizePhoneToken(String(envelope?.chatId || ''));

      if (eventChatId) {
        patchConversationByChatId(eventChatId, (conversation) => ({
          ...conversation,
          lastMessage:
            normalizeChatMessages(envelope?.lastMessage ? [envelope.lastMessage] : [])[0]?.content ||
            conversation.lastMessage,
          unread: conversation.id === selectedConversationIdRef.current ? 0 : conversation.unread,
          updatedAt: toIsoDate(Date.now()),
        }));
      }

      if (!selectedChatIdRef.current || eventChatId !== selectedChatIdRef.current) {
        return;
      }

      applyMessages(normalizeChatMessages(envelope?.messages));
    };

    const onRealtimeMessage = (payload: unknown) => {
      const envelope = normalizeRealtimeEnvelope(payload);

      if (!envelope) {
        return;
      }

      const eventChatId = normalizePhoneToken(envelope.chatId);
      const nextTimestamp = toUnixMillis(envelope.message.timestamp || envelope.message.createdAt);

      patchConversationByChatId(eventChatId, (conversation) => ({
        ...conversation,
        lastMessage: envelope.message.content || envelope.message.caption || conversation.lastMessage,
        unread:
          conversation.id === selectedConversationIdRef.current || envelope.message.fromMe
            ? 0
            : (conversation.unread || 0) + 1,
        updatedAt: envelope.message.createdAt || toIsoDate(Date.now()),
      }));

      if (!selectedChatIdRef.current || eventChatId !== selectedChatIdRef.current) {
        return;
      }

      if (messageIdsRef.current.has(String(envelope.message.id)) && nextTimestamp <= lastMessageTimestampRef.current) {
        return;
      }

      lastMessageTimestampRef.current = Math.max(lastMessageTimestampRef.current, nextTimestamp);
      messageIdsRef.current.add(String(envelope.message.id));
      setMessages((previous) => dedupeMessages([...previous, envelope.message]));
    };

    socket.on('messages_snapshot', onMessagesSnapshot);
    socket.on('conversation_snapshot', onConversationSnapshot);
    socket.on('new_message', onRealtimeMessage);

    return () => {
      socket.off('messages_snapshot', onMessagesSnapshot);
      socket.off('conversation_snapshot', onConversationSnapshot);
      socket.off('new_message', onRealtimeMessage);
    };
  }, [applyMessages, patchConversationByChatId]);

  useEffect(() => {
    const onConversationUpdated = (payload: unknown) => {
      const incoming = normalizeConversation(payload);

      if (incoming) {
        applyConversationUpdate(incoming);
        return;
      }

      scheduleConversationsRefresh();
    };

    const onChatsLoaded = (payload: unknown) => {
      const envelope = payload as { chats?: unknown[] };

      if (Array.isArray(envelope?.chats) && envelope.chats.length > 0) {
        scheduleConversationsRefresh();
      }
    };

    const onTypingStart = (payload: unknown) => {
      const event = payload as { chatId?: string; conversationId?: string; phone?: string; name?: string };
      const eventChatId = normalizePhoneToken(String(event.chatId || event.conversationId || event.phone || ''));

      if (!selectedChatIdRef.current || eventChatId !== selectedChatIdRef.current) {
        return;
      }

      setTypingText(`${event.name || conversationDisplayName(selectedConversation)} digitando...`);
    };

    const onTypingStop = (payload: unknown) => {
      const event = payload as { chatId?: string; conversationId?: string; phone?: string };
      const eventChatId = normalizePhoneToken(String(event.chatId || event.conversationId || event.phone || ''));

      if (!selectedChatIdRef.current || eventChatId !== selectedChatIdRef.current) {
        return;
      }

      setTypingText('');
    };

    const onMessageStatus = (payload: unknown) => {
      const event = payload as { id?: string; status?: string };

      if (!event?.id || !event?.status) {
        return;
      }

      setMessages((previous) =>
        previous.map((message) => (message.id === event.id ? { ...message, status: event.status } : message)),
      );
    };

    const onAiResponse = () => {
      scheduleMessageRefresh();
      void getAIEngineStatus().then(setAiStatus).catch(() => null);
    };

    socket.on('conversation:update', onConversationUpdated);
    socket.on('conversation_updated', onConversationUpdated);
    socket.on('conversation-update', onConversationUpdated);
    socket.on('chats_loaded', onChatsLoaded);
    socket.on('typing:start', onTypingStart);
    socket.on('typing_start', onTypingStart);
    socket.on('typing:stop', onTypingStop);
    socket.on('typing_stop', onTypingStop);
    socket.on('message_status', onMessageStatus);
    socket.on('ai_response', onAiResponse);

    return () => {
      socket.off('conversation:update', onConversationUpdated);
      socket.off('conversation_updated', onConversationUpdated);
      socket.off('conversation-update', onConversationUpdated);
      socket.off('chats_loaded', onChatsLoaded);
      socket.off('typing:start', onTypingStart);
      socket.off('typing_start', onTypingStart);
      socket.off('typing:stop', onTypingStop);
      socket.off('typing_stop', onTypingStop);
      socket.off('message_status', onMessageStatus);
      socket.off('ai_response', onAiResponse);
    };
  }, [applyConversationUpdate, scheduleConversationsRefresh, scheduleMessageRefresh, selectedConversation]);

  useEffect(() => {
    return () => {
      if (conversationRefreshTimerRef.current) {
        window.clearTimeout(conversationRefreshTimerRef.current);
      }
      if (messageRefreshTimerRef.current) {
        window.clearTimeout(messageRefreshTimerRef.current);
      }
      if (draftPersistTimerRef.current) {
        window.clearTimeout(draftPersistTimerRef.current);
      }
    };
  }, []);

  const sendTextMessage = useCallback(
    async (content: string) => {
      if (!selectedConversation || !content.trim()) {
        return;
      }

      if (runtime.status !== 'connected') {
        setMessagesError('O WhatsApp esta offline. Aguarde a reconexao para enviar a mensagem.');
        return;
      }

      const optimisticMessage: ChatMessage = {
        content: content.trim(),
        createdAt: new Date().toISOString(),
        fromMe: true,
        id: `optimistic-${Date.now()}`,
        status: 'sent',
        type: 'text',
      };

      messageIdsRef.current.add(String(optimisticMessage.id));
      setMessages((previous) => dedupeMessages([...previous, optimisticMessage]));
      setDraft('');
      setMessagesError(null);

      try {
        await api.post('/messages', {
          conversationId: selectedConversation.id,
          name: conversationDisplayName(selectedConversation),
          phone: selectedConversation.phone,
          text: content.trim(),
        });

        await api.post(`/conversations/${selectedConversation.id}/draft`, { draft: '' });
        scheduleMessageRefresh();
      } catch (error) {
        setDraft(content);
        setMessages((previous) => previous.filter((message) => message.id !== optimisticMessage.id));
        messageIdsRef.current.delete(String(optimisticMessage.id));
        setMessagesError('Falha ao enviar a mensagem. O rascunho foi preservado para nova tentativa.');
        console.warn('[Chat] sendTextMessage falhou:', error);
      }
    },
    [runtime.status, scheduleMessageRefresh, selectedConversation],
  );

  const sendMessage = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      await sendTextMessage(draft);
    },
    [draft, sendTextMessage],
  );

  const appendQuickReply = useCallback((content: string) => {
    setDraft((previous) => (previous ? `${previous}\n${content}` : content));
  }, []);

  const sendQuickReplyInstantly = useCallback(async (content: string) => {
    await sendTextMessage(content);
  }, [sendTextMessage]);

  const toggleConversationAi = useCallback(
    async (nextValue: boolean) => {
      if (!selectedConversation) {
        return;
      }

      setUpdatingConversationState(true);

      try {
        const payload = await api.patch<unknown>(`/conversations/${encodeURIComponent(selectedConversation.phone)}/ai`, {
          aiEnabled: nextValue,
          companyId: 'default',
        });

        const normalized = normalizeConversation(payload);
        applyConversationUpdate(normalized || { ...selectedConversation, aiEnabled: nextValue });
      } catch (error) {
        setMessagesError('Nao foi possivel atualizar o modo de IA desta conversa.');
        console.warn('[Chat] toggleConversationAi falhou:', error);
      } finally {
        setUpdatingConversationState(false);
      }
    },
    [applyConversationUpdate, selectedConversation],
  );

  const setConversationMode = useCallback(
    async (mode: 'ai' | 'human') => {
      if (!selectedConversation) {
        return;
      }

      setUpdatingConversationState(true);

      try {
        const payload = await api.post<{ conversation?: unknown }>(`/conversations/${selectedConversation.id}/handoff`, {
          mode,
        });

        const normalized = normalizeConversation(payload?.conversation || payload);
        applyConversationUpdate(
          normalized || {
            ...selectedConversation,
            controlMode: mode === 'human' ? 'human_active' : 'ai_active',
            humanActive: mode === 'human',
          },
        );
      } catch (error) {
        setMessagesError('Nao foi possivel atualizar o modo de atendimento desta conversa.');
        console.warn('[Chat] setConversationMode falhou:', error);
      } finally {
        setUpdatingConversationState(false);
      }
    },
    [applyConversationUpdate, selectedConversation],
  );

  return (
    <ChatLayout
      aiStatus={aiStatus}
      connectionStatus={runtime.status}
      conversations={conversations}
      conversationsError={conversationsError}
      draft={draft}
      loadingConversations={loadingConversations}
      loadingMessages={loadingMessages}
      messages={messages}
      messagesError={messagesError}
      quickReplies={quickReplies}
      search={search}
      selectedConversation={selectedConversation}
      selectedConversationId={selectedConversationId}
      typingText={typingText}
      updatingConversationState={updatingConversationState}
      onAppendQuickReply={appendQuickReply}
      onDraftChange={setDraft}
      onSearch={setSearch}
      onSelectConversation={setSelectedConversationId}
      onSendMessage={sendMessage}
      onSendQuickReply={(content) => void sendQuickReplyInstantly(content)}
      onSetConversationMode={(mode) => void setConversationMode(mode)}
      onToggleConversationAi={(value) => void toggleConversationAi(value)}
    />
  );
}
