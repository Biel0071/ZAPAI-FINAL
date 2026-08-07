const fs = require('fs/promises');
const path = require('path');

const messageStore = require('../store/messageStore');
const sessionManager = require('./sessionManager');
const whatsappService = require('./whatsappService');
const { registerOutgoingMessage } = require('../controllers/messagesController');
const { getAutomatedReplyPermission } = require('./aiReplyGuard');
const { emitAIResponseProgress } = require('./aiResponseProgressService');
const correlationTracker = require('./correlationTracker');
const messageAckPipeline = require('./messageAckPipeline');

const QUEUE_FILE_PATH = path.join(__dirname, '..', 'data', 'outbound_queue.json');

const STATES = {
  CANCELLED: 'cancelled',
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
  const isMedia = payload.mediaType && payload.mediaPath;

  if (!phone || (!text && !isMedia)) {
    throw Object.assign(new Error('The fields phone/chatId and text/message/media are required.'), {
      code: 'INVALID_QUEUE_PAYLOAD',
    });
  }

  const timestamp = nowIso();

  return {
    attemptCount: 0,
    correlationId: String(payload.correlationId || correlationTracker.generateMessageTraceId()),
    companyId: String(payload.companyId || process.env.DEFAULT_COMPANY_ID || 'default').trim(),
    createdAt: timestamp,
    deadLetterAt: null,
    failureHistory: [],
    id: `oq_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    lastFailure: null,
    maxAttempts: Math.max(1, Number(payload.maxAttempts) || DEFAULT_CONFIG.maxAttempts),
    nextAttemptAt: payload.nextAttemptAt || timestamp,
    phone,
    processingStartedAt: null,
    sentAt: null,
    sessionId: sessionManager.normalizeSessionName(payload.sessionId || sessionManager.DEFAULT_SESSION),
    state: STATES.QUEUED,
    text,
    mediaType: payload.mediaType || null,
    mediaPath: payload.mediaPath || null,
    fileName: payload.fileName || null,
    actions: payload.actions || null,
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
      mediaPath: item.mediaPath || null,
      mediaType: item.mediaType || null,
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
    source: item.metadata?.ai_response ? 'ai' : (item.metadata?.source || 'human'),
    text: item.text,
    mediaPath: item.mediaPath || null,
    mediaType: item.mediaType || null,
    status: item.status || 'pending',
    whatsappMessageId: item.whatsappMessageId || null,
    remoteJid: item.remoteJid || null,
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

  // Handle delay/typing simulator for any item in outbound queue (AI, flows, quick replies, campaigns)
  const responseDelayMs = Math.max(0, Number(item.metadata?.responseDelayMs || item.metadata?.delayMs) || 0);
  const typingDelayMs = Math.max(0, Number(item.metadata?.typingDelayMs || item.metadata?.typingMs) || 0);
  const io = storeRef?.io || global.io;
  const publishProgress = (status, details = {}) => {
    if (item.metadata?.ai_response !== true) return null;
    return emitAIResponseProgress(io, {
      companyId: item.companyId,
      conversationId: item.metadata?.conversationId,
      phone: item.phone,
      sessionId: item.sessionId,
      agentName: item.metadata?.agentName,
      startedAt: item.metadata?.progressStartedAt || item.createdAt,
      status,
      ...details,
    });
  };

  const initialPermission = await getAutomatedReplyPermission(item);
  if (!initialPermission.allowed) {
    publishProgress('cancelled', { message: 'Resposta cancelada porque a IA foi desativada.' });
    console.log(`[OUTBOUND_QUEUE] AI response cancelled before delay for ${item.phone}: ${initialPermission.reason}`);
    return { cancelled: true, reason: initialPermission.reason };
  }

  publishProgress('waiting', {
    estimatedMs: responseDelayMs + typingDelayMs,
    message: 'Resposta pronta; aguardando o momento configurado para responder.',
  });

  if (responseDelayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, responseDelayMs));
  }

  if (typingDelayMs > 0) {
    publishProgress('typing', {
      estimatedMs: typingDelayMs,
      message: `${item.metadata?.agentName || 'IA'} esta digitando a resposta.`,
    });
    const jid = String(item.phone).includes('@') ? item.phone : `${item.phone}@s.whatsapp.net`;
    const presenceType = item.mediaType === 'audio' ? 'recording' : 'composing';
    await sock.presenceSubscribe?.(jid).catch(() => {});
    await sock.sendPresenceUpdate?.(presenceType, jid).catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, typingDelayMs));
    await sock.sendPresenceUpdate?.('paused', jid).catch(() => {});
  }

  const aiPermission = await getAutomatedReplyPermission(item);
  if (!aiPermission.allowed) {
    publishProgress('cancelled', { message: 'Resposta cancelada porque a IA foi desativada antes do envio.' });
    console.log(`[OUTBOUND_QUEUE] AI response cancelled before send for ${item.phone}: ${aiPermission.reason}`);
    return { cancelled: true, reason: aiPermission.reason };
  }

  publishProgress('sending', { message: 'Enviando resposta para o WhatsApp.' });

  let sendResult;
  if (item.mediaType && item.mediaPath) {
    sendResult = await whatsappService.sendMediaMessage(sock, item.phone, item.mediaType, item.mediaPath, {
      caption: item.text,
      fileName: item.fileName,
    });
  } else {
    sendResult = await whatsappService.sendMessage(sock, item.phone, item.text);
  }

  if (!sendResult?.key?.id) {
    throw Object.assign(new Error('Message send failed: Baileys did not return a message id.'), {
      code: 'SEND_FAILED',
    });
  }

  const whatsappMessageId = String(sendResult.key.id);
  messageAckPipeline.transitionAck(whatsappMessageId, messageAckPipeline.ACK_STATES.PENDING, {
    chatId: item.phone,
    sessionId: session?.sessionId || item.sessionId,
    companyId: item.companyId,
    correlationId: item.correlationId,
  });
  correlationTracker.traceLog(item.correlationId, 'ack.waiting', 'Worker is waiting for WhatsApp server ACK.', {
    companyId: item.companyId,
    messageId: whatsappMessageId,
    queueId: item.id,
  });
  const ackEntry = await messageAckPipeline.waitForAck(whatsappMessageId, {
    timeoutMs: Math.max(3000, Number(process.env.WHATSAPP_SEND_ACK_TIMEOUT_MS) || 10000),
  });
  if (!ackEntry || ackEntry.status === messageAckPipeline.ACK_STATES.FAILED) {
    throw Object.assign(new Error(ackEntry ? 'WhatsApp rejected the message.' : 'WhatsApp server ACK timed out.'), {
      code: ackEntry ? 'WHATSAPP_SEND_REJECTED' : 'WHATSAPP_ACK_TIMEOUT',
      nonRetryable: !ackEntry,
    });
  }

  const res = await persistSuccessfulSend({
    ...item,
    sessionId: session?.sessionId || item.sessionId,
    status: ackEntry.status,
    whatsappMessageId,
    remoteJid: sendResult.key.remoteJid || null,
  });

  if (res?.message?.id) {
    messageAckPipeline.registerDbMapping(whatsappMessageId, res.message.id);
    const io = storeRef?.io || global.io;
    if (io) messageAckPipeline.emitAckUpdate(io, ackEntry);
  }
  correlationTracker.traceLog(item.correlationId, 'database.persisted', 'Confirmed outbound message persisted.', {
    companyId: item.companyId,
    dbMessageId: res?.message?.id,
    messageId: whatsappMessageId,
    queueId: item.id,
    status: ackEntry.status,
  });

  return res;
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
  queueMicrotask(() => {
    processOneItem().catch((error) => {
      console.error('[OUTBOUND_QUEUE] Immediate worker cycle failed:', error?.message || error);
    });
  });
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
      const executionResult = await executeOutbound(item);

      if (executionResult?.cancelled) {
        item.state = STATES.CANCELLED;
        item.cancelledAt = nowIso();
        item.cancelReason = executionResult.reason || 'ai_disabled';
        item.updatedAt = nowIso();
        item.lastFailure = null;
        await saveQueueState();
        return;
      }

      // Execute actions (like tagging or archiving)
      if (item.actions) {
        try {
          const conversationRepository = require('../repositories/conversationRepository');
          const conv = await conversationRepository.getConversationByPhone(item.phone, item.companyId);
          if (conv) {
            const fields = {};
            if (Array.isArray(item.actions.addTags) && item.actions.addTags.length > 0) {
              const currentTags = Array.isArray(conv.tags) ? conv.tags : [];
              fields.tags = Array.from(new Set([...currentTags, ...item.actions.addTags]));
            }
            if (item.actions.archiveContact) {
              fields.status = 'archived';
            }
            if (Object.keys(fields).length > 0) {
              await conversationRepository.updateConversationState(conv.id, fields);
              const io = storeRef?.io || global.io;
              if (io) {
                const decorated = { ...conv, ...fields };
                io.emit('conversation:update', decorated);
                io.emit('conversation_updated', decorated);
                io.emit('conversation-update', decorated);
              }
            }
          }
        } catch (actionErr) {
          console.error('[OUTBOUND_QUEUE] Failed to run step actions:', actionErr.message);
        }
      }

      if (item.metadata?.ai_response && executionResult?.message) {
        const message = executionResult.message;
        const io = storeRef?.io || global.io;
        io?.emit('ai_response', {
          id: message.id,
          conversationId: message.conversationId,
          chatId: item.phone,
          phone: item.phone,
          sessionId: item.sessionId,
          content: message.content || message.text || item.text,
          text: message.content || message.text || item.text,
          createdAt: message.createdAt || message.timestamp || nowIso(),
          timestamp: message.createdAt || message.timestamp || nowIso(),
          fromMe: true,
          isAI: true,
          status: message.status || 'sent',
          aiProvider: item.metadata.provider,
          aiModel: item.metadata.model,
          aiAgentName: item.metadata.agentName,
          aiResponseTimeMs: item.metadata.responseTimeMs,
          aiPromptTokens: item.metadata.promptTokens,
          aiCompletionTokens: item.metadata.completionTokens,
          aiTotalTokens: item.metadata.totalTokens,
        });
        emitAIResponseProgress(io, {
          companyId: item.companyId,
          conversationId: item.metadata?.conversationId || message.conversationId,
          phone: item.phone,
          sessionId: item.sessionId,
          agentName: item.metadata?.agentName,
          startedAt: item.metadata?.progressStartedAt || item.createdAt,
          status: 'completed',
          message: 'Resposta enviada com sucesso.',
        });
      }
      item.state = STATES.SENT;
      item.sentAt = nowIso();
      item.updatedAt = nowIso();
      item.lastFailure = null;

      if (item.metadata?.currentStep && item.metadata?.totalSteps) {
        try {
          const flowTrackerService = require('./flowTrackerService');
          flowTrackerService.updateFlowStep({
            chatId: item.phone,
            currentStep: item.metadata.currentStep,
            stepDescription: `Etapa ${item.metadata.currentStep} enviada.`,
          });
          if (Number(item.metadata.currentStep) >= Number(item.metadata.totalSteps)) {
            flowTrackerService.finishFlow(item.phone);
          }
        } catch (trackerErr) {
          console.error('[OUTBOUND_QUEUE] Failed to update flow tracker:', trackerErr.message);
        }
      }

      await saveQueueState();
    } catch (error) {
      item.attemptCount = Number(item.attemptCount || 0) + 1;
      const failure = sanitizeError(error);
      item.lastFailure = failure;
      if (item.metadata?.ai_response === true) {
        emitAIResponseProgress(storeRef?.io || global.io, {
          companyId: item.companyId,
          conversationId: item.metadata?.conversationId,
          phone: item.phone,
          sessionId: item.sessionId,
          agentName: item.metadata?.agentName,
          startedAt: item.metadata?.progressStartedAt || item.createdAt,
          status: 'failed',
          message: failure.message || 'Falha ao enviar a resposta da IA.',
        });
      }
      const currentHistory = item.failureHistory || [];
      const cappedHistory = currentHistory.length >= 50 ? currentHistory.slice(-49) : currentHistory;
      item.failureHistory = [...cappedHistory, failure];
      item.updatedAt = nowIso();

      if (error?.nonRetryable || item.attemptCount >= Number(item.maxAttempts || DEFAULT_CONFIG.maxAttempts)) {
        item.state = STATES.DEAD_LETTER;
        item.deadLetterAt = nowIso();
        item.nextAttemptAt = null;
        
        if (item.metadata?.currentStep && item.metadata?.totalSteps) {
          try {
            const flowTrackerService = require('./flowTrackerService');
            if (Number(item.metadata.currentStep) >= Number(item.metadata.totalSteps)) {
              flowTrackerService.finishFlow(item.phone);
            }
          } catch (e) {}
        }
      } else {
        item.state = STATES.FAILED;
        const delayMs = nextBackoffMs(item.attemptCount);
        item.nextAttemptAt = new Date(Date.now() + delayMs).toISOString();
      }

      await saveQueueState();
    }
  } finally {
    processingTick = false;
    if (pickNextProcessableItem()) {
      queueMicrotask(() => {
        processOneItem().catch((error) => {
          console.error('[OUTBOUND_QUEUE] Queue drain failed:', error?.message || error);
        });
      });
    }
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
