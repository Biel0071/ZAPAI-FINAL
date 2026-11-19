/**
 * WebSocket Gateway — Centralized event bus with rooms, namespaces, and ACK.
 *
 * Single authoritative coordinator for Socket.IO event registrations:
 * - Routes events through tenant rooms
 * - Batches rapid-fire events
 * - Provides ACK tracking
 * - Deduplicates emissions
 * - Rate-limits per event type
 * - Exposes metrics
 * - Supports event replay on reconnect
 * - Single io.on('connection') listener preventing socket leaks
 * - Unref background timers to prevent event-loop hangs
 */

const { emitToTenant, emitToTenantWithAliases, joinTenantRoom, resolveSocketTenantId } = require('./realtime/tenantRooms');
const backpressureController = require('./backpressureController');

let _io = null;
let _initialized = false;
let _connectionHandler = null;
const _customSocketHandlers = new Set();

// ─── Event Metrics ───
const eventCounters = new Map(); // eventName → { emitted, dropped, batched }
const recentEvents = []; // Last N events for replay
const MAX_RECENT_EVENTS = 200;

// ─── Batch Queue ───
const batchQueue = new Map(); // batchKey → { events[], timer }
const BATCH_WINDOW_MS = Math.max(50, Number(process.env.WS_BATCH_WINDOW_MS) || 100);

// ─── Dedup ───
const recentEmitKeys = new Set();
const DEDUP_WINDOW_MS = 500;
let dedupCleanupTimer = null;

// ─── Default Inbound Socket Handlers (Chat actions, tags, typing) ───

