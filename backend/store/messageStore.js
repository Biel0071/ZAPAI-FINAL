/**
 * In-memory message and chat store.
 * Used as primary storage when PostgreSQL is unavailable (DATABASE_URL not set).
 * All data is process-scoped and lost on restart.
 */

const MAX_MESSAGES_PER_CHAT = 500;
const MAX_CHATS = 300;

/** @type {Record<string, { id: string; chatId: string; phone: string; name: string; lastMessage: string; lastMessageTimestamp: string | null; sessionId: string; unread: number; sessionName?: string }>} */
const chats = {};

/** @type {Record<string, Array<{ id: string; chatId: string; phone: string; content: string; fromMe: boolean; createdAt: string; mediaType: string | null; mediaPath: string | null; sessionId: string; conversationId: string; status: string }>>} */
const messages = {};

function normalizeChatId(chatId) {
  return String(chatId || '')
    .replace(/@s\.whatsapp\.net$/i, '')
    .replace(/\s+/g, '')
    .trim();
}

function getOrCreateChat(chatId, meta = {}) {
  const normalized = normalizeChatId(chatId);
  if (!normalized) return null;

  if (!chats[normalized]) {
    chats[normalized] = {
      id: `chat-${normalized}`,
      chatId: normalized,
      phone: normalized,
      name: meta.name && meta.name !== normalized ? meta.name : normalized,
      lastMessage: '',
      lastMessageTimestamp: null,
      sessionId: meta.sessionId || 'main',
      unread: 0,
    };
  }

  if (meta.name && meta.name !== normalized && meta.name !== chats[normalized].name) {
    chats[normalized].name = meta.name;
  }
  if (meta.sessionId) {
    chats[normalized].sessionId = meta.sessionId;
  }

  return chats[normalized];
}

/**
 * Add a message to the in-memory store.
 * @param {string} chatId - Normalized phone number / JID without @suffix
 * @param {{ id?: string; content?: string; text?: string; fromMe?: boolean; createdAt?: string; timestamp?: string; mediaType?: string | null; mediaPath?: string | null; sessionId?: string; conversationId?: string; status?: string; name?: string; contactName?: string }} message
 */
function addMessage(chatId, message) {
  const normalized = normalizeChatId(chatId);
  if (!normalized) return null;

  if (!messages[normalized]) {
    messages[normalized] = [];
  }

  // Deduplicate by id
  const msgId = message.id;
  if (msgId && messages[normalized].some((m) => m.id === msgId)) {
    return messages[normalized].find((m) => m.id === msgId);
  }

  const entry = {
    id: msgId || `mem-${normalized}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    chatId: normalized,
    phone: normalized,
    content: message.content || message.text || '',
    fromMe: Boolean(message.fromMe),
    createdAt: message.createdAt || message.timestamp || new Date().toISOString(),
    mediaType: message.mediaType || null,
    mediaPath: message.mediaPath || null,
    sessionId: message.sessionId || 'main',
    conversationId: message.conversationId || `chat-${normalized}`,
    status: message.status || (message.fromMe ? 'sent' : 'received'),
  };

  messages[normalized].push(entry);

  // Trim oldest to cap per-chat size
  if (messages[normalized].length > MAX_MESSAGES_PER_CHAT) {
    messages[normalized] = messages[normalized].slice(-MAX_MESSAGES_PER_CHAT);
  }

  // Update chat metadata
  const chat = getOrCreateChat(normalized, {
    name: message.name || message.contactName,
    sessionId: message.sessionId,
  });

  if (chat) {
    chat.lastMessage = entry.content || `[${entry.mediaType || 'media'}]`;
    chat.lastMessageTimestamp = entry.createdAt;
    if (!entry.fromMe) {
      chat.unread = (chat.unread || 0) + 1;
    }
  }

  // Evict oldest chats if over capacity
  const chatKeys = Object.keys(chats);
  if (chatKeys.length > MAX_CHATS) {
    const sortedByTime = chatKeys.sort((a, b) => {
      const aTime = new Date(chats[a]?.lastMessageTimestamp || 0).getTime();
      const bTime = new Date(chats[b]?.lastMessageTimestamp || 0).getTime();
      return aTime - bTime;
    });
    const toRemove = sortedByTime.slice(0, chatKeys.length - MAX_CHATS);
    toRemove.forEach((key) => {
      delete chats[key];
      delete messages[key];
    });
  }

  return entry;
}

/**
 * Get messages for a chat, sorted oldest-first.
 * @param {string} chatId
 * @param {number} [limit=50]
 * @param {string | null} [before] - ISO date string; only return messages older than this
 * @returns {Array}
 */
function getMessages(chatId, limit = 50, before = null) {
  const normalized = normalizeChatId(chatId);
  const all = messages[normalized] || [];
  const sorted = [...all].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  if (before) {
    const beforeTime = new Date(before).getTime();
    const filtered = sorted.filter((m) => new Date(m.createdAt).getTime() < beforeTime);
    return filtered.slice(-limit);
  }

  return sorted.slice(-limit);
}

/**
 * Get all chats sorted by most recent message first.
 * @returns {Array}
 */
function getChats() {
  return Object.values(chats).sort((a, b) => {
    const aTime = new Date(a.lastMessageTimestamp || 0).getTime();
    const bTime = new Date(b.lastMessageTimestamp || 0).getTime();
    return bTime - aTime;
  });
}

/**
 * Get a single chat by chatId (normalized phone).
 * @param {string} chatId
 */
function getChat(chatId) {
  const normalized = normalizeChatId(chatId);
  return chats[normalized] || null;
}

function hasChat(chatId) {
  const normalized = normalizeChatId(chatId);
  return Boolean(chats[normalized]);
}

function markChatRead(chatId) {
  const normalized = normalizeChatId(chatId);
  if (chats[normalized]) {
    chats[normalized].unread = 0;
  }
}

function chatCount() {
  return Object.keys(chats).length;
}

function messageCount() {
  return Object.values(messages).reduce((sum, msgs) => sum + msgs.length, 0);
}

/** Reset everything (useful for testing). */
function clearAll() {
  Object.keys(chats).forEach((k) => delete chats[k]);
  Object.keys(messages).forEach((k) => delete messages[k]);
}

module.exports = {
  addMessage,
  chatCount,
  clearAll,
  getChat,
  getChats,
  getMessages,
  getOrCreateChat,
  hasChat,
  markChatRead,
  messageCount,
  normalizeChatId,
};
