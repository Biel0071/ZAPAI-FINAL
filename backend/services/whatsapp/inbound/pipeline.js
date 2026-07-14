/**
 * Inbound message pipeline: media download, extraction, dedupe, persistence.
 * Extracted from whatsappService.legacy.js (Phase 2b-5).
 *
 * Exports:
 *   - downloadMedia(mediaMessage, mediaType): fetches media via Baileys and
 *     the enterprise media service, returning a normalized descriptor.
 *   - extractIncomingMessage(messageData): normalizes a raw Baileys upsert
 *     payload into the internal message shape.
 *   - formatInboundSavedMessage(result, fallback): normalizes the DB-saved
 *     message into the realtime contract.
 *   - buildRealtimeDeduplicationKey / shouldProcessRealtimeMessage: per
 *     -session ring buffer dedupe.
 *   - shouldProcessGlobalMessageId: unified TTL-based dedupe (bugfix #3).
 *   - persistRealtimeMessage / persistInboundMessageFallback: DB persistence
 *     helpers used by the realtime listener.
 *
 * `MAX_RECENT_MESSAGE_IDS` is duplicated from the legacy constant; when the
 * legacy file no longer uses it we can collapse the duplication.
 */


const conversationRepository = require('../../../repositories/conversationRepository');
const messageRepository = require('../../../repositories/messageRepository');
const messageDedupeService = require('../../messageDedupeService');
const enterpriseMessageService = require('../../enterprise/message-service');
const enterpriseMediaService = require('../../enterprise/media-service');
const { normalizePhone } = require('../shared/identifiers');
const { toUnixMillis } = require('../shared/time');
const {
  extractMessageText,
  getMediaDescriptor,
  unwrapMessageContent,
} = require('./parser');
const {
  buildMediaUrl,
  normalizeRealtimeMediaType,
} = require('../media/url');

const MAX_RECENT_MESSAGE_IDS = 500;

async function downloadMedia(mediaMessage, mediaType) {
  if (!mediaMessage || !mediaType) {
    return null;
  }

  try {
    const { downloadContentFromMessage, downloadMediaMessage } = await import('@whiskeysockets/baileys');

    const downloaded = await enterpriseMediaService.downloadFromWhatsApp({
      downloadContentFromMessage,
      downloadMediaMessage,
      mediaMessage,
      mediaType,
      tenantId: process.env.DEFAULT_COMPANY_ID || 'default',
    });

    if (!downloaded) {
      console.warn(`[MEDIA] downloadFromWhatsApp returned null for type=${mediaType}`);
      return null;
    }

    const absoluteUrl = buildMediaUrl(downloaded.url || downloaded.filePath || '');
    console.log(`[MEDIA] Downloaded ${mediaType}: ${absoluteUrl}`);

    return {
      ...downloaded,
      type: normalizeRealtimeMediaType(downloaded.type || mediaType),
      url: absoluteUrl || null,
    };
  } catch (error) {
    console.error(`[MEDIA] Failed to download ${mediaType}:`, error?.message || error);
    return null;
  }
}

async function extractIncomingMessage(messageData = {}, options = {}) {
  const phone = messageData.key?.remoteJid;
  const name = messageData.pushName || 'Unknown';
  const timestamp = messageData.messageTimestamp
    ? Number(messageData.messageTimestamp) * 1000
    : Date.now();
  const isGroup = String(phone || '').endsWith('@g.us');
  const participant = isGroup
    ? (messageData.key?.participant || messageData.participant || messageData.pushName || null)
    : null;

  if (!phone || (!phone.endsWith('@s.whatsapp.net') && !phone.endsWith('@g.us') && !phone.endsWith('@lid'))) {
    return null;
  }

  const normalizedMessage = unwrapMessageContent(messageData.message || {});
  const { mediaMessage, mediaType } = getMediaDescriptor(normalizedMessage);
  const text = extractMessageText(messageData);
  const skipMediaDownload = Boolean(options.skipMediaDownload);
  let mediaInfo = null;

  if (mediaMessage && !skipMediaDownload) {
    try {
      mediaInfo = await downloadMedia(mediaMessage, mediaType);
    } catch (error) {
      console.error('[PIPELINE] Media download failed during extraction:', error?.message || error);
    }
  }

  const mediaPath = mediaInfo?.filePath || null;
  const mediaUrl = mediaInfo?.url || null;

  return {
    companyId: process.env.DEFAULT_COMPANY_ID || 'default',
    externalMessageId: messageData.key?.id || null,
    remoteJid: messageData.key?.remoteJid || null,
    fileName: mediaInfo?.fileName || mediaMessage?.fileName || null,
    isGroup,
    mediaPath,
    mediaUrl,
    mediaType,
    mimeType: mediaInfo?.mimeType || mediaMessage?.mimetype || null,
    name,
    participant,
    phone: isGroup ? phone : normalizePhone(phone),
    size: mediaInfo?.size || (mediaMessage?.fileLength ? Number(mediaMessage.fileLength) : null),
    text,
    timestamp: new Date(timestamp).toISOString(),
    type: mediaInfo?.type || mediaType || 'text',
    hash: mediaInfo?.hash || null,
  };
}

