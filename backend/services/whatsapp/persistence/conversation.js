/**
 * Database + realtime persistence pipeline for conversation messages.
 * Extracted from whatsappService.legacy.js (Phase 2b-4).
 *
 * Exports:
 *   - syncMessageCache / syncConversationCache: in-memory store upserts.
 *   - findOrCreateContact / findOrCreateConversation: idempotent DB lookups.
 *   - getConversationPreview: text/media preview formatter.
 *   - maybeGenerateAiSummary: stub for future AI summary enrichment.
 *   - persistConversationMessage: the main inbound/outbound persistence
 *     pipeline that runs microtasks, updates caches, emits realtime events,
 *     and returns lead/campaign metadata.
 *
 * No module-scoped mutable state. All effects go through the passed `store`
 * and through injected repositories / side-effect services.
 */

const contactRepository = require('../../../src/data/repositories/contactRepository');
const conversationRepository = require('../../../src/data/repositories/conversationRepository');
const messageRepository = require('../../../src/data/repositories/messageRepository');
const { getAgentByName, pickRandomAgent } = require('../../../src/infrastructure/config/agents');
const aiAgentService = require('../../../src/ai/agents/services/aiAgentService');
const { evaluateCampaign } = require('../../campaignEngine');
const { runTask } = require('../../microtaskRunner');
const { generateConversationSummary } = require('../../conversationSummarizer');
const { analyzeLeadIntent } = require('../../leadAnalyzer');
const { generateSalesStrategy } = require('../../salesStrategyEngine');
const { buildLeadTags, getNextFunnelStage } = require('../../salesFunnel');
const { DEFAULT_SESSION, getCompanyId } = require('../shared/identifiers');
const { getMessageTimestamp } = require('../shared/time');
const { emitRealtimeEvent } = require('../realtime/events');

function syncMessageCache(store, message) {
  if (!store?.messages) {
    return;
  }

  const existingIndex = store.messages.findIndex((entry) => entry.id === message.id);

  if (existingIndex >= 0) {
    store.messages[existingIndex] = message;
    return;
  }

  store.messages.push(message);
}

function syncConversationCache(store, conversation) {
  if (!store?.conversations) {
    return;
  }

  const existingIndex = store.conversations.findIndex(
    (entry) => entry.id === conversation.id
  );

  if (existingIndex >= 0) {
    store.conversations[existingIndex] = conversation;
    return;
  }

  store.conversations.push(conversation);
}

async function findOrCreateContact({ companyId, name, phone }) {
  const normalizedCompanyId = getCompanyId(companyId);
  // eslint-disable-next-line no-console
  console.log('Saving lead to database');
  let contact = await contactRepository.findContactByPhone(phone, normalizedCompanyId);

  if (!contact) {
    return contactRepository.createContact({
      companyId: normalizedCompanyId,
      name,
      phone,
    });
  }

  if (name && name !== 'Unknown' && contact.name !== name) {
    contact = await contactRepository.updateContactName(phone, name, normalizedCompanyId);
  }

  return contact;
}

async function findOrCreateConversation({
  assignedAgent,
  companyId,
  contactId,
  sessionId,
}) {
  const normalizedCompanyId = getCompanyId(companyId);
  let conversation = await conversationRepository.getConversationByContact(
    contactId,
    normalizedCompanyId,
    sessionId
  );
  let isNewConversation = false;

  if (!conversation) {
    conversation = await conversationRepository.createConversation({
      assignedAgent,
      companyId: normalizedCompanyId,
      contactId,
      funnelStage: 'new_lead',
      sessionId,
      status: 'open',
      tags: [],
    });
    isNewConversation = true;
  }

  return {
    conversation,
    isNewConversation,
  };
}

function getConversationPreview(text, mediaType) {
  if (text) {
    return text;
  }

  if (mediaType) {
    if (mediaType === 'image') return 'Imagem';
    if (mediaType === 'video') return 'Vídeo';
    if (mediaType === 'audio') return 'Áudio';
    if (mediaType === 'document' || mediaType === 'file') return 'Documento';
    if (mediaType === 'sticker') return 'Sticker';
    return 'Mídia';
  }

  return '';
}

async function maybeGenerateAiSummary(_store, _messageHistory, fallbackSummary) {
  return fallbackSummary;
}

