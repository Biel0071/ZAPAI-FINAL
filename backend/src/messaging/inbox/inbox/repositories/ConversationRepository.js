const baseConversationRepository = require('../../../../data/repositories/conversationRepository');

function toConversationState(conversation) {
  if (!conversation) {
    return null;
  }

  const lastInteractionAt =
    conversation.lastInteractionAt ||
    conversation.lastMessageAt ||
    conversation.updatedAt ||
    conversation.createdAt ||
    new Date().toISOString();

  return {
    ...conversation,
    contactId: conversation.contactId || conversation.contact_id || conversation.lead_id || null,
    conversationStatus: conversation.conversationStatus || conversation.status || 'open',
    assignedAgent: conversation.assignedAgent || conversation.agent_name || null,
    intent: conversation.intent || conversation.lead_intent || 'information',
    leadScore: Number(conversation.leadScore || conversation.lead_confidence || 0),
    lastInteractionAt,
  };
}

function toRepositoryStateFields(fields = {}) {
  return {
    agent_name: fields.assignedAgent,
    aiEnabled: fields.aiEnabled,
    funnel_stage: fields.funnelStage,
    lastMessage: fields.lastMessage,
    lastMessageType: fields.lastMessageType,
    lead_confidence: fields.leadScore,
    lead_intent: fields.intent,
    lead_temperature: fields.leadTemperature,
    next_action: fields.nextAction,
    session_id: fields.sessionId,
    status: fields.conversationStatus,
    summary: fields.conversationSummary,
    unreadCount: fields.unreadCount,
    updatedAt: fields.lastInteractionAt,
  };
}

async function listConversations(companyId, limit = 50, options = {}) {
  const rows = await baseConversationRepository.listConversations(companyId, limit, options);
  return rows.map(toConversationState);
}

async function getConversationById(conversationId) {
  const conversation = await baseConversationRepository.getConversationById(conversationId);
  return toConversationState(conversation);
}

async function findOrCreateConversationByPhone(payload) {
  const conversation = await baseConversationRepository.findOrCreateConversationByPhone(payload);
  return toConversationState(conversation);
}

async function updateConversationState(conversationId, fields = {}) {
  const updated = await baseConversationRepository.updateConversationState(
    conversationId,
    toRepositoryStateFields(fields)
  );

  return toConversationState(updated);
}

async function saveInsights(conversationId, insights = {}) {
  const updated = await updateConversationState(conversationId, {
    conversationSummary: insights.summary,
    intent: insights.intent,
    leadScore: insights.leadScore,
    nextAction: insights.nextAction,
  });

  return updated;
}

function getInsightsFromConversation(conversation) {
  if (!conversation) {
    return {
      automationStatus: 'idle',
      conversationSummary: '',
      intent: 'information',
      leadScore: 0,
      nextSuggestedReply: '',
    };
  }

  return {
    automationStatus: conversation.conversationStatus === 'closed' ? 'stopped' : 'active',
    conversationSummary: conversation.summary || 'No summary yet.',
    intent: conversation.intent || 'information',
    leadScore: Number(conversation.leadScore || 0),
    nextSuggestedReply: conversation.next_action || 'Follow up with a concise answer and clear CTA.',
  };
}

module.exports = {
  findOrCreateConversationByPhone,
  getConversationById,
  getInsightsFromConversation,
  listConversations,
  saveInsights,
  toConversationState,
  updateConversationState,
};
