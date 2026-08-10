async function runTask(payload = {}) {
  const io = payload.store?.io || global.io;

  if (!io) {
    return payload;
  }

  if (payload.isNewConversation && payload.updatedConversation) {
    io.emit('new_conversation', payload.updatedConversation);
  }

  if (payload.savedMessage) {
    io.emit('new_message', {
      chatId: `${String(payload.savedMessage.phone || '').replace(/\D+/g, '')}@s.whatsapp.net`,
      message: {
        content: payload.savedMessage.content || payload.savedMessage.text || '',
        conversationId: payload.updatedConversation?.id || payload.currentConversation?.id || null,
        createdAt: payload.savedMessage.createdAt || payload.savedMessage.timestamp || new Date().toISOString(),
        fromMe: Boolean(payload.savedMessage.fromMe),
        id: payload.savedMessage.id,
        timestamp: payload.savedMessage.timestamp || payload.savedMessage.createdAt || new Date().toISOString(),
        type: payload.savedMessage.mediaType || payload.savedMessage.type || 'text',
        url: payload.savedMessage.url || null,
      },
    });
  }

  if (payload.updatedConversation) {
    io.emit('conversation_updated', payload.updatedConversation);
  }

  if (payload.campaign) {
    io.emit('campaign_triggered', {
      ...payload.campaign,
      conversationId: payload.updatedConversation?.id,
      phone: payload.updatedConversation?.phone,
    });
  }

  return payload;
}

module.exports = { runTask };
