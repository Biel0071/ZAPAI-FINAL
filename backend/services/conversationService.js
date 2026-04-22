const conversationRepository = require('../repositories/conversationRepository');

async function listConversations(companyId, limit = 50, options = {}) {
  return conversationRepository.listConversations(companyId, limit, options);
}

async function getConversationById(conversationId, companyId) {
  return conversationRepository.getConversationById(conversationId, companyId);
}

module.exports = {
  listConversations,
  getConversationById,
};
