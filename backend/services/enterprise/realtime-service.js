const recentMessages = new Set();
const messageRepository = require('../../repositories/messageRepository');
const BASE_URL = process.env.PUBLIC_URL || 'http://localhost:4025';

function buildMediaUrl(mediaPath = '') {
  const rawPath = String(mediaPath || '').trim();

  if (!rawPath) {
    return null;
  }

  if (rawPath.startsWith('http')) {
    return rawPath;
  }

  const base = String(BASE_URL).trim().replace(/\/+$/, '');
  const normalizedPath = rawPath.replace(/^\/+/, '');

  return `${base}/${normalizedPath}`;
}

function normalizeRealtimeType(type = '') {
  const normalized = String(type || '').toLowerCase();

  if (normalized === 'document') {
    return 'file';
  }

  return normalized || 'text';
}

function normalizePhone(phone = '') {
  return String(phone || '')
    .trim()
    .replace(/@s\.whatsapp\.net$/i, '')
    .replace(/\s+/g, '');
}

function sortMessagesAsc(messages = []) {
  return [...messages].sort(
    (a, b) => new Date(a?.createdAt || a?.timestamp || 0) - new Date(b?.createdAt || b?.timestamp || 0)
  );
}

function dedupeMessages(messages = []) {
  const deduped = new Map();

  for (const entry of messages || []) {
    if (!entry) {
      continue;
    }

    const idKey = String(entry.id || '').trim();
    const fallbackKey = [
      String(entry.phone || '').trim(),
      String(entry.createdAt || entry.timestamp || '').trim(),
      String(entry.content || entry.text || '').trim(),
      String(entry.mediaType || entry.type || '').trim(),
      String(entry.fromMe ?? ''),
    ].join('|');
    const key = idKey || fallbackKey;

    deduped.set(key, entry);
  }

  return Array.from(deduped.values());
}

function normalizeSnapshotMessage(message = {}) {
  const mediaPath = message.url || message.mediaUrl || message.mediaPath || '';

  return {
    ...message,
    type: normalizeRealtimeType(message.type || message.mediaType || 'text'),
    url: buildMediaUrl(mediaPath) || null,
  };
}

async function revalidateConversation(io, message = {}) {
  if (!io) {
    return;
  }

  const normalizedPhone = normalizePhone(message.phone || message.chatId || '');

  if (!normalizedPhone) {
    return;
  }

  const companyId = message.companyId || process.env.DEFAULT_COMPANY_ID || 'default';
  const sessionId = message.sessionId || null;
  const chatId = message.chatId || `${normalizedPhone}@s.whatsapp.net`;
  const sourceMessages = await messageRepository.getMessagesByPhone(normalizedPhone, companyId, sessionId);
  const normalizedMessages = sortMessagesAsc(dedupeMessages(sourceMessages)).map(normalizeSnapshotMessage);

  io.emit('messages:revalidated', {
    chatId,
    messages: normalizedMessages,
  });
  io.emit('messages_snapshot', {
    chatId,
    messages: normalizedMessages,
  });
  io.emit('conversation:revalidated', {
    chatId,
    messages: normalizedMessages,
  });
  io.emit('conversation_snapshot', {
    chatId,
    lastMessage: normalizedMessages[normalizedMessages.length - 1] || null,
    messages: normalizedMessages,
    messagesCount: normalizedMessages.length,
  });
}

function buildRealtimeMessageEnvelope(message = {}) {
  const chatId = message.chatId || `${normalizePhone(message.phone || '')}@s.whatsapp.net`;
  const normalizedType = normalizeRealtimeType(message.type || message.mediaType || 'text');
  const resolvedTimestamp = message.timestamp || message.createdAt || Date.now();
  const resolvedCreatedAt = new Date(
    typeof resolvedTimestamp === 'number' && resolvedTimestamp < 1_000_000_000_000
      ? resolvedTimestamp * 1000
      : resolvedTimestamp
  ).toISOString();
  const mediaPath = message.url || message.mediaPath || '';
  message.url = buildMediaUrl(mediaPath);

  if (message.url) {
    console.log('MEDIA GERADA:', message.url);
  }

  return {
    chatId,
    message: {
      caption: message.caption || message.content || message.text || '',
      content: message.content || message.text || '',
      conversationId: message.conversationId || message.conversation_id || null,
      createdAt: resolvedCreatedAt,
      fromMe: Boolean(message.fromMe),
      id: message.id,
      isGroup: Boolean(message.isGroup),
      participant: message.participant || null,
      status: message.status || (message.fromMe ? 'sent' : 'received'),
      timestamp: resolvedTimestamp,
      type: normalizedType,
      url: message.url || null,
    },
  };
}

function shouldEmitEvent(eventId = '') {
  const key = String(eventId || '').trim();

  if (!key) {
    return true;
  }

  if (recentMessages.has(key)) {
    return false;
  }

  recentMessages.add(key);

  if (recentMessages.size > 5000) {
    const first = recentMessages.values().next().value;
    recentMessages.delete(first);
  }

  return true;
}

function emitNewMessage(ioLike, message = {}) {
  const io = ioLike || global.io;

  if (!io) {
    return;
  }

  const chatId = message.chatId || `${normalizePhone(message.phone || '')}@s.whatsapp.net`;
  const ensuredMessage = {
    ...message,
    chatId,
    id: message?.id || `${chatId}_${Date.now()}`,
  };

  if (!shouldEmitEvent(ensuredMessage.id)) {
    return;
  }

  const envelope = buildRealtimeMessageEnvelope(ensuredMessage);

  if (['image', 'video', 'audio', 'file'].includes(String(envelope?.message?.type || '').toLowerCase()) && !envelope?.message?.url) {
    console.error('SEM URL:', envelope?.message);
    return;
  }

  console.log('EMIT:', envelope.message.id);

  console.log('EMITINDO NEW_MESSAGE:', {
    chatId: envelope.chatId,
    messageId: envelope.message.id,
  });

  io.emit('new_message', envelope);
  io.emit('message:new', {
    conversationId: ensuredMessage.conversationId || null,
    message: envelope.message,
  });

  console.log('FLOW:', {
    saved: true,
    emitted: true,
    chatId: envelope.chatId,
    messageId: envelope.message.id,
  });

  revalidateConversation(io, ensuredMessage).catch((error) => {
    console.error('[REALTIME] revalidateConversation failed:', error?.message || error);
  });
}

module.exports = {
  buildRealtimeMessageEnvelope,
  emitNewMessage,
};
