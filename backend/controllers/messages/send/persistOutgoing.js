/**
 * Persist an outbound message (DB + in-memory store updates).
 * Extracted from controllers/messagesController.js (Phase 2b-3b).
 */

const sessionManager = require('../../../services/sessionManager');
const conversationRepository = require('../../../repositories/conversationRepository');
const messageRepository = require('../../../repositories/messageRepository');
const { toExactMessageText } = require('../shared');

async function ensureConversationForMessage({ companyId, mediaType, name, phone, sessionId, text }) {
  return conversationRepository.findOrCreateConversationByPhone({
    companyId: companyId || process.env.DEFAULT_COMPANY_ID || 'default',
    contactName: name || phone,
    lastMessage: text || '',
    lastMessageType: mediaType || 'text',
    phone,
    sessionId,
  });
}

async function persistOutgoingMessageRecord(store, payload) {
  const conversation = await ensureConversationForMessage(payload);
  const exactText = toExactMessageText(payload.text);
  const messagePreview = exactText || `[${payload.mediaType || 'text'}]`;
  const savedMessage = await messageRepository.create({
    content: exactText || messagePreview,
    conversationId: conversation.id,
    createdAt: new Date().toISOString(),
    fromMe: true,
    mediaPath: payload.mediaPath || null,
    messageType: payload.mediaType || 'text',
    phone: payload.phone,
    sessionId: payload.sessionId || sessionManager.DEFAULT_SESSION,
    status: 'sent',
  });

  if (!savedMessage) {
    return null;
  }

  const updatedConversation = await conversationRepository.updateConversationState(
    conversation.id,
    {
      lastMessage: messagePreview,
      lastMessageType: payload.mediaType || 'text',
      status: 'open',
      unreadCount: 0,
      updatedAt: new Date().toISOString(),
    }
  );

  if (store?.messages) {
    store.messages.push(savedMessage);
  }

  if (store?.conversations && updatedConversation) {
    const existingIndex = store.conversations.findIndex(
      (item) => item.id === updatedConversation.id
    );

    if (existingIndex >= 0) {
      store.conversations[existingIndex] = updatedConversation;
    } else {
      store.conversations.push(updatedConversation);
    }
  }

  return {
    conversation: updatedConversation || conversation,
    message: savedMessage,
  };
}

module.exports = {
  ensureConversationForMessage,
  persistOutgoingMessageRecord,
};
