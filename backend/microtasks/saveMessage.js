const messageRepository = require('../repositories/messageRepository');

async function runTask(payload = {}) {
  const savedMessage = await messageRepository.create({
    content: payload.text || payload.messagePreview || '',
    conversationId: payload.currentConversation.id,
    createdAt: payload.timestamp,
    fromMe: payload.from === 'agent',
    mediaPath: payload.mediaPath || null,
    messageType: payload.mediaType || 'text',
    phone: payload.phone,
    status: payload.from === 'agent' ? 'sent' : 'received',
  });

  return {
    ...payload,
    savedMessage,
  };
}

module.exports = { runTask };
