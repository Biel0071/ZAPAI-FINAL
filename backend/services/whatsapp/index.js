/**
 * WhatsApp domain — public barrel.
 *
 * Phase 2a of the refactor: pure helpers have been extracted from
 * `whatsappService.legacy.js` into small modules under `services/whatsapp/`.
 * The legacy file continues to host the stateful Baileys lifecycle (session
 * manager, listeners, outbound senders that depend on connection state) and
 * re-exports the names it used to own, so all existing callers keep working.
 *
 * New code is encouraged to require the specific sub-module it needs:
 *
 *   const { normalizePhone } = require('./whatsapp/shared/identifiers');
 *   const { buildMediaUrl } = require('./whatsapp/media/url');
 *
 * rather than reaching into the legacy file.
 */

const identifiers = require('./shared/identifiers');
const time = require('./shared/time');
const serialization = require('./shared/serialization');
const mediaUrl = require('./media/url');
const mediaPayload = require('./media/payload');
const inboundParser = require('./inbound/parser');
const inboundDebug = require('./inbound/debug');
const inboundPipeline = require('./inbound/pipeline');
const realtimePayloads = require('./realtime/payloads');
const realtimeChatState = require('./realtime/chatState');
const realtimeEvents = require('./realtime/events');
const connectionReconnect = require('./connection/reconnect');
const connectionQr = require('./connection/qr');
const connectionSock = require('./connection/sock');
const connectionPersistence = require('./connection/persistence');
const connectionLogger = require('./connection/logger');
const connectionStableSession = require('./connection/stableSession');
const outboundSenders = require('./outbound/senders');
const persistenceConversation = require('./persistence/conversation');
const realtimeMetrics = require('./realtime/metrics');
const chatOperations = require('./chat/operations');
const stateRegistry = require('./state/registry');

