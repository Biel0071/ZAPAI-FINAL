const conversationRepository = require('../../data/repositories/conversationRepository');

async function runTask(payload = {}) {
  const companyId = payload.companyId || process.env.DEFAULT_COMPANY_ID || 'default';
  let conversation = null;

  if (payload.conversationId) {
    conversation = await conversationRepository.getConversationById(payload.conversationId);
  }

  if (!conversation && payload.phone) {
    conversation = await conversationRepository.getConversationByPhone(
      payload.phone,
      companyId,
      payload.sessionId
    );
  }

  if (!conversation && payload.contact?.id) {
    conversation = await conversationRepository.getConversationByContact(
      payload.contact.id,
      companyId,
      payload.sessionId
    );
  }

  let isNewConversation = false;

  if (!conversation) {
    conversation = await conversationRepository.createConversation({
      assignedAgent: payload.assignedAgent,
      companyId,
      contactId: payload.contact.id,
      funnelStage: 'new_lead',
      sessionId: payload.sessionId,
      status: 'open',
      tags: [],
    });
    isNewConversation = true;
  }

  return {
    ...payload,
    companyId,
    conversation,
    currentConversation: conversation,
    isNewConversation,
  };
}

module.exports = { runTask };
