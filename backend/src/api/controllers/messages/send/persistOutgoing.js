/**
 * Persist an outbound message (DB + in-memory store updates).
 * Extracted from controllers/messagesController.js (Phase 2b-3b).
 */

const sessionManager = require('../../../../../services/sessionManager');
const conversationRepository = require('../../../../data/repositories/conversationRepository');
const messageRepository = require('../../../../data/repositories/messageRepository');
const { toExactMessageText } = require('../shared');

function getMessagePreviewLabel(mediaType) {
  switch (String(mediaType || '').toLowerCase()) {
    case 'image':
      return 'Imagem';
    case 'video':
      return 'Vídeo';
    case 'audio':
      return 'Áudio';
    case 'document':
    case 'file':
      return 'Documento';
    case 'sticker':
      return 'Sticker';
    default:
      return 'Mídia';
  }
}

async function ensureConversationForMessage({ companyId, contactId, conversationId, mediaType, name, phone, sessionId, text }) {
  const rawJid = phone || '';
  const rawLid = rawJid.includes('@lid') ? rawJid : '';
  const { normalizePhone } = require('../../../../../services/whatsapp/shared/identifiers');
  const normalizedPhone = normalizePhone(phone);
  console.log(`[CONVERSATION-UPSERT-KEY] OUTBOUND Message - Raw JID: "${rawJid}", Raw LID: "${rawLid}", Normalized Canonical Phone Key: "${normalizedPhone}"`);

  if (conversationId) {
    const existingConversation = await conversationRepository.getConversationById(conversationId);
    if (existingConversation) {
      return existingConversation;
    }
  }

  if (contactId) {
    const numericContactId = Number(contactId);
    if (Number.isSafeInteger(numericContactId) && numericContactId <= 2147483647) {
      try {
        const existingConversation = await conversationRepository.getConversationByContact(contactId, companyId, sessionId);
        if (existingConversation) {
          return existingConversation;
        }
      } catch (err) {
        console.warn(`[CONVERSATION-UPSERT] Failed to lookup conversation by contactId ${contactId}:`, err.message);
      }
    }
  }

  return conversationRepository.findOrCreateConversationByPhone({
    companyId: companyId || process.env.DEFAULT_COMPANY_ID || 'default',
    contactName: name || normalizedPhone,
    lastMessage: text || '',
    lastMessageType: mediaType || 'text',
    phone: normalizedPhone,
    sessionId,
  });
}

async function persistOutgoingMessageRecord(store, payload) {
  const conversation = await ensureConversationForMessage(payload);
  const exactText = toExactMessageText(payload.text);
  const messagePreview = exactText || getMessagePreviewLabel(payload.mediaType);
  const savedMessage = await messageRepository.create({
    content: exactText || '',
    conversationId: conversation.id,
    createdAt: new Date().toISOString(),
    fromMe: true,
    mediaPath: payload.mediaPath || null,
    messageType: payload.mediaType || 'text',
    phone: payload.phone,
    sessionId: payload.sessionId || sessionManager.DEFAULT_SESSION,
    status: payload.status || 'sent',
    sender: payload.source === 'ai' ? 'ai' : 'agent',
    direction: 'outgoing',
    whatsappMessageId: payload.whatsappMessageId || null,
    remoteJid: payload.remoteJid || null,
    participantJid: payload.participantJid || null,
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

  try {
    const { syncEngine } = require('../../../../../services/sync');
    syncEngine.dispatch('message.sent', {
      messageId: savedMessage.id,
      conversationId: conversation.id,
      phone: payload.phone,
      text: savedMessage.content,
      tenantId: payload.companyId || 'default',
    });
  } catch (_) {}

  return {
    conversation: updatedConversation || conversation,
    message: savedMessage,
  };
}

module.exports = {
  ensureConversationForMessage,
  persistOutgoingMessageRecord,
};
