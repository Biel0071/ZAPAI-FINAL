const fs = require('fs/promises');
const path = require('path');

const messageStore = require('../store/messageStore');
const sessionManager = require('./sessionManager');
const whatsappService = require('./whatsappService');
const { registerOutgoingMessage } = require('../controllers/messagesController');

const QUEUE_FILE_PATH = path.join(__dirname, '..', 'data', 'outbound_queue.json');

const STATES = {
  DEAD_LETTER: 'dead_letter',
  FAILED: 'failed',
  PROCESSING: 'processing',
  QUEUED: 'queued',
  SENT: 'sent',
};

const DEFAULT_CONFIG = {
  allowTestHooks: String(process.env.OUTBOUND_QUEUE_ALLOW_TEST_HOOKS || '').toLowerCase() === 'true',
  baseDelayMs: Number(process.env.OUTBOUND_QUEUE_BASE_DELAY_MS) || 1000,
  jitterMs: Number(process.env.OUTBOUND_QUEUE_JITTER_MS) || 250,
  maxAttempts: Number(process.env.OUTBOUND_QUEUE_MAX_ATTEMPTS) || 3,
  maxDelayMs: Number(process.env.OUTBOUND_QUEUE_MAX_DELAY_MS) || 60000,
  pollMs: Number(process.env.OUTBOUND_QUEUE_POLL_MS) || 5000,
};

let storeRef = null;
let workerTimer = null;
let processingTick = false;
let persistLock = Promise.resolve();
let queueState = {
  items: [],
  version: 1,
};

function nowIso() {
  return new Date().toISOString();
}

function sanitizeError(error) {
  const message = error?.message || String(error || 'Unknown error');
  const code = error?.code || 'OUTBOUND_SEND_FAILED';
  return { code, message, timestamp: nowIso() };
}

function normalizePhone(phone) {
  return whatsappService.normalizePhone(String(phone || ''));
}

function nextBackoffMs(attempt) {
  const exp = Math.max(0, Number(attempt) - 1);
  const base = Math.min(DEFAULT_CONFIG.baseDelayMs * 2 ** exp, DEFAULT_CONFIG.maxDelayMs);
  const jitter = Math.floor(Math.random() * Math.max(0, DEFAULT_CONFIG.jitterMs));
  return base + jitter;
}

function canUseTestHooks() {
  return DEFAULT_CONFIG.allowTestHooks || String(process.env.NODE_ENV || 'development').toLowerCase() !== 'production';
}

function cloneItem(item) {
  return JSON.parse(JSON.stringify(item));
}

async function ensureQueueFile() {
  await fs.mkdir(path.dirname(QUEUE_FILE_PATH), { recursive: true });

  try {
    await fs.access(QUEUE_FILE_PATH);
  } catch {
    await fs.writeFile(QUEUE_FILE_PATH, JSON.stringify(queueState, null, 2) + '\n', 'utf8');
  }
}

async function loadQueueState() {
  await ensureQueueFile();
  const raw = await fs.readFile(QUEUE_FILE_PATH, 'utf8');

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.items)) {
      throw new Error('Invalid queue state file format.');
    }

    queueState = {
      items: parsed.items,
      version: Number(parsed.version) || 1,
    };
  } catch (error) {
    // Bugfix#4: preserve corrupted file for forensics instead of silently
    // discarding queued work.
    const backupPath = `${QUEUE_FILE_PATH}.corrupt-${Date.now()}.bak`;
    try {
      await fs.rename(QUEUE_FILE_PATH, backupPath);
      console.error(
        `[OUTBOUND_QUEUE] Corrupt queue file backed up to ${backupPath}: ${error?.message || error}`
      );
    } catch (renameError) {
      console.error(
        '[OUTBOUND_QUEUE] Failed to back up corrupt queue file:',
        renameError?.message || renameError
      );
    }

    queueState = {
      items: [],
      version: 1,
    };
    await saveQueueState();
  }
}

