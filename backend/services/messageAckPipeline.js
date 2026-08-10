/**
 * Message ACK Pipeline — Full message lifecycle tracking.
 *
 * States: pending → sent → server_ack → device_ack → read → failed → retry
 *
 * Tracks:
 *   - ACK state transitions with timestamps
 *   - Delivery latency (sent → device_ack)
 *   - Retry count and backoff
 *   - Optimistic reconciliation (frontend pending → backend ack)
 *   - Duplicate prevention via message ID
 *
 * Storage:
 *   - In-memory Map (fast O(1) access)
 *   - PostgreSQL update on state change (async, non-blocking)
 *
 * Integration:
 *   - messages.update from Baileys (server/device/read acks)
 *   - outboundQueueService (send state)
 *   - WebSocket emission for frontend reconciliation
 */

const db = require('../src/infrastructure/config/database');
const EventEmitter = require('events');
const correlationTracker = require('./correlationTracker');
const { emitToTenantWithAliases } = require('./realtime/tenantRooms');
const ackEmitter = new EventEmitter();

// ─── ACK States ───
const ACK_STATES = {
  PENDING: 'pending',
  SENT: 'sent',
  SERVER_ACK: 'server_ack',
  DEVICE_ACK: 'device_ack',
  READ: 'read',
  PLAYED: 'played',
  FAILED: 'failed',
  RETRY: 'retry',
};

// Valid transitions (from → to[])
const VALID_TRANSITIONS = {
  [ACK_STATES.PENDING]: [ACK_STATES.SENT, ACK_STATES.FAILED],
  [ACK_STATES.SENT]: [ACK_STATES.SERVER_ACK, ACK_STATES.FAILED],
  [ACK_STATES.SERVER_ACK]: [ACK_STATES.DEVICE_ACK, ACK_STATES.READ, ACK_STATES.FAILED],
  [ACK_STATES.DEVICE_ACK]: [ACK_STATES.READ, ACK_STATES.PLAYED],
  [ACK_STATES.READ]: [ACK_STATES.PLAYED],
  [ACK_STATES.PLAYED]: [],
  [ACK_STATES.FAILED]: [ACK_STATES.RETRY, ACK_STATES.PENDING],
  [ACK_STATES.RETRY]: [ACK_STATES.PENDING, ACK_STATES.SENT, ACK_STATES.FAILED],
};

// Baileys WAMessageStatus numeric value → ACK state.
// ERROR=0, PENDING=1, SERVER_ACK=2, DELIVERY_ACK=3, READ=4, PLAYED=5.
const BAILEYS_STATUS_MAP = {
  0: ACK_STATES.FAILED,
  // PENDING only confirms local transport acceptance; it is not a real send ACK.
  1: ACK_STATES.PENDING,
  2: ACK_STATES.SERVER_ACK,
  3: ACK_STATES.DEVICE_ACK,
  4: ACK_STATES.READ,
  5: ACK_STATES.PLAYED,
};

// ─── In-Memory Tracking ───
const ackEntries = new Map(); // messageId → AckEntry
const MAX_ENTRIES = Math.max(1000, Number(process.env.ACK_PIPELINE_MAX_ENTRIES) || 50_000);

/**
 * @typedef {Object} AckEntry
 * @property {string} messageId
 * @property {string} chatId
 * @property {string} sessionId
 * @property {string} status
 * @property {number} retryCount
 * @property {string|null} pendingAt
 * @property {string|null} sentAt
 * @property {string|null} serverAckAt
 * @property {string|null} deviceAckAt
 * @property {string|null} readAt
 * @property {string|null} failedAt
 * @property {number|null} deliveryLatencyMs
 * @property {string} updatedAt
 */

function createAckEntry(messageId, chatId, sessionId) {
  const now = new Date().toISOString();
  return {
    messageId,
    dbMessageId: null,
    companyId: null,
    correlationId: null,
    chatId: chatId || '',
    sessionId: sessionId || 'default',
    status: ACK_STATES.PENDING,
    retryCount: 0,
    pendingAt: now,
    sentAt: null,
    serverAckAt: null,
    deviceAckAt: null,
    readAt: null,
    failedAt: null,
    deliveryLatencyMs: null,
    updatedAt: now,
  };
}

function evictOldEntries() {
  if (ackEntries.size <= MAX_ENTRIES) return;

  const targetSize = Math.floor(MAX_ENTRIES * 0.9);
  const removeCount = ackEntries.size - targetSize;
  let removed = 0;

  for (const key of ackEntries.keys()) {
    if (removed >= removeCount) break;
    ackEntries.delete(key);
    removed += 1;
  }
}

// ─── State Transitions ───

