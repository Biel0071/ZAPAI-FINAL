/**
 * Realtime inbox event emitters.
 * Extracted from controllers/messagesController.js (Phase 2b-3).
 *
 * Four functions:
 *   - scheduleConversationRevalidation: 500 ms delayed re-fetch + emit.
 *   - emitConversationSnapshotImmediate: immediate snapshot emit.
 *   - emitInboxRealtimeEvent: request-scoped inbox event emission.
 *   - emitInboxRealtimeEventFromStore: store-scoped variant for legacy paths.
 *
 * No module-scoped mutable state. All side effects go through `io`.
 */

const sessionManager = require('../../../services/sessionManager');
const messageService = require('../../../services/messageService');
const {
  buildStandardNewMessageEnvelope,
  formatApiMessage,
  getRequestedSessionId,
  getStore,
  normalizeChatId,
} = require('../shared');
const { loadMessagesForChat } = require('../sync/loadMessagesForChat');

function scheduleConversationRevalidation({
  chatId,
  companyId,
  conversationId = null,
  io,
  sessionId,
  store,
}) {
  if (!io || !chatId) {
    return;
  }

  setTimeout(() => {
    loadMessagesForChat({
      chatId,
      companyId,
      sessionId,
      store,
    })
      .then((messages) => {
        const safeMessages = Array.isArray(messages) ? messages : [];

        io.emit('messages:revalidated', {
          chatId: normalizeChatId(chatId),
          conversationId,
          messages: safeMessages,
        });
        io.emit('messages_snapshot', {
          chatId: normalizeChatId(chatId),
          conversationId,
          messages: safeMessages,
        });
        io.emit('conversation:revalidated', {
          chatId: normalizeChatId(chatId),
          conversationId,
          messages: safeMessages,
        });
        io.emit('conversation_snapshot', {
          chatId: normalizeChatId(chatId),
          conversationId,
          lastMessage: safeMessages[safeMessages.length - 1] || null,
          messages: safeMessages,
          messagesCount: safeMessages.length,
        });
      })
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error('[API] conversation revalidation failed:', error?.message || error);
      });
  }, 500);
}

function emitConversationSnapshotImmediate({
  chatId,
  companyId,
  conversationId = null,
  io,
  sessionId,
  store,
  fallbackMessage = null,
}) {
  if (!io || !chatId) {
    return;
  }

  loadMessagesForChat({
    chatId,
    companyId,
    sessionId,
    store,
  })
    .then((messages) => {
      const normalizedFallback = formatApiMessage(fallbackMessage);
      const safeMessages = Array.isArray(messages) && messages.length
        ? messages
        : normalizedFallback
          ? [normalizedFallback]
          : [];

      io.emit('messages_snapshot', {
        chatId: normalizeChatId(chatId),
        conversationId,
        messages: safeMessages,
      });
      io.emit('conversation_snapshot', {
        chatId: normalizeChatId(chatId),
        conversationId,
        lastMessage: safeMessages[safeMessages.length - 1] || null,
        messages: safeMessages,
        messagesCount: safeMessages.length,
      });
    })
    .catch((error) => {
      const normalizedFallback = formatApiMessage(fallbackMessage);
      const fallbackMessages = normalizedFallback ? [normalizedFallback] : [];

      // eslint-disable-next-line no-console
      console.error('[API] immediate snapshot failed:', error?.message || error);

      io.emit('messages_snapshot', {
        chatId: normalizeChatId(chatId),
        conversationId,
        messages: fallbackMessages,
      });
      io.emit('conversation_snapshot', {
        chatId: normalizeChatId(chatId),
        conversationId,
        lastMessage: fallbackMessages[fallbackMessages.length - 1] || null,
        messages: fallbackMessages,
        messagesCount: fallbackMessages.length,
      });
    });
}

