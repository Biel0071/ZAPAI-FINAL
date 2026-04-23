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
const {
  default: makeWASocket,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} = require('@whiskeysockets/baileys');

const sessionStateService = require('../../sessionStateService');
const enterpriseQueueService = require('../../enterprise/queue-service');
const enterpriseAiService = require('../../enterprise/ai-service');
const enterpriseMessageService = require('../../enterprise/message-service');
const enterpriseRealtimeService = require('../../enterprise/realtime-service');
const { getAgentByName, pickRandomAgent } = require('../../../config/agents');

const {
  DEFAULT_SESSION,
  normalizePhone,
  normalizeSessionName,
} = require('../shared/identifiers');
const { toUnixMillis } = require('../shared/time');
const { getMediaDescriptor, unwrapMessageContent } = require('../inbound/parser');
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
const { getConnectionCloseCode, shouldReconnect } = require('./reconnect');
const {
  safeCreateSessionRecord,
  safeUpdateSessionStatus,
} = require('./persistence');
const { logSessionEvent, pushConnectionLog } = require('./logger');
const { sendMessage } = require('../outbound/senders');
const { saveMessage } = require('../chat/operations');
const { activeSessions } = require('../state/registry');

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
  Number(process.env.WHATSAPP_MAX_RECONNECT_REQUESTS || 5)
);
// QR timeout: if the user does not scan the QR within this window the session
// is closed (but auth folder IS preserved so future start reuses credentials).
const QR_TIMEOUT_MS = Math.max(
  30_000,
  Number(process.env.WHATSAPP_QR_TIMEOUT_MS || 2 * 60_000)
);
const INITIAL_CHAT_HISTORY_LIMIT = 50;

