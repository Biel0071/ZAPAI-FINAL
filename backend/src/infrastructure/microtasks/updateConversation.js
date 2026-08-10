const conversationRepository = require('../../data/repositories/conversationRepository');

async function runTask(payload = {}) {
  const updatedConversation = await conversationRepository.updateConversationState(
    payload.currentConversation.id,
    payload.conversationUpdate || {}
  );

  return {
    ...payload,
    updatedConversation,
  };
}

module.exports = { runTask };
