/**
 * Pure realtime chat-state helpers.
 * Extracted from whatsappService.legacy.js (Phase 2a).
 *
 * These functions manipulate plain-object chat/contact state passed in by the
 * caller. No socket I/O, no DB, no module-scoped mutable state.
 *
 * Constants previously lived as module-level `const`s in the legacy file.
 * Values here match the legacy behavior.
 */

const { toUnixMillis } = require('../shared/time');
const { extractMessageText, unwrapMessageContent } = require('../inbound/parser');

const CHAT_HISTORY_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_CHAT_HISTORY_MESSAGES = 500;

function isValidRealtimeChatId(chatId) {
  const normalizedChatId = String(chatId || '').trim();

  if (!normalizedChatId) {
    return false;
  }

  if (normalizedChatId.includes('status@broadcast')) {
    return false;
  }

  return true;
}

function getMessagePreview(message = {}) {
  const text = String(message?.text || '').trim();

  if (text) {
    return text;
  }

  if (message?.type && message.type !== 'unknown') {
    return `[${message.type}]`;
  }

  return '';
}

function createRealtimeChatState({ chatId, isGroup, name }) {
  return {
    aiEnabled: true,
    archived: false,
    assignedTo: null,
    id: chatId,
    isGroup: Boolean(isGroup),
    lastMessage: '',
    messages: [],
    name: name || chatId,
    tags: [],
    updatedAt: Date.now(),
  };
}

function pruneChatMessages(messages = []) {
  const cutoff = Date.now() - CHAT_HISTORY_WINDOW_MS;
  const recentMessages = (Array.isArray(messages) ? messages : []).filter(
    (entry) => toUnixMillis(entry?.timestamp) >= cutoff
  );

  if (recentMessages.length <= MAX_CHAT_HISTORY_MESSAGES) {
    return recentMessages;
  }

  return recentMessages.slice(-MAX_CHAT_HISTORY_MESSAGES);
}

function ensureRealtimeStore(session) {
  if (!session.realtimeStore) {
    session.realtimeStore = {
      chats: Object.create(null),
      contacts: Object.create(null),
      metrics: {
        activeChats: 0,
        todayMessages: 0,
        totalMessages: 0,
      },
    };
  }

  return session.realtimeStore;
}

function normalizeContactKey(value = '') {
  const normalized = String(value || '').trim();

  if (!normalized) {
    return '';
  }

  return normalized.replace(/@s\.whatsapp\.net$/i, '');
}

function resolveContactForChat(store, chatId) {
  if (!store?.contacts || !chatId) {
    return null;
  }

  const direct = store.contacts[chatId];
  if (direct) {
    return direct;
  }

  const normalized = normalizeContactKey(chatId);
  return store.contacts[normalized] || store.contacts[`${normalized}@s.whatsapp.net`] || null;
}

function getRecentChatHistory(chat = {}, limit = 20) {
  const messages = Array.isArray(chat?.messages) ? chat.messages : [];

  return messages.slice(-Math.max(1, Number(limit) || 20)).map((entry) => ({
    from: entry?.fromMe ? 'agent' : 'contact',
    mediaType: entry?.type,
    text: entry?.text || '',
  }));
}

function buildRealtimeIncomingMessage(msg = {}) {
  const normalizedMessage = unwrapMessageContent(msg.message || {});
  const type = Object.keys(normalizedMessage || {})[0] || 'unknown';
  const text = extractMessageText(normalizedMessage);
  const fromMe = Boolean(msg.key?.fromMe);
  const chatId = msg.key?.remoteJid || null;
  const isGroup = String(chatId || '').endsWith('@g.us');
  const participant = isGroup
    ? msg.key?.participant || msg.participant || msg.pushName || null
    : null;

  return {
    chatId,
    fromMe,
    id: msg.key?.id || null,
    isGroup,
    participant,
    status: fromMe ? 'sent' : 'received',
    text,
    timestamp: toUnixMillis(msg.messageTimestamp),
    type,
  };
}

function isMessageConfirmed(message = {}) {
  const status = String(message?.status || '').trim().toLowerCase();

  if (!status) {
    return false;
  }

  return ['confirmed', 'delivered', 'read', 'received', 'sent'].includes(status);
}

module.exports = {
  CHAT_HISTORY_WINDOW_MS,
  MAX_CHAT_HISTORY_MESSAGES,
  buildRealtimeIncomingMessage,
  createRealtimeChatState,
  ensureRealtimeStore,
  getMessagePreview,
  getRecentChatHistory,
  isMessageConfirmed,
  isValidRealtimeChatId,
  normalizeContactKey,
  pruneChatMessages,
  resolveContactForChat,
};