module.exports = {
  shared: {
    identifiers,
    time,
    serialization,
  },
  media: {
    url: mediaUrl,
    payload: mediaPayload,
  },
  inbound: {
    parser: inboundParser,
    debug: inboundDebug,
    pipeline: inboundPipeline,
  },
  realtime: {
    payloads: realtimePayloads,
    chatState: realtimeChatState,
    events: realtimeEvents,
    metrics: realtimeMetrics,
  },
  chat: {
    operations: chatOperations,
  },
  state: {
    registry: stateRegistry,
  },
  connection: {
    reconnect: connectionReconnect,
    qr: connectionQr,
    sock: connectionSock,
    persistence: connectionPersistence,
    logger: connectionLogger,
    stableSession: connectionStableSession,
  },
  outbound: {
    senders: outboundSenders,
  },
  persistence: {
    conversation: persistenceConversation,
  },
  // Flat re-exports of the most commonly used symbols, to make
  // drop-in migration from whatsappService.legacy easier.
  DEFAULT_SESSION: identifiers.DEFAULT_SESSION,
  CHAT_HISTORY_WINDOW_MS: realtimeChatState.CHAT_HISTORY_WINDOW_MS,
  MAX_CHAT_HISTORY_MESSAGES: realtimeChatState.MAX_CHAT_HISTORY_MESSAGES,
  activeSessions: stateRegistry.activeSessions,
  addMessageToRealtimeStore: connectionStableSession.addMessageToRealtimeStore,
  addTag: chatOperations.addTag,
  archiveChat: chatOperations.archiveChat,
  buildInboundDebugPayload: inboundDebug.buildInboundDebugPayload,
  buildMediaUrl: mediaUrl.buildMediaUrl,
  buildRealtimeDeduplicationKey: inboundPipeline.buildRealtimeDeduplicationKey,
  buildRealtimeIncomingMessage: realtimeChatState.buildRealtimeIncomingMessage,
  buildRealtimeMediaPayload: realtimePayloads.buildRealtimeMediaPayload,
  buildRealtimeMessagePayload: realtimePayloads.buildRealtimeMessagePayload,
  buildStandardNewMessageEnvelope: realtimePayloads.buildStandardNewMessageEnvelope,
  buildMediaEventPayload: connectionStableSession.buildMediaEventPayload,
  createRealtimeChatState: realtimeChatState.createRealtimeChatState,
  createStableSession: connectionStableSession.createStableSession,
  emitChatsLoaded: realtimeEvents.emitChatsLoaded,
  emitChatUpdated: realtimeEvents.emitChatUpdated,
  emitConnectionUpdate: realtimeEvents.emitConnectionUpdate,
  emitInboundRealtimeMessage: realtimeEvents.emitInboundRealtimeMessage,
  emitMessageUpdates: realtimeEvents.emitMessageUpdates,
  emitRealtimeEvent: realtimeEvents.emitRealtimeEvent,
  emitRealtimeMetrics: realtimeMetrics.emitRealtimeMetrics,
  emitSessionStatus: realtimeEvents.emitSessionStatus,
  ensureEnterpriseQueues: connectionStableSession.ensureEnterpriseQueues,
  ensureRealtimeStore: realtimeChatState.ensureRealtimeStore,
  ensureSessionPath: connectionStableSession.ensureSessionPath,
  ensureSessionsDirectory: connectionStableSession.ensureSessionsDirectory,
  ensureSocket: outboundSenders.ensureSocket,
  ensureWhatsAppJid: identifiers.ensureWhatsAppJid,
  downloadMedia: inboundPipeline.downloadMedia,
  extensionFromMimeType: mediaUrl.extensionFromMimeType,
  extractIncomingMessage: inboundPipeline.extractIncomingMessage,
  extractMessageText: inboundParser.extractMessageText,
  findOrCreateContact: persistenceConversation.findOrCreateContact,
  findSessionForChat: chatOperations.findSessionForChat,
  formatInboundSavedMessage: inboundPipeline.formatInboundSavedMessage,
  findOrCreateConversation: persistenceConversation.findOrCreateConversation,
  getChatConfig: chatOperations.getChatConfig,
  getCompanyId: identifiers.getCompanyId,
  getConnectionCloseCode: connectionReconnect.getConnectionCloseCode,
  getConversationPreview: persistenceConversation.getConversationPreview,
  getDocumentFileName: mediaPayload.getDocumentFileName,
  getOrCreateChat: chatOperations.getOrCreateChat,
  getMediaDescriptor: inboundParser.getMediaDescriptor,
  getMediaUrlPayload: mediaPayload.getMediaUrlPayload,
  getMessagePreview: realtimeChatState.getMessagePreview,
  getMessageTimestamp: time.getMessageTimestamp,
  getRecentChatHistory: realtimeChatState.getRecentChatHistory,
  hasActiveConnection: realtimeMetrics.hasActiveConnection,
  isLikelyBase64Payload: serialization.isLikelyBase64Payload,
  loadRealtimeHistory: connectionStableSession.loadRealtimeHistory,
  isMessageConfirmed: realtimeChatState.isMessageConfirmed,
  isToday: time.isToday,
  isValidRealtimeChatId: realtimeChatState.isValidRealtimeChatId,
  logSessionEvent: connectionLogger.logSessionEvent,
  maybeGenerateAiSummary: persistenceConversation.maybeGenerateAiSummary,
  normalizeContactKey: realtimeChatState.normalizeContactKey,
  normalizeInboundPhone: inboundDebug.normalizeInboundPhone,
  normalizePhone: identifiers.normalizePhone,
  normalizeRealtimeMediaType: mediaUrl.normalizeRealtimeMediaType,
  normalizeSessionName: identifiers.normalizeSessionName,
  normalizeUtf8Text: serialization.normalizeUtf8Text,
  persistConversationMessage: persistenceConversation.persistConversationMessage,
  persistInboundMessageFallback: inboundPipeline.persistInboundMessageFallback,
  persistRealtimeMessage: inboundPipeline.persistRealtimeMessage,
  pruneChatMessages: realtimeChatState.pruneChatMessages,
  pushConnectionLog: connectionLogger.pushConnectionLog,
  removeTag: chatOperations.removeTag,
  resolveContactForChat: realtimeChatState.resolveContactForChat,
  safeCreateSessionRecord: connectionPersistence.safeCreateSessionRecord,
  safeSerializeInboundMessage: serialization.safeSerializeInboundMessage,
  safeUpdateSessionStatus: connectionPersistence.safeUpdateSessionStatus,
  saveMessage: chatOperations.saveMessage,
  sendAudio: outboundSenders.sendAudio,
  sendDocument: outboundSenders.sendDocument,
  sendImage: outboundSenders.sendImage,
  sendMediaMessage: outboundSenders.sendMediaMessage,
  sendMessage: outboundSenders.sendMessage,
  sendVideo: outboundSenders.sendVideo,
  sendWithRetry: outboundSenders.sendWithRetry,
  sessionPhoneFromSock: connectionSock.sessionPhoneFromSock,
  shouldEmitMetricsForMessage: realtimeMetrics.shouldEmitMetricsForMessage,
  shouldProcessGlobalMessageId: inboundPipeline.shouldProcessGlobalMessageId,
  shouldProcessRealtimeMessage: inboundPipeline.shouldProcessRealtimeMessage,
  syncConversationCache: persistenceConversation.syncConversationCache,
  syncMessageCache: persistenceConversation.syncMessageCache,
  shouldReconnect: connectionReconnect.shouldReconnect,
  shouldRefreshSummary: connectionStableSession.shouldRefreshSummary,
  runAIForChat: connectionStableSession.runAIForChat,
  toMediaPayload: mediaPayload.toMediaPayload,
  toQrDataUrl: connectionQr.toQrDataUrl,
  toRealtimeTimestamp: time.toRealtimeTimestamp,
  toUnixMillis: time.toUnixMillis,
  toggleAI: chatOperations.toggleAI,
  unwrapMessageContent: inboundParser.unwrapMessageContent,
};
