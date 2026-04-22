/**
 * Pure realtime payload builders. Extracted from whatsappService.legacy.js (Phase 2a).
 *
 * These functions convert persisted / wire message shapes into the envelope
 * the websocket clients expect. They are pure — no sockets, no DB.
 */

const { DEFAULT_SESSION, ensureWhatsAppJid, normalizeSessionName } = require('../shared/identifiers');
const { toRealtimeTimestamp, toUnixMillis } = require('../shared/time');
const { buildMediaUrl, normalizeRealtimeMediaType } = require('../media/url');
const { extractMessageText, getMediaDescriptor } = require('../inbound/parser');

function buildRealtimeMessagePayload(message = {}) {
  const resolvedType = normalizeRealtimeMediaType(message.mediaType || message.type || 'text');

  const content = message.text || message.content || '';
  const caption = message.caption || content;
  const mediaPath = message.url || message.mediaPath || '';
  message.url = buildMediaUrl(mediaPath);

  if (message.url) {
    // Preserve the original side-effect log so ops dashboards stay the same.
    // eslint-disable-next-line no-console
    console.log('MEDIA GERADA:', message.url);
  }

  return {
    chatId: ensureWhatsAppJid(message.phone || ''),
    caption,
    content,
    conversationId: message.conversationId || message.conversation_id || null,
    fromMe:
      typeof message.fromMe === 'boolean'
        ? message.fromMe
        : message.from === 'agent' || message.sender === 'agent',
    id: message.id,
    isGroup: Boolean(message.isGroup),
    participant: message.participant || null,
    phone: message.phone,
    sessionId: normalizeSessionName(message.sessionId || message.sessionName || DEFAULT_SESSION),
    text: message.text || message.content || '',
    timestamp: toRealtimeTimestamp(message.timestamp),
    type: resolvedType,
    url: message.url,
  };
}

function buildStandardNewMessageEnvelope({ chatId, message = {} }) {
  const normalizedType = normalizeRealtimeMediaType(message.mediaType || message.type || 'text');
  const normalizedTimestamp = toUnixMillis(message.timestamp || message.createdAt || Date.now());
  const normalizedCreatedAt = new Date(normalizedTimestamp).toISOString();
  const normalizedContent = String(message.content || message.text || '').trim();
  const mediaPath = message.url || message.mediaPath || '';
  message.url = buildMediaUrl(mediaPath);

  if (message.url) {
    // eslint-disable-next-line no-console
    console.log('MEDIA GERADA:', message.url);
  }

  return {
    chatId,
    message: {
      caption: message.caption || normalizedContent,
      content: normalizedContent,
      conversationId: message.conversationId || message.conversation_id || null,
      createdAt: normalizedCreatedAt,
      fromMe: Boolean(message.fromMe),
      id: message.id || `msg-${normalizedTimestamp}`,
      isGroup: Boolean(message.isGroup),
      participant: message.participant || null,
      timestamp: normalizedTimestamp,
      type: normalizedType,
      url: message.url || null,
    },
  };
}

function buildRealtimeMediaPayload({ messageData = {}, savedMessage = {}, sessionId }) {
  const { mediaType } = getMediaDescriptor(messageData.message || {});

  if (!mediaType) {
    return null;
  }

  const realtimeType = normalizeRealtimeMediaType(mediaType);

  const text =
    extractMessageText(messageData.message || '') || savedMessage.text || savedMessage.content || '';
  const realtimeTimestamp = messageData.messageTimestamp
    ? Number(messageData.messageTimestamp) * 1000
    : toRealtimeTimestamp(savedMessage.timestamp || savedMessage.createdAt);

  savedMessage.url = buildMediaUrl(savedMessage.mediaPath || savedMessage.url || '');

  if (savedMessage.url) {
    // eslint-disable-next-line no-console
    console.log('MEDIA GERADA:', savedMessage.url);
  }

  return {
    caption: text,
    url: savedMessage.url,
    chatId: messageData.key?.remoteJid || ensureWhatsAppJid(savedMessage.phone || ''),
    conversationId: savedMessage.conversationId || null,
    fromMe: Boolean(messageData.key?.fromMe),
    id: messageData.key?.id || savedMessage.id || null,
    isGroup: String(messageData.key?.remoteJid || '').endsWith('@g.us'),
    mediaPath: savedMessage.mediaPath || null,
    mediaType: realtimeType,
    mimetype:
      messageData.message?.imageMessage?.mimetype ||
      messageData.message?.videoMessage?.mimetype ||
      messageData.message?.audioMessage?.mimetype ||
      messageData.message?.documentMessage?.mimetype ||
      null,
    participant: messageData.key?.participant || messageData.participant || messageData.pushName || null,
    sessionId: normalizeSessionName(sessionId || savedMessage.sessionId || DEFAULT_SESSION),
    text,
    timestamp: realtimeTimestamp,
    type: realtimeType,
  };
}

module.exports = {
  buildRealtimeMediaPayload,
  buildRealtimeMessagePayload,
  buildStandardNewMessageEnvelope,
};
