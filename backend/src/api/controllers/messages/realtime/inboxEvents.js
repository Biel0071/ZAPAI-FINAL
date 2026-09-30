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

const sessionManager = require('../../../../../services/sessionManager');
const messageService = require('../../../../../services/messageService');
const {
  buildStandardNewMessageEnvelope,
  formatApiMessage,
  getRequestedSessionId,
  getStore,
  normalizeChatId,
} = require('../shared');
const { loadMessagesForChat } = require('../sync/loadMessagesForChat');
const { emitToTenant, emitToTenantWithAliases } = require('../../../../../services/realtime/tenantRooms');

function scheduleConversationRevalidation({
  chatId,
  companyId,
  conversationId = null,
  io,
  sessionId,
  store,
}) {
  if (!io || !chatId || !companyId) {
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

        emitToTenant(io, companyId, 'messages:revalidated', {
          chatId: normalizeChatId(chatId),
          conversationId,
          messages: safeMessages,
        });
        emitToTenant(io, companyId, 'messages_snapshot', {
          chatId: normalizeChatId(chatId),
          conversationId,
          messages: safeMessages,
        });
        emitToTenant(io, companyId, 'conversation:revalidated', {
          chatId: normalizeChatId(chatId),
          conversationId,
          messages: safeMessages,
        });
        emitToTenant(io, companyId, 'conversation_snapshot', {
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
  if (!io || !chatId || !companyId) {
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

      emitToTenant(io, companyId, 'messages_snapshot', {
        chatId: normalizeChatId(chatId),
        conversationId,
        messages: safeMessages,
      });
      emitToTenant(io, companyId, 'conversation_snapshot', {
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

      emitToTenant(io, companyId, 'messages_snapshot', {
        chatId: normalizeChatId(chatId),
        conversationId,
        messages: fallbackMessages,
      });
      emitToTenant(io, companyId, 'conversation_snapshot', {
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
  const companyId = req.authTenantId;

  if (!io || !savedMessage || !companyId) {
    return;
  }

  const payload = {
    conversationId: savedMessage.conversationId,
    message: savedMessage,
  };

  emitToTenantWithAliases(io, companyId, 'message:new', payload, []);
  emitToTenantWithAliases(
    io, companyId,
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
  emitToTenantWithAliases(io, companyId, 'new_message', buildStandardNewMessageEnvelope(savedMessage));
  emitConversationSnapshotImmediate({
    chatId: savedMessage.phone || '',
    companyId,
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
    companyId,
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
  const companyId = savedMessage?.companyId || savedMessage?.company_id;

  if (!io || !savedMessage || !companyId) {
    return;
  }

  const payload = {
    conversationId: savedMessage.conversationId,
    message: savedMessage,
  };

  emitToTenantWithAliases(io, companyId, 'message:new', payload, []);
  emitToTenantWithAliases(
    io, companyId,
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
  emitToTenantWithAliases(io, companyId, 'new_message', buildStandardNewMessageEnvelope(savedMessage));
  emitConversationSnapshotImmediate({
    chatId: savedMessage.phone || '',
    companyId,
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
    companyId,
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
