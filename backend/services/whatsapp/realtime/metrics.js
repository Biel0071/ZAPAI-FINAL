/**
 * Realtime metrics emission for the WhatsApp subsystem.
 * Extracted from whatsappService.legacy.js (Phase 2c).
 *
 * - `hasActiveConnection(session)`: true if the session-state service
 *   reports a connected WhatsApp AND (optionally) the given session is in
 *   `connected` status.
 * - `shouldEmitMetricsForMessage({savedMessage, session})`: gate used by
 *   `createStableSession` to decide whether to push metrics after a
 *   message is persisted.
 * - `emitRealtimeMetrics(io, store)`: computes and pushes the `metrics`
 *   event to the given socket server.
 *
 * All state is either injected (`session`, `store`) or read from
 * `sessionStateService`.
 */

const sessionStateService = require('../../sessionStateService');
const { isToday } = require('../shared/time');
const { isMessageConfirmed } = require('./chatState');

function hasActiveConnection(session = null) {
  if (!sessionStateService.getWhatsappSession().connected) {
    return false;
  }

  if (!session) {
    return true;
  }

  return String(session.status || '').toLowerCase() === 'connected';
}

function shouldEmitMetricsForMessage({ savedMessage = null, session = null } = {}) {
  return (
    Boolean(savedMessage?.id) &&
    isMessageConfirmed(savedMessage) &&
    hasActiveConnection(session)
  );
}

function emitRealtimeMetrics(io, store) {
  const socketServer = io || global.io;

  if (!socketServer || !store?.chats) {
    return;
  }

  const allChats = Object.values(store.chats);
  const totalMessages = allChats.reduce(
    (acc, chat) => acc + (Array.isArray(chat?.messages) ? chat.messages.length : 0),
    0
  );
  const todayMessages = allChats
    .flatMap((chat) => (Array.isArray(chat?.messages) ? chat.messages : []))
    .filter((message) => isToday(message?.timestamp)).length;
  const activeChats = allChats.filter((chat) => chat?.archived !== true).length;

  store.metrics = {
    activeChats,
    todayMessages,
    totalMessages,
  };

  socketServer.emit('metrics', store.metrics);
}

module.exports = {
  emitRealtimeMetrics,
  hasActiveConnection,
  shouldEmitMetricsForMessage,
};