function formatInboundSavedMessage(result = {}, fallback = {}) {
  if (!result?.message) {
    return null;
  }

  return {
    ...result.message,
    content: result.message.content || result.message.text || fallback.text || '',
    conversationId:
      result.message.conversationId ||
      result.conversation?.id ||
      fallback.conversationId ||
      null,
    createdAt: result.message.createdAt || result.message.timestamp || new Date().toISOString(),
    fromMe:
      typeof result.message.fromMe === 'boolean'
        ? result.message.fromMe
        : result.message.from === 'agent',
    phone: result.message.phone || fallback.phone || null,
    status: result.message.status || 'received',
    text: result.message.text || result.message.content || fallback.text || '',
    timestamp:
      result.message.timestamp ||
      result.message.createdAt ||
      fallback.timestamp ||
      new Date().toISOString(),
    whatsappMessageId: fallback.id || null,
    mediaPath: result.message.mediaPath || fallback.mediaPath || null,
    mediaType: result.message.mediaType || result.message.type || fallback.mediaType || fallback.type || null,
    mimeType: result.message.mimeType || fallback.mimeType || null,
    fileName: result.message.fileName || fallback.fileName || null,
    size: result.message.size || fallback.size || null,
    mediaUrl: result.message.mediaUrl || result.message.url || fallback.mediaUrl || fallback.url || null,
    url: result.message.url || result.message.mediaUrl || fallback.url || fallback.mediaUrl || null,
  };
}

function buildRealtimeDeduplicationKey(incomingMessage = {}, fallbackChatId = '') {
  const messageId = incomingMessage?.key?.id;

  if (messageId) {
    return messageId;
  }

  const chatId = incomingMessage?.key?.remoteJid || fallbackChatId;
  const timestamp = toUnixMillis(incomingMessage?.messageTimestamp || Date.now());
  const messageType = Object.keys(unwrapMessageContent(incomingMessage?.message || {}))[0] || 'unknown';
  const text = extractMessageText(incomingMessage?.message || '').slice(0, 64);

  return `${chatId}:${timestamp}:${messageType}:${text}`;
}

function shouldProcessRealtimeMessage(session, dedupeKey) {
  if (!session || !dedupeKey) {
    return true;
  }

  if (!session.recentMessageIds) {
    session.recentMessageIds = new Set();
    session.recentMessageOrder = [];
  }

  if (session.recentMessageIds.has(dedupeKey)) {
    return false;
  }

  session.recentMessageIds.add(dedupeKey);
  session.recentMessageOrder.push(dedupeKey);

  if (session.recentMessageOrder.length > MAX_RECENT_MESSAGE_IDS) {
    const removedMessageId = session.recentMessageOrder.shift();

    if (removedMessageId) {
      session.recentMessageIds.delete(removedMessageId);
    }
  }

  return true;
}

function shouldProcessGlobalMessageId(messageId = '') {
  // Bugfix#3: unified TTL-based dedupe shared with messagesController.
  return messageDedupeService.markSeen('inbound_event', messageId);
}

