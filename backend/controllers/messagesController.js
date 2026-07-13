const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const { query: dbQuery } = require('../config/database');

const sessionManager = require('../services/sessionManager');
const messageService = require('../services/messageService');
const conversationRepository = require('../repositories/conversationRepository');
const messageRepository = require('../repositories/messageRepository');
const whatsappService = require('../services/whatsappService');
const MessageAuditService = require('../services/messageAuditService');
const messageStore = require('../store/messageStore');
const webhookService = require('../services/webhookService');
const aiIntelligenceService = require('../services/aiIntelligenceService');

const messageDedupeService = require('../services/messageDedupeService');
const messageAckPipeline = require('../services/messageAckPipeline');

// Phase 2a: pure helpers live under ./messages/*. Names are destructured here
// so all internal callers and module.exports stay byte-compatible.
const messagesHelpers = require('./messages');
const {
  MEDIA_TEMP_PUBLIC_PREFIX,
  buildMediaUrl,
  buildStandardNewMessageEnvelope,
  dedupeMessages,
  emitConversationSnapshotImmediate,
  emitInboxRealtimeEvent,
  emitInboxRealtimeEventFromStore,
  emitSocketEvent,
  ensureConversationForMessage,
  extensionFromMimeType,
  formatApiMessage,
  getRequestedSessionId,
  getStore,
  inferMediaType,
  isBase64MediaInput,
  loadMessagesForChat,
  normalizeChatId,
  normalizeMessagesForApi,
  persistIncomingMessageInMemory,
  persistOutgoingMessageRecord,
  registerIncomingMessage,
  registerOutgoingMessage,
  saveBase64MediaToTempFile,
  scheduleConversationRevalidation,
  shouldPersistExternalMessageId,
  sortMessagesAsc,
  toExactMessageText,
  toIsoTimestamp,
} = messagesHelpers;

const FAST_FALLBACK_TIMEOUT_MS = Math.max(Number(process.env.API_FALLBACK_TIMEOUT_MS) || 2500, 500);