function isValidTransition(currentState, nextState) {
  if (currentState === nextState) return true;

  const allowed = VALID_TRANSITIONS[currentState];
  if (allowed?.includes(nextState)) return true;

  // WhatsApp does not guarantee that every intermediate receipt is emitted.
  // Accept forward jumps (sent → delivered/read), while rejecting late events
  // that would visually downgrade a message already delivered or read.
  const progressRank = {
    [ACK_STATES.PENDING]: 0,
    [ACK_STATES.RETRY]: 0,
    [ACK_STATES.SENT]: 1,
    [ACK_STATES.SERVER_ACK]: 2,
    [ACK_STATES.DEVICE_ACK]: 3,
    [ACK_STATES.READ]: 4,
    [ACK_STATES.PLAYED]: 5,
  };
  const currentRank = progressRank[currentState];
  const nextRank = progressRank[nextState];
  return Number.isFinite(currentRank) && Number.isFinite(nextRank) && nextRank > currentRank;
}

function transitionAck(messageId, nextState, metadata = {}) {
  if (!messageId) return null;

  let entry = ackEntries.get(messageId);

  if (!entry) {
    entry = createAckEntry(messageId, metadata.chatId, metadata.sessionId);
    ackEntries.set(messageId, entry);
    evictOldEntries();
  }

  if (metadata.chatId && !entry.chatId) {
    entry.chatId = metadata.chatId;
  }
  if (metadata.sessionId && !entry.sessionId) {
    entry.sessionId = metadata.sessionId;
  }
  if (metadata.companyId) entry.companyId = String(metadata.companyId);
  if (metadata.correlationId) entry.correlationId = String(metadata.correlationId);

  if (!isValidTransition(entry.status, nextState)) {
    // Allow forward-only transitions (don't go backward)
    return entry;
  }

  const now = new Date().toISOString();
  entry.status = nextState;
  entry.updatedAt = now;

  // Record timestamps
  switch (nextState) {
    case ACK_STATES.SENT:
      entry.sentAt = now;
      break;
    case ACK_STATES.SERVER_ACK:
      entry.serverAckAt = now;
      break;
    case ACK_STATES.DEVICE_ACK:
      entry.deviceAckAt = now;
      if (entry.sentAt) {
        entry.deliveryLatencyMs = new Date(now).getTime() - new Date(entry.sentAt).getTime();
      }
      break;
    case ACK_STATES.READ:
      entry.readAt = now;
      break;
    case ACK_STATES.FAILED:
      entry.failedAt = now;
      break;
    case ACK_STATES.RETRY:
      entry.retryCount += 1;
      break;
  }

  // Trigger PostgreSQL update asynchronously
  void persistAckState(messageId).catch(err => {
    console.error(`[AckPipeline] Async persist transition failed for ${messageId}:`, err);
  });

  // Emit local event for debugging/testing
  ackEmitter.emit(messageId, entry);

  if (entry.correlationId) {
    correlationTracker.traceLog(entry.correlationId, `ack.${nextState}`, 'Baileys ACK state changed.', {
      companyId: entry.companyId,
      messageId,
      sessionId: entry.sessionId,
      status: nextState,
    });
  }

  return entry;
}

// ─── Baileys Integration ───

function processBaileysStatusUpdate(update = {}) {
  const messageId = update?.key?.id;
  if (!messageId) return null;

  const statusVal = update?.update?.status;
  let mappedState = null;

  if (statusVal === 'ERROR' || statusVal === 'failed' || update?.update?.messageStubParameters || update?.update?.error) {
    mappedState = ACK_STATES.FAILED;
  } else {
    const baileysStatus = Number(statusVal);
    mappedState = BAILEYS_STATUS_MAP[baileysStatus];
  }

  if (!mappedState) return null;

  const { normalizePhone } = require('./whatsapp/shared/identifiers');
  const chatId = normalizePhone(update?.key?.remoteJid || '');
  return transitionAck(messageId, mappedState, { chatId });
}

function processBaileysStatusBatch(updates = []) {
  const results = [];
  for (const update of Array.isArray(updates) ? updates : []) {
    const result = processBaileysStatusUpdate(update);
    if (result) results.push(result);
  }
  return results;
}

// ─── Mark Operations ───

function markPending(messageId, chatId, sessionId) {
  return transitionAck(messageId, ACK_STATES.PENDING, { chatId, sessionId });
}

function markSent(messageId) {
  return transitionAck(messageId, ACK_STATES.SENT);
}

function markFailed(messageId) {
  return transitionAck(messageId, ACK_STATES.FAILED);
}

function markRetry(messageId) {
  return transitionAck(messageId, ACK_STATES.RETRY);
}

// ─── Query Operations ───

function getAckState(messageId) {
  return ackEntries.get(messageId) || null;
}

function getPendingMessages(sessionId = null) {
  const results = [];
  for (const entry of ackEntries.values()) {
    if (entry.status === ACK_STATES.PENDING || entry.status === ACK_STATES.RETRY) {
      if (!sessionId || entry.sessionId === sessionId) {
        results.push({ ...entry });
      }
    }
  }
  return results;
}

function getFailedMessages(sessionId = null) {
  const results = [];
  for (const entry of ackEntries.values()) {
    if (entry.status === ACK_STATES.FAILED) {
      if (!sessionId || entry.sessionId === sessionId) {
        results.push({ ...entry });
      }
    }
  }
  return results;
}