async function saveQueueState() {
  const next = JSON.stringify(queueState, null, 2) + '\n';

  // Bugfix#4: atomic write. Previous implementation wrote directly to the
  // final path, so a crash mid-write corrupted the JSON and loadQueueState
  // silently reset the queue to []. We now write to a sibling tmp file and
  // rename(), which is atomic on NTFS and POSIX.
  persistLock = persistLock.then(
    async () => {
      const tmpPath = `${QUEUE_FILE_PATH}.${process.pid}.tmp`;
      await fs.writeFile(tmpPath, next, 'utf8');
      await fs.rename(tmpPath, QUEUE_FILE_PATH);
    },
    async () => {
      // Previous persist rejected; still try to persist current state
      // atomically so we don't amplify a failure into a corrupt file.
      const tmpPath = `${QUEUE_FILE_PATH}.${process.pid}.tmp`;
      await fs.writeFile(tmpPath, next, 'utf8');
      await fs.rename(tmpPath, QUEUE_FILE_PATH);
    }
  );

  await persistLock;
}

function getSessionSocket(sessionId) {
  const normalizedSessionId = sessionManager.normalizeSessionName(sessionId || sessionManager.DEFAULT_SESSION);
  const session = sessionManager.getSession(normalizedSessionId);

  if (session?.sock) {
    return {
      session,
      sock: session.sock,
    };
  }

  const fallbackSock = storeRef?.sock || null;
  if (fallbackSock) {
    return {
      session: {
        phone: null,
        sessionId: normalizedSessionId,
      },
      sock: fallbackSock,
    };
  }

  throw Object.assign(new Error('No active WhatsApp session is available.'), {
    code: 'SESSION_UNAVAILABLE',
  });
}