async function persistRealtimeMessage({ incomingMessage, sessionId }) {
  const payload = await extractIncomingMessage(incomingMessage);

  if (!payload?.phone || (!payload.text && !payload.mediaType)) {
    return null;
  }

  if (payload.mediaType) {
    console.log(`[MEDIA] [MEDIA_RECEIVED] Inbound media detected: type=${payload.mediaType} mimeType=${payload.mimeType}`);
    console.log(`[MEDIA] [MEDIA_PATH] File path: ${payload.mediaPath}`);
    console.log(`[MEDIA] [MEDIA_URL] URL: ${payload.mediaUrl}`);
    console.log(`[MEDIA] [MEDIA_STATUS] Download status: ${payload.mediaPath ? 'SUCCESS' : 'FAILED'}`);
  }

  return enterpriseMessageService.persistInboundMessage({
    companyId: payload.companyId,
    fileName: payload.fileName,
    fromMe: Boolean(incomingMessage.key?.fromMe),
    mediaPath: payload.mediaPath,
    mediaType: payload.mediaType,
    mimeType: payload.mimeType,
    name: payload.name,
    participant: payload.participant,
    phone: payload.phone,
    sessionId,
    size: payload.size,
    status: incomingMessage.key?.fromMe ? 'sent' : 'received',
    text: payload.text,
    timestamp: payload.timestamp || new Date().toISOString(),
    type: payload.type,
    url: payload.mediaUrl || payload.mediaPath,
    hash: payload.hash || null,
  });
}

async function persistInboundMessageFallback(sessionId, incomingMessage, debugPayload) {
  const phone = debugPayload.phone;

  if (!phone) {
    return null;
  }

  const { mediaType } = getMediaDescriptor(incomingMessage?.message || {});
  let resolvedType = mediaType;
  if (!resolvedType && debugPayload.text === '[media]') {
    const msgKeys = Object.keys(unwrapMessageContent(incomingMessage?.message || {}));
    if (msgKeys.some(k => k.includes('image') || k.includes('Image'))) resolvedType = 'image';
    else if (msgKeys.some(k => k.includes('video') || k.includes('Video'))) resolvedType = 'video';
    else if (msgKeys.some(k => k.includes('audio') || k.includes('Audio'))) resolvedType = 'audio';
    else if (msgKeys.some(k => k.includes('sticker') || k.includes('Sticker'))) resolvedType = 'sticker';
    else resolvedType = 'media';
  }
  if (!resolvedType) resolvedType = 'text';

  const text = debugPayload.text || (resolvedType !== 'text' ? `[${resolvedType}]` : '');

  const conversation = await conversationRepository.findOrCreateConversationByPhone({
    companyId: process.env.DEFAULT_COMPANY_ID || 'default',
    contactName: incomingMessage.pushName || phone,
    lastMessage: text,
    lastMessageType: resolvedType,
    phone,
    sessionId,
    aiEnabled: true,
  });

  if (conversation && conversation.aiEnabled === false) {
    await conversationRepository.updateConversationAIEnabled(phone, true, process.env.DEFAULT_COMPANY_ID || 'default');
    conversation.aiEnabled = true;
  }

  const savedMessage = await messageRepository.create({
    content: text,
    conversationId: conversation.id,
    createdAt: new Date(debugPayload.timestamp).toISOString(),
    fromMe: false,
    messageType: resolvedType,
    phone,
    sessionId,
    status: 'received',
  });

  if (!savedMessage) {
    throw new Error('Failed to persist incoming message');
  }

  // eslint-disable-next-line no-console
  console.log('MESSAGE SAVED', savedMessage);

  const updatedConversation = await conversationRepository.updateConversationState(
    conversation.id,
    {
      lastMessage: text,
      lastMessageType: resolvedType,
      session_id: sessionId,
      status: 'open',
      unreadCount: (Number(conversation.unreadCount) || 0) + 1,
    }
  );

  return {
    conversation: updatedConversation || conversation,
    message: savedMessage,
  };
}

module.exports = {
  MAX_RECENT_MESSAGE_IDS,
  buildRealtimeDeduplicationKey,
  downloadMedia,
  extractIncomingMessage,
  formatInboundSavedMessage,
  persistInboundMessageFallback,
  persistRealtimeMessage,
  shouldProcessGlobalMessageId,
  shouldProcessRealtimeMessage,
};