function emitInboxRealtimeEvent(req, savedMessage) {
  const io = req.app.get('io') || getStore(req)?.io;

  if (!io || !savedMessage) {
    return;
  }

  const payload = {
    conversationId: savedMessage.conversationId,
    message: savedMessage,
  };

  messageService.safeSocketEmit(io, 'message:new', payload, []);
  messageService.safeSocketEmit(
    io,
    'conversation:update',
    {
      conversationId: savedMessage.conversationId,
      lastMessage: savedMessage.content || savedMessage.text || '',
      mediaType: savedMessage.mediaType || null,
      phone: savedMessage.phone || null,
      timestamp: savedMessage.timestamp || savedMessage.createdAt || new Date().toISOString(),
    },
    ['conversation_updated', 'conversation-update']
  );
  messageService.safeSocketEmit(io, 'new_message', buildStandardNewMessageEnvelope(savedMessage));
  emitConversationSnapshotImmediate({
    chatId: savedMessage.phone || '',
    companyId: req.body?.companyId || req.query?.companyId || req.companyId || req.tenantId,
    conversationId: savedMessage.conversationId || null,
    io,
    sessionId: savedMessage.sessionId || getRequestedSessionId(req),
    store: getStore(req),
    fallbackMessage: savedMessage,
  });

  // eslint-disable-next-line no-console
  console.log('FLOW:', {
    saved: true,
    emitted: true,
    chatId: normalizeChatId(savedMessage.phone || ''),
    messageId: savedMessage.id,
  });

  scheduleConversationRevalidation({
    chatId: savedMessage.phone,
    companyId: req.body?.companyId || req.query?.companyId || req.companyId || req.tenantId,
    conversationId: savedMessage.conversationId || null,
    io,
    sessionId: savedMessage.sessionId || getRequestedSessionId(req),
    store: getStore(req),
  });

  // eslint-disable-next-line no-console
  console.log('[INBOX] realtime event emitted');
}

function emitInboxRealtimeEventFromStore(store, savedMessage) {
  const io = store?.io || global.io;

  if (!io || !savedMessage) {
    return;
  }

  const payload = {
    conversationId: savedMessage.conversationId,
    message: savedMessage,
  };

  messageService.safeSocketEmit(io, 'message:new', payload, []);
  messageService.safeSocketEmit(
    io,
    'conversation:update',
    {
      conversationId: savedMessage.conversationId,
      lastMessage: savedMessage.content || savedMessage.text || '',
      mediaType: savedMessage.mediaType || null,
      phone: savedMessage.phone || null,
      timestamp: savedMessage.timestamp || savedMessage.createdAt || new Date().toISOString(),
    },
    ['conversation_updated', 'conversation-update']
  );
  messageService.safeSocketEmit(io, 'new_message', buildStandardNewMessageEnvelope(savedMessage));
  emitConversationSnapshotImmediate({
    chatId: savedMessage.phone || '',
    companyId: process.env.DEFAULT_COMPANY_ID || 'default',
    conversationId: savedMessage.conversationId || null,
    io,
    sessionId: savedMessage.sessionId || sessionManager.DEFAULT_SESSION,
    store,
    fallbackMessage: savedMessage,
  });

  // eslint-disable-next-line no-console
  console.log('FLOW:', {
    saved: true,
    emitted: true,
    chatId: normalizeChatId(savedMessage.phone || ''),
    messageId: savedMessage.id,
  });

  scheduleConversationRevalidation({
    chatId: savedMessage.phone,
    companyId: process.env.DEFAULT_COMPANY_ID || 'default',
    conversationId: savedMessage.conversationId || null,
    io,
    sessionId: savedMessage.sessionId || sessionManager.DEFAULT_SESSION,
    store,
  });

  // eslint-disable-next-line no-console
  console.log('[INBOX] realtime event emitted');
}

module.exports = {
  emitConversationSnapshotImmediate,
  emitInboxRealtimeEvent,
  emitInboxRealtimeEventFromStore,
  scheduleConversationRevalidation,
};