function buildQueuedItem(payload = {}) {
  const phone = normalizePhone(payload.phone || payload.chatId);
  const text = String(payload.text || payload.message || '').trim();

  if (!phone || !text) {
    throw Object.assign(new Error('The fields phone/chatId and text/message are required.'), {
      code: 'INVALID_QUEUE_PAYLOAD',
    });
  }

  const timestamp = nowIso();

  return {
    attemptCount: 0,
    companyId: String(payload.companyId || process.env.DEFAULT_COMPANY_ID || 'default').trim(),
    createdAt: timestamp,
    deadLetterAt: null,
    failureHistory: [],
    id: `oq_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    lastFailure: null,
    maxAttempts: Math.max(1, Number(payload.maxAttempts) || DEFAULT_CONFIG.maxAttempts),
    nextAttemptAt: timestamp,
    phone,
    processingStartedAt: null,
    sentAt: null,
    sessionId: sessionManager.normalizeSessionName(payload.sessionId || sessionManager.DEFAULT_SESSION),
    state: STATES.QUEUED,
    text,
    updatedAt: timestamp,
    metadata: payload.metadata || {},
    testing: payload.testing || {},
  };
}

async function persistSuccessfulSend(item) {
  const normalizedPhone = normalizePhone(item.phone);

  if (!storeRef?.databaseEnabled) {
    const memEntry = messageStore.addMessage(normalizedPhone, {
      content: item.text,
      createdAt: nowIso(),
      fromMe: true,
      mediaPath: null,
      mediaType: null,
      sessionId: item.sessionId,
      conversationId: `chat-${normalizedPhone}`,
      status: 'sent',
    });

    return {
      message: memEntry,
      mode: 'memory',
    };
  }

  const session = sessionManager.getSession(item.sessionId) || {};
  const persisted = await registerOutgoingMessage(storeRef, {
    companyId: item.companyId,
    name: session?.phone || 'Unknown',
    phone: normalizedPhone,
    sessionId: item.sessionId,
    source: 'human',
    text: item.text,
  });

  return {
    message: persisted?.message || null,
    mode: 'database',
  };
}

async function executeOutbound(item) {
  const forceResult = String(item.testing?.forceResult || '').toLowerCase();

  if (canUseTestHooks() && forceResult === 'failed') {
    throw Object.assign(new Error('Forced failure for queue validation.'), {
      code: 'FORCED_FAILURE',
    });
  }

  if (canUseTestHooks() && forceResult === 'sent') {
    return persistSuccessfulSend(item);
  }

  if (!sessionManager.isRuntimeActive()) {
    throw Object.assign(new Error('System is inactive. Activate it with POST /system/start.'), {
      code: 'SYSTEM_INACTIVE',
    });
  }

  const { session, sock } = getSessionSocket(item.sessionId);
  const sendResult = await whatsappService.sendMessage(sock, item.phone, item.text);

  if (!sendResult) {
    throw Object.assign(new Error('Message send failed.'), {
      code: 'SEND_FAILED',
    });
  }

  return persistSuccessfulSend({
    ...item,
    sessionId: session?.sessionId || item.sessionId,
  });
}

function pickNextProcessableItem() {
  const now = Date.now();
  const candidates = queueState.items
    .filter((item) => {
      if (item.state === STATES.QUEUED) {
        return true;
      }

      if (item.state === STATES.FAILED) {
        return new Date(item.nextAttemptAt || 0).getTime() <= now;
      }

      return false;
    })
    .sort((a, b) => new Date(a.nextAttemptAt || a.createdAt).getTime() - new Date(b.nextAttemptAt || b.createdAt).getTime());

  return candidates[0] || null;
}

function listPending(limit = 100) {
  const normalizedLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  return queueState.items
    .filter((item) => item.state === STATES.QUEUED || item.state === STATES.PROCESSING || item.state === STATES.FAILED)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(0, normalizedLimit)
    .map(cloneItem);
}

function listDeadLetter(limit = 100) {
  const normalizedLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  return queueState.items
    .filter((item) => item.state === STATES.DEAD_LETTER)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, normalizedLimit)
    .map(cloneItem);
}

async function enqueue(payload = {}) {
  const item = buildQueuedItem(payload);
  queueState.items.push(item);
  await saveQueueState();
  return cloneItem(item);
}

async function reprocessDeadLetterItem(id, options = {}) {
  const item = queueState.items.find((entry) => entry.id === id);

  if (!item || item.state !== STATES.DEAD_LETTER) {
    throw Object.assign(new Error('Dead letter item not found.'), {
      code: 'DLQ_ITEM_NOT_FOUND',
    });
  }

  item.state = STATES.QUEUED;
  item.attemptCount = 0;
  item.processingStartedAt = null;
  item.nextAttemptAt = nowIso();
  item.updatedAt = nowIso();
  item.lastFailure = null;

  if (options?.testing && typeof options.testing === 'object') {
    item.testing = {
      ...(item.testing || {}),
      ...options.testing,
    };
  }

  await saveQueueState();
  return cloneItem(item);
}

async function processOneItem() {
  if (processingTick) {
    return;
  }

  processingTick = true;

  try {
    const item = pickNextProcessableItem();

    if (!item) {
      return;
    }

    item.state = STATES.PROCESSING;
    item.processingStartedAt = nowIso();
    item.updatedAt = nowIso();
    await saveQueueState();

    try {
      await executeOutbound(item);
      item.state = STATES.SENT;
      item.sentAt = nowIso();
      item.updatedAt = nowIso();
      item.lastFailure = null;
      await saveQueueState();
    } catch (error) {
      item.attemptCount = Number(item.attemptCount || 0) + 1;
      const failure = sanitizeError(error);
      item.lastFailure = failure;
      item.failureHistory = [...(item.failureHistory || []), failure];
      item.updatedAt = nowIso();

      if (item.attemptCount >= Number(item.maxAttempts || DEFAULT_CONFIG.maxAttempts)) {
        item.state = STATES.DEAD_LETTER;
        item.deadLetterAt = nowIso();
        item.nextAttemptAt = null;
      } else {
        item.state = STATES.FAILED;
        const delayMs = nextBackoffMs(item.attemptCount);
        item.nextAttemptAt = new Date(Date.now() + delayMs).toISOString();
      }

      await saveQueueState();
    }
  } finally {
    processingTick = false;
  }
}

function startWorker() {
  if (workerTimer) {
    return;
  }

  workerTimer = setInterval(() => {
    processOneItem().catch((error) => {
      console.error('[OUTBOUND_QUEUE] Worker cycle failed:', error?.message || error);
    });
  }, DEFAULT_CONFIG.pollMs);
}

function stopWorker() {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
}

async function initializeOutboundQueue({ store }) {
  storeRef = store;
  await loadQueueState();
  startWorker();
}

async function shutdownOutboundQueue() {
  stopWorker();
  await saveQueueState();
}

module.exports = {
  STATES,
  enqueue,
  initializeOutboundQueue,
  listDeadLetter,
  listPending,
  processOneItem,
  reprocessDeadLetterItem,
  shutdownOutboundQueue,
};
