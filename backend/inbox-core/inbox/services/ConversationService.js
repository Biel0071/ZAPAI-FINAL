const messageRepository = require('../../../repositories/messageRepository');
const messageStore = require('../../../store/messageStore');
const sessionManager = require('../../../services/sessionManager');
const { normalizePhone } = require('../../../services/whatsapp/shared/identifiers');
const { processEvent, generateReply } = require('../../ai/AIEventBridge');
const conversationRepository = require('../repositories/ConversationRepository');
const conversationRuntimeService = require('./ConversationRuntimeService');

function getCompanyId(companyId) {
  return companyId || process.env.DEFAULT_COMPANY_ID || 'default';
}

function getSessionOwnPhones(sessionId, store) {
  const phones = new Set();
  const addPhone = (value) => {
    const normalized = normalizePhone(value || '');
    if (normalized) {
      phones.add(normalized);
    }
  };

  const normalizedSessionId = sessionId ? sessionManager.normalizeSessionName(sessionId) : null;
  const session = normalizedSessionId ? sessionManager.getSession(normalizedSessionId) : null;
  addPhone(session?.phone);
  addPhone(session?.sock?.user?.id);
  addPhone(store?.phone);
  addPhone(store?.sock?.user?.id);

  if (!normalizedSessionId) {
    for (const activeSession of sessionManager.listSessions()) {
      addPhone(activeSession?.phone);
    }
  }

  return phones;
}

function getConversationPhone(conversation) {
  const candidates = [
    conversation?.phone,
    conversation?.remote_jid,
    conversation?.remoteJid,
    conversation?.contactId,
    conversation?.contact_id,
    conversation?.id,
  ];

  for (const candidate of candidates) {
    const normalized = normalizePhone(candidate || '');
    if (normalized) {
      return normalized;
    }
  }

  return '';
}

function filterOwnSessionConversation(conversations, { sessionId, store } = {}) {
  const ownPhones = getSessionOwnPhones(sessionId, store);

  if (!ownPhones.size) {
    return conversations;
  }

  return conversations.filter((conversation) => !ownPhones.has(getConversationPhone(conversation)));
}

async function listConversations({ companyId, limit = 50, sessionId, store }) {
  if (store?.databaseEnabled) {
    const conversations = await conversationRepository.listConversations(getCompanyId(companyId), limit, {
      sessionId: sessionId || null,
    });
    return filterOwnSessionConversation(conversations, { sessionId, store })
      .map((conversation) => conversationRuntimeService.decorateConversation(store, conversation));
  }

  const memChats = filterOwnSessionConversation(messageStore.getChats(), { sessionId, store });

  return memChats.map((chat) => conversationRuntimeService.decorateConversation(store, {
    assignedAgent: null,
    contactId: chat.phone,
    conversationStatus: 'open',
    id: chat.id,
    intent: 'information',
    lastInteractionAt: chat.lastMessageTimestamp || new Date().toISOString(),
    lastMessage: chat.lastMessage,
    leadScore: 0,
    name: chat.name,
    phone: chat.phone,
    unreadCount: chat.unread || 0,
    updatedAt: chat.lastMessageTimestamp || new Date().toISOString(),
  }));
}

async function getConversationMessages({ conversationId, store, limit = 50, before = null }) {
  if (store?.databaseEnabled) {
    const messages = await messageRepository.findByConversationId(conversationId);
    return [...messages].sort((a, b) => new Date(a.createdAt || a.timestamp || 0) - new Date(b.createdAt || b.timestamp || 0));
  }

  return messageStore.getMessages(conversationId, limit, before);
}

async function getConversationInsights(conversationId) {
  const conversation = await conversationRepository.getConversationById(conversationId);
  return conversationRepository.getInsightsFromConversation(conversation);
}

async function analyzeIncomingMessage({ conversationId, text, metadata = {}, options = {} }) {
  if (!conversationId) {
    return null;
  }

  const engineResult = await processEvent(
    {
      type: 'incoming_message',
      conversationId,
      message: text || '',
      text: text || '',
      metadata,
      context: {
        conversationId,
        ...metadata,
      },
    },
    options
  );

  const updatedContext = engineResult?.updatedContext || {};
  const insightPayload = {
    intent: updatedContext.intent || updatedContext.leadIntent || metadata.intent || 'information',
    leadScore: Number(updatedContext.leadScore || updatedContext.lead_confidence || metadata.leadScore || 0),
    nextAction: updatedContext.nextAction || updatedContext.next_action || metadata.nextAction || 'follow_up',
    summary:
      updatedContext.summary ||
      updatedContext.lastResponse ||
      engineResult?.response ||
      'Conversation analyzed by AI engine.',
  };

  const updatedConversation = await conversationRepository.saveInsights(conversationId, insightPayload);
  const normalizedConversation = conversationRuntimeService.decorateConversation(options?.store, updatedConversation);

  return {
    conversation: normalizedConversation,
    engineResult,
    insights: {
      automationStatus: normalizedConversation?.conversationStatus === 'closed' ? 'stopped' : 'active',
      conversationSummary: insightPayload.summary,
      intent: insightPayload.intent,
      leadScore: insightPayload.leadScore,
      nextSuggestedReply: insightPayload.nextAction,
      controlMode: normalizedConversation?.controlMode || 'ai_active',
      humanActive: Boolean(normalizedConversation?.humanActive),
      aiPausedUntil: normalizedConversation?.aiPausedUntil || null,
    },
  };
}

async function suggestReplyForConversation({ conversationId, text, metadata = {}, options = {} }) {
  const reply = await generateReply(
    {
      conversationId,
      text: text || '',
      metadata,
    },
    options
  );

  return {
    suggestion: reply || 'Could you share more details so I can help with the best option?',
  };
}

module.exports = {
  analyzeIncomingMessage,
  getConversationInsights,
  getConversationMessages,
  listConversations,
  suggestReplyForConversation,
};
