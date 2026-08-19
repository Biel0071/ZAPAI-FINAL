/**
 * Pure helpers shared across message controller handlers.
 * Extracted from controllers/messagesController.js (Phase 2a).
 *
 * Dependencies here are other modules, never module-scoped mutable state.
 */

const sessionManager = require('../../../../services/sessionManager');
const messageService = require('../../../../services/messageService');
const whatsappService = require('../../../../services/whatsappService');
const { buildMediaUrl } = require('../../../../services/whatsapp/media/url');
const { ensureWhatsAppJid } = require('../../../../services/whatsapp/shared/identifiers');

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

  try {
    return ensureWhatsAppJid(normalizedPhone);
  } catch {
    return normalizedPhone.includes('@') ? normalizedPhone : `${normalizedPhone}@s.whatsapp.net`;
  }
}

function toIsoTimestamp(value) {
  if (!value) {
    return new Date().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const str = String(value).trim();
  if (/^\d+$/.test(str)) {
    const num = Number(str);
    if (num > 1e9 && num < 9e9) {
      return new Date(num * 1000).toISOString();
    }
    if (num >= 1e12 && num < 9e12) {
      return new Date(num).toISOString();
    }
  }

  const parsed = Date.parse(str);
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

  let mediaType = message.mediaType || null;
  
  if (mediaType === 'media' || mediaType === 'document' || !mediaType) {
    const filename = message.filename || message.fileName || '';
    const mime = message.mimeType || message.mimetype || '';
    const pathOrUrl = message.mediaPath || message.mediaUrl || message.url || '';
    const content = message.content || message.text || '';
    const combined = `${filename} ${mime} ${pathOrUrl}`.toLowerCase();
    const contentLower = String(content).toLowerCase();

    if (contentLower.includes('[image]') || combined.includes('image/') || /(\.png|\.jpe?g|\.gif|\.bmp|\.svg)($|\?|#)/.test(combined)) {
      mediaType = 'image';
    } else if (contentLower.includes('[video]') || combined.includes('video/') || /(\.mp4|\.mov|\.avi|\.mkv|\.webm|\.m4v)($|\?|#)/.test(combined)) {
      mediaType = 'video';
    } else if (contentLower.includes('[audio]') || combined.includes('audio/') || /(\.mp3|\.wav|\.ogg|\.m4a|\.aac|\.opus)($|\?|#)/.test(combined)) {
      mediaType = 'audio';
    } else if (contentLower.includes('[sticker]') || combined.includes('webp') || combined.includes('sticker') || /(\.webp)($|\?|#)/.test(combined)) {
      mediaType = 'sticker';
    } else if (contentLower.includes('[document]') || contentLower.includes('[file]') || message.mediaPath || message.mediaUrl || message.url) {
      mediaType = 'file';
    }
  }

  if (message.mediaPath || message.mediaUrl || message.url || message.mediaType) {
    console.log(`[MEDIA_RECEIVED] Original payload:`, {
      id: message.id,
      mediaPath: message.mediaPath,
      mediaUrl: message.mediaUrl,
      url: message.url,
      mediaType: message.mediaType,
      mimeType: message.mimeType || message.mimetype,
      filename: message.filename || message.fileName
    });
    console.log(`[MEDIA_URL_GENERATED] Generated mediaUrl:`, normalizedMediaUrl);
  }

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
    mediaType: mediaType,
    mediaUrl: normalizedMediaUrl,
    phone: message.phone || null,
    status: message.status || 'sent',
    url: normalizedMediaUrl,
    sessionId: message.sessionId || message.session_id || null,
    mimeType: message.mimeType || message.mimetype || null,
    filename: message.filename || message.fileName || null,
    thumbnail: message.thumbnail ? buildMediaUrl(message.thumbnail) : null,
    whatsappMessageId: message.whatsappMessageId || message.whatsapp_message_id || null,
    isAI: message.isAI || message.is_ai || message.source === 'ai' || message.sender === 'ai' || (message.metadata && (message.metadata.source === 'ai' || message.metadata.ai_response)) || false,
    sender: message.sender || null,
    source: message.source || (message.metadata && message.metadata.source) || (message.metadata && message.metadata.ai_response ? 'ai' : null) || null,
    agentName: message.agentName || message.aiAgentName || (message.metadata && message.metadata.agentName) || null,
  };
}

function buildStandardNewMessageEnvelope(message = {}) {
  const normalized = formatApiMessage(message) || message;
  const resolvedTimestamp = normalized.timestamp || normalized.createdAt || new Date().toISOString();
  const resolvedCreatedAt = normalized.createdAt || toIsoTimestamp(resolvedTimestamp);
  const resolvedUrl = buildMediaUrl(
    normalized.url || normalized.mediaUrl || normalized.mediaPath || ''
  );

  if (normalized.mediaPath || normalized.mediaUrl || normalized.url || normalized.mediaType) {
    console.log(`[MEDIA_URL_SENT_TO_FRONTEND] Envelope payload for message id=${normalized.id}:`, {
      url: resolvedUrl,
      mediaType: normalized.mediaType,
      mimeType: normalized.mimeType,
      filename: normalized.filename
    });
  }

  return {
    chatId: normalizeChatId(normalized.phone || ''),
    sessionId: normalized.sessionId || message.sessionId || message.session_id || null,
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
      sessionId: normalized.sessionId || message.sessionId || message.session_id || null,
      mediaType: normalized.mediaType || null,
      mimeType: normalized.mimeType || null,
      filename: normalized.filename || null,
      thumbnail: normalized.thumbnail || null,
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
