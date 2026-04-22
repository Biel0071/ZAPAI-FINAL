/**
 * Pure helpers shared across message controller handlers.
 * Extracted from controllers/messagesController.js (Phase 2a).
 *
 * Dependencies here are other modules, never module-scoped mutable state.
 */

const sessionManager = require('../../services/sessionManager');
const messageService = require('../../services/messageService');
const whatsappService = require('../../services/whatsappService');
const { buildMediaUrl } = require('../../services/whatsapp/media/url');

function getStore(req) {
  return req?.app?.locals?.store;
}

function getRequestedSessionId(req) {
  const raw = String(
    req?.headers?.['x-session-id'] || req?.query?.sessionId || req?.body?.sessionId || sessionManager.DEFAULT_SESSION
  ).trim();

  return sessionManager.normalizeSessionName(raw || sessionManager.DEFAULT_SESSION);
}

function normalizeChatId(chatId = '') {
  const normalizedPhone = whatsappService.normalizePhone(chatId || '');

  if (!normalizedPhone) {
    return '';
  }

  return `${normalizedPhone}@s.whatsapp.net`;
}

function toIsoTimestamp(value) {
  const parsed = value ? Date.parse(String(value)) : NaN;

  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString();
  }

  return new Date().toISOString();
}

function toExactMessageText(value) {
  if (typeof value === 'string') {
    return value;
  }

  if (Buffer.isBuffer(value)) {
    return value.toString('utf8');
  }

  if (value == null) {
    return '';
  }

  return String(value);
}

function formatApiMessage(message) {
  if (!message) {
    return null;
  }

  const normalizedMediaPath = messageService.toPublicMediaPath(message.mediaPath || null);
  const normalizedMediaUrl = buildMediaUrl(message.url || message.mediaUrl || normalizedMediaPath || '');

  return {
    content: message.content || message.text || '',
    conversationId: message.conversationId || message.conversation_id || null,
    createdAt: message.createdAt || message.timestamp || new Date().toISOString(),
    fromMe:
      typeof message.fromMe === 'boolean'
        ? message.fromMe
        : message.from === 'agent' || message.sender === 'agent',
    id: message.id,
    mediaPath: normalizedMediaPath,
    mediaType: message.mediaType || null,
    mediaUrl: normalizedMediaUrl,
    phone: message.phone || null,
    status: message.status || 'sent',
    url: normalizedMediaUrl,
  };
}

function buildStandardNewMessageEnvelope(message = {}) {
  const normalized = formatApiMessage(message) || message;
  const resolvedTimestamp = normalized.timestamp || normalized.createdAt || new Date().toISOString();
  const resolvedCreatedAt = normalized.createdAt || toIsoTimestamp(resolvedTimestamp);
  const resolvedUrl = buildMediaUrl(
    normalized.url || normalized.mediaUrl || normalized.mediaPath || ''
  );

  return {
    chatId: normalizeChatId(normalized.phone || ''),
    message: {
      caption: normalized.content || normalized.text || '',
      content: normalized.content || normalized.text || '',
      conversationId: normalized.conversationId || normalized.conversation_id || null,
      createdAt: resolvedCreatedAt,
      fromMe: Boolean(normalized.fromMe),
      id: normalized.id,
      isGroup: Boolean(normalized.isGroup),
      participant: normalized.participant || null,
      status: normalized.status || (normalized.fromMe ? 'sent' : 'received'),
      timestamp: resolvedTimestamp,
      type: normalized.type || normalized.mediaType || 'text',
      url: resolvedUrl || null,
    },
  };
}

function emitSocketEvent(reqOrStore, eventName, payload) {
  const io =
    reqOrStore?.app?.get?.('io') ||
    reqOrStore?.app?.locals?.store?.io ||
    reqOrStore?.io ||
    global.io;

  const aliasesByEvent = {
    'conversation:update': ['conversation_updated', 'conversation-update'],
    'message:new': ['new_message'],
    'message:update': ['messages.update', 'message-update'],
    'session:status': ['session_status'],
  };

  messageService.safeSocketEmit(io, eventName, payload, aliasesByEvent[eventName] || []);
}

module.exports = {
  buildMediaUrl,
  buildStandardNewMessageEnvelope,
  emitSocketEvent,
  formatApiMessage,
  getRequestedSessionId,
  getStore,
  normalizeChatId,
  toExactMessageText,
  toIsoTimestamp,
};
