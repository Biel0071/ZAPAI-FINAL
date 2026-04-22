/**
 * Chat-level operations: session lookup, config, tagging, archiving, AI toggle.
 * Extracted from whatsappService.legacy.js (Phase 2c).
 *
 * These functions read/write the shared `activeSessions` and `chats`
 * registries (see `state/registry.js`) and delegate realtime broadcasting
 * to `realtime/events.js` + `realtime/chatState.js`. They keep the exact
 * semantics of the legacy file — same return shapes, same edge-case
 * behaviour (e.g. `addTag` falls back to the legacy `chats` store when
 * no realtime session owns the chatId yet).
 *
 * No module-scoped mutable state (only the shared registries).
 */

const { normalizeSessionName } = require('../shared/identifiers');
const { ensureRealtimeStore } = require('../realtime/chatState');
const {
  emitChatsLoaded,
  emitChatUpdated,
} = require('../realtime/events');
const { emitRealtimeMetrics } = require('../realtime/metrics');
const { activeSessions, chats } = require('../state/registry');

function findSessionForChat(chatId, sessionId = null) {
  const preferredSession = sessionId
    ? activeSessions[normalizeSessionName(sessionId)]
    : null;

  if (preferredSession?.realtimeStore?.chats?.[chatId]) {
    return preferredSession;
  }

  for (const session of Object.values(activeSessions)) {
    if (session?.realtimeStore?.chats?.[chatId]) {
      return session;
    }
  }

  return preferredSession || null;
}

function getChatConfig(chatId, sessionId = null) {
  const session = findSessionForChat(chatId, sessionId);

  if (!session) {
    return {
      aiEnabled: true,
      archived: false,
      assignedTo: null,
      tags: [],
    };
  }

  const store = ensureRealtimeStore(session);
  const chat = store.chats?.[chatId];

  if (!chat) {
    return {
      aiEnabled: true,
      archived: false,
      assignedTo: null,
      tags: [],
    };
  }

  return {
    aiEnabled: chat.aiEnabled !== false,
    archived: chat.archived === true,
    assignedTo: chat.assignedTo || null,
    tags: Array.isArray(chat.tags) ? chat.tags : [],
  };
}

function getOrCreateChat(chatId = '') {
  const normalizedChatId = String(chatId || '').trim();

  if (!normalizedChatId) {
    return null;
  }

  if (!chats[normalizedChatId]) {
    chats[normalizedChatId] = {
      archived: false,
      messages: [],
      tags: [],
    };
  }

  return chats[normalizedChatId];
}

function saveMessage(message = {}) {
  const from = String(message.from || '').trim();
  const chat = getOrCreateChat(from);

  if (!chat) {
    return false;
  }

  chat.messages.push(message);
  return true;
}

function addTag(chatId, tag) {
  const session = findSessionForChat(chatId);
  const store = session ? ensureRealtimeStore(session) : null;
  const targetChat = store?.chats?.[chatId];

  if (targetChat) {
    const safeTag = String(tag || '').trim();

    if (!safeTag) {
      return false;
    }

    if (!Array.isArray(targetChat.tags)) {
      targetChat.tags = [];
    }

    if (!targetChat.tags.includes(safeTag)) {
      targetChat.tags.push(safeTag);
      emitChatUpdated(session?.io || global.io, targetChat);
    }

    return true;
  }

  const chat = getOrCreateChat(chatId);

  if (!chat) {
    return false;
  }

  const safeTag = String(tag || '').trim();

  if (!safeTag) {
    return false;
  }

  if (!Array.isArray(chat.tags)) {
    chat.tags = [];
  }

  if (!chat.tags.includes(safeTag)) {
    chat.tags.push(safeTag);
  }

  return true;
}

function archiveChat(chatId) {
  const session = findSessionForChat(chatId);
  const store = session ? ensureRealtimeStore(session) : null;
  const targetChat = store?.chats?.[chatId];

  if (targetChat) {
    targetChat.archived = true;
    targetChat.updatedAt = Date.now();
    emitChatUpdated(session?.io || global.io, targetChat);
    emitChatsLoaded(session?.io || global.io, store);
    emitRealtimeMetrics(session?.io || global.io, store);
    return true;
  }

  const chat = getOrCreateChat(chatId);

  if (!chat) {
    return false;
  }

  chat.archived = true;
  return true;
}

function removeTag(chatId, tag) {
  const session = findSessionForChat(chatId);
  const store = session ? ensureRealtimeStore(session) : null;
  const targetChat = store?.chats?.[chatId];

  if (!targetChat) {
    return false;
  }

  const safeTag = String(tag || '').trim();

  if (!safeTag || !Array.isArray(targetChat.tags)) {
    return false;
  }

  const initialLength = targetChat.tags.length;
  targetChat.tags = targetChat.tags.filter((entry) => entry !== safeTag);

  if (targetChat.tags.length !== initialLength) {
    targetChat.updatedAt = Date.now();
    emitChatUpdated(session?.io || global.io, targetChat);
    return true;
  }

  return false;
}

function toggleAI(chatId, sessionId = null) {
  const session = findSessionForChat(chatId, sessionId);

  if (!session) {
    return null;
  }

  const store = ensureRealtimeStore(session);
  const targetChat = store.chats?.[chatId];

  if (!targetChat) {
    return null;
  }

  targetChat.aiEnabled = targetChat.aiEnabled === false;
  targetChat.updatedAt = Date.now();
  emitChatUpdated(session?.io || global.io, targetChat);
  return targetChat;
}

module.exports = {
  addTag,
  archiveChat,
  findSessionForChat,
  getChatConfig,
  getOrCreateChat,
  removeTag,
  saveMessage,
  toggleAI,
};
