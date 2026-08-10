/**
 * Message controller — public barrel.
 *
 * Phase 2a: pure helpers for the message controller live under
 * controllers/messages/*. The HTTP handlers (sendMessage, receiveMessage,
 * listMessages, etc.) still live in ../messagesController.js and will be
 * extracted in Phase 2b. This barrel re-exports the helpers so new code can
 * consume a single import.
 */

const shared = require('./shared');
const mediaHelpers = require('./media/helpers');
const collectionOps = require('./sync/collectionOps');
const loadMessagesForChatModule = require('./sync/loadMessagesForChat');
const receiveDedupe = require('./receive/dedupe');
const receivePersistMemory = require('./receive/persistMemory');
const receiveRegister = require('./receive/register');
const sendPersistOutgoing = require('./send/persistOutgoing');
const realtimeInboxEvents = require('./realtime/inboxEvents');

module.exports = {
  shared,
  media: mediaHelpers,
  sync: {
    collectionOps,
    loadMessagesForChat: loadMessagesForChatModule,
  },
  receive: {
    dedupe: receiveDedupe,
    persistMemory: receivePersistMemory,
    register: receiveRegister,
  },
  send: {
    persistOutgoing: sendPersistOutgoing,
  },
  realtime: {
    inboxEvents: realtimeInboxEvents,
  },
  // Flat re-exports for convenience.
  buildMediaUrl: shared.buildMediaUrl,
  buildStandardNewMessageEnvelope: shared.buildStandardNewMessageEnvelope,
  dedupeMessages: collectionOps.dedupeMessages,
  emitConversationSnapshotImmediate: realtimeInboxEvents.emitConversationSnapshotImmediate,
  emitInboxRealtimeEvent: realtimeInboxEvents.emitInboxRealtimeEvent,
  emitInboxRealtimeEventFromStore: realtimeInboxEvents.emitInboxRealtimeEventFromStore,
  emitSocketEvent: shared.emitSocketEvent,
  ensureConversationForMessage: sendPersistOutgoing.ensureConversationForMessage,
  extensionFromMimeType: mediaHelpers.extensionFromMimeType,
  formatApiMessage: shared.formatApiMessage,
  getRequestedSessionId: shared.getRequestedSessionId,
  getStore: shared.getStore,
  inferMediaType: mediaHelpers.inferMediaType,
  isBase64MediaInput: mediaHelpers.isBase64MediaInput,
  loadMessagesForChat: loadMessagesForChatModule.loadMessagesForChat,
  MEDIA_TEMP_PUBLIC_PREFIX: mediaHelpers.MEDIA_TEMP_PUBLIC_PREFIX,
  normalizeChatId: shared.normalizeChatId,
  normalizeMessagesForApi: collectionOps.normalizeMessagesForApi,
  persistIncomingMessageInMemory: receivePersistMemory.persistIncomingMessageInMemory,
  persistOutgoingMessageRecord: sendPersistOutgoing.persistOutgoingMessageRecord,
  registerIncomingMessage: receiveRegister.registerIncomingMessage,
  registerOutgoingMessage: receiveRegister.registerOutgoingMessage,
  saveBase64MediaToTempFile: mediaHelpers.saveBase64MediaToTempFile,
  scheduleConversationRevalidation: realtimeInboxEvents.scheduleConversationRevalidation,
  shouldPersistExternalMessageId: receiveDedupe.shouldPersistExternalMessageId,
  sortMessagesAsc: collectionOps.sortMessagesAsc,
  toExactMessageText: shared.toExactMessageText,
  toIsoTimestamp: shared.toIsoTimestamp,
};
