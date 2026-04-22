/**
 * Realtime socket event emitters for WhatsApp.
 * Extracted from whatsappService.legacy.js (Phase 2b-1).
 *
 * These functions write to Socket.IO (`io || global.io`) but have no other
 * module-scoped state. They preserve the legacy emission pattern (multiple
 * alias events for the same payload) so existing frontends keep receiving
 * the same names while we migrate to single-event semantics.
 *
 * NOTE: these are NOT tenant-scoped yet. A follow-up will wrap them with
 * `services/realtime/tenantRooms.emitToTenant` once all call-sites know
 * their tenant.
 */

const { ensureWhatsAppJid } = require('../shared/identifiers');
const {
  buildRealtimeMessagePayload,
  buildStandardNewMessageEnvelope,
} = require('./payloads');

function resolveSocket(io) {
  return io || global.io;
}

function emitRealtimeEvent(io, eventName, payload) {
  const socketServer = resolveSocket(io);

  if (!socketServer) {
    return;
  }

  const eventPayload =
    eventName === 'new_message' ? buildRealtimeMessagePayload(payload) : payload;

  if (eventName === 'new_message') {
    const normalizedType = String(eventPayload?.type || eventPayload?.mediaType || '').toLowerCase();
    const requiresUrl = ['image', 'video', 'audio', 'file'].includes(normalizedType);

    if (requiresUrl && !eventPayload?.url) {
      // eslint-disable-next-line no-console
      console.error('SEM URL:', eventPayload);
      return;
    }
  }

  if (eventName === 'new_message') {
    socketServer.emit(
      'new_message',
      buildStandardNewMessageEnvelope({
        chatId: eventPayload.chatId || ensureWhatsAppJid(eventPayload.phone || ''),
        message: eventPayload,
      })
    );
  } else {
    socketServer.emit(eventName, eventPayload);
  }

  if (eventName === 'new_message') {
    socketServer.emit('new-message', {
      chatId: eventPayload.chatId || ensureWhatsAppJid(eventPayload.phone || ''),
      message: eventPayload,
    });
    socketServer.emit('message:new', {
      conversationId: eventPayload.conversationId || null,
      message: eventPayload,
    });
  }

  if (eventName === 'conversation_updated' || eventName === 'conversation:update') {
    socketServer.emit('conversation:update', eventPayload);
    socketServer.emit('conversation_updated', eventPayload);
    socketServer.emit('conversation-update', eventPayload);
  }

  if (eventName === 'messages.update') {
    socketServer.emit('message:update', eventPayload);
  }
}

function emitConnectionUpdate(io, payload) {
  const socketServer = resolveSocket(io);

  if (!socketServer) {
    return;
  }

  socketServer.emit('connection.update', payload);
  socketServer.emit('connection-update', payload);
}

function emitSessionStatus(io, sessionId, status, sessionName = null) {
  const socketServer = resolveSocket(io);

  if (!socketServer) {
    return;
  }

  const normalizedStatus = (() => {
    const value = String(status || '').toLowerCase();

    if (value === 'qr_ready') {
      return 'qr';
    }

    if (value === 'error') {
      return 'error';
    }

    if (['connected', 'connecting', 'qr', 'disconnected', 'creating'].includes(value)) {
      return value;
    }

    return 'disconnected';
  })();

  const payload = {
    eventAt: Date.now(),
    type: 'status',
    name: sessionName || sessionId,
    sessionId,
    sessionName: sessionName || sessionId,
    status: normalizedStatus,
  };

  socketServer.emit('session_status', payload);
  socketServer.emit('session:status', payload);
  socketServer.emit('connection:event', payload);

  const isOnline = ['connected', 'connecting', 'qr', 'creating'].includes(normalizedStatus);
  const activeSessions = isOnline
    ? [
        {
          name: payload.name,
          sessionId: payload.sessionId,
          sessionName: payload.sessionName,
          status: payload.status,
        },
      ]
    : [];

  socketServer.emit('system:runtime-status', {
    sessions: activeSessions,
    status: isOnline ? 'online' : 'offline',
  });
}

async function emitMessageUpdates(io, updates = [], sessionId) {
  const socketServer = resolveSocket(io);

  if (!socketServer || !Array.isArray(updates) || updates.length === 0) {
    return;
  }

  const payload = {
    sessionId,
    updates,
  };

  socketServer.emit('messages.update', payload);
  socketServer.emit('message:update', payload);
  socketServer.emit('message-update', payload);
  socketServer.emit('message_status', payload);
}

function emitChatsLoaded(io, store) {
  const socketServer = resolveSocket(io);

  if (!socketServer || !store?.chats) {
    return;
  }

  const visibleChats = Object.values(store.chats).filter((chat) => chat?.archived !== true);
  socketServer.emit('chats_loaded', {
    chats: visibleChats,
    type: 'reset',
  });
}

function emitChatUpdated(io, chat) {
  const socketServer = resolveSocket(io);

  if (!socketServer || !chat?.id) {
    return;
  }

  socketServer.emit('chat_updated', chat);
}

function emitInboundRealtimeMessage(io, savedMessage, conversation = null) {
  if (!savedMessage) {
    return;
  }

  // Legacy order preserved: prefer global.io if present.
  const socketServer = global.io || io;

  if (!socketServer) {
    return;
  }

  if (conversation) {
    socketServer.emit('conversation:update', conversation);
    socketServer.emit('conversation_updated', conversation);
    socketServer.emit('conversation-update', conversation);
  }
}

module.exports = {
  emitChatsLoaded,
  emitChatUpdated,
  emitConnectionUpdate,
  emitInboundRealtimeMessage,
  emitMessageUpdates,
  emitRealtimeEvent,
  emitSessionStatus,
};
