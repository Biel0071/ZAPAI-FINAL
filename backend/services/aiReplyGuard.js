async function getAutomatedReplyPermission(item, dependencies = {}) {
  if (item?.metadata?.ai_response !== true) {
    return { allowed: true, reason: 'not_ai_response' };
  }

  const readGlobalToggle = dependencies.isAIEnabled || require('../config/aiToggle').isAIEnabled;
  if (!readGlobalToggle()) {
    return { allowed: false, reason: 'global_ai_off' };
  }

  const sessionManager = dependencies.sessionManager || require('./sessionManager');
  const session = sessionManager.getSession(item.sessionId);
  if (session?.systemConnected === false) {
    return { allowed: false, reason: 'session_ai_disabled' };
  }

  const repository = dependencies.conversationRepository || require('../repositories/conversationRepository');
  try {
    let conversation = null;
    if (item.metadata?.conversationId) {
      conversation = await repository.getConversationById(item.metadata.conversationId);
    }
    if (!conversation) {
      conversation = await repository.getConversationByPhone(item.phone, item.companyId, item.sessionId);
    }
    if (!conversation) {
      return { allowed: false, reason: 'conversation_not_found' };
    }
    if (conversation.aiEnabled === false || conversation.ai_enabled === false) {
      return { allowed: false, reason: 'conversation_ai_off' };
    }
    return { allowed: true, reason: 'ai_enabled' };
  } catch (error) {
    console.error('[AI_REPLY_GUARD] Failed to verify AI toggle before send:', error?.message || error);
    return { allowed: false, reason: 'ai_toggle_verification_failed' };
  }
}

module.exports = {
  getAutomatedReplyPermission,
};