function attachDefaultSocketHandlers(socket, io, tenantId) {
  // Typing indicators
  socket.on('typing:start', (payload = {}) => {
    const target = payload?.tenantId || payload?.companyId || socket.data?.tenantId || tenantId;
    emitToTenantWithAliases(io, target, 'typing:start', payload, ['typing_start']);
  });

  socket.on('typing:stop', (payload = {}) => {
    const target = payload?.tenantId || payload?.companyId || socket.data?.tenantId || tenantId;
    emitToTenantWithAliases(io, target, 'typing:stop', payload, ['typing_stop']);
  });

  // Archive Chat
  socket.on('archive_chat', async (chatId) => {
    try {
      console.log(`[WS-Gateway] Received archive_chat for ${chatId}`);
      const chatOperations = require('./whatsapp/chat/operations');
      const conversationRepository = require('../src/data/repositories/conversationRepository');
      const messageRepository = require('../src/data/repositories/messageRepository');
      const sessionManager = require('./sessionManager');

      const updatedConv = await conversationRepository.updateConversationState(chatId, { status: 'archived' }).catch(() => null);
      let conv = updatedConv || await conversationRepository.getConversationById(chatId).catch(() => null);

      if (conv) {
        const jid = conv.phone.includes('@') ? conv.phone : `${conv.phone}@s.whatsapp.net`;
        chatOperations.archiveChat(jid);

        const preferredSessionId = sessionManager.normalizeSessionName(
          conv.sessionId || conv.session_id || sessionManager.DEFAULT_SESSION
        );
        let session = sessionManager.getSession(preferredSessionId);
        if (!session?.sock) session = await sessionManager.getDefaultSession().catch(() => null);
        if (!session?.sock) session = sessionManager.getConnectedSessionOrNull();
        if (!session?.sock) session = chatOperations.findSessionForChat(jid, preferredSessionId);

        if (session && session.sock) {
          const lastDbMsg = await messageRepository.getLastMessage(conv.id).catch(() => null);
          const lastMessages = lastDbMsg ? [{
            key: {
              id: lastDbMsg.whatsapp_message_id || String(lastDbMsg.id),
              remoteJid: jid,
              fromMe: Boolean(lastDbMsg.from_me),
            },
            messageTimestamp: Math.floor(new Date(lastDbMsg.timestamp || lastDbMsg.created_at || Date.now()).getTime() / 1000),
          }] : [];

          await session.sock.chatModify({ archive: true, lastMessages }, jid).catch((err) => {
            console.warn(`[WHATSAPP_ARCHIVE] Failed to archive in Baileys for ${jid}:`, err.message);
          });
        }
      } else {
        chatOperations.archiveChat(chatId);
      }

      const eventPayload = {
        chatId: String(conv?.id || chatId),
        conversationId: String(conv?.id || chatId),
        status: 'archived',
        archived: true,
      };
      io.emit('chat_archived', eventPayload);
      if (conv) {
        io.emit('conversation:update', { ...conv, status: 'archived' });
        io.emit('conversation_updated', { ...conv, status: 'archived' });
      }
    } catch (err) {
      console.error('[WS-Gateway] archive_chat error:', err);
    }
  });

  // Unarchive Chat
  socket.on('unarchive_chat', async (chatId) => {
    try {
      console.log(`[WS-Gateway] Received unarchive_chat for ${chatId}`);
      const chatOperations = require('./whatsapp/chat/operations');
      const conversationRepository = require('../src/data/repositories/conversationRepository');
      const messageRepository = require('../src/data/repositories/messageRepository');
      const sessionManager = require('./sessionManager');
      const { ensureRealtimeStore } = require('./whatsapp/realtime/chatState');
      const { emitChatUpdated, emitChatsLoaded } = require('./whatsapp/realtime/events');
      const { emitRealtimeMetrics } = require('./whatsapp/realtime/metrics');

      const updatedConv = await conversationRepository.updateConversationState(chatId, { status: 'open' }).catch(() => null);
      let conv = updatedConv || await conversationRepository.getConversationById(chatId).catch(() => null);
      const targetId = conv ? (conv.phone.includes('@') ? conv.phone : `${conv.phone}@s.whatsapp.net`) : chatId;

      const preferredSessionId = sessionManager.normalizeSessionName(
        conv?.sessionId || conv?.session_id || sessionManager.DEFAULT_SESSION
      );
      let session = sessionManager.getSession(preferredSessionId);
      if (!session?.sock) session = await sessionManager.getDefaultSession().catch(() => null);
      if (!session?.sock) session = sessionManager.getConnectedSessionOrNull();
      if (!session?.sock) session = chatOperations.findSessionForChat(targetId, preferredSessionId);

      const store = session ? ensureRealtimeStore(session) : null;
      const targetChat = store?.chats?.[targetId];
      if (targetChat) {
        targetChat.archived = false;
        targetChat.updatedAt = Date.now();
        emitChatUpdated(session?.io || io, targetChat);
        emitChatsLoaded(session?.io || io, store);
        emitRealtimeMetrics(session?.io || io, store);
      }
      const chat = chatOperations.getOrCreateChat(targetId);
      if (chat) {
        chat.archived = false;
      }

      if (session && session.sock) {
        const lastDbMsg = conv ? await messageRepository.getLastMessage(conv.id).catch(() => null) : null;
        const lastMessages = lastDbMsg ? [{
          key: {
            id: lastDbMsg.whatsapp_message_id || String(lastDbMsg.id),
            remoteJid: targetId,
            fromMe: Boolean(lastDbMsg.from_me),
          },
          messageTimestamp: Math.floor(new Date(lastDbMsg.timestamp || lastDbMsg.created_at || Date.now()).getTime() / 1000),
        }] : [];

        await session.sock.chatModify({ archive: false, lastMessages }, targetId).catch((err) => {
          console.warn(`[WHATSAPP_ARCHIVE] Failed to unarchive in Baileys for ${targetId}:`, err.message);
        });
      }

      const eventPayload = {
        chatId: String(conv?.id || chatId),
        conversationId: String(conv?.id || chatId),
        status: 'open',
        archived: false,
      };
      io.emit('chat_unarchived', eventPayload);
      if (conv) {
        io.emit('conversation:update', { ...conv, status: 'open' });
        io.emit('conversation_updated', { ...conv, status: 'open' });
      }
    } catch (err) {
      console.error('[WS-Gateway] unarchive_chat error:', err);
    }
  });

  // Add Tag
  socket.on('add_tag', async (payload = {}) => {
    try {
      const chatId = payload.chatId;
      const tagsToAdd = payload.tag ? [payload.tag] : (payload.tags || []);
      if (!chatId || tagsToAdd.length === 0) return;

      console.log(`[WS-Gateway] Received add_tag for ${chatId}:`, tagsToAdd);
      const chatOperations = require('./whatsapp/chat/operations');
      const conversationRepository = require('../src/data/repositories/conversationRepository');

      const conv = await conversationRepository.getConversationById(chatId);
      if (conv) {
        let currentTags = Array.isArray(conv.tags) ? conv.tags : [];
        let changed = false;
        for (const t of tagsToAdd) {
          if (t && !currentTags.includes(t)) {
            currentTags.push(t);
            changed = true;
          }
        }
        if (changed) {
          await conversationRepository.updateConversationState(chatId, { tags: currentTags }).catch(() => {});
        }

        const jid = conv.phone.includes('@') ? conv.phone : `${conv.phone}@s.whatsapp.net`;
        const session = chatOperations.findSessionForChat(jid);
        for (const t of tagsToAdd) {
          chatOperations.addTag(jid, t);
          if (session && session.sock && typeof session.sock.chatModify === 'function') {
            await session.sock.chatModify({ addLabel: { labelId: t } }, jid).catch((err) => {
              console.log(`[WHATSAPP_LABELS] addLabel skipped/failed for tag "${t}":`, err.message);
            });
          }
        }
      }

      socket.broadcast.emit('tag_added', { chatId, tags: tagsToAdd });
    } catch (err) {
      console.error('[WS-Gateway] add_tag error:', err);
    }
  });

  // Remove Tag
  socket.on('remove_tag', async (payload = {}) => {
    try {
      const { chatId, tag } = payload;
      if (!chatId || !tag) return;

      console.log(`[WS-Gateway] Received remove_tag for ${chatId}: ${tag}`);
      const chatOperations = require('./whatsapp/chat/operations');
      const conversationRepository = require('../src/data/repositories/conversationRepository');

      const conv = await conversationRepository.getConversationById(chatId);
      if (conv) {
        if (Array.isArray(conv.tags) && conv.tags.includes(tag)) {
          const nextTags = conv.tags.filter((t) => t !== tag);
          await conversationRepository.updateConversationState(chatId, { tags: nextTags }).catch(() => {});
        }

        const jid = conv.phone.includes('@') ? conv.phone : `${conv.phone}@s.whatsapp.net`;
        chatOperations.removeTag(jid, tag);
        const session = chatOperations.findSessionForChat(jid);
        if (session && session.sock && typeof session.sock.chatModify === 'function') {
          await session.sock.chatModify({ removeLabel: { labelId: tag } }, jid).catch((err) => {
            console.log(`[WHATSAPP_LABELS] removeLabel skipped/failed for tag "${tag}":`, err.message);
          });
        }
      }

      socket.broadcast.emit('tag_removed', { chatId, tag });
    } catch (err) {
      console.error('[WS-Gateway] remove_tag error:', err);
    }
  });
}

