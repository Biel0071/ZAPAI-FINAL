const fs = require('fs/promises');
const path = require('path');
const conversationRepository = require('../../repositories/conversationRepository');
const messageRepository = require('../../repositories/messageRepository');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const CONVERSATIONS_ROOT = path.join(PROJECT_ROOT, 'conversations');

function normalizePhone(value = '') {
  return String(value || '')
    .trim()
    .replace(/@s\.whatsapp\.net$/i, '')
    .replace(/\s+/g, '');
}

async function persistInboundMessage(payload = {}) {
  const phone = normalizePhone(payload.phone || '');

  if (!phone) {
    throw new Error('Inbound message missing phone.');
  }

  const companyId = payload.companyId || process.env.DEFAULT_COMPANY_ID || 'default';
  const sessionId = payload.sessionId || 'main';
  const text = String(payload.text || '').trim();
  const messageType = payload.mediaType || payload.type || 'text';
  const messagePreview = text || `[${messageType}]`;

  const conversation = await conversationRepository.findOrCreateConversationByPhone({
    companyId,
    contactName: payload.name || payload.participant || phone,
    lastMessage: messagePreview,
    lastMessageType: messageType,
    phone,
    sessionId,
  });

  const savedMessage = await messageRepository.create({
    companyId,
    content: messagePreview,
    conversationId: conversation.id,
    createdAt: payload.timestamp || new Date().toISOString(),
    fromMe: Boolean(payload.fromMe),
    mediaPath: payload.mediaPath || payload.url || null,
    messageType,
    phone,
    sessionId,
    status: payload.status || (payload.fromMe ? 'sent' : 'received'),
  });

  const updatedConversation = await conversationRepository.updateConversationState(conversation.id, {
    lastMessage: messagePreview,
    lastMessageType: messageType,
    session_id: sessionId,
    status: 'open',
    unreadCount: payload.fromMe ? 0 : (Number(conversation.unreadCount) || 0) + 1,
  });

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

  return {
    conversation: updatedConversation || conversation,
    message: savedMessage,
  };
}

module.exports = {
  normalizePhone,
  persistInboundMessage,
};
