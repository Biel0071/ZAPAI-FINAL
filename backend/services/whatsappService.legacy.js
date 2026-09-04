/**
 * Legacy WhatsApp service facade.
 *
 * After the Phase 2a/2b/2c refactor this file is a thin re-exporter. All
 * business logic, listeners, lifecycle management, persistence and realtime
 * emitters live under `services/whatsapp/*`. The public surface below is
 * preserved byte-compatible so existing callers (routes, controllers,
 * bootstrap code) keep working without changes.
 *
 * Shared mutable state (`activeSessions`, `chats`) is imported by reference
 * from `services/whatsapp/state/registry` — mutations flow both ways.
 *
 * Tenant-indexed connection state replaces the old `global.whatsappSession`
 * read/writes; initialisation is handled by `sessionStateService` require
 * side-effects.
 */

require('./sessionStateService').getWhatsappSession();

const { activeSessions, chats } = require('./whatsapp/state/registry');
const whatsappModule = require('./whatsapp');
const {
  DEFAULT_SESSION,
  addTag,
  archiveChat,
  buildRealtimeMessagePayload,
  createStableSession,
  ensureWhatsAppJid,
  extractMessageText,
  extractIncomingMessage,
  getChatConfig,
  getMessageTimestamp,
  normalizePhone,
  normalizeSessionName,
  persistConversationMessage,
  removeTag,
  saveMessage,
  sendAudio,
  sendDocument,
  sendImage,
  sendMediaMessage,
  sendMessage,
  sendVideo,
  toggleAI,
} = whatsappModule;

module.exports = {
  DEFAULT_SESSION,
  addTag,
  archiveChat,
  buildRealtimeMessagePayload,
  chats,
  createStableSession,
  ensureWhatsAppJid,
  extractMessageText,
  extractIncomingMessage,
  getChatConfig,
  getMessageTimestamp,
  normalizePhone,
  normalizeSessionName,
  persistConversationMessage,
  removeTag,
  saveMessage,
  sendAudio,
  sendDocument,
  sendImage,
  sendMediaMessage,
  sendMessage,
  sendVideo,
  toggleAI,
};
