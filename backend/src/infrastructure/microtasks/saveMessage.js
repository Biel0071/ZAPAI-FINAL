const messageRepository = require('../../data/repositories/messageRepository');

async function runTask(payload = {}) {
  const savedMessage = await messageRepository.create({
    content: payload.text || payload.messagePreview || '',
    conversationId: payload.currentConversation.id,
    createdAt: payload.timestamp,
    fileName: payload.fileName || null,
    fromMe: payload.from === 'agent',
    mediaPath: payload.mediaPath || null,
    mimeType: payload.mimeType || null,
    messageType: payload.mediaType || 'text',
    phone: payload.phone,
    size: payload.size || null,
    status: payload.from === 'agent' ? 'sent' : 'received',
  });

  return {
    ...payload,
    savedMessage,
  };
}

module.exports = { runTask };
