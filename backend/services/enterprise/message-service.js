const fs = require('fs/promises');
const path = require('path');
const conversationRepository = require('../../src/data/repositories/conversationRepository');
const messageRepository = require('../../src/data/repositories/messageRepository');
const { normalizePhone } = require('../whatsapp/shared/identifiers');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const CONVERSATIONS_ROOT = path.join(PROJECT_ROOT, 'conversations');



async function persistInboundMessage(payload = {}) {
  const phone = normalizePhone(payload.phone || '');

  if (!phone) {
    throw new Error('Inbound message missing phone.');
  }

  // Log conversation upsert key details
  const rawJid = payload.phone || '';
  const rawLid = rawJid.includes('@lid') ? rawJid : '';
  console.log(`[CONVERSATION-UPSERT-KEY] INBOUND Message (Enterprise) - Raw JID: "${rawJid}", Raw LID: "${rawLid}", Normalized Canonical Phone Key: "${phone}"`);

  const companyId = payload.companyId || process.env.DEFAULT_COMPANY_ID || 'default';
  const sessionId = payload.sessionId || 'main';



  const text = String(payload.text || '').trim();
  const messageType = payload.mediaType || payload.type || 'text';
  const messagePreview = text || `[${messageType}]`;

  let conversation = null;
  if (payload.conversationId) {
    conversation = await conversationRepository.getConversationById(payload.conversationId).catch(() => null);
  }
  if (!conversation) {
    conversation = await conversationRepository.findOrCreateConversationByPhone({
      companyId,
      contactName: payload.name || payload.participant || phone,
      lastMessage: messagePreview,
      lastMessageType: messageType,
      phone,
      sessionId,
      aiEnabled: true,
    });
  }

  if (!payload.fromMe && conversation && (conversation.aiEnabled === false || conversation.ai_enabled === false)) {
    console.log('[EnterpriseMessageService] AI remains OFF for conversation ' + phone + '; incoming message persisted without re-enabling automation.');
  }

  const externalMessageId = payload.externalMessageId || payload.whatsappMessageId || payload.messageId || null;

  const savedMessage = await messageRepository.create({
    companyId,
    content: messagePreview,
    conversationId: conversation.id,
    createdAt: payload.timestamp || new Date().toISOString(),
    externalMessageId,
    fileName: payload.fileName || null,
    fromMe: Boolean(payload.fromMe),
    mediaPath: payload.mediaPath || payload.url || null,
    mimeType: payload.mimeType || null,
    messageType,
    phone,
    sessionId,
    size: payload.size || null,
    status: payload.status || (payload.fromMe ? 'sent' : 'received'),
    whatsappMessageId: externalMessageId,
    hash: payload.hash || null,
  });

  const updatedConversation = await conversationRepository.updateConversationState(conversation.id, {
    lastMessage: messagePreview,
    lastMessageType: messageType,
    session_id: sessionId,
    status: 'open',
    unreadCount: payload.fromMe ? 0 : (Number(conversation.unreadCount) || 0) + 1,
  });

  setImmediate(async () => {
    try {
      const tenantDirectory = path.join(CONVERSATIONS_ROOT, String(companyId));
      await fs.mkdir(tenantDirectory, { recursive: true });
      await fs.appendFile(
        path.join(tenantDirectory, `${conversation.id}.jsonl`),
        `${JSON.stringify({
          id: savedMessage.id,
          mediaType: messageType,
          text: messagePreview,
          timestamp: payload.timestamp || new Date().toISOString(),
        })}\n`,
        'utf8'
      );
    } catch (_) {}
  });

  return {
    conversation: updatedConversation || conversation,
    message: savedMessage,
  };
}

module.exports = {
  normalizePhone,
  persistInboundMessage,
};
