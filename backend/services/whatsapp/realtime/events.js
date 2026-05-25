/**
 * Realtime socket event emitters for WhatsApp.
 *
 * Centralizes session-status/runtime-status normalization so the frontend sees
 * one coherent lifecycle model: connected | qr_ready | connecting | disconnected.
 * Alias events are still emitted for backwards compatibility, but the payload
 * is computed in exactly one place.
 */

const { ensureWhatsAppJid } = require('../shared/identifiers');
const {
  buildRealtimeMessagePayload,
  buildStandardNewMessageEnvelope,
} = require('./payloads');

function resolveSocket(io) {
  return io || global.io;
}

function normalizeSessionStatus(status = 'disconnected') {
  const value = String(status || '').toLowerCase();

  if (value === 'connected') {
    return 'connected';
  }

  if (['qr', 'qr_ready', 'awaiting_qr'].includes(value)) {
    return 'qr_ready';
  }

  if (['connecting', 'creating', 'error', 'reconnecting'].includes(value)) {
    return 'connecting';
  }

  return 'disconnected';
}

function isLiveSessionStatus(status = 'disconnected') {
  return ['connected', 'qr_ready', 'connecting'].includes(normalizeSessionStatus(status));
}

function buildSessionStatusPayload(input = {}) {
  const normalizedStatus = normalizeSessionStatus(input.status);
  const updatedAt = input.updatedAt || new Date().toISOString();
  const qr = normalizedStatus === 'qr_ready' ? input.qr || input.qrCode || null : null;
  const sessionId = input.sessionId || input.id || input.sessionName || input.name || null;
  const sessionName = input.sessionName || input.name || sessionId;

  return {
    connected: normalizedStatus === 'connected',
    eventAt: Date.now(),
    name: sessionName,
    phone: input.phone || null,
    qr,
    sessionId,
    sessionName,
    status: normalizedStatus,
    type: 'status',
    updatedAt,
  };
}

function buildRuntimeStatusPayload(sessions = [], options = {}) {
  const normalizedSessions = (Array.isArray(sessions) ? sessions : [])
    .map((session) => buildSessionStatusPayload(session))
    .filter((session) => Boolean(session.sessionId) && isLiveSessionStatus(session.status));

  const runtimeActive = options.runtimeActive !== false;
  const isOnline = runtimeActive && normalizedSessions.length > 0;

  return {
    sessions: normalizedSessions,
    status: isOnline ? 'online' : 'offline',
    updatedAt: new Date().toISOString(),
    workersActive: options.workersActive,
    uptimeSeconds: options.uptimeSeconds,
  };
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

function emitSessionStatus(io, sessionOrPayload, legacyStatus, legacySessionName = null, legacyExtras = {}) {
  const socketServer = resolveSocket(io);

  if (!socketServer) {
    return null;
  }

  const input =
    sessionOrPayload && typeof sessionOrPayload === 'object' && !Array.isArray(sessionOrPayload)
      ? sessionOrPayload
      : {
          ...legacyExtras,
          sessionId: sessionOrPayload,
          sessionName: legacySessionName || sessionOrPayload,
          status: legacyStatus,
        };

  const payload = buildSessionStatusPayload(input);

  socketServer.emit('session_status', payload);
  socketServer.emit('session:status', payload);
  socketServer.emit('connection:event', payload);

  return payload;
}

function emitRuntimeStatus(io, sessions = [], options = {}) {
  const socketServer = resolveSocket(io);

  if (!socketServer) {
    return null;
  }

  const payload = buildRuntimeStatusPayload(sessions, options);
  socketServer.emit('system:runtime-status', payload);
  return payload;
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
  buildRuntimeStatusPayload,
  buildSessionStatusPayload,
  emitChatsLoaded,
  emitChatUpdated,
  emitConnectionUpdate,
  emitInboundRealtimeMessage,
  emitMessageUpdates,
  emitRealtimeEvent,
  emitRuntimeStatus,
  emitSessionStatus,
  isLiveSessionStatus,
  normalizeSessionStatus,
};