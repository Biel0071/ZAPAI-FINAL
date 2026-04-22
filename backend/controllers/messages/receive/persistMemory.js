/**
 * Persist an inbound message into the in-memory store (DB fallback).
 * Extracted from controllers/messagesController.js (Phase 2a).
 *
 * Module-pure: only depends on other modules, never on module-scoped
 * mutable state. Side effects (store mutation, audit log, AI capture) are
 * all driven by the passed-in `store`.
 */

const sessionManager = require('../../../services/sessionManager');
const whatsappService = require('../../../services/whatsappService');
const messageStore = require('../../../store/messageStore');
const MessageAuditService = require('../../../services/messageAuditService');
const aiIntelligenceService = require('../../../services/aiIntelligenceService');

function persistIncomingMessageInMemory(store, payload = {}) {
  const normalizedPhone = whatsappService.normalizePhone(payload.phone || '');
  const normalizedSessionId = payload.sessionId || sessionManager.DEFAULT_SESSION;
  const memEntry = messageStore.addMessage(normalizedPhone, {
    content: payload.text || '',
    createdAt: new Date().toISOString(),
    fromMe: false,
    mediaPath: payload.mediaPath || null,
    mediaType: payload.mediaType || null,
    name: payload.name || normalizedPhone,
    sessionId: normalizedSessionId,
    conversationId: `chat-${normalizedPhone}`,
    status: 'received',
  });

  MessageAuditService.log('message_received_memory', {
    fallback: true,
    phone: normalizedPhone,
    text: payload.text || '',
  });

  void aiIntelligenceService
    .captureMessageEvent(store, {
      conversationId: memEntry?.conversationId || `chat-${normalizedPhone}`,
      direction: 'incoming',
      mediaType: payload.mediaType || null,
      messageId: memEntry?.id,
      name: payload.name || normalizedPhone,
      phone: normalizedPhone,
      source: 'http-fallback',
      text: payload.text || '',
      timestamp: memEntry?.createdAt || new Date().toISOString(),
    })
    .catch((error) => {
      console.error(
        '[AI INTELLIGENCE] Failed to capture inbound memory fallback:',
        error?.message || error
      );
    });

  return {
    content: payload.text || '',
    conversationId: memEntry?.conversationId || `chat-${normalizedPhone}`,
    createdAt: memEntry?.createdAt || new Date().toISOString(),
    fromMe: false,
    id: memEntry?.id,
    mediaPath: payload.mediaPath || null,
    mediaType: payload.mediaType || null,
    phone: normalizedPhone,
    status: 'received',
  };
}

module.exports = {
  persistIncomingMessageInMemory,
};