async function persistConversationMessage(store, payload) {
  const companyId = getCompanyId(payload.companyId);
  const sessionId = payload.sessionId || DEFAULT_SESSION;
  // Ensure the agents list cache is hydrated
  await aiAgentService.listAgents(companyId).catch(() => {});
  const assignedAgent = pickRandomAgent(companyId);
  let taskPayload = await runTask('createLead', {
    companyId,
    name: payload.name,
    phone: payload.phone,
    sessionId,
    store,
  });

  taskPayload = await runTask('createConversation', {
    ...taskPayload,
    assignedAgent: assignedAgent?.name || null,
  });

  const currentConversation = taskPayload.currentConversation;
  const isNewConversation = taskPayload.isNewConversation;
  // eslint-disable-next-line no-console
  console.log('Saving conversation to database');
  const existingMessages = await messageRepository.getMessagesByConversation(
    currentConversation.id
  );
  const messagePreview = getConversationPreview(payload.text, payload.mediaType);
  const leadAnalysis =
    payload.from === 'client'
      ? analyzeLeadIntent(messagePreview, existingMessages)
      : null;
  const salesStrategy = generateSalesStrategy(
    leadAnalysis || {
      intent: currentConversation.lead_intent,
      lead_temperature: currentConversation.lead_temperature,
    }
  );
  const nextFunnelStage = getNextFunnelStage(
    currentConversation.funnel_stage,
    leadAnalysis || {
      intent: currentConversation.lead_intent,
      lead_temperature: currentConversation.lead_temperature,
    },
    payload.text || messagePreview
  );
  const tags = buildLeadTags(
    leadAnalysis || {
      intent: currentConversation.lead_intent,
      lead_temperature: currentConversation.lead_temperature,
      next_action: currentConversation.next_action,
    },
    nextFunnelStage
  );

  // eslint-disable-next-line no-console
  console.log('Saving message to database');
  taskPayload = await runTask('saveMessage', {
    ...taskPayload,
    fileName: payload.fileName || null,
    from: payload.from,
    mediaPath: payload.mediaPath,
    mediaType: payload.mediaType,
    mimeType: payload.mimeType || null,
    messagePreview,
    size: payload.size || null,
    text: payload.text || messagePreview,
    timestamp: payload.timestamp || getMessageTimestamp(),
  });
  const savedMessage = taskPayload.savedMessage;

  const conversationHistory = [...existingMessages, savedMessage];
  const fallbackSummary = generateConversationSummary(conversationHistory);
  const summary = await maybeGenerateAiSummary(store, conversationHistory, fallbackSummary);

  taskPayload = await runTask('updateConversation', {
    ...taskPayload,
    conversationUpdate: {
      lastMessage: messagePreview,
      lastMessageType: payload.mediaType || 'text',
      lead_confidence:
        typeof leadAnalysis?.confidence === 'number'
          ? leadAnalysis.confidence
          : currentConversation.lead_confidence,
      lead_intent: leadAnalysis?.intent || currentConversation.lead_intent,
      lead_temperature:
        leadAnalysis?.lead_temperature || currentConversation.lead_temperature,
      next_action: leadAnalysis?.next_action || currentConversation.next_action,
      agent_name: currentConversation.agent_name || assignedAgent.name,
      funnel_stage: nextFunnelStage,
      session_id: sessionId,
      status: 'open',
      summary,
      tags,
      unreadCount:
        payload.from === 'client'
          ? (Number(currentConversation.unreadCount) || 0) + 1
          : 0,
    },
  });
  const updatedConversation = taskPayload.updatedConversation;

  syncMessageCache(store, savedMessage);
  syncConversationCache(store, updatedConversation);
  conversationRepository.invalidateConversationCache(companyId);

  emitRealtimeEvent(store?.io, 'lead_updated', {
    conversationId: updatedConversation.id,
    intent: updatedConversation.lead_intent,
    lead_temperature: updatedConversation.lead_temperature,
    next_action: updatedConversation.next_action,
    phone: updatedConversation.phone,
    tags: updatedConversation.tags,
  });
  emitRealtimeEvent(store?.io, 'funnel_updated', {
    conversationId: updatedConversation.id,
    funnel_stage: updatedConversation.funnel_stage,
    phone: updatedConversation.phone,
  });

  const campaign = evaluateCampaign(updatedConversation);

  taskPayload = await runTask('emitSocketEvent', {
    ...taskPayload,
    campaign,
    currentConversation,
    isNewConversation,
    savedMessage,
    store,
    updatedConversation,
  });
  await runTask('updateMetrics', {
    ...taskPayload,
    campaign,
    currentConversation,
    isNewConversation,
    savedMessage,
    store,
    updatedConversation,
  });

  // Ensure the agents list cache is hydrated
  await aiAgentService.listAgents(companyId).catch(() => {});

  return {
    agent: getAgentByName(updatedConversation.agent_name, companyId),
    campaign,
    conversation: updatedConversation,
    isNewConversation,
    leadAnalysis,
    message: savedMessage,
    salesStrategy,
  };
}

module.exports = {
  findOrCreateContact,
  findOrCreateConversation,
  getConversationPreview,
  maybeGenerateAiSummary,
  persistConversationMessage,
  syncConversationCache,
  syncMessageCache,
};