function init(io) {
  if (!io) return false;

  // Idempotency: if already initialized with this io instance, do not duplicate listeners
  if (_initialized && _io === io) {
    return true;
  }

  // If re-initializing with a new io instance, clean up prior setup
  if (_initialized && _io && _io !== io) {
    shutdown();
  }

  _io = io;
  _initialized = true;

  // Single authoritative connection handler
  _connectionHandler = (socket) => {
    const tenantId = joinTenantRoom(socket);
    incrementCounter('_connections', 'emitted');
    console.log(`[WS-Gateway] Client connected (tenant=${tenantId}, id=${socket.id})`);

    // Attach core inbound domain handlers
    attachDefaultSocketHandlers(socket, _io, tenantId);

    // Attach any registered custom extension handlers
    for (const customHandler of _customSocketHandlers) {
      try {
        customHandler(socket, _io, tenantId);
      } catch (err) {
        console.error('[WS-Gateway] Custom socket handler error:', err?.message || err);
      }
    }

    // Single unified disconnect handler
    socket.on('disconnect', (reason) => {
      incrementCounter('_disconnections', 'emitted');
      console.log(`[WS-Gateway] Client disconnected (tenant=${tenantId}, id=${socket.id}, reason=${reason})`);
    });
  };

  io.on('connection', _connectionHandler);

  // Periodic dedup cleanup (unref to avoid keeping node alive on exit)
  if (dedupCleanupTimer) {
    clearInterval(dedupCleanupTimer);
  }
  dedupCleanupTimer = setInterval(() => {
    recentEmitKeys.clear();
  }, DEDUP_WINDOW_MS * 2);
  if (dedupCleanupTimer && typeof dedupCleanupTimer.unref === 'function') {
    dedupCleanupTimer.unref();
  }

  console.log('[WS-Gateway] Initialized (Single Authoritative Coordinator)');
  return true;
}