async function runWithFastFallback(work, fallbackValue = null) {
  let timer = null;

  try {
    return await Promise.race([
      Promise.resolve()
        .then(work)
        .then((value) => ({
          degraded: false,
          fallback: 'none',
          value,
          warning: null,
        })),
      new Promise((resolve) => {
        timer = setTimeout(() => {
          resolve({
            degraded: true,
            fallback: 'timeout',
            value: fallbackValue,
            warning: 'Request exceeded the fast-path timeout. Returned memory fallback.',
          });
        }, FAST_FALLBACK_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    return {
      degraded: true,
      fallback: 'error',
      value: fallbackValue,
      warning: error?.message || String(error),
    };
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

// Phase 2a: getRequestedSessionId, normalizeChatId, toIsoTimestamp,
// buildStandardNewMessageEnvelope moved to controllers/messages/shared.js.

// Phase 2a: persistIncomingMessageInMemory moved to
//          controllers/messages/receive/persistMemory.js.

// Phase 2a: sortMessagesAsc, dedupeMessages, normalizeMessagesForApi
//          moved to controllers/messages/sync/collectionOps.js.

// Phase 2a: loadMessagesForChat moved to
//          controllers/messages/sync/loadMessagesForChat.js.

// Phase 2b-3: scheduleConversationRevalidation, emitConversationSnapshotImmediate,
//          emitInboxRealtimeEvent, emitInboxRealtimeEventFromStore
//          moved to controllers/messages/realtime/inboxEvents.js.

// Phase 2a: emitSocketEvent, toExactMessageText, formatApiMessage moved to
//          controllers/messages/shared.js.
// Phase 2a: inferMediaType, isBase64MediaInput, extensionFromMimeType,
//          saveBase64MediaToTempFile moved to controllers/messages/media/helpers.js.

// Phase 2b-3b: ensureConversationForMessage, persistOutgoingMessageRecord
//          moved to controllers/messages/send/persistOutgoing.js.
// Phase 2b-3b: registerIncomingMessage, registerOutgoingMessage
//          moved to controllers/messages/receive/register.js.

async function sendMessage(req, res) {
  const {
    _transportMediaPath,
    chatId,
    contactId,
    conversationId,
    fileName,
    mediaPath = null,
    mediaType = null,
    message,
    mimetype,
    phone,
    ptt = false,
    sessionId,
    sessionName,
    text,
  } = req.body;
  const store = getStore(req);
  let conversationTarget = null;
  if (conversationId) {
    try {
      conversationTarget = await conversationRepository.getConversationById(conversationId);
    } catch (lookupError) {
      console.warn('[SEND_MESSAGE] Failed to resolve conversation target:', lookupError.message);
    }
  }
  const targetJidOrPhone = conversationTarget?.remote_jid || conversationTarget?.remoteJid || chatId || phone;
  const normalizedPhone = whatsappService.normalizePhone(targetJidOrPhone);
  const mediaTransportPath = await messageService.resolveOutboundMediaPath(_transportMediaPath || mediaPath);
  const resolvedMediaType =
    String(mediaType || '').toLowerCase() === 'file'
      ? 'document'
      : (mediaType || inferMediaType(mediaTransportPath || mediaPath));
  const resolvedText = toExactMessageText(message || text || null) || null;
  const persistedMediaPath = messageService.toPublicMediaPath(mediaPath || mediaTransportPath);
  const requestedSessionId = getRequestedSessionId(req);
  const targetSessionName = sessionManager.normalizeSessionName(
    sessionName || sessionId || requestedSessionId || sessionManager.DEFAULT_SESSION
  );
  const existingSession = sessionManager.getSession(targetSessionName);

  const isSessionConnected = (s) => s && String(s.status || '').toLowerCase() === 'connected';

  let session = existingSession;
  if (!isSessionConnected(session)) {
    const defaultSession = await sessionManager.getDefaultSession();
    if (isSessionConnected(defaultSession)) {
      session = defaultSession;
    } else {
      const allSessions = sessionManager.listSessions();
      const connectedSessionInfo = allSessions.find(
        (s) => String(s.status || '').toLowerCase() === 'connected'
      );
      if (connectedSessionInfo) {
        session = sessionManager.getSession(connectedSessionInfo.sessionId);
      }
    }
  }

  if (!session) {
    session = existingSession || (await sessionManager.getDefaultSession());
  }

  const sock = session?.sock || store.sock;
  const normalizedSessionStatus = String(session?.status || 'disconnected').toLowerCase();

  if (!sessionManager.isRuntimeActive()) {
    return res.status(409).json({
      error: 'System is inactive. Activate it with POST /system/start.',
    });
  }

  if (!normalizedPhone || (!resolvedText && !mediaTransportPath && !mediaPath)) {
    return res.status(400).json({
      error: 'The field phone/chatId and at least one of text/message or mediaPath are required.',
    });
  }

  if (!sock) {
    return res.status(409).json({
      error: 'No active WhatsApp session is available.',
    });
  }

  if (!session || ['connected'].includes(normalizedSessionStatus) === false) {
    return res.status(409).json({
      error: `Session ${targetSessionName} is not connected (status: ${normalizedSessionStatus || 'unknown'}).`,
      sessionId: targetSessionName,
      status: normalizedSessionStatus || 'unknown',
      success: false,
    });
  }

  if (session.systemConnected === false) {
    return res.status(409).json({
      error: `Session ${targetSessionName} is disconnected from system processing.`,
      sessionId: targetSessionName,
      success: false,
    });
  }

  const ownSessionPhone = whatsappService.normalizePhone(session?.phone || session?.sock?.user?.id || '');
  if (ownSessionPhone && normalizedPhone === ownSessionPhone) {
    return res.status(422).json({
      code: 'WHATSAPP_SELF_SEND_BLOCKED',
      error: 'Destino igual ao numero conectado da sessao. Selecione o contato real antes de enviar.',
      phone: normalizedPhone,
      sessionId: session?.sessionId || targetSessionName,
      success: false,
    });
  }

  try {
    let sendResult;

    if (mediaTransportPath || mediaPath) {
      const checkedMediaTransportPath = await messageService.assertLocalMediaPathExists(
        mediaTransportPath || mediaPath
      );
      await messageService.ensureUploadDirectories();
      sendResult = await whatsappService.sendMediaMessage(
        sock,
        targetJidOrPhone,
        resolvedMediaType,
        checkedMediaTransportPath || mediaPath,
        {
        caption: resolvedText || '',
        fileName,
        mimetype,
        ptt,
        }
      );
    } else {
      sendResult = await whatsappService.sendMessage(sock, targetJidOrPhone, resolvedText);
    }

    if (!sendResult || !sendResult.key || !sendResult.key.id) {
      MessageAuditService.log('message_failed', {
        error: 'Message send failed: Baileys did not return a valid key ID',
        phone: normalizedPhone,
        text: resolvedText,
      });

      return res.status(500).json({
        error: 'Message send failed: Baileys confirmation missing.',
        success: false,
      });
    }

    if (!store.databaseEnabled) {
      // Persist to in-memory store when PostgreSQL is unavailable
      const memEntry = messageStore.addMessage(normalizedPhone, {
        content: resolvedText || '',
        createdAt: new Date().toISOString(),
        fromMe: true,
        mediaPath: persistedMediaPath || mediaTransportPath || mediaPath || null,
        mediaType: resolvedMediaType || null,
        sessionId: session?.sessionId || targetSessionName,
        conversationId: conversationId || `chat-${normalizedPhone}`,
        status: 'sent',
      });

      MessageAuditService.log('message_sent_memory', {
        phone: normalizedPhone,
        text: resolvedText,
      });

      if (sendResult?.key?.id && memEntry?.id) {
        messageAckPipeline.registerDbMapping(sendResult.key.id, memEntry.id);
        const ackEntry = messageAckPipeline.transitionAck(sendResult.key.id, messageAckPipeline.ACK_STATES.SENT, {
          chatId: normalizedPhone,
          sessionId: session?.sessionId || targetSessionName,
        });
        const io = store?.io || global.io || req.app?.get?.('io') || req.app?.locals?.io;
        if (io && ackEntry) {
          messageAckPipeline.emitAckUpdate(io, ackEntry);
        }
      }

      const inboxPayload = {
        conversationId: memEntry?.conversationId || `chat-${normalizedPhone}`,
        content: resolvedText || '',
        createdAt: memEntry?.createdAt || new Date().toISOString(),
        fromMe: true,
        id: memEntry?.id,
        mediaPath: messageService.toPublicMediaPath(memEntry?.mediaPath || persistedMediaPath || null),
        mediaType: memEntry?.mediaType || null,
        phone: normalizedPhone,
        status: 'sent',
      };

      if (!inboxPayload.id) {
        return res.status(500).json({
          error: 'Message persistence failed: missing id.',
          success: false,
        });
      }

      void aiIntelligenceService
        .captureMessageEvent(store, {
          conversationId: inboxPayload.conversationId,
          direction: 'outgoing',
          mediaType: inboxPayload.mediaType || null,
          messageId: inboxPayload.id,
          name: normalizedPhone,
          phone: normalizedPhone,
          source: 'human-fallback',
          text: resolvedText || '',
          timestamp: inboxPayload.createdAt,
        })
        .catch((error) => {
          console.error('[AI INTELLIGENCE] Failed to capture outbound memory fallback:', error.message || error);
        });

      return res.status(200).json({
        chatId: normalizeChatId(normalizedPhone),
        message: inboxPayload,
        success: true,
      });
    }

    const persistedResult = await registerOutgoingMessage(store, {
      companyId: req.body?.companyId,
      contactId,
      conversationId,
      mediaPath: persistedMediaPath || mediaPath,
      mediaType: resolvedMediaType,
      name: session?.phone || 'Unknown',
      phone: normalizedPhone,
      sessionId: session?.sessionId || targetSessionName,
      source: 'human',
      text: resolvedText,
      status: 'sent',
    });

    if (!persistedResult?.message) {
      MessageAuditService.log('message_failed', {
        error: 'Message persistence failed',
        phone: normalizedPhone,
        text: resolvedText,
      });

      return res.status(500).json({
        error: 'Message persistence failed',
        success: false,
      });
    }

    const apiMessage = formatApiMessage(persistedResult.message);

    if (!apiMessage?.id) {
      return res.status(500).json({
        error: 'Message persistence failed: missing id.',
        success: false,
      });
    }

    console.log('MESSAGE SAVED', apiMessage);

    if (sendResult?.key?.id && apiMessage?.id) {
      messageAckPipeline.registerDbMapping(sendResult.key.id, apiMessage.id);
      const ackEntry = messageAckPipeline.transitionAck(sendResult.key.id, messageAckPipeline.ACK_STATES.SENT, {
        chatId: normalizedPhone,
        sessionId: session?.sessionId || targetSessionName,
      });
      const io = store?.io || global.io || req.app?.get?.('io') || req.app?.locals?.io;
      if (io && ackEntry) {
        messageAckPipeline.emitAckUpdate(io, ackEntry);
      }
    }

    return res.status(200).json({
      chatId: normalizeChatId(normalizedPhone),
      message: apiMessage,
      success: true,
    });
  } catch (error) {
    const message = String(error?.message || '');

    const errMsg = message.toLowerCase();
    const isBlockedError = errMsg.includes('blocked') || errMsg.includes('forbidden') || errMsg.includes('recipient unavailable');
    if (isBlockedError && store.databaseEnabled) {
      try {
        const companyId = req.body?.companyId || req.companyId || req.tenantId || 'default';
        await dbQuery(
          'UPDATE leads SET is_blocked = TRUE WHERE phone = $1 AND company_id = $2',
          [normalizedPhone, companyId]
        );
        console.log(`[CRM] Contact ${normalizedPhone} marked as blocked due to error: ${message}`);
      } catch (dbErr) {
        console.error('[CRM] Failed to update blocked status for lead:', dbErr.message);
      }
    }

    if (error?.code === 'WHATSAPP_NUMBER_NOT_FOUND') {
      return res.status(422).json({
        error: error.message,
        code: error.code,
        jid: error.jid,
        success: false,
      });
    }

    if (error?.code === 'WHATSAPP_JID_VERIFY_FAILED') {
      return res.status(409).json({
        error: error.message,
        code: error.code,
        jid: error.jid,
        success: false,
      });
    }

    if (error?.code === 'MEDIA_FILE_NOT_FOUND') {
      return res.status(404).json({
        error: error.message,
        success: false,
      });
    }

    if (error?.code === 'MEDIA_PATH_FORBIDDEN') {
      return res.status(403).json({
        error: error.message,
        success: false,
      });
    }

    if (error?.code === 'SESSION_UNAVAILABLE' || /socket is not initialized|WhatsApp socket offline/i.test(message)) {
      return res.status(409).json({
        error: /WhatsApp socket offline/i.test(message) ? 'WhatsApp socket offline' : 'No active WhatsApp session is available.',
        success: false,
      });
    }

    if (/connection closed|connection closed unexpectedly|timed out|not connected/i.test(message)) {
      return res.status(409).json({
        error: 'WhatsApp session is disconnected. Reconnect and try again.',
        success: false,
      });
    }

    MessageAuditService.log('message_failed', {
      error: message || String(error),
      phone: normalizedPhone,
      text: resolvedText,
    });

    return res.status(500).json({
      error: error.message || 'Failed to send WhatsApp message.',
      success: false,
    });
  }
}

async function sendMedia(req, res) {
  const {
    caption = '',
    chatId,
    file,
    fileName,
    mediaPath,
    mimetype,
    phone,
    ptt = false,
    sessionId,
    sessionName,
    type,
  } = req.body || {};

  try {
    await messageService.ensureUploadDirectories();

    const base64Data = isBase64MediaInput(file) ? file : (isBase64MediaInput(mediaPath) ? mediaPath : null);
    const resolvedMediaPath = mediaPath || file || null;
    const resolvedMediaType =
      String(type || '').toLowerCase() === 'file'
        ? 'document'
        : (type || inferMediaType(resolvedMediaPath));

    if (!resolvedMediaPath || !resolvedMediaType) {
      return res.status(400).json({
        error: 'The fields file/mediaPath and type are required for media sending.',
        success: false,
      });
    }

    const tempFile = await saveBase64MediaToTempFile(base64Data || resolvedMediaPath, {
      mediaType: resolvedMediaType,
      mimetype,
    });
    const resolvedTransportPath = await messageService.resolveOutboundMediaPath(
      tempFile?.absolutePath || resolvedMediaPath
    );
    const persistedMediaPath =
      tempFile?.publicPath || messageService.toPublicMediaPath(resolvedTransportPath || resolvedMediaPath);
    const transportMediaPath = resolvedTransportPath || resolvedMediaPath;

    req.body = {
      ...req.body,
      chatId: chatId || phone,
      _transportMediaPath: transportMediaPath,
      fileName,
      mediaPath: persistedMediaPath,
      mediaType: resolvedMediaType,
      mimetype,
      ptt,
      sessionId,
      sessionName,
      text: caption,
    };

    const originalJson = res.json.bind(res);
    res.json = (payload) => {
      if (res.statusCode === 200 && payload?.message) {
        emitSocketEvent(req, 'media_sent', {
          caption,
          chatId: payload.message.phone || chatId || phone,
          conversationId: payload.message.conversationId,
          file: payload.message.mediaPath || persistedMediaPath,
          fileName: fileName || null,
          id: payload.message.id,
          mediaPath: payload.message.mediaPath || persistedMediaPath,
          mediaType: payload.message.mediaType || resolvedMediaType,
          message: payload.message.content,
          ptt,
          timestamp: payload.message.createdAt,
        });
      }

      return originalJson(payload);
    };

    return sendMessage(req, res);
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Failed to process media upload.',
      success: false,
    });
  }
}

async function receiveMessage(req, res) {
  const {
    mediaPath = null,
    mediaType = null,
    name,
    phone,
    sessionId,
    text,
  } = req.body;
  const store = getStore(req);
  const requestedSessionId = getRequestedSessionId(req);
  const resolvedIncomingMediaType = mediaType || inferMediaType(mediaPath || '');
  const resolvedIncomingMediaPath = messageService.toPublicMediaPath(
    await messageService.resolveOutboundMediaPath(mediaPath || '')
  ) || null;

  if (!phone || (!text && !resolvedIncomingMediaType && !resolvedIncomingMediaPath)) {
    return res.status(400).json({
      error: 'The field phone and at least one of text or mediaType are required.',
    });
  }

  let savedMessage;

  if (!store.databaseEnabled) {
    const inboxPayload = persistIncomingMessageInMemory(store, {
      mediaPath: resolvedIncomingMediaPath,
      mediaType: resolvedIncomingMediaType || null,
      name,
      phone,
      sessionId: sessionId || requestedSessionId || sessionManager.DEFAULT_SESSION,
      text,
    });

    emitInboxRealtimeEvent(req, inboxPayload);

    return res.status(200).json({
      fallback: 'memory',
      message: inboxPayload,
      success: true,
    });
  }

  // NOTE(bugfix#1): we intentionally do NOT use runWithFastFallback here.
  // A timeout-based race on a write path caused duplicate persistence:
  // the client received a "memory fallback" response, but the original
  // DB write kept running in the background and eventually committed a
  // second row (with a second unreadCount increment and socket event).
  // For at-most-once semantics, wait for the real work; fall back to
  // memory only on actual rejection.
  let persistedValue = null;
  let persistenceError = null;

  try {
    persistedValue = await registerIncomingMessage(store, {
      companyId: req.body?.companyId,
      externalMessageId: req.body?.id || null,
      mediaPath: resolvedIncomingMediaPath,
      mediaType: resolvedIncomingMediaType || null,
      name,
      phone,
      sessionId: sessionId || requestedSessionId || sessionManager.DEFAULT_SESSION,
      text,
    });
  } catch (error) {
    persistenceError = error;
  }

  if (!persistedValue) {
    const warning = persistenceError?.message || 'Falling back to memory persistence.';

    MessageAuditService.log('message_failed', {
      error: warning,
      fallback: true,
      phone,
      text,
    });

    const fallbackMessage = persistIncomingMessageInMemory(store, {
      mediaPath: resolvedIncomingMediaPath,
      mediaType: resolvedIncomingMediaType || null,
      name,
      phone,
      sessionId: sessionId || requestedSessionId || sessionManager.DEFAULT_SESSION,
      text,
    });

    emitInboxRealtimeEvent(req, fallbackMessage);

    return res.status(200).json({
      degraded: true,
      fallback: 'memory',
      message: fallbackMessage,
      success: true,
      warning,
    });
  }

  savedMessage = persistedValue;

  if (savedMessage?.duplicate === true) {
    return res.status(200).json({
      degraded: false,
      duplicate: true,
      fallback: 'none',
      message: null,
      success: true,
      warning: null,
    });
  }

  return res.status(200).json({
    message: (() => {
      const apiMessage = formatApiMessage(savedMessage?.message);
      emitInboxRealtimeEvent(req, apiMessage);
      return apiMessage;
    })(),
    degraded: false,
    fallback: 'none',
    success: true,
    warning: null,
  });
}

async function getMessagesByPhone(req, res) {
  const { phone } = req.params;
  const requestedSessionRaw = String(
    req?.headers?.['x-session-id'] || req?.query?.sessionId || req?.body?.sessionId || ''
  ).trim();
  const requestedSessionId = requestedSessionRaw
    ? sessionManager.normalizeSessionName(requestedSessionRaw)
    : null;
  const companyId = req.tenantId || req.companyId || req.query?.companyId || process.env.DEFAULT_COMPANY_ID || 'default';

  try {
    const filteredMessages = await messageRepository.getMessagesByPhone(
      phone,
      companyId,
      requestedSessionId
    );

    return res.status(200).json(filteredMessages);
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Failed to fetch messages.',
    });
  }
}

async function listMessages(req, res) {
  const store = getStore(req);
  const requestedSessionRaw = String(
    req?.headers?.['x-session-id'] || req?.query?.sessionId || req?.body?.sessionId || ''
  ).trim();
  const requestedSessionId = requestedSessionRaw
    ? sessionManager.normalizeSessionName(requestedSessionRaw)
    : null;
  const companyId = req.tenantId || req.companyId || req.query?.companyId || process.env.DEFAULT_COMPANY_ID || 'default';
  const chatId = String(req.query?.chatId || '').trim();
  const cursor = req.query?.cursor || null;
  const limit = Math.min(Math.max(Number(req.query?.limit) || 20, 1), 2000);

  if (chatId) {
    let sourceMessages = [];

    if (store?.databaseEnabled) {
      try {
        sourceMessages = await messageRepository.getMessagesByPhone(
          chatId,
          companyId,
          requestedSessionId
        );
      } catch (error) {
        console.error('[API] Failed to list paginated chat messages from DB:', error.message || error);
      }
    }

    if (!Array.isArray(sourceMessages) || sourceMessages.length === 0) {
      sourceMessages = (Array.isArray(store?.messages) ? store.messages : [])
        .filter((item) => {
          const phone = whatsappService.normalizePhone(item?.phone || '');
          const target = whatsappService.normalizePhone(chatId || '');
          return phone && target && phone === target;
        })
        .map((item) => formatApiMessage(item))
        .filter(Boolean);
    }

    const sortedDesc = [...sourceMessages].sort(
      (a, b) => new Date(b.createdAt || b.timestamp || 0) - new Date(a.createdAt || a.timestamp || 0)
    );

    const startIndex = cursor
      ? Math.max(
          0,
          sortedDesc.findIndex((entry) => String(entry.id) === String(cursor)) + 1
        )
      : 0;

    const page = sortedDesc.slice(startIndex, startIndex + limit);
    const nextCursor =
      startIndex + limit < sortedDesc.length && page.length > 0
        ? page[page.length - 1].id
        : null;

    return res.status(200).json({
      messages: page.reverse(),
      nextCursor,
    });
  }

  if (store?.databaseEnabled) {
    try {
      const messages = await messageRepository.listRecentMessages(limit, companyId);
      if (!requestedSessionId) {
        return res.status(200).json(messages);
      }

      const filteredBySession = messages.filter(
        (item) => String(item.sessionId || sessionManager.DEFAULT_SESSION) === requestedSessionId
      );

      return res.status(200).json(filteredBySession);
    } catch (error) {
      console.error('[API] Failed to list recent messages from DB:', error.message || error);
    }
  }

  const fallbackMessages = Array.isArray(store?.messages)
    ? store.messages
        .filter((item) => (
          requestedSessionId
            ? String(item.sessionId || sessionManager.DEFAULT_SESSION) === requestedSessionId
            : true
        ))
        .slice(-limit)
        .map((item) => formatApiMessage(item))
        .filter(Boolean)
    : [];

  return res.status(200).json(fallbackMessages);
}

async function getMessagesByConversationId(req, res) {
  const { conversationId } = req.params;
  const store = getStore(req);
  const limit = Math.max(1, Math.min(Number(req.query?.limit) || 50, 200));
  const before = typeof req.query?.before === 'string' ? req.query.before : undefined;

  try {
    if (store?.databaseEnabled) {
      const messages = await messageRepository.getMessagesByConversation(conversationId, { limit, before });
      const sortedMessages = normalizeMessagesForApi(messages);

      return res.status(200).json(Array.isArray(sortedMessages) ? sortedMessages : []);
    }

    const memoryList = Array.isArray(store?.messages)
      ? store.messages
          .filter((entry) => String(entry?.conversationId || '') === String(conversationId || ''))
          .filter((entry) => {
            if (!before) return true;
            const timestamp = new Date(String(entry?.createdAt || entry?.timestamp || ''));
            return !Number.isNaN(timestamp.getTime()) && timestamp.getTime() < new Date(before).getTime();
          })
          .sort((a, b) => new Date(String(b?.createdAt || b?.timestamp || '')).getTime() - new Date(String(a?.createdAt || a?.timestamp || '')).getTime())
          .slice(0, limit)
          .map((entry) => formatApiMessage(entry))
          .filter(Boolean)
          .reverse()
      : [];

    return res.status(200).json(normalizeMessagesForApi(memoryList));
  } catch (error) {
    const safeFallback = Array.isArray(store?.messages)
      ? store.messages
          .filter((entry) => String(entry?.conversationId || '') === String(conversationId || ''))
          .map((entry) => formatApiMessage(entry))
          .filter(Boolean)
      : [];

    return res.status(200).json(normalizeMessagesForApi(safeFallback));
  }
}

async function createMessage(req, res) {
  const {
    body,
    companyId,
    conversationId,
    direction,
    from,
    mediaPath = null,
    mediaType = null,
    name,
    phone,
    sessionId,
    timestamp,
  } = req.body || {};
  const store = getStore(req);
  const requestedSessionId = getRequestedSessionId(req);
  const normalizedPhone = whatsappService.normalizePhone(phone || from);
  const resolvedText = body || req.body?.text || '';

  if (!normalizedPhone || (!resolvedText && !mediaType)) {
    return res.status(400).json({
      error: 'The field phone and at least one of body/text or mediaType are required.',
    });
  }

  if (!store.databaseEnabled) {
    const fallbackConversationId = String(conversationId || `chat-${normalizedPhone}`);
    const fallbackMessage = {
      id: randomUUID(),
      conversationId: fallbackConversationId,
      content: String(resolvedText || ''),
      createdAt: Date.now(),
      fromMe: direction === 'outbound',
      mediaPath,
      mediaType,
      phone: normalizedPhone,
      sessionId: sessionId || requestedSessionId || sessionManager.DEFAULT_SESSION,
      status: direction === 'outbound' ? 'sent' : 'received',
      timestamp: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
      type: mediaType || 'text',
      url: buildMediaUrl(mediaPath || '') || null,
    };

    if (!Array.isArray(store.messages)) {
      store.messages = [];
    }

    store.messages.push(fallbackMessage);

    return res.status(200).json({
      message: formatApiMessage(fallbackMessage),
      success: true,
    });
  }

  try {
    let result;

    if (direction === 'outbound') {
      result = await registerOutgoingMessage(store, {
        companyId,
        contactId: req.body?.contactId,
        conversationId,
        mediaPath,
        mediaType,
        name: name || normalizedPhone,
        phone: normalizedPhone,
        sessionId: sessionId || requestedSessionId || sessionManager.DEFAULT_SESSION,
        source: req.body?.source || 'human',
        text: resolvedText,
      });
    } else {
      result = await registerIncomingMessage(store, {
        companyId,
        conversationId,
        externalMessageId: req.body?.id || null,
        mediaPath,
        mediaType,
        name: name || normalizedPhone,
        phone: normalizedPhone,
        sessionId: sessionId || requestedSessionId || sessionManager.DEFAULT_SESSION,
        text: resolvedText,
        timestamp: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
      });
    }

    const apiMessage = formatApiMessage(result?.message);

    if (!apiMessage) {
      return res.status(500).json({
        error: 'Failed to persist message.',
      });
    }

    emitInboxRealtimeEvent(req, apiMessage);

    return res.status(200).json({
      message: apiMessage,
      success: true,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Failed to persist message.',
      success: false,
    });
  }
}

/**
 * GET /chats
 * Returns the list of recent chat contacts from the in-memory store (falls back to conversations DB).
 */
async function getChats(req, res) {
  const store = getStore(req);
  const requestedSessionId = getRequestedSessionId(req);

  // Try DB first when enabled
  if (store?.databaseEnabled) {
    try {
      const dbConversations = await conversationRepository.listConversations(
        req.query?.companyId || process.env.DEFAULT_COMPANY_ID || 'default',
        Number(req.query?.limit) || 50,
        {
          sessionId: requestedSessionId,
        }
      );

      if (Array.isArray(dbConversations) && dbConversations.length > 0) {
        return res.status(200).json(dbConversations);
      }
    } catch (_err) {
      // fall through to memory store
    }
  }

  // Return from in-memory store
  const memChats = messageStore
    .getChats()
    .filter((chat) => String(chat.sessionId || sessionManager.DEFAULT_SESSION) === requestedSessionId);
  const normalized = memChats.map((chat) => ({
    id: chat.id,
    contactName: chat.name,
    lastMessage: chat.lastMessage,
    lastMessageType: 'text',
    phone: chat.phone,
    sessionId: chat.sessionId,
    status: 'open',
    tags: [],
    unread: chat.unread || 0,
    updatedAt: chat.lastMessageTimestamp || new Date().toISOString(),
  }));

  return res.status(200).json(normalized);
}

/**
 * GET /chats/:chatId/messages
 * Returns messages for a chatId (phone) from in-memory store (with DB fallback).
 */
async function getMessagesByChatId(req, res) {
  const { chatId } = req.params;
  const store = getStore(req);
  const requestedSessionId = getRequestedSessionId(req);
  const companyId = req.tenantId || req.companyId || req.query?.companyId || process.env.DEFAULT_COMPANY_ID || 'default';

  try {
    const messages = await loadMessagesForChat({
      chatId,
      companyId,
      sessionId: requestedSessionId,
      store,
    });

    return res.status(200).json(messages);
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Failed to fetch chat messages.',
    });
  }
}

async function deleteMessage(req, res) {
  const { messageId } = req.params;
  const store = getStore(req);

  try {
    const existing = store?.databaseEnabled
      ? await messageRepository.findById(messageId)
      : Array.isArray(store?.messages)
        ? store.messages.find((entry) => String(entry?.id) === String(messageId))
        : null;

    if (!existing) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    if (store?.databaseEnabled) {
      await messageRepository.deleteById(messageId);
    } else if (Array.isArray(store?.messages)) {
      store.messages = store.messages.filter((entry) => String(entry?.id) !== String(messageId));
    }

    emitSocketEvent(req, 'message_deleted', {
      messageId: String(messageId),
      conversationId: existing.conversationId || existing.chatId || null,
    });

    return res.status(200).json({ success: true, messageId: String(messageId) });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to delete message.' });
  }
}

async function forwardMessage(req, res) {
  const { messageId } = req.params;
  const { phone, conversationId, sessionId } = req.body || {};
  const store = getStore(req);

  if (!phone) {
    return res.status(400).json({ error: 'The field phone is required.' });
  }

  try {
    const existing = store?.databaseEnabled
      ? await messageRepository.findById(messageId)
      : Array.isArray(store?.messages)
        ? store.messages.find((entry) => String(entry?.id) === String(messageId))
        : null;

    if (!existing) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    req.body = {
      chatId: phone,
      phone,
      text: existing.content || existing.text || '',
      mediaPath: existing.mediaPath || null,
      mediaType: existing.mediaType || null,
      conversationId: conversationId || undefined,
      sessionId: sessionId || existing.sessionId || undefined,
      message: existing.content || existing.text || '',
    };

    return existing.mediaType ? sendMedia(req, res) : sendMessage(req, res);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to forward message.' });
  }
}

async function listStickers(req, res) {
  const store = getStore(req);
  try {
    const enterpriseMediaService = require('../services/enterprise/media-service');
    const tenantId = enterpriseMediaService.normalizeTenantId(req.query.tenantId || req.companyId || 'default');
    
    // Path: storage/media/<tenantId>/stickers
    const PROJECT_ROOT = path.join(__dirname, '..');
    const MEDIA_ROOT = path.resolve(PROJECT_ROOT, '..', 'storage', 'media');
    const stickersDir = path.join(MEDIA_ROOT, tenantId, 'stickers');
    
    const urls = new Set();
    const { existsSync } = require('fs');
    
    // 1. Read from local directory if it exists
    if (existsSync(stickersDir)) {
      const files = await fs.readdir(stickersDir);
      for (const file of files) {
        if (file.endsWith('.webp')) {
          urls.add(`/media/${tenantId}/stickers/${file}`);
        }
      }
    }
    
    // 2. Query from database if enabled
    if (store.databaseEnabled) {
      const dbResult = await dbQuery(
        `SELECT DISTINCT media_path FROM messages WHERE message_type = 'sticker' AND media_path IS NOT NULL AND company_id = $1`,
        [tenantId]
      );
      for (const row of dbResult.rows) {
        if (row.media_path) {
          urls.add(row.media_path);
        }
      }
    }
    
    const stickers = Array.from(urls).map(url => {
      const parts = url.split('/');
      const id = parts[parts.length - 1];
      return {
        id,
        url,
        name: id
      };
    });
    
    return res.status(200).json({ stickers, success: true });
  } catch (error) {
    console.error('[STICKERS] Failed to list stickers:', error);
    return res.status(500).json({ error: error.message || 'Failed to list stickers', success: false });
  }
}

module.exports = {
  createMessage,
  deleteMessage,
  extractIncomingMessage: whatsappService.extractIncomingMessage,
  forwardMessage,
  getChats,
  getMessagesByChatId,
  getMessagesByConversationId,
  getMessagesByPhone,
  listMessages,
  receiveMessage,
  registerIncomingMessage,
  registerOutgoingMessage,
  sendMedia,
  sendMessage,
  listStickers,
};
