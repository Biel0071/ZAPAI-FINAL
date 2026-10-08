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

async function resolveOutboundContext(req, { requireConnected = true } = {}) {
  const companyId = String(req.authTenantId || '').trim();
  const reject = (status, code, message) => { throw Object.assign(new Error(message), { status, code }); };
  if (!companyId) reject(401, 'AUTH_REQUIRED', 'Autenticação da empresa obrigatória.');
  const payload = req.body || {};
  const conversationId = payload.conversationId || req.query?.conversationId || null;
  const { query } = require('../../../infrastructure/config/database');
  const repository = require('../../../data/repositories/conversationRepository');
  const { getPhoneAliases } = require('../../../../services/whatsapp/shared/identifiers');
  const sameRecipient = (left, right) => {
    if (String(left || '') === String(right || '')) return true;
    if (String(left || '').includes('@g.us') || String(right || '').includes('@g.us')) return false;
    const aliases = new Set(getPhoneAliases(left));
    return getPhoneAliases(right).some(alias => aliases.has(alias));
  };
  const conversation = conversationId ? await repository.getConversationById(conversationId, companyId) : null;
  if (conversationId && (!conversation || String(conversation.company_id || conversation.companyId) !== companyId)) {
    reject(404, 'CONVERSATION_NOT_FOUND', 'Conversa não encontrada nesta empresa.');
  }
  const explicitTarget = payload.chatId || payload.phone || payload.from || req.params?.phone;
  const shortId = /^\d{1,6}$/.test(String(explicitTarget || '').trim());
  const conversationTarget = conversation?.remote_jid || conversation?.remoteJid || conversation?.phone;
  if (explicitTarget && conversation && !shortId && !sameRecipient(explicitTarget, conversationTarget) && !sameRecipient(explicitTarget, conversation.phone)) {
    reject(409, 'DESTINATION_MISMATCH', 'O destino não corresponde à conversa selecionada.');
  }
  const targetJidOrPhone = conversationTarget || explicitTarget;
  const normalizedPhone = whatsappService.normalizePhone(targetJidOrPhone);
  if (!normalizedPhone || (shortId && !conversation)) reject(400, 'INVALID_RECIPIENT', 'Selecione um destino válido para enviar.');
  const requestedSession = String(payload.sessionName || payload.sessionId || req.headers?.['x-session-id'] || req.query?.sessionId || '').trim();
  const conversationSession = conversation?.session_id || conversation?.sessionId;

  const requestedName = sessionManager.normalizeSessionName(requestedSession || conversationSession || sessionManager.DEFAULT_SESSION);
  let ownedSession = (await query(
    'SELECT session_id, session_name FROM sessions WHERE company_id = $1 AND (session_id = $2 OR session_name = $2) LIMIT 1',
    [companyId, requestedName]
  )).rows[0];

  if (!ownedSession && conversationSession) {
    const convSessionName = sessionManager.normalizeSessionName(conversationSession);
    ownedSession = (await query(
      'SELECT session_id, session_name FROM sessions WHERE company_id = $1 AND (session_id = $2 OR session_name = $2) LIMIT 1',
      [companyId, convSessionName]
    )).rows[0];
  }

  // Fallback to active connected session for the company if legacy/aliased session requested
  if (!ownedSession) {
    ownedSession = (await query(
      "SELECT session_id, session_name FROM sessions WHERE company_id = $1 AND (status = 'connected' OR connected = true) ORDER BY updated_at DESC LIMIT 1",
      [companyId]
    )).rows[0];
  }

  // Final fallback to any session of the company
  if (!ownedSession) {
    ownedSession = (await query(
      "SELECT session_id, session_name FROM sessions WHERE company_id = $1 ORDER BY updated_at DESC LIMIT 1",
      [companyId]
    )).rows[0];
  }

  if (!ownedSession) reject(403, 'SESSION_FORBIDDEN', 'A conexão não pertence à empresa autenticada.');
  const targetSessionName = sessionManager.normalizeSessionName(ownedSession.session_id || ownedSession.session_name || requestedName);
  const session = sessionManager.getSession(targetSessionName);
  if (session?.companyId && String(session.companyId) !== companyId) reject(403, 'SESSION_FORBIDDEN', 'A conexão não pertence à empresa autenticada.');
  const contactId = payload.contactId || conversation?.contact_id || conversation?.lead_id || null;
  if (payload.contactId && conversation && String(contactId) !== String(conversation.contact_id || conversation.lead_id)) {
    reject(409, 'CONTACT_MISMATCH', 'O contato não corresponde à conversa selecionada.');
  }
  if (contactId) {
    const contact = (await query('SELECT id, phone FROM leads WHERE id = $1 AND company_id = $2 LIMIT 1', [contactId, companyId])).rows[0];
    if (!contact) reject(404, 'CONTACT_NOT_FOUND', 'Contato não encontrado nesta empresa.');
    if (!String(targetJidOrPhone).includes('@lid') && !String(targetJidOrPhone).includes('@g.us') && !sameRecipient(contact.phone, normalizedPhone)) {
      reject(409, 'CONTACT_MISMATCH', 'O destino não corresponde ao contato selecionado.');
    }
  }
  if (requireConnected && (!session?.sock || String(session.status || '').toLowerCase() !== 'connected' || session.systemConnected === false)) {
    reject(409, 'WHATSAPP_SESSION_OFFLINE', 'A conexão WhatsApp está desconectada. Reconecte para enviar.');
  }
  return { companyId, conversation, conversationId: conversation?.id || null, contactId, normalizedPhone, targetJidOrPhone, targetSessionName, session };
}

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
      isAI: Boolean(normalized.isAI),
      sender: normalized.sender || (normalized.fromMe ? 'agent' : 'client'),
      source: normalized.source || null,
      agentName: normalized.agentName || null,
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

  const companyId = reqOrStore?.authTenantId || payload?.companyId || payload?.company_id;
  if (companyId) {
    require('../../../../services/realtime/tenantRooms').emitToTenantWithAliases(io, companyId, eventName, payload, aliasesByEvent[eventName] || []);
  } else if (!reqOrStore?.app) {
    messageService.safeSocketEmit(io, eventName, payload, aliasesByEvent[eventName] || []);
  }
}

module.exports = {
  buildMediaUrl,
  buildStandardNewMessageEnvelope,
  emitSocketEvent,
  formatApiMessage,
  getRequestedSessionId,
  getStore,
  normalizeChatId,
  resolveOutboundContext,
  toExactMessageText,
  toIsoTimestamp,
};