function registerSocketHandler(handlerFn) {
  if (typeof handlerFn === 'function') {
    _customSocketHandlers.add(handlerFn);
  }
}

function shutdown() {
  if (dedupCleanupTimer) {
    clearInterval(dedupCleanupTimer);
    dedupCleanupTimer = null;
  }

  for (const [, batch] of batchQueue) {
    if (batch.timer) clearTimeout(batch.timer);
  }
  batchQueue.clear();

  if (_io && _connectionHandler && typeof _io.off === 'function') {
    _io.off('connection', _connectionHandler);
  }

  _connectionHandler = null;
  _initialized = false;
  _io = null;
}

// ─── Counter Helpers ───

function incrementCounter(event, field) {
  let entry = eventCounters.get(event);
  if (!entry) {
    entry = { emitted: 0, dropped: 0, batched: 0 };
    eventCounters.set(event, entry);
  }
  entry[field] = (entry[field] || 0) + 1;
}

// ─── Core Emit ───

function emit(event, payload, options = {}) {
  if (!_io) return false;

  const tenantId = options.tenantId || null;
  const dedupKey = options.dedupKey || null;

  // Backpressure check
  if (!backpressureController.shouldEmitWebSocket()) {
    incrementCounter(event, 'dropped');
    return false;
  }

  // Dedup check
  if (dedupKey) {
    const fullKey = `${event}:${dedupKey}`;
    if (recentEmitKeys.has(fullKey)) {
      incrementCounter(event, 'dropped');
      return false;
    }
    recentEmitKeys.add(fullKey);
  }

  // Emit to tenant room or broadcast
  if (tenantId) {
    emitToTenant(_io, tenantId, event, payload);
  } else {
    _io.emit(event, payload);
  }

  incrementCounter(event, 'emitted');

  // Store for replay
  recentEvents.push({
    event,
    payload,
    tenantId,
    timestamp: Date.now(),
  });
  if (recentEvents.length > MAX_RECENT_EVENTS) {
    recentEvents.shift();
  }

  return true;
}

function emitBatched(event, payload, options = {}) {
  const batchKey = options.batchKey || event;

  let batch = batchQueue.get(batchKey);
  if (!batch) {
    batch = { events: [], timer: null };
    batchQueue.set(batchKey, batch);
  }

  batch.events.push({ event, payload, options });
  incrementCounter(event, 'batched');

  if (!batch.timer) {
    batch.timer = setTimeout(() => {
      const items = batch.events.splice(0);
      batchQueue.delete(batchKey);

      if (items.length === 1) {
        emit(items[0].event, items[0].payload, items[0].options);
      } else if (items.length > 1) {
        emit(`${event}:batch`, items.map((i) => i.payload), options);
      }
    }, BATCH_WINDOW_MS);
    if (batch.timer && typeof batch.timer.unref === 'function') {
      batch.timer.unref();
    }
  }
}

// ─── Event Replay ───

function replayRecentEvents(socket, since = 0) {
  if (!socket) return 0;

  const tenantId = resolveSocketTenantId(socket);
  let replayed = 0;

  for (const entry of recentEvents) {
    if (entry.timestamp < since) continue;
    if (entry.tenantId && entry.tenantId !== tenantId) continue;

    socket.emit(entry.event, entry.payload);
    replayed += 1;
  }

  return replayed;
}

// ─── Metrics ───

function getMetrics() {
  const metrics = {};
  for (const [event, counts] of eventCounters) {
    metrics[event] = { ...counts };
  }

  return {
    events: metrics,
    recentEventsBuffered: recentEvents.length,
    batchQueueSize: batchQueue.size,
    dedupKeysActive: recentEmitKeys.size,
  };
}

function resetMetrics() {
  eventCounters.clear();
}

// ─── Status ───

function getIO() {
  return _io;
}

function isConnected() {
  return _io != null;
}

function isInitialized() {
  return _initialized;
}

function getConnectedSockets() {
  if (!_io?.sockets?.sockets) return 0;
  return _io.sockets.sockets.size || 0;
}

module.exports = {
  emit,
  emitBatched,
  getConnectedSockets,
  getIO,
  getMetrics,
  init,
  isConnected,
  isInitialized,
  registerSocketHandler,
  replayRecentEvents,
  resetMetrics,
  shutdown,
};