function computeReconnectDelay(attempt) {
  const safeAttempt = Math.max(1, Number(attempt) || 1);
  const exponential = RECONNECT_BACKOFF_BASE_MS * Math.pow(2, safeAttempt - 1);
  return Math.min(exponential, RECONNECT_BACKOFF_MAX_MS);
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

  if (!mediaMessage || !mediaType || !['image', 'audio', 'video', 'document'].includes(mediaType)) {
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
  const store = ensureRealtimeStore(session);
  const chat = store.chats?.[chatId];

  if (
    !chat ||
    chat.archived === true ||
    chat.aiEnabled === false ||
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
  const aiResult = await enterpriseAiService.evaluateInboundAi({
    agent,
    chatId,
    conversationHistory: getRecentChatHistory(chat, 10),
    customerMessage: messageText,
    store: {
      activePrompt: session.activePrompt,
      contact,
      isGroup: Boolean(chat?.isGroup),
    },
  });

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
  });
  const savedOutgoingMessage = persisted?.message || null;

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
  emitSessionStatus(io, normalizedSessionName, session.status, session.sessionName);

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    const qrDataUrl = qr ? await toQrDataUrl(qr) : null;
    const connectionChanged = connection && connection !== session.lastConnectionState;

    if (connection) {
      session.lastConnectionState = connection;
    }

    if (connection === 'connecting' && connectionChanged) {
      session.status = 'connecting';
      pushConnectionLog(session, 'info', 'connecting', 'Attempting to connect to WhatsApp.');
      emitSessionStatus(io, normalizedSessionName, session.status, session.sessionName);
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
        emitSessionStatus(io, normalizedSessionName, session.status, session.sessionName);
        try {
          sock.end?.(undefined);
        } catch {
          // ignore socket end failures during QR timeout cleanup
        }
      }, QR_TIMEOUT_MS);
      // eslint-disable-next-line no-console
      console.log(`[WHATSAPP] QR generated: ${normalizedSessionName}`);
      onQrGenerated(qrDataUrl);
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
      emitSessionStatus(io, normalizedSessionName, session.status, session.sessionName);
    }

    await onConnectionUpdate({
      ...update,
      session,
      sessionId: normalizedSessionName,
      sessionName: normalizedSessionName,
    });

    if (connection === 'open') {
      session.status = 'connected';
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
      emitSessionStatus(io, normalizedSessionName, session.status, session.sessionName);

      if (!session.heartbeatTimer) {
        session.heartbeatTimer = setInterval(() => {
          if (session.status === 'connected') {
            (io || global.io)?.emit('ping');
          }
        }, 5000);
      }

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
      return;
    }

    if (connection === 'close') {
      sessionStateService.setWhatsappSession(sessionStateService.DEFAULT_TENANT, {
        connected: false,
        status: 'DISCONNECTED',
      });
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
      let willReconnect = !session.isClosing && !session.isDisposed && shouldReconnect(lastDisconnect);

      if (willReconnect) {
        if (session.reconnecting) {
          return;
        }

        session.reconnecting = true;
        if (session.reconnectCooldownTimer) {
          clearTimeout(session.reconnectCooldownTimer);
        }
        session.reconnectCooldownTimer = setTimeout(() => {
          session.reconnectCooldownTimer = null;
          session.reconnecting = false;
        }, 5000);

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
        session.status = 'error';
        session.lastError = `Connection closed (${closeCode || 'unknown'}), retry scheduled.`;
        pushConnectionLog(session, 'error', 'error', session.lastError);
        logSessionEvent('warn', 'reconnect_scheduled', session, {
          closeCode,
          reason: session.lastError,
        });
      } else {
        session.status = 'disconnected';
        session.lastError = shouldReconnect(lastDisconnect)
          ? 'Connection closed by runtime.'
          : 'WhatsApp session logged out.';
        pushConnectionLog(
          session,
          shouldReconnect(lastDisconnect) ? 'warn' : 'info',
          'disconnected',
          session.lastError
        );
        logSessionEvent(
          shouldReconnect(lastDisconnect) ? 'warn' : 'info',
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
        'disconnected',
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
      emitSessionStatus(io, normalizedSessionName, session.status, session.sessionName);

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
        if (session.reconnectRequestTimer) {
          clearTimeout(session.reconnectRequestTimer);
        }
        session.reconnectRequestTimer = setTimeout(() => {
          session.reconnectRequestTimer = null;
          onReconnectRequested(normalizedSessionName, { closeCode })
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
            })
            .finally(() => {
              session.reconnectRequestPending = false;
            });
        }, reconnectDelayMs);
      } else if (!shouldReconnect(lastDisconnect)) {
        delete activeSessions[normalizedSessionName];
        // loggedOut — clear stale auth so next connect gets a fresh QR
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
    const batchCount = Array.isArray(messages) ? messages.length : 0;

    if (batchCount > 0) {
      // eslint-disable-next-line no-console
      console.log(
        `[WHATSAPP] messages.upsert session=${normalizedSessionName} count=${batchCount} type=${type || 'unknown'}`
      );
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

      // eslint-disable-next-line no-console
      console.log(
        `[WHATSAPP] message.received session=${normalizedSessionName} chat=${remoteJid} id=${messageId || 'n/a'} fromMe=${fromMe}`
      );

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
        try {
          result = await persistRealtimeMessage({
            incomingMessage,
            sessionId: normalizedSessionName,
          });
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('[WHATSAPP] outbound realtime persistence failed:', error?.message || error);
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
      emitInboundRealtimeMessage(io, savedMessage, result?.conversation || null);

      if (chatStore && formattedRealtimeMessage?.chatId) {
        const realtimeUrl = realtimeMediaPayload?.url || null;
        const realtimeType = String(realtimeMediaPayload?.type || '').toLowerCase();
        const requiresUrl = ['image', 'video', 'audio', 'file'].includes(realtimeType);

        if (requiresUrl && !realtimeUrl) {
          // eslint-disable-next-line no-console
          console.error('SEM URL:', formattedRealtimeMessage);
          continue;
        }

        enterpriseRealtimeService.emitNewMessage(io || global.io, {
          ...formattedRealtimeMessage,
          caption: realtimeMediaPayload?.caption || formattedRealtimeMessage.text || '',
          chatId: formattedRealtimeMessage.chatId,
          conversationId: savedMessage?.conversationId || result?.conversation?.id || null,
          content: formattedRealtimeMessage.text || '',
          phone: inboundDebugPayload.phone,
          url: realtimeUrl,
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
    await emitMessageUpdates(io, updates, normalizedSessionName);

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

  return session;
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
};