function waitForAck(messageId, options = {}) {
  const timeoutMs = Math.max(1000, Number(options.timeoutMs) || 10_000);
  const acceptedStates = new Set(options.acceptedStates || [
    ACK_STATES.SERVER_ACK,
    ACK_STATES.DEVICE_ACK,
    ACK_STATES.READ,
    ACK_STATES.PLAYED,
  ]);
  const current = getAckState(messageId);
  if (current && (acceptedStates.has(current.status) || current.status === ACK_STATES.FAILED)) {
    return Promise.resolve(current);
  }

  return new Promise((resolve) => {
    const finish = (entry) => {
      if (!entry || (!acceptedStates.has(entry.status) && entry.status !== ACK_STATES.FAILED)) return;
      clearTimeout(timer);
      ackEmitter.off(messageId, finish);
      resolve(entry);
    };
    const timer = setTimeout(() => {
      ackEmitter.off(messageId, finish);
      resolve(null);
    }, timeoutMs);
    ackEmitter.on(messageId, finish);
  });
}
function getStats() {
  const counters = {};
  for (const state of Object.values(ACK_STATES)) {
    counters[state] = 0;
  }

  let totalLatency = 0;
  let latencyCount = 0;

  for (const entry of ackEntries.values()) {
    counters[entry.status] = (counters[entry.status] || 0) + 1;
    if (entry.deliveryLatencyMs != null) {
      totalLatency += entry.deliveryLatencyMs;
      latencyCount += 1;
    }
  }

  return {
    total: ackEntries.size,
    maxEntries: MAX_ENTRIES,
    states: counters,
    avgDeliveryLatencyMs: latencyCount > 0 ? Math.round(totalLatency / latencyCount) : null,
  };
}

// ─── PostgreSQL Persistence ───

async function persistAckState(messageId) {
  const entry = ackEntries.get(messageId);
  if (!entry) return;

  try {
    if (entry.dbMessageId) {
      await db.query(
        `UPDATE messages SET status = $1 WHERE id = $2`,
        [entry.status, entry.dbMessageId]
      );
    }
  } catch (err) {
    // Non-fatal — in-memory is the primary source
    if (err?.code !== '42P01') {
      console.error(`[AckPipeline] Persist failed for ${messageId} (dbMessageId: ${entry.dbMessageId}):`, err?.message || err);
    }
  }
}

function registerDbMapping(messageId, dbMessageId) {
  if (!messageId) return null;
  let entry = ackEntries.get(messageId);
  if (!entry) {
    entry = createAckEntry(messageId);
    ackEntries.set(messageId, entry);
    evictOldEntries();
  }
  entry.dbMessageId = dbMessageId;

  // Only update database if status has actually progressed beyond pending
  if (entry.status !== ACK_STATES.PENDING) {
    void persistAckState(messageId).catch(err => {
      console.error(`[AckPipeline] Async persist mapping failed for ${messageId}:`, err);
    });
  }

  return entry;
}

// ─── WebSocket Emission ───

function emitAckUpdate(io, entry) {
  if (!io || !entry) return;

  const payload = {
    messageId: entry.dbMessageId || entry.messageId,
    chatId: entry.chatId,
    status: entry.status,
    deliveryLatencyMs: entry.deliveryLatencyMs,
    updatedAt: entry.updatedAt,
    correlationId: entry.correlationId,
  };
  const ackPayload = {
    id: entry.dbMessageId || entry.messageId,
    chatId: entry.chatId,
    status: entry.status,
    correlationId: entry.correlationId,
  };

  emitToTenantWithAliases(io, entry.companyId, 'message_status', payload, ['message:status']);
  emitToTenantWithAliases(io, entry.companyId, 'message:ack', ackPayload);
  if (entry.correlationId) {
    correlationTracker.traceLog(entry.correlationId, 'socket.ack', 'ACK emitted to tenant room.', {
      companyId: entry.companyId,
      messageId: entry.dbMessageId || entry.messageId,
      status: entry.status,
    });
  }
}

// ─── Reconciliation ───

function reconcilePendingMessages(io) {
  const now = Date.now();
  const staleThresholdMs = 60_000; // 1 minute
  const stale = [];

  for (const entry of ackEntries.values()) {
    if (entry.status === ACK_STATES.PENDING && entry.pendingAt) {
      const pendingAge = now - new Date(entry.pendingAt).getTime();
      if (pendingAge > staleThresholdMs) {
        stale.push(entry);
      }
    }
  }

  // Emit stale pending messages as potentially failed
  for (const entry of stale) {
    entry.status = ACK_STATES.FAILED;
    entry.failedAt = new Date().toISOString();
    entry.updatedAt = entry.failedAt;
    emitAckUpdate(io, entry);
  }

  return { reconciledCount: stale.length };
}

module.exports = {
  ACK_STATES,
  ackEmitter,
  emitAckUpdate,
  getAckState,
  getFailedMessages,
  getPendingMessages,
  getStats,
  markFailed,
  markPending,
  markRetry,
  markSent,
  persistAckState,
  processBaileysStatusBatch,
  processBaileysStatusUpdate,
  reconcilePendingMessages,
  registerDbMapping,
  transitionAck,
};
