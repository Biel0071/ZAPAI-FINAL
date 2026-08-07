async function getAutomatedReplyPermission(item, dependencies = {}) {
  if (item?.metadata?.ai_response !== true) {
    return { allowed: true, reason: 'not_ai_response' };
  }

  const repository = dependencies.conversationRepository || require('../repositories/conversationRepository');
  let conversation = null;
  try {
    if (item.metadata?.conversationId) {
      conversation = await repository.getConversationById(item.metadata.conversationId);
    }
    if (!conversation) {
      conversation = await repository.getConversationByPhone(item.phone, item.companyId, item.sessionId);
    }
    
    // Per-contact override: If explicitly disabled for this contact, deny it.
    if (conversation && (conversation.aiEnabled === false || conversation.ai_enabled === false)) {
      return { allowed: false, reason: 'conversation_ai_off' };
    }

    // Per-contact override: If explicitly enabled for this contact, allow it regardless of global setting.
    if (conversation && (conversation.aiEnabled === true || conversation.ai_enabled === true)) {
      return { allowed: true, reason: 'conversation_ai_on_override' };
    }
  } catch (error) {
    console.error('[AI_REPLY_GUARD] Failed to verify conversation AI state:', error?.message || error);
    // Ignore error and fallback to global
  }

  const readGlobalToggle = dependencies.isAIEnabled || require('../config/aiToggle').isAIEnabled;
  if (!readGlobalToggle(item.companyId)) {
    return { allowed: false, reason: 'global_ai_off' };
  }

  const sessionManager = dependencies.sessionManager || require('./sessionManager');
  const session = sessionManager.getSession(item.sessionId);
  if (session?.systemConnected === false) {
    return { allowed: false, reason: 'session_ai_disabled' };
  }

  if (!conversation) {
    return { allowed: false, reason: 'conversation_not_found' };
  }

  return { allowed: true, reason: 'ai_enabled' };
}

module.exports = {
  getAutomatedReplyPermission,
};