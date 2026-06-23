/**
 * Baileys session factory + all lifecycle listeners.
 * Extracted from whatsappService.legacy.js (Phase 2c — final).
 *
 * `createStableSession({ sessionName, io, callbacks... })` is the single
 * entry-point that:
 *   1. Ensures session folder + auth state.
 *   2. Opens a Baileys socket with the correct browser/version headers.
 *   3. Registers the `connection.update` / `messages.upsert` /
 *      `messages.update` listeners and the reconnect lifecycle state
 *      machine (QR → connected → close → reconnect w/ backoff / logout).
 *   4. Delegates persistence, realtime emission and AI auto-reply to the
 *      migrated helper modules. No module-scoped mutable state lives here
 *      — `activeSessions` comes from `state/registry` so mutations remain
 *      shared with the legacy facade and with `chat/operations`.
 *
 * This file is purposefully large and mostly unchanged from the legacy
 * implementation. The semantics are identical; only the imports and the
 * source-of-truth for the connection flag (now `sessionStateService`,
 * not `global.whatsappSession`) differ.
 */

const fs = require('fs/promises');
const path = require('path');
const pino = require('pino');


const sessionStateService = require('../../sessionStateService');
const enterpriseQueueService = require('../../enterprise/queue-service');
const enterpriseAiService = require('../../enterprise/ai-service');
const enterpriseMessageService = require('../../enterprise/message-service');
const enterpriseRealtimeService = require('../../enterprise/realtime-service');
const { getAgentByName, pickRandomAgent } = require('../../../config/agents');
const MessageAuditService = require('../../messageAuditService');

const {
  DEFAULT_SESSION,
  normalizePhone,
  normalizeSessionName,
} = require('../shared/identifiers');
const { toUnixMillis } = require('../shared/time');
const { extractMessageText, getMediaDescriptor, unwrapMessageContent } = require('../inbound/parser');
const { buildInboundDebugPayload } = require('../inbound/debug');
const {
  buildRealtimeDeduplicationKey,
  downloadMedia,
  formatInboundSavedMessage,
  persistInboundMessageFallback,
  persistRealtimeMessage,
  shouldProcessGlobalMessageId,
  shouldProcessRealtimeMessage,
} = require('../inbound/pipeline');
const {
  buildRealtimeIncomingMessage,
  createRealtimeChatState,
  ensureRealtimeStore,
  getMessagePreview,
  getRecentChatHistory,
  isValidRealtimeChatId,
  normalizeContactKey,
  pruneChatMessages,
  resolveContactForChat,
} = require('../realtime/chatState');
const { buildRealtimeMediaPayload } = require('../realtime/payloads');
const {
  emitChatsLoaded,
  emitConnectionUpdate,
  emitInboundRealtimeMessage,
  emitMessageUpdates,
  emitSessionStatus,
} = require('../realtime/events');
const {
  emitRealtimeMetrics,
  shouldEmitMetricsForMessage,
} = require('../realtime/metrics');
const { toQrDataUrl } = require('./qr');
const { sessionPhoneFromSock } = require('./sock');
const { getConnectionCloseCode, isTerminalDisconnect, shouldReconnect } = require('./reconnect');
const {
  safeCreateSessionRecord,
  safeUpdateSessionStatus,
} = require('./persistence');
const { logSessionEvent, pushConnectionLog } = require('./logger');
const { sendMessage } = require('../outbound/senders');
const { saveMessage } = require('../chat/operations');
const { activeSessions } = require('../state/registry');
const contactsEngine = require('../../contactsEngine');
const runtimeEngine = require('../../runtimeEngine');
const sessionRegistry = require('../../sessionRegistry');
const messageAckPipeline = require('../../messageAckPipeline');
const messageRepository = require('../../../repositories/messageRepository');
const conversationRepository = require('../../../repositories/conversationRepository');
const { isAIEnabled } = require('../../../config/aiToggle');

const SESSIONS_DIRECTORY = path.join(__dirname, '..', '..', '..', 'sessions');
const DEFAULT_RECONNECT_DELAY_MS = 3000;
const RECONNECT_BACKOFF_BASE_MS = Math.max(
  500,
  Number(process.env.WHATSAPP_RECONNECT_BACKOFF_BASE_MS || DEFAULT_RECONNECT_DELAY_MS)
);
const RECONNECT_BACKOFF_MAX_MS = Math.max(
  RECONNECT_BACKOFF_BASE_MS,
  Number(process.env.WHATSAPP_RECONNECT_BACKOFF_MAX_MS || 60_000)
);
const MAX_RECONNECT_REQUESTS = Math.max(
  1,
  Number(process.env.WHATSAPP_MAX_RECONNECT_REQUESTS || 1000)
);
// QR timeout: if the user does not scan the QR within this window the session
// is closed (but auth folder IS preserved so future start reuses credentials).
const QR_TIMEOUT_MS = Math.max(
  30_000,
  Number(process.env.WHATSAPP_QR_TIMEOUT_MS || 2 * 60_000)
);
const INITIAL_CHAT_HISTORY_LIMIT = 50;

function toFiniteNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function randomDelayFromProfile(profile = {}, defaults = { minMs: 1000, maxMs: 3000 }) {
  const minMs = Math.max(0, toFiniteNumber(profile.minMs, defaults.minMs));
  const maxMs = Math.max(minMs, toFiniteNumber(profile.maxMs, defaults.maxMs));
  if (maxMs === minMs) return minMs;
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

function computeReconnectDelay(attempt) {
  const safeAttempt = Math.max(1, Number(attempt) || 1);
  const delays = [5000, 15000, 30000, 60000, 120000];
  return delays[safeAttempt - 1] || 120000;
}

// --- Enterprise queue bootstrap (once per process) ------------------------

let enterpriseQueueBootstrapped = false;

function ensureEnterpriseQueues() {
  if (enterpriseQueueBootstrapped) {
    return;
  }

  enterpriseQueueBootstrapped = true;

  enterpriseQueueService.registerWorker(
    enterpriseQueueService.QUEUE_NAMES.inboundMessages,
    async (payload) => payload
  );
  enterpriseQueueService.registerWorker(
    enterpriseQueueService.QUEUE_NAMES.outboundMessages,
    async (payload) => payload
  );
  enterpriseQueueService.registerWorker(
    enterpriseQueueService.QUEUE_NAMES.mediaJobs,
    async (payload) => payload
  );
  enterpriseQueueService.registerWorker(
    enterpriseQueueService.QUEUE_NAMES.aiJobs,
    async (payload) => payload
  );

  enterpriseQueueService.initialize().catch((error) => {
    // eslint-disable-next-line no-console
    console.warn('[QUEUE] Failed to initialize enterprise queue:', error?.message || error);
  });
}

// --- Session-folder management -------------------------------------------

async function ensureSessionsDirectory() {
  await fs.mkdir(SESSIONS_DIRECTORY, { recursive: true });
}

async function ensureSessionPath(sessionName) {
  await ensureSessionsDirectory();
  const normalizedSessionName = normalizeSessionName(sessionName);
  const sessionPath = path.join(SESSIONS_DIRECTORY, normalizedSessionName);

  // eslint-disable-next-line no-console
  console.log('Creating session:', normalizedSessionName);
  // eslint-disable-next-line no-console
  console.log('Session folder:', `sessions/${normalizedSessionName}`);

  await fs.mkdir(sessionPath, { recursive: true });
  return {
    normalizedSessionName,
    sessionPath,
  };
}

// --- Realtime store helpers (media preview, store upsert, history load) ---

async function buildMediaEventPayload(msg = {}) {
  const chatId = msg?.key?.remoteJid || null;

  if (!isValidRealtimeChatId(chatId)) {
    return null;
  }

  const normalizedMessage = unwrapMessageContent(msg.message || {});
  const { mediaMessage, mediaType } = getMediaDescriptor(normalizedMessage);

  if (!mediaMessage || !mediaType || !['image', 'audio', 'video', 'document', 'sticker'].includes(mediaType)) {
    return null;
  }

  let mediaUrl = null;

  try {
    const downloaded = await downloadMedia(mediaMessage, mediaType);
    mediaUrl = downloaded?.url || downloaded?.filePath || null;
  } catch {
    mediaUrl = null;
  }

  return {
    caption:
      normalizedMessage?.imageMessage?.caption ||
      normalizedMessage?.videoMessage?.caption ||
      normalizedMessage?.documentMessage?.caption ||
      '',
    type: mediaType,
    url: mediaUrl,
  };
}

function addMessageToRealtimeStore(session, message, chatMeta = {}) {
  if (!isValidRealtimeChatId(message?.chatId)) {
    return null;
  }

  const store = ensureRealtimeStore(session);

  if (!store.chats[message.chatId]) {
    store.chats[message.chatId] = createRealtimeChatState({
      chatId: message.chatId,
      isGroup: String(message.chatId).endsWith('@g.us'),
      name: chatMeta.name || message.chatId,
    });
  }

  const chatStore = store.chats[message.chatId];

  if (chatMeta.name) {
    chatStore.name = chatMeta.name;
  }

  if (!Array.isArray(chatStore.messages)) {
    chatStore.messages = [];
  }

  chatStore.messages.push(message);
  chatStore.messages = pruneChatMessages(chatStore.messages);
  chatStore.lastMessage = String(message?.text || '');
  chatStore.updatedAt = Date.now();

  return chatStore;
}

async function loadRealtimeHistory({ io, session, sock }) {
  const store = ensureRealtimeStore(session);
  const socketServer = io || global.io;

  if (!socketServer || !sock) {
    return;
  }

  const contacts = typeof sock.getContacts === 'function' ? await sock.getContacts() : [];
  store.contacts = Object.create(null);

  for (const contact of Array.isArray(contacts) ? contacts : []) {
    const id = contact?.id || contact?.jid || contact?.phone || '';

    if (!id) {
      continue;
    }

    store.contacts[id] = contact;
    const normalizedId = normalizeContactKey(id);
    if (normalizedId) {
      store.contacts[normalizedId] = contact;
    }
  }

  const uniqueContacts = Array.from(new Set(Object.values(store.contacts))).filter(Boolean);
  socketServer.emit('contacts_loaded', uniqueContacts);

  const chatsFromSocket = typeof sock.getChats === 'function' ? await sock.getChats() : [];
  const chatList = Array.isArray(chatsFromSocket) ? chatsFromSocket : [];

  store.chats = Object.create(null);

  for (const chat of chatList) {
    const chatId = chat?.id;

    if (!isValidRealtimeChatId(chatId)) {
      continue;
    }

    let historicalMessages = [];

    if (typeof sock.fetchMessagesFromWA === 'function') {
      try {
        historicalMessages = await sock.fetchMessagesFromWA(chatId, INITIAL_CHAT_HISTORY_LIMIT);
      } catch {
        historicalMessages = [];
      }
    }

    const formattedHistory = (Array.isArray(historicalMessages) ? historicalMessages : [])
      .map((entry) => buildRealtimeIncomingMessage(entry))
      .filter((entry) => entry.id && entry.chatId);

    const messages = pruneChatMessages(formattedHistory);
    const latestMessage = messages.length > 0 ? messages[messages.length - 1] : null;
    store.chats[chatId] = {
      ...createRealtimeChatState({
        chatId,
        isGroup: String(chatId).endsWith('@g.us'),
        name: chat?.name || chat?.pushName || chat?.subject || chatId,
      }),
      lastMessage: latestMessage ? getMessagePreview(latestMessage) : '',
      messages,
      updatedAt: latestMessage ? toUnixMillis(latestMessage.timestamp) : Date.now(),
    };
  }

  emitChatsLoaded(socketServer, store);
  emitRealtimeMetrics(socketServer, store);
}

// --- AI auto-reply --------------------------------------------------------

async function runAIForChat({ chatId, incomingFormattedMessage, session, sock }) {
  // Short-circuit automated replies if:
  // (0) it is a group chat
  if (String(chatId).endsWith('@g.us')) {
    console.log(`[WHATSAPP_AI] Skipping AI auto-reply for group chat ${chatId}`);
    return null;
  }

  // (a) global AI toggle is OFF
  if (!isAIEnabled()) {
    console.log(`[WHATSAPP_AI] Global AI toggle is OFF. Short-circuiting response for ${chatId}.`);
    return null;
  }

  // (b) session systemConnected is OFF
  if (session && session.systemConnected === false) {
    console.log(`[WHATSAPP_AI] Session ${session.sessionId || 'unknown'} is not enabled for AI. Short-circuiting response for ${chatId}.`);
    return null;
  }

  const store = ensureRealtimeStore(session);
  const chat = store.chats?.[chatId];

  // (c) conversation AI is OFF (checking authoritative database value)
  let conversationAIEnabled = chat ? chat.aiEnabled !== false : true;
  let fresh = null;
  try {
    const normalizedPhone = normalizePhone(chatId);
    if (incomingFormattedMessage?.conversationId) {
      fresh = await conversationRepository.getConversationById(incomingFormattedMessage.conversationId).catch(() => null);
    }
    if (!fresh) {
      fresh = await conversationRepository.getConversationByPhone(
        normalizedPhone,
        process.env.DEFAULT_COMPANY_ID || 'default',
        session?.sessionId || DEFAULT_SESSION
      ).catch(() => null);
    }
    if (fresh) {
      conversationAIEnabled = fresh.aiEnabled !== false && fresh.ai_enabled !== false;
    }
  } catch (err) {
    console.error('[WHATSAPP_AI] Failed to fetch authoritative chat AI setting from database:', err.message);
  }

  if (
    !chat ||
    chat.archived === true ||
    chat.aiEnabled === false ||
    !conversationAIEnabled ||
    incomingFormattedMessage?.fromMe
  ) {
    return null;
  }

  const messageText = String(incomingFormattedMessage?.text || '').trim();

  if (!messageText) {
    return null;
  }

  const contact = resolveContactForChat(store, chatId);
  const agent = getAgentByName(chat.assignedTo) || pickRandomAgent();

  // Log AI_TRIGGERED step
  try {
    await MessageAuditService.logStep({
      messageId: incomingFormattedMessage?.id || null,
      conversationId: chat?.conversationId || null,
      phone: normalizePhone(chatId),
      step: 'AI_TRIGGERED',
      status: 'success',
      details: {
        agentName: agent?.name || chat.assignedTo || 'unknown',
        agentKey: agent?.key || 'unknown',
        chatId
      }
    });
  } catch (err) {
    console.error('[WHATSAPP] Failed to log AI_TRIGGERED:', err);
  }

  let aiResult;
  try {
    aiResult = await enterpriseAiService.evaluateInboundAi({
      agent,
      chatId,
      conversationHistory: getRecentChatHistory(chat, 10),
      customerMessage: messageText,
      store: {
        activePrompt: session.activePrompt,
        contact,
        isGroup: Boolean(chat?.isGroup),
      },
      forceAutoReply: conversationAIEnabled,
      conversationId: fresh?.id || incomingFormattedMessage?.conversationId || null,
    });
  } catch (error) {
    try {
      await MessageAuditService.logStep({
        messageId: incomingFormattedMessage?.id || null,
        conversationId: chat?.conversationId || null,
        phone: normalizePhone(chatId),
        step: 'AI_TRIGGERED',
        status: 'failed',
        errorMessage: error?.message || String(error),
        details: {
          agentName: agent?.name || chat.assignedTo || 'unknown',
          chatId
        }
      });
    } catch (err) {
      console.error('[WHATSAPP] Failed to log failed AI_TRIGGERED:', err);
    }
    throw error;
  }

  const safeResponse = String(aiResult?.response || '').trim();

  if (!safeResponse || aiResult?.action === 'human') {
    return null;
  }

  if (aiResult?.action === 'suggest_reply') {
    (session.io || global.io)?.emit('ai_response', {
      chatId,
      confidence: aiResult?.confidence,
      response: safeResponse,
      suggested: true,
    });
    return null;
  }

  const responseDelayMs = randomDelayFromProfile(agent?.delayProfile, { minMs: 1000, maxMs: 5000 });
  const typingDelayMs = randomDelayFromProfile(agent?.typingDelayProfile, { minMs: 1000, maxMs: 3000 });

  if (responseDelayMs > 0) {
    await sleep(responseDelayMs);
  }

  try {
    await sock.presenceSubscribe(chatId).catch(() => {});
    await sock.sendPresenceUpdate('composing', chatId).catch(() => {});
    await sleep(typingDelayMs);
    await sock.sendPresenceUpdate('paused', chatId).catch(() => {});
  } catch (presenceError) {
    console.warn('[WHATSAPP] Humanized typing presence failed:', presenceError?.message || presenceError);
  }

  const sent = await sendMessage(sock, chatId, safeResponse);

  const persisted = await enterpriseMessageService.persistInboundMessage({
    companyId: process.env.DEFAULT_COMPANY_ID || 'default',
    fromMe: true,
    mediaPath: null,
    mediaType: 'text',
    name: session?.phone || 'AI',
    phone: normalizePhone(chatId),
    sessionId: session?.sessionId || DEFAULT_SESSION,
    status: 'sent',
    text: safeResponse,
    timestamp: new Date().toISOString(),
    type: 'text',
    conversationId: fresh?.id || incomingFormattedMessage?.conversationId || null,
  });
  const savedOutgoingMessage = persisted?.message || null;

  console.log(`[TEMP_LOG] message.sent - CONVERSATION_ID: "${savedOutgoingMessage?.conversationId || persisted?.conversation?.id || ''}", PHONE: "${normalizePhone(chatId)}", REMOTE_JID: "${chatId}", SESSION_ID: "${session?.sessionId || ''}", MESSAGE_ID: "${savedOutgoingMessage?.id || ''}", SOURCE: "ai_reply"`);

  if (!savedOutgoingMessage?.id) {
    // eslint-disable-next-line no-console
    console.error('ERRO: mensagem sem ID');
    return null;
  }

  const outgoingMessage = {
    chatId,
    conversationId: savedOutgoingMessage.conversationId || persisted?.conversation?.id || null,
    content: safeResponse,
    fromMe: true,
    id: savedOutgoingMessage.id || sent?.key?.id || `ai-${Date.now()}`,
    status: savedOutgoingMessage.status || 'sent',
    text: safeResponse,
    timestamp: savedOutgoingMessage.timestamp || savedOutgoingMessage.createdAt || Date.now(),
    type: 'text',
    url: null,
  };

  addMessageToRealtimeStore(session, outgoingMessage);
  enterpriseRealtimeService.emitNewMessage(session.io || global.io, outgoingMessage);
  (session.io || global.io)?.emit('ai_response', {
    confidence: aiResult?.confidence,
    chatId,
    response: safeResponse,
  });

  // Log RESPONSE_SENT step
  try {
    await MessageAuditService.logStep({
      messageId: outgoingMessage.id,
      conversationId: outgoingMessage.conversationId,
      phone: normalizePhone(chatId),
      step: 'RESPONSE_SENT',
      status: 'success',
      details: {
        response: safeResponse,
        originalMessageId: incomingFormattedMessage?.id || null,
        agentName: agent?.name || 'unknown'
      }
    });
  } catch (err) {
    console.error('[WHATSAPP] Failed to log RESPONSE_SENT:', err);
  }

  if (shouldEmitMetricsForMessage({ savedMessage: savedOutgoingMessage, session })) {
    emitRealtimeMetrics(session.io || global.io, store);
  }

  return outgoingMessage;
}

function shouldRefreshSummary(messageHistory = []) {
  return messageHistory.length > 0 && messageHistory.length % 5 === 0;
}

// --- Main factory: createStableSession ------------------------------------

async function createStableSession({
  displayName,
  generation = 0,
  io,
  onConnectionUpdate = async () => {},
  onIncomingMessage = async () => {},
  onMessageUpdate = async () => {},
  onQrGenerated = () => {},
  onReconnectRequested = async () => {},
  onSessionConnected = async () => {},
  sessionName = DEFAULT_SESSION,
} = {}) {
  ensureEnterpriseQueues();

  const { normalizedSessionName, sessionPath } = await ensureSessionPath(sessionName);
  const existingSession = activeSessions[normalizedSessionName];

  if (existingSession && !existingSession.isDisposed && !existingSession.isClosing) {
    // eslint-disable-next-line no-console
    console.log('Sessao ja existe:', normalizedSessionName);
    return existingSession;
  }

  // CRITICAL: If there's a stale entry (disposed/closing), clean it up first
  if (existingSession) {
    try {
      existingSession.sock?.ev?.removeAllListeners?.();
      existingSession.sock?.end?.(undefined);
    } catch { /* ignore cleanup errors */ }
    delete activeSessions[normalizedSessionName];
  }

  const baileys = await import('@whiskeysockets/baileys');
  const makeWASocket = baileys.default || baileys;
  const fetchLatestBaileysVersion = baileys.fetchLatestBaileysVersion;
  const useMultiFileAuthState = baileys.useMultiFileAuthState;

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    auth: state,
    browser: ['Windows', 'Chrome', '122.0.0'],
    logger: pino({ level: 'silent' }),
    version,
  });

  const session = {
    authState: state,
    displayName: displayName || normalizedSessionName,
    generation: Number(generation || 0),
    io,
    hasEmittedQr: false,
    phone: null,
    qrCode: null,
    recentMessageIds: new Set(),
    recentMessageOrder: [],
    connectionLogs: [],
    sessionId: normalizedSessionName,
    sessionName: displayName || normalizedSessionName,
    sessionPath,
    systemConnected: true,
    heartbeatTimer: null,
    reconnecting: false,
    reconnectRequestCount: 0,
    reconnectRequestPending: false,
    sock,
    status: 'connecting',
    lastConnectionState: null,
    reconnectCooldownTimer: null,
    reconnectRequestTimer: null,
  };

  activeSessions[normalizedSessionName] = session;

  // eslint-disable-next-line no-console
  console.log(`[WHATSAPP] Connecting: ${normalizedSessionName}`);
  pushConnectionLog(session, 'info', 'connecting', 'Session is initializing connection with WhatsApp.');
  logSessionEvent('info', 'connecting', session, {
    phase: 'startup',
  });

  await safeCreateSessionRecord(normalizedSessionName, session.sessionName);
  emitSessionStatus(io, session);

  sock.ev.on('creds.update', () => {
    session.lastPingAt = Date.now();
    saveCreds();
  });

  sock.ev.on('connection.update', async (update) => {
    session.lastPingAt = Date.now();
    if (session.isDisposed || session.isClosing) {
      console.log(`[WHATSAPP] connection.update ignored: session is disposed or closing (${normalizedSessionName})`);
      return;
    }
    const { connection, lastDisconnect, qr } = update;
    const qrDataUrl = qr ? await toQrDataUrl(qr) : null;
    const connectionChanged = connection && connection !== session.lastConnectionState;

    if (connection) {
      session.lastConnectionState = connection;
    }

    if (connection === 'connecting' && connectionChanged) {
      session.status = 'connecting';
      session.updatedAt = new Date().toISOString();
      pushConnectionLog(session, 'info', 'connecting', 'Attempting to connect to WhatsApp.');
      emitSessionStatus(io, session);
    }

    emitConnectionUpdate(io, {
      connection,
      qr: qrDataUrl,
      hasQr: Boolean(qrDataUrl),
      reasonCode: getConnectionCloseCode(lastDisconnect),
      session: normalizedSessionName,
      sessionId: normalizedSessionName,
      sessionName: session.sessionName,
    });

    if (qrDataUrl) {
      session.status = 'qr_ready';
      session.qrCode = qrDataUrl;
      session.qrGeneratedAt = Date.now();
      session.updatedAt = new Date().toISOString();
      session.hasEmittedQr = true;
      pushConnectionLog(session, 'info', 'qr_ready', 'QR is ready for authentication.');

      // QR timeout guard: if no scan happens within QR_TIMEOUT_MS we close the
      // socket and mark the session as disconnected WITHOUT removing auth state,
      // so a subsequent start reuses the stored credentials.
      if (session.qrTimeoutTimer) {
        clearTimeout(session.qrTimeoutTimer);
      }
      session.qrTimeoutTimer = setTimeout(() => {
        session.qrTimeoutTimer = null;
        if (session.status !== 'qr_ready') {
          return;
        }
        session.status = 'disconnected';
        session.qrCode = null;
        session.hasEmittedQr = false;
        session.updatedAt = new Date().toISOString();
        session.lastError = `QR not scanned within ${QR_TIMEOUT_MS}ms.`;
        pushConnectionLog(session, 'warn', 'qr_timeout', session.lastError);
        logSessionEvent('warn', 'qr_timeout', session, {
          timeoutMs: QR_TIMEOUT_MS,
        });
        // eslint-disable-next-line no-console
        console.warn(
          `[WHATSAPP] QR timeout: ${normalizedSessionName} — closing socket, auth preserved.`
        );
        (io || global.io)?.emit('qr_expired', {
          eventAt: Date.now(),
          sessionId: normalizedSessionName,
          sessionName: session.sessionName,
          status: 'disconnected',
          timeoutMs: QR_TIMEOUT_MS,
        });
        emitSessionStatus(io, session);
        try {
          sock.end?.(undefined);
        } catch {
          // ignore socket end failures during QR timeout cleanup
        }
      }, QR_TIMEOUT_MS);
      // eslint-disable-next-line no-console
      console.log(`[WHATSAPP] QR generated: ${normalizedSessionName}`);
      onQrGenerated(qrDataUrl);
      sessionRegistry.setQr(normalizedSessionName, qrDataUrl);
      sessionRegistry.persistSession(normalizedSessionName).catch(() => {});
      (io || global.io)?.emit('session_qr', {
        eventAt: Date.now(),
        name: session.sessionName,
        sessionId: normalizedSessionName,
        status: 'qr',
        type: 'qr',
        qr: qrDataUrl,
        sessionName: session.sessionName,
      });
      (io || global.io)?.emit('qr.update', {
        eventAt: Date.now(),
        sessionId: normalizedSessionName,
        sessionName: session.sessionName,
        status: 'qr',
        qr: qrDataUrl,
      });
      emitSessionStatus(io, session);
    }

    await onConnectionUpdate({
      ...update,
      session,
      sessionId: normalizedSessionName,
      sessionName: normalizedSessionName,
    });

    if (connection === 'open') {
      session.status = 'connected';
      session.updatedAt = new Date().toISOString();
      sessionStateService.setWhatsappSession(sessionStateService.DEFAULT_TENANT, {
        connected: true,
        status: 'CONNECTED',
      });
      session.hasEmittedQr = false;
      session.phone = sessionPhoneFromSock(sock);
      session.qrCode = null;
      session.lastError = null;
      session.reconnecting = false;
      session.reconnectRequestCount = 0;
      session.reconnectRequestPending = false;
      session.connectedAt = Date.now();
      session.lastPingAt = Date.now();
      session.whatsAppName = sock.user?.name || null;
      scanLidMapping(sock);
      session.hasConflict = false;
      session.isBanned = false;
      session.lastDisconnectCode = null;
      session.lastDisconnectReason = null;
      try {
        const jid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        sock.profilePictureUrl(jid, 'image')
          .then((url) => {
            session.profilePictureUrl = url;
          })
          .catch(() => {});
      } catch (e) {}
      if (session.reconnectCooldownTimer) {
        clearTimeout(session.reconnectCooldownTimer);
        session.reconnectCooldownTimer = null;
      }
      if (session.reconnectRequestTimer) {
        clearTimeout(session.reconnectRequestTimer);
        session.reconnectRequestTimer = null;
      }
      if (session.qrTimeoutTimer) {
        clearTimeout(session.qrTimeoutTimer);
        session.qrTimeoutTimer = null;
      }
      if (connectionChanged) {
        pushConnectionLog(session, 'info', 'connected', 'Session connected successfully.');
        logSessionEvent('info', 'connected', session, {
          phone: session.phone,
        });
      }
      await safeUpdateSessionStatus(
        normalizedSessionName,
        'connected',
        session.phone,
        session.sessionName
      );

      if (connectionChanged) {
        // eslint-disable-next-line no-console
        console.log(`[WHATSAPP] Connected: ${normalizedSessionName}, phone: ${session.phone}`);
      }

      (io || global.io)?.emit('session_connected', {
        eventAt: Date.now(),
        name: session.sessionName,
        phone: session.phone,
        sessionId: normalizedSessionName,
        status: 'connected',
        type: 'status',
        sessionName: session.sessionName,
      });
      (io || global.io)?.emit('whatsapp_connection', {
        connected: true,
        sessionId: normalizedSessionName,
        sessionName: session.sessionName,
      });
      (io || global.io)?.emit('session.connected', {
        eventAt: Date.now(),
        phone: session.phone,
        sessionId: normalizedSessionName,
        sessionName: session.sessionName,
        status: 'connected',
      });
      emitSessionStatus(io, session);

      // Sync to SessionRegistry and RuntimeEngine
      sessionRegistry.setConnected(normalizedSessionName, session.phone);
      sessionRegistry.persistSession(normalizedSessionName).catch(() => {});
      runtimeEngine.recordSessionHeartbeat(normalizedSessionName);

      // Socket.IO has built-in ping/pong (default 25s), custom heartbeat not needed
      // Removed redundant 5s interval that was emitting 'ping' to all clients

      try {
        await loadRealtimeHistory({
          io,
          session,
          sock,
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn(
          `[WHATSAPP] Failed to load realtime history for ${normalizedSessionName}:`,
          error?.message || error
        );
      }

      await onSessionConnected(session);

      // Sync Blocklist on Connected (BUG 1 & 10)
      try {
        if (typeof sock.fetchBlocklist === 'function') {
          const blockedJids = await sock.fetchBlocklist();
          const blockedPhones = (blockedJids || [])
            .map((jid) => String(jid).split('@')[0])
            .filter(Boolean);

          const companyId = process.env.DEFAULT_COMPANY_ID || 'default';
          const database = require('../../../config/database');
          await database.query(
            `UPDATE leads SET is_blocked = FALSE WHERE company_id = $1`,
            [companyId]
          );

          if (blockedPhones.length > 0) {
            await database.query(
              `UPDATE leads SET is_blocked = TRUE WHERE phone = ANY($1) AND company_id = $2`,
              [blockedPhones, companyId]
            );
          }

          const conversationRepository = require('../../../repositories/conversationRepository');
          conversationRepository.invalidateConversationCache(companyId);

          const ioServer = io || global.io;
          if (ioServer) {
            ioServer.emit('conversation:revalidated', { sessionId: normalizedSessionName });
          }
        }
      } catch (blocklistError) {
        console.warn('[BLOCKLIST] Failed to sync blocklist on connection open:', blocklistError?.message || blocklistError);
      }

      return;
    }

    if (connection === 'close') {
      // Only set global tenant status to DISCONNECTED if no other session is connected
      const anyConnected = Object.values(activeSessions).some(
        (s) => s && s.sessionName !== session.sessionName && (s.status === 'connected' || s.connected === true)
      );
      if (!anyConnected) {
        sessionStateService.setWhatsappSession(sessionStateService.DEFAULT_TENANT, {
          connected: false,
          status: 'DISCONNECTED',
        });
      }
      if (session.heartbeatTimer) {
        clearInterval(session.heartbeatTimer);
        session.heartbeatTimer = null;
      }
      if (session.qrTimeoutTimer) {
        clearTimeout(session.qrTimeoutTimer);
        session.qrTimeoutTimer = null;
      }
      if (session.reconnectCooldownTimer) {
        clearTimeout(session.reconnectCooldownTimer);
        session.reconnectCooldownTimer = null;
      }
      if (session.reconnectRequestTimer) {
        clearTimeout(session.reconnectRequestTimer);
        session.reconnectRequestTimer = null;
      }

      session.hasEmittedQr = false;
      session.qrCode = null;
      const closeCode = getConnectionCloseCode(lastDisconnect);
      const terminalDisconnect = isTerminalDisconnect(lastDisconnect);
      let willReconnect = !session.isClosing && !session.isDisposed && shouldReconnect(lastDisconnect);

      session.lastDisconnectCode = closeCode;
      session.lastDisconnectReason = lastDisconnect?.error?.message || lastDisconnect?.error || null;
      if (closeCode === 409) {
        session.hasConflict = true;
      }
      if (closeCode === 401 || closeCode === 403) {
        session.isBanned = true;
      }

      if (willReconnect) {
        if (session.reconnecting) {
          // eslint-disable-next-line no-console
          console.log(`[WHATSAPP] Reconnect already in progress for ${normalizedSessionName}, ignoring duplicate close event.`);
          return;
        }

        session.reconnecting = true;
        if (session.reconnectCooldownTimer) {
          clearTimeout(session.reconnectCooldownTimer);
        }
        // Cooldown: prevent another close event from triggering a second reconnect.
        // Window matches the computed backoff so the flag is only cleared AFTER the
        // reconnect attempt has had time to complete.
        const cooldownMs = computeReconnectDelay(session.reconnectRequestCount) + 5000;
        session.reconnectCooldownTimer = setTimeout(() => {
          session.reconnectCooldownTimer = null;
          session.reconnecting = false;
        }, cooldownMs);

        session.reconnectRequestCount = Number(session.reconnectRequestCount || 0) + 1;

        if (session.reconnectRequestCount > MAX_RECONNECT_REQUESTS) {
          willReconnect = false;
          session.status = 'disconnected';
          session.lastError = `Reconnect limit reached (${MAX_RECONNECT_REQUESTS}).`;
          pushConnectionLog(session, 'error', 'reconnect_limit_reached', session.lastError);
          logSessionEvent('warn', 'reconnect_limit_reached', session, {
            closeCode,
            maxReconnectRequests: MAX_RECONNECT_REQUESTS,
            reconnectRequestCount: session.reconnectRequestCount,
          });
        }
      }

      if (willReconnect) {
        session.status = 'connecting';
        session.updatedAt = new Date().toISOString();
        session.lastError = `Connection closed (${closeCode || 'unknown'}), retry scheduled.`;
        pushConnectionLog(session, 'error', 'error', session.lastError);
        logSessionEvent('warn', 'reconnect_scheduled', session, {
          closeCode,
          reason: session.lastError,
        });
      } else {
        session.status = 'disconnected';
        session.updatedAt = new Date().toISOString();
        session.lastError = terminalDisconnect
          ? 'WhatsApp session logged out.'
          : 'Connection closed by runtime.';
        pushConnectionLog(
          session,
          terminalDisconnect ? 'info' : 'warn',
          'disconnected',
          session.lastError
        );
        logSessionEvent(
          terminalDisconnect ? 'info' : 'warn',
          'disconnected',
          session,
          {
            closeCode,
            reason: session.lastError,
          }
        );
      }

      await safeUpdateSessionStatus(
        normalizedSessionName,
        willReconnect ? 'connecting' : 'disconnected',
        session.phone,
        session.sessionName
      );

      // eslint-disable-next-line no-console
      console.log(
        `[WHATSAPP] Disconnected: ${normalizedSessionName}, code: ${closeCode}, willReconnect: ${willReconnect}`
      );

      (io || global.io)?.emit('session_disconnected', {
        eventAt: Date.now(),
        name: session.sessionName,
        sessionId: normalizedSessionName,
        status: 'disconnected',
        type: 'status',
        sessionName: session.sessionName,
      });
      (io || global.io)?.emit('whatsapp_connection', {
        connected: false,
        sessionId: normalizedSessionName,
        sessionName: session.sessionName,
      });
      (io || global.io)?.emit('session.disconnected', {
        eventAt: Date.now(),
        sessionId: normalizedSessionName,
        sessionName: session.sessionName,
        status: 'disconnected',
      });
      emitSessionStatus(io, session);

      // Sync to SessionRegistry and RuntimeEngine
      if (willReconnect) {
        sessionRegistry.set(normalizedSessionName, {
          connected: false,
          phone: session.phone,
          qrCode: null,
          status: 'connecting',
        });
        runtimeEngine.incrementReconnectCounter(normalizedSessionName);
      } else {
        sessionRegistry.setDisconnected(normalizedSessionName, terminalDisconnect ? 'logged_out' : 'closed');
      }
      sessionRegistry.persistSession(normalizedSessionName).catch(() => {});

      if (willReconnect) {
        if (session.reconnectRequestPending) {
          return;
        }

        session.reconnectRequestPending = true;
        const reconnectDelayMs = computeReconnectDelay(session.reconnectRequestCount);
        logSessionEvent('info', 'reconnect_delay', session, {
          attempt: session.reconnectRequestCount,
          delayMs: reconnectDelayMs,
          closeCode,
        });
        onReconnectRequested(normalizedSessionName, { closeCode, generation: session.generation })
          .catch((error) => {
            logSessionEvent('error', 'reconnect_failed', session, {
              attempt: session.reconnectRequestCount,
              closeCode,
              error: error?.message || String(error),
            });
            // eslint-disable-next-line no-console
            console.error(
              `[WHATSAPP] Session ${normalizedSessionName} reconnect failed:`,
              error?.message || error
            );
          });
      } else if (terminalDisconnect) {
        delete activeSessions[normalizedSessionName];
        if (closeCode === 401) {
          // loggedOut / invalid session — clear stale auth so next connect gets a fresh QR
          // eslint-disable-next-line no-console
          console.log(`[WHATSAPP] Logged out: ${normalizedSessionName} — clearing auth state`);
          try {
            await fs.rm(sessionPath, { force: true, recursive: true });
          } catch (rmErr) {
            // eslint-disable-next-line no-console
            console.warn(
              `[WHATSAPP] Could not clear auth state for ${normalizedSessionName}:`,
              rmErr.message
            );
          }
        } else {
          console.log(`[WHATSAPP] Terminal disconnect (${closeCode}) for ${normalizedSessionName} — keeping credentials`);
        }
        (io || global.io)?.emit('session_logged_out', {
          name: session.sessionName,
          sessionId: normalizedSessionName,
          sessionName: session.sessionName,
        });
      } else if (!willReconnect) {
        delete activeSessions[normalizedSessionName];
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    session.lastPingAt = Date.now();
    if (session.isDisposed || session.isClosing) return;
    scanLidMapping(sock);
    const batchCount = Array.isArray(messages) ? messages.length : 0;

    if (batchCount > 0) {
      // eslint-disable-next-line no-console
      console.log(
        `[WHATSAPP] messages.upsert session=${normalizedSessionName} count=${batchCount} type=${type || 'unknown'}`
      );
      runtimeEngine.incrementMessageCounter(batchCount);
    }

    if (type !== 'notify') {
      return;
    }

    for (const incomingMessage of messages || []) {
      const remoteJid = incomingMessage?.key?.remoteJid || '';
      const messageId = incomingMessage?.key?.id || null;
      const dedupeKey = buildRealtimeDeduplicationKey(incomingMessage, remoteJid);
      const fromMe = Boolean(incomingMessage?.key?.fromMe);
      const protocolMessageType = Number(incomingMessage?.message?.protocolMessage?.type);
      const queueName = fromMe
        ? enterpriseQueueService.QUEUE_NAMES.outboundMessages
        : enterpriseQueueService.QUEUE_NAMES.inboundMessages;

      if (!isValidRealtimeChatId(remoteJid) || remoteJid.endsWith('@newsletter')) {
        continue;
      }

      if (!incomingMessage?.message) {
        continue;
      }

      if (protocolMessageType === 0) {
        const deletedMessageId =
          incomingMessage?.message?.protocolMessage?.key?.id || messageId;

        (io || global.io)?.emit('message_deleted', { id: deletedMessageId });
        continue;
      }

      if (session.systemConnected === false) {
        continue;
      }

      if (!shouldProcessGlobalMessageId(messageId)) {
        continue;
      }

      if (!shouldProcessRealtimeMessage(session, dedupeKey)) {
        continue;
      }

      // Log RECEIVED_FROM_BAILEYS step
      try {
        await MessageAuditService.logStep({
          messageId: messageId,
          conversationId: null,
          phone: remoteJid ? String(remoteJid).split('@')[0] : null,
          step: 'RECEIVED_FROM_BAILEYS',
          status: 'success',
          details: { sessionId: normalizedSessionName, fromMe }
        });
      } catch (err) {
        console.error('[WHATSAPP] Failed to log RECEIVED_FROM_BAILEYS:', err);
      }

      // eslint-disable-next-line no-console
      console.log(
        `[WHATSAPP] message.received session=${normalizedSessionName} chat=${remoteJid} id=${messageId || 'n/a'} fromMe=${fromMe}`
      );

      try {
        const text = extractMessageText(incomingMessage);
        const { mediaType } = getMediaDescriptor(incomingMessage.message);
        let desc = text || '';
        if (mediaType) {
          const typeLabel = mediaType === 'audio' ? 'Áudio' : mediaType === 'image' ? 'Imagem' : mediaType === 'video' ? 'Vídeo' : 'Arquivo';
          desc = `[${typeLabel}]${text ? ' ' + text : ''}`;
        }
        if (!desc.trim()) {
          desc = '[Mensagem]';
        }
        const cleanedPhone = String(remoteJid).split('@')[0];
        if (fromMe) {
          pushConnectionLog(session, 'info', 'message_sent', `Mensagem enviada para ${cleanedPhone}: ${desc.slice(0, 80)}`);
        } else {
          pushConnectionLog(session, 'info', 'message_received', `Mensagem recebida de ${incomingMessage.pushName || cleanedPhone}: ${desc.slice(0, 80)}`);
        }
      } catch (logErr) {
        console.error('[WHATSAPP] Failed to push message connection log:', logErr);
      }

      await enterpriseQueueService.enqueue(
        queueName,
        {
          chatId: remoteJid,
          fromMe,
          messageId,
          sessionId: normalizedSessionName,
          timestamp: Date.now(),
        },
        {
          attempts: 5,
          backoffMs: 500,
        }
      );

      const inboundDebugPayload = buildInboundDebugPayload(incomingMessage);

      let result = null;

      if (fromMe) {
        // This is an outbound message sent from Baileys
        // Transition state to SENT
        const existingAck = messageAckPipeline.getAckState(messageId);
        let dbId = existingAck?.dbMessageId;

        if (!existingAck || !dbId) {
          // If not in memory mapping (e.g. sent from another device), save to DB
          try {
            result = await persistRealtimeMessage({
              incomingMessage,
              sessionId: normalizedSessionName,
            });
            if (result?.message?.id) {
              dbId = result.message.id;
              messageAckPipeline.registerDbMapping(messageId, dbId);
            }
          } catch (error) {
            console.error('[WHATSAPP] outbound realtime persistence failed:', error?.message || error);
          }
        } else {
          // If it IS in the memory mapping (sent from our API), result is null.
          // BUT we can load the message from the repository so we can populate `result`
          // and let formatInboundSavedMessage create a correct savedMessage object!
          try {
            const dbMessage = await messageRepository.findById(dbId);
            if (dbMessage) {
              const dbConversation = await conversationRepository.getConversationById(dbMessage.conversationId);
              result = {
                message: dbMessage,
                conversation: dbConversation
              };
            }
          } catch (err) {
            console.error('[WHATSAPP] failed to retrieve existing message/conversation:', err?.message || err);
          }
        }

        // Transition the state to SENT and save/emit
        const ackEntry = messageAckPipeline.transitionAck(messageId, messageAckPipeline.ACK_STATES.SENT, {
          chatId: remoteJid,
          sessionId: normalizedSessionName,
        });

        // Emit the real-time event to socket
        if (ackEntry) {
          messageAckPipeline.emitAckUpdate(io || global.io, ackEntry);
        }

        // Also emit literal 'message:sent' as requested
        (io || global.io)?.emit('message:sent', {
          id: dbId || messageId,
          chatId: remoteJid,
          status: 'sent',
        });

        // If we still don't have a result (e.g. DB fetch failed), fallback mock to prevent skipping realtime store/events
        if (!result) {
          result = {
            message: {
              id: dbId || messageId,
              fromMe: true,
              from: 'agent',
              status: 'sent',
              content: inboundDebugPayload.text,
              text: inboundDebugPayload.text,
              phone: inboundDebugPayload.phone,
              timestamp: inboundDebugPayload.timestamp,
              createdAt: new Date(inboundDebugPayload.timestamp).toISOString(),
            }
          };
        }
      } else {
        try {
          result = await onIncomingMessage({
            incomingMessage,
            session,
            sessionId: normalizedSessionName,
            sock,
          });
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('[WHATSAPP] inbound persistence pipeline failed:', error?.message || error);
        }

        if (!result?.message) {
          result = await persistInboundMessageFallback(
            normalizedSessionName,
            incomingMessage,
            inboundDebugPayload
          );
        }
      }

      const savedMessage = formatInboundSavedMessage(result, inboundDebugPayload);

      if (!savedMessage?.id) {
        // eslint-disable-next-line no-console
        console.error('ERRO: mensagem sem ID');
        continue;
      }

      const realtimeMediaPayload = buildRealtimeMediaPayload({
        messageData: incomingMessage,
        savedMessage,
        sessionId: normalizedSessionName,
      });

      const formattedRealtimeMessage = {
        ...buildRealtimeIncomingMessage(incomingMessage),
        id: savedMessage.id,
        conversationId: savedMessage.conversationId || result?.conversation?.id || null,
      };
      const chatStore = addMessageToRealtimeStore(session, formattedRealtimeMessage);

      const formattedMessage = {
        from: remoteJid,
        id: messageId,
        text: inboundDebugPayload.text === '[media]' ? '' : inboundDebugPayload.text,
        timestamp: inboundDebugPayload.timestamp,
      };

      saveMessage(formattedMessage);

      // eslint-disable-next-line no-console
      console.log(
        `[WHATSAPP] message.saved session=${normalizedSessionName} chat=${remoteJid} id=${savedMessage.id}`
      );
      if (result?.conversation) {
        emitInboundRealtimeMessage(io, savedMessage, result.conversation);
      }

      if (chatStore && formattedRealtimeMessage?.chatId) {
        const realtimeUrl = realtimeMediaPayload?.url || null;
        const realtimeType = String(realtimeMediaPayload?.type || '').toLowerCase();
        const requiresUrl = ['image', 'video', 'audio', 'file'].includes(realtimeType);

        if (requiresUrl && !realtimeUrl) {
          // eslint-disable-next-line no-console
          console.warn('[WHATSAPP] [REALTIME EVENT] Missing URL for media message, but proceeding to emit event anyway:', formattedRealtimeMessage);
        }

        enterpriseRealtimeService.emitNewMessage(io || global.io, {
          ...formattedRealtimeMessage,
          caption: realtimeMediaPayload?.caption || formattedRealtimeMessage.text || '',
          chatId: formattedRealtimeMessage.chatId,
          conversationId: savedMessage?.conversationId || result?.conversation?.id || null,
          content: formattedRealtimeMessage.text || '',
          phone: inboundDebugPayload.phone,
          url: realtimeUrl,
          sessionId: normalizedSessionName,
          mimeType: realtimeMediaPayload?.mimetype || null,
          filename: realtimeMediaPayload?.fileName || realtimeMediaPayload?.filename || null,
        });
      }

      if (realtimeMediaPayload) {
        await enterpriseQueueService.enqueue(
          enterpriseQueueService.QUEUE_NAMES.mediaJobs,
          {
            chatId: remoteJid,
            messageId,
            sessionId: normalizedSessionName,
            type: realtimeMediaPayload.type,
          },
          {
            attempts: 5,
            backoffMs: 500,
          }
        );

        // eslint-disable-next-line no-console
        console.log('BAILEYS MEDIA RECEIVED', realtimeMediaPayload);
        (io || global.io)?.emit('new_media', realtimeMediaPayload);
      }

      const mediaPayload = await buildMediaEventPayload(incomingMessage);

      if (mediaPayload) {
        (io || global.io)?.emit('media', mediaPayload);
      } else if (realtimeMediaPayload?.type) {
        // eslint-disable-next-line no-console
        console.warn(
          `[WHATSAPP] media.error session=${normalizedSessionName} chat=${remoteJid} id=${messageId || 'n/a'} reason=media_url_unavailable`
        );
      }

      if (shouldEmitMetricsForMessage({ savedMessage, session })) {
        emitRealtimeMetrics(io, ensureRealtimeStore(session));
      }

      try {
        await enterpriseQueueService.enqueue(
          enterpriseQueueService.QUEUE_NAMES.aiJobs,
          {
            chatId: formattedRealtimeMessage.chatId,
            messageId,
            sessionId: normalizedSessionName,
          },
          {
            attempts: 5,
            backoffMs: 500,
          }
        );

        await runAIForChat({
          chatId: formattedRealtimeMessage.chatId,
          incomingFormattedMessage: formattedRealtimeMessage,
          session,
          sock,
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn(
          `[WHATSAPP] AI auto-reply skipped for ${formattedRealtimeMessage.chatId}:`,
          error?.message || error
        );
      }
    }
  });

  sock.ev.on('messages.update', async (updates) => {
    session.lastPingAt = Date.now();
    if (session.isDisposed || session.isClosing) return;
    await emitMessageUpdates(io, updates, normalizedSessionName);

    // Phase 5: Track ACK state transitions
    const ackResults = messageAckPipeline.processBaileysStatusBatch(updates);
    for (const ackEntry of ackResults) {
      messageAckPipeline.emitAckUpdate(io || global.io, ackEntry);
    }

    for (const update of updates || []) {
      (io || global.io)?.emit('message_status', {
        id: update?.key?.id || null,
        status: update?.update?.status,
      });
    }

    await onMessageUpdate({
      session,
      sessionId: normalizedSessionName,
      updates,
    });
  });

  sock.ev.on('message-receipt.update', async (receipts) => {
    session.lastPingAt = Date.now();
    if (session.isDisposed || session.isClosing) return;
    for (const receipt of receipts || []) {
      const messageId = receipt?.key?.id;
      if (!messageId) continue;

      const remoteJid = receipt?.key?.remoteJid;
      // Map Baileys receipt updates to ack status
      let mappedStatus = null;
      if (receipt.receipt?.readTimestamp) {
        mappedStatus = messageAckPipeline.ACK_STATES.READ;
      } else if (receipt.receipt?.receiptTimestamp) {
        mappedStatus = messageAckPipeline.ACK_STATES.DEVICE_ACK;
      }

      if (mappedStatus) {
        const ackEntry = messageAckPipeline.transitionAck(messageId, mappedStatus, {
          chatId: remoteJid,
          sessionId: normalizedSessionName,
        });
        if (ackEntry) {
          messageAckPipeline.emitAckUpdate(io || global.io, ackEntry);
        }
      }
    }
  });

  // ── Chats sync (fired after initial connection) ─────────────────────────
  // Baileys emits 'chats.set' when the initial chat list arrives after
  // authentication. We capture this to ensure:
  //   1. The realtime store is populated (in-memory, for WS emission)
  //   2. Each 1:1 conversation is persisted to PostgreSQL (for Inbox hydration)
  //
  // Without (2), restarting PM2 empties the Inbox because GET /api/conversations
  // reads from the DB — not from the in-memory store.
  sock.ev.on('chats.set', ({ chats: chatList = [] }) => {
    session.lastPingAt = Date.now();
    if (session.isDisposed || session.isClosing) return;
    if (!Array.isArray(chatList) || chatList.length === 0) {
      return;
    }

    // eslint-disable-next-line no-console
    console.log(
      `[WHATSAPP] chats.set session=${normalizedSessionName} count=${chatList.length}`
    );

    const store = ensureRealtimeStore(session);

    // Batch for DB persist — individual chats only (groups use a different schema)
    const individualChatsToSync = [];

    for (const chat of chatList) {
      const chatId = chat?.id;
      if (!isValidRealtimeChatId(chatId)) {
        continue;
      }

      const isGroup = String(chatId).endsWith('@g.us');
      const name = chat?.name || chat?.subject || chatId;

      // 1. Update in-memory realtime store
      if (!store.chats[chatId]) {
        store.chats[chatId] = createRealtimeChatState({
          chatId,
          isGroup,
          name,
        });
      } else {
        if (name) {
          store.chats[chatId].name = name;
        }
      }

      // 2. Queue individual chats for DB persistence
      if (!isGroup) {
        // Extract phone number from JID (e.g. "5511999887766@s.whatsapp.net" → "5511999887766")
        const phone = String(chatId).split('@')[0];
        if (phone && /^\d{7,15}$/.test(phone)) {
          individualChatsToSync.push({ phone, name, chatId });
        }
      }
    }

    // Re-emit chats loaded for any late-connecting frontend clients
    emitChatsLoaded(io || global.io, store);

    // Async DB sync — fire and forget, does not block the event loop
    // Uses lazy require to avoid circular dependency at module load time
    if (individualChatsToSync.length > 0) {
      setImmediate(async () => {
        try {
          const conversationRepository = require('../../../repositories/conversationRepository');
          const companyId = process.env.DEFAULT_COMPANY_ID || 'default';
          let synced = 0;
          let errors = 0;

          // Process in small batches to avoid overwhelming the DB pool
          const BATCH_SIZE = 10;
          for (let i = 0; i < individualChatsToSync.length; i += BATCH_SIZE) {
            const batch = individualChatsToSync.slice(i, i + BATCH_SIZE);
            await Promise.allSettled(batch.map(async ({ phone, name }) => {
              try {
                await conversationRepository.findOrCreateConversationByPhone({
                  companyId,
                  contactName: name || phone,
                  phone,
                  sessionId: normalizedSessionName,
                });
                synced++;
              } catch (err) {
                errors++;
                // Only log first few errors to avoid log spam
                if (errors <= 3) {
                  console.warn(`[WHATSAPP] chats.set DB sync failed for ${phone}: ${err?.message}`);
                }
              }
            }));
          }

          console.log(
            `[WHATSAPP] chats.set DB sync complete session=${normalizedSessionName} synced=${synced} errors=${errors} total=${individualChatsToSync.length}`
          );

          // Invalidate conversation cache so next GET /api/conversations sees fresh data
          conversationRepository.invalidateConversationCache(companyId);
        } catch (err) {
          console.error(`[WHATSAPP] chats.set DB sync fatal: ${err?.message}`);
        }
      });
    }
  });


  // ── Chats update (name/archive changes) ─────────────────────────────────
  sock.ev.on('chats.update', (updates) => {
    session.lastPingAt = Date.now();
    if (session.isDisposed || session.isClosing) return;
    const store = ensureRealtimeStore(session);

    for (const update of updates || []) {
      const chatId = update?.id;
      if (!chatId || !store.chats[chatId]) {
        continue;
      }

      if (update.name) {
        store.chats[chatId].name = update.name;
      }
      if (typeof update.archived === 'boolean') {
        store.chats[chatId].archived = update.archived;
      }
    }
  });

  // ── Contacts sync ──────────────────────────────────────────────────────
  sock.ev.on('contacts.upsert', (contacts) => {
    session.lastPingAt = Date.now();
    if (session.isDisposed || session.isClosing) return;
    for (const contact of contacts || []) {
      processContactForLidMapping(contact);
    }
  });

  sock.ev.on('contacts.update', (updates) => {
    session.lastPingAt = Date.now();
    if (session.isDisposed || session.isClosing) return;
    const store = ensureRealtimeStore(session);
    if (!store.contacts) {
      store.contacts = Object.create(null);
    }

    for (const contact of updates || []) {
      const id = contact?.id || '';
      if (!id) {
        continue;
      }

      processContactForLidMapping(contact);

      store.contacts[id] = { ...(store.contacts[id] || {}), ...contact };
      const normalizedId = normalizeContactKey(id);
      if (normalizedId) {
        store.contacts[normalizedId] = store.contacts[id];
      }
    }

    // Sync through ContactsEngine pipeline (incremental + persist + emit)
    const companyId = session.companyId || process.env.DEFAULT_COMPANY_ID || 'default';
    contactsEngine.fullSync(
      updates || [],
      normalizedSessionName,
      companyId,
      io || global.io
    ).catch((err) => {
      console.error(`[WHATSAPP] ContactsEngine sync failed: ${err?.message || err}`);
    });

    // eslint-disable-next-line no-console
    console.log(
      `[WHATSAPP] contacts.update session=${normalizedSessionName} count=${(updates || []).length}`
    );
  });

  sock.ev.on('presence.update', async (presence) => {
    session.lastPingAt = Date.now();
    if (session.isDisposed || session.isClosing) return;

    const remoteJid = presence?.id;
    if (!remoteJid) return;

    const phone = remoteJid.split('@')[0];
    const companyId = process.env.DEFAULT_COMPANY_ID || 'default';

    const participantPresences = presence.presences || {};
    let status = 'unavailable';
    if (participantPresences[remoteJid]?.lastKnownPresence) {
      status = participantPresences[remoteJid].lastKnownPresence;
    } else if (presence.presence) {
      status = presence.presence;
    }

    const presenceState = ['available', 'composing', 'recording'].includes(status) ? 'online' : 'offline';

    try {
      const conversationRepository = require('../../../repositories/conversationRepository');
      const conversationRuntimeService = require('../../../inbox-core/inbox/services/ConversationRuntimeService');
      const conversation = await conversationRepository.getConversationByPhone(phone, companyId);
      if (conversation) {
        const decorated = conversationRuntimeService.decorateConversation(session, conversation);
        decorated.presence = presenceState;

        const ioServer = io || global.io;
        if (ioServer) {
          ioServer.emit('conversation:update', decorated);
          ioServer.emit('conversation_updated', decorated);
          ioServer.emit('conversation-update', decorated);

          // Emit typing event for composing/recording
          const isTypingVal = status === 'composing' ? 'composing' : status === 'recording' ? 'recording' : false;
          ioServer.emit('typing', {
            conversationId: conversation.id,
            phone: phone,
            isTyping: isTypingVal
          });
        }
      }
    } catch (err) {
      // ignore
    }
  });

  return session;
}

const lidMapper = require('../shared/lidMapper');

function processContactForLidMapping(contact) {
  if (!contact) return;
  const id = contact.id || contact.jid || '';
  const lid = contact.lid || '';
  if (id && lid) {
    const idIsLid = id.endsWith('@lid');
    const lidIsLid = lid.endsWith('@lid');
    const idIsJid = id.endsWith('@s.whatsapp.net');
    const lidIsJid = lid.endsWith('@s.whatsapp.net');

    let lidStr = null;
    let jidStr = null;

    if (idIsLid) lidStr = id;
    if (lidIsLid) lidStr = lid;
    if (idIsJid) jidStr = id;
    if (lidIsJid) jidStr = lid;

    if (lidStr && jidStr) {
      const lidDigits = lidStr.split('@')[0];
      const jidDigits = jidStr.split('@')[0];
      lidMapper.saveMapping(lidDigits, jidDigits).catch(err => {
        console.error('[LID-MAPPER] Failed to save mapping:', err);
      });
    }
  }
}

function scanLidMapping(sockInstance) {
  if (!sockInstance) return;
  const mapping = sockInstance.lidMapping;
  if (mapping) {
    if (mapping instanceof Map) {
      for (const [lid, jid] of mapping.entries()) {
        const lidDigits = String(lid).split('@')[0];
        const jidDigits = String(jid).split('@')[0];
        lidMapper.saveMapping(lidDigits, jidDigits).catch(err => {
          console.error('[LID-MAPPER] Failed to save mapping from Map:', err);
        });
      }
    } else if (typeof mapping === 'object') {
      for (const [lid, jid] of Object.entries(mapping)) {
        const lidDigits = String(lid).split('@')[0];
        const jidDigits = String(jid).split('@')[0];
        lidMapper.saveMapping(lidDigits, jidDigits).catch(err => {
          console.error('[LID-MAPPER] Failed to save mapping from Object:', err);
        });
      }
    }
  }
}

module.exports = {
  addMessageToRealtimeStore,
  buildMediaEventPayload,
  createStableSession,
  ensureEnterpriseQueues,
  ensureSessionPath,
  ensureSessionsDirectory,
  loadRealtimeHistory,
  runAIForChat,
  shouldRefreshSummary,
  scanLidMapping,
  processContactForLidMapping,
};
