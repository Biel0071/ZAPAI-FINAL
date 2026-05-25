const conversationRepository = require('../repositories/conversationRepository');
const messageRepository = require('../repositories/messageRepository');
const whatsappService = require('../services/whatsappService');
const sessionManager = require('../services/sessionManager');
const { registerOutgoingMessage } = require('./messagesController');
const messageStore = require('../store/messageStore');
const inboxConversationService = require('../inbox-core/inbox/services/ConversationService');
const inboxConversationRepository = require('../inbox-core/inbox/repositories/ConversationRepository');
const inboxRealtimeService = require('../inbox-core/inbox/events/InboxRealtimeService');
const conversationRuntimeService = require('../inbox-core/inbox/services/ConversationRuntimeService');

function getStore(req) {
  return req.app?.locals?.store;
}

function getRequestedSessionId(req) {
  const raw = String(
    req?.headers?.['x-session-id'] || req?.query?.sessionId || req?.body?.sessionId || 'main'
  ).trim();

  return sessionManager.normalizeSessionName(raw || 'main');
}

function getOptionalSessionId(req) {
  const raw = String(
    req?.headers?.['x-session-id'] || req?.query?.sessionId || req?.body?.sessionId || ''
  ).trim();

  if (!raw) {
    return null;
  }

  return sessionManager.normalizeSessionName(raw);
}

function ensureDraftStore(store) {
  if (!store) {
    return {};
  }

  if (!store.conversationDrafts || typeof store.conversationDrafts !== 'object') {
    store.conversationDrafts = {};
  }

  return store.conversationDrafts;
}

function resolveBasePublicUrl(store) {
  return (
    String(process.env.MASTER_API_URL || process.env.PUBLIC_API_URL || '').trim() ||
    store?.publicUrl ||
    `http://localhost:${process.env.PORT || 4025}`
  );
}

function emitConversationUpdated(store, conversation) {
  const io = store?.io || global.io;

  if (!io || !conversation) {
    return;
  }

  const payload = conversationRuntimeService.decorateConversation(store, conversation);

  io.emit('conversation:update', payload);
  io.emit('conversation_updated', payload);
  io.emit('conversation-update', payload);
}

function toConversationState(conversation) {
  return inboxConversationRepository.toConversationState(conversation);
}

function toConversationStateWithRuntime(store, conversation) {
  return conversationRuntimeService.decorateConversation(store, toConversationState(conversation));
}

function formatMoneyBRL(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0));
}

function getSalesStore(store) {
  if (!store.salesOperations || typeof store.salesOperations !== 'object') {
    store.salesOperations = {
      billings: {},
      profileCards: {},
    };
  }

  if (!store.salesOperations.billings || typeof store.salesOperations.billings !== 'object') {
    store.salesOperations.billings = {};
  }

  if (!store.salesOperations.profileCards || typeof store.salesOperations.profileCards !== 'object') {
    store.salesOperations.profileCards = {};
  }

  return store.salesOperations;
}

function buildBillingToken(conversationId) {
  return `${conversationId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function trimMessage(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

async function loadConversationForOperation(conversationId) {
  const conversation = await conversationRepository.getConversationById(conversationId);

  if (!conversation) {
    const error = new Error('Conversation not found.');
    error.status = 404;
    throw error;
  }

  return conversation;
}

async function sendAutomatedConversationMessage({ conversation, store, text }) {
  const normalizedText = String(text || '').trim();
  if (!normalizedText) {
    return null;
  }

  if (!sessionManager.isRuntimeActive()) {
    const error = new Error('System is inactive. Activate it with POST /system/start.');
    error.status = 409;
    throw error;
  }

  const preferredSessionId = sessionManager.normalizeSessionName(
    conversation?.session_id || sessionManager.DEFAULT_SESSION
  );
  const preferredSession = sessionManager.getSession(preferredSessionId);
  const fallbackSession = await sessionManager.getDefaultSession();
  const activeSession = preferredSession?.sock ? preferredSession : fallbackSession;
  const sock = activeSession?.sock || store?.sock;

  if (!sock || String(activeSession?.status || '').toLowerCase() !== 'connected') {
    const error = new Error('No connected WhatsApp session is available for automatic sending.');
    error.status = 409;
    throw error;
  }

  await whatsappService.sendMessage(sock, conversation.phone, normalizedText);

  const persistedResult = await registerOutgoingMessage(store, {
    companyId: conversation.company_id,
    mediaPath: null,
    mediaType: 'text',
    name: conversation.name || conversation.phone,
    phone: conversation.phone,
    sessionId: activeSession?.sessionId || preferredSessionId,
    source: 'human',
    text: normalizedText,
  });

  return persistedResult?.message || null;
}

async function getConversations(req, res) {
  const store = getStore(req);
  const sessionId = getOptionalSessionId(req);

  if (store?.databaseEnabled) {
    try {
      const sortedConversations = await inboxConversationService.listConversations({
        companyId: req.query?.companyId,
        limit: Number(req.query?.limit) || 50,
        sessionId: sessionId || undefined,
        store,
      });

      return res.status(200).json(sortedConversations);
    } catch (_err) {
      // fall through to memory store
    }
  }

  // Return in-memory chats when DB is unavailable
  const memChats = messageStore.getChats().filter((chat) =>
    sessionId ? String(chat.sessionId || 'main') === sessionId : true
  );
  const normalized = memChats.map((chat) => ({
    assignedAgent: 'Camila',
    contactId: chat.phone,
    conversationStatus: 'open',
    id: chat.id,
    intent: 'information',
    lastInteractionAt: chat.lastMessageTimestamp || new Date().toISOString(),
    contactName: chat.name,
    leadScore: 0,
    lastMessage: chat.lastMessage,
    lastMessageType: 'text',
    phone: chat.phone,
    sessionId: chat.sessionId,
    status: 'open',
    tags: [],
    unread: chat.unread || 0,
    updatedAt: chat.lastMessageTimestamp || new Date().toISOString(),
  }));

  return res.status(200).json(normalized.map((conversation) => conversationRuntimeService.decorateConversation(store, conversation)));
}

async function updateConversationAI(req, res) {
  const { phone } = req.params;
  const { aiEnabled } = req.body || {};

  if (typeof aiEnabled !== 'boolean') {
    return res.status(400).json({ error: 'The field aiEnabled must be boolean.' });
  }

  try {
    const conversation = await conversationRepository.updateConversationAIEnabled(
      phone,
      aiEnabled,
      req.body?.companyId || process.env.DEFAULT_COMPANY_ID || 'default'
    );

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    const store = req.app.locals.store;

    if (store?.conversations) {
      const index = store.conversations.findIndex((item) => item.id === conversation.id);
      if (index >= 0) {
        store.conversations[index] = conversation;
      } else {
        store.conversations.push(conversation);
      }
    }

    emitConversationUpdated(store, conversation);

    return res.status(200).json(toConversationStateWithRuntime(store, conversation));
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to update conversation.' });
  }
}

async function createConversation(req, res) {
  const { companyId, name, phone, sessionId, text } = req.body || {};
  const targetSessionId = sessionManager.normalizeSessionName(sessionId || getRequestedSessionId(req) || 'main');

  if (!phone) {
    return res.status(400).json({ error: 'The field phone is required.' });
  }

  try {
    const conversation = await inboxConversationRepository.findOrCreateConversationByPhone({
      companyId: companyId || process.env.DEFAULT_COMPANY_ID || 'default',
      contactName: name || phone,
      lastMessage: text || '',
      lastMessageType: 'text',
      phone,
      sessionId: targetSessionId,
    });

    const store = getStore(req);

    if (store?.conversations) {
      const existingIndex = store.conversations.findIndex((item) => item.id === conversation.id);

      if (existingIndex >= 0) {
        store.conversations[existingIndex] = conversation;
      } else {
        store.conversations.push(conversation);
      }
    }

    emitConversationUpdated(store, toConversationStateWithRuntime(store, conversation));

    return res.status(200).json(toConversationStateWithRuntime(store, conversation));
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to create conversation.' });
  }
}

async function getPublicUrl(req, res) {
  const publicUrl = resolveBasePublicUrl(req.app.locals.store);
  if (req.app.locals.store) {
    req.app.locals.store.publicUrl = publicUrl;
  }

  return res.status(200).json({
    api: publicUrl,
  });
}

async function getConversationMessages(req, res) {
  const { conversationId } = req.params;
  const store = getStore(req);

  async function markConversationAsRead() {
    try {
      if (store?.databaseEnabled) {
        const updatedConversation = await conversationRepository.updateConversationState(conversationId, {
          unreadCount: 0,
        });
        emitConversationUpdated(store, updatedConversation);
        return;
      }

      messageStore.markChatRead(conversationId);
    } catch {
      // Best-effort read sync should not break message loading.
    }
  }

  if (store?.databaseEnabled) {
    try {
      const sortedMessages = await inboxConversationService.getConversationMessages({
        conversationId,
        store,
      });
      await markConversationAsRead();
      if (sortedMessages.length > 0) {
        return res.status(200).json(sortedMessages);
      }
    } catch (_err) {
      // fall through to memory store
    }
  }

  // Fallback: return in-memory messages filtered by conversationId.
  const memMessages = Array.isArray(store?.messages)
    ? store.messages.filter((entry) => String(entry?.conversationId || '') === String(conversationId || ''))
    : [];
  await markConversationAsRead();
  return res.status(200).json(Array.isArray(memMessages) ? memMessages : []);
}

async function getConversationDraft(req, res) {
  const { conversationId } = req.params;
  const store = getStore(req);
  const draftStore = ensureDraftStore(store);

  return res.status(200).json({
    conversationId,
    draft: String(draftStore[conversationId] || ''),
  });
}

async function saveConversationDraft(req, res) {
  const { conversationId } = req.params;
  const store = getStore(req);
  const draftStore = ensureDraftStore(store);
  const draft = String(req.body?.draft || '');

  draftStore[conversationId] = draft;

  return res.status(200).json({
    conversationId,
    draft,
    success: true,
  });
}

async function clearConversationDraft(req, res) {
  const { conversationId } = req.params;
  const store = getStore(req);
  const draftStore = ensureDraftStore(store);

  delete draftStore[conversationId];

  return res.status(200).json({
    conversationId,
    draft: '',
    success: true,
  });
}

async function markConversationRead(req, res) {
  const { conversationId } = req.params;
  const store = getStore(req);

  if (store?.databaseEnabled) {
    try {
      const updatedConversation = await conversationRepository.updateConversationState(conversationId, {
        unreadCount: 0,
      });
      emitConversationUpdated(store, toConversationStateWithRuntime(store, updatedConversation));

      return res.status(200).json({
        conversation: toConversationStateWithRuntime(store, updatedConversation),
        success: true,
      });
    } catch (error) {
      return res.status(500).json({
        error: error.message || 'Failed to mark conversation as read.',
      });
    }
  }

  messageStore.markChatRead(conversationId);

  return res.status(200).json({
    conversationId,
    success: true,
    unreadCount: 0,
  });
}

async function getConversationInsights(req, res) {
  try {
    const { conversationId } = req.params;
    const insights = await inboxConversationService.getConversationInsights(conversationId);
    const runtime = conversationRuntimeService.getConversationRuntime(getStore(req), req.params.conversationId);
    return res.status(200).json({
      ...insights,
      aiPausedUntil: runtime.aiPausedUntil,
      controlMode: runtime.controlMode,
      humanActive: runtime.controlMode === 'human_active' || runtime.controlMode === 'paused_ai',
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Failed to load conversation insights.',
    });
  }
}

async function suggestConversationReply(req, res) {
  try {
    const { conversationId } = req.params;
    const result = await inboxConversationService.suggestReplyForConversation({
      conversationId,
      metadata: req.body?.metadata || {},
      text: req.body?.text || '',
    });

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Failed to generate suggested reply.',
    });
  }
}

async function updateTypingState(req, res) {
  const { conversationId } = req.params;
  const isTyping = Boolean(req.body?.isTyping);
  const actor = String(req.body?.actor || 'agent');
  const store = getStore(req);
  const io = store?.io || global.io;
  const payload = {
    actor,
    conversationId,
    timestamp: new Date().toISOString(),
  };

  if (isTyping) {
    inboxRealtimeService.emitTypingStart(io, payload);
  } else {
    inboxRealtimeService.emitTypingStop(io, payload);
  }

  return res.status(200).json({
    success: true,
    typing: isTyping,
  });
}

async function setConversationHandoff(req, res) {
  try {
    const { conversationId } = req.params;
    const { mode, timeoutMs } = req.body || {};
    const store = getStore(req);
    const conversation = await loadConversationForOperation(conversationId);

    if (mode === 'human') {
      conversationRuntimeService.setHumanTakeover(store, conversationId, timeoutMs);
    } else if (mode === 'ai') {
      conversationRuntimeService.resumeAI(store, conversationId);
    } else {
      return res.status(400).json({
        error: 'The field mode must be either human or ai.',
      });
    }

    const normalized = toConversationStateWithRuntime(store, conversation);
    emitConversationUpdated(store, normalized);

    return res.status(200).json({
      conversation: normalized,
      success: true,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || 'Failed to update handoff state.',
      success: false,
    });
  }
}

async function getConversationRuntime(req, res) {
  try {
    const { conversationId } = req.params;
    const runtime = conversationRuntimeService.getConversationRuntime(getStore(req), conversationId);

    return res.status(200).json({
      conversationId,
      runtime,
      success: true,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Failed to load runtime state.',
      success: false,
    });
  }
}

async function generateProfileCard(req, res) {
  try {
    const { conversationId } = req.params;
    const conversation = await loadConversationForOperation(conversationId);
    const messages = await messageRepository.findByConversationId(conversationId);
    const latestMessages = (Array.isArray(messages) ? messages : []).slice(-8);

    const customerMessages = latestMessages
      .filter((item) => !item.fromMe)
      .map((item) => trimMessage(item.content || item.text))
      .filter(Boolean);

    const lastCustomerMessage = customerMessages[customerMessages.length - 1] || '';
    const painPoints = customerMessages
      .filter((entry) => /(preco|prazo|entrega|desconto|frete|pagamento|orcamento)/i.test(entry))
      .slice(-3);

    const profile = {
      conversationId,
      customer: {
        name: conversation.name || 'Cliente',
        phone: conversation.phone,
      },
      lead: {
        confidence: Number(conversation.lead_confidence || 0),
        intent: String(conversation.lead_intent || 'information'),
        temperature: String(conversation.lead_temperature || 'cold'),
        funnelStage: String(conversation.funnel_stage || 'new_lead'),
      },
      summary: trimMessage(conversation.summary || 'Sem resumo registrado.'),
      lastCustomerMessage,
      painPoints,
      nextAction: String(conversation.next_action || 'educate'),
      generatedAt: new Date().toISOString(),
    };

    const suggestedText = [
      'Ficha de atendimento',
      `Cliente: ${profile.customer.name} (${profile.customer.phone})`,
      `Estagio: ${profile.lead.funnelStage}`,
      `Intencao: ${profile.lead.intent}`,
      `Prioridade: ${profile.lead.temperature}`,
      `Resumo: ${profile.summary}`,
      profile.lastCustomerMessage ? `Ultima mensagem: ${profile.lastCustomerMessage}` : null,
      profile.painPoints.length ? `Pontos de atencao: ${profile.painPoints.join(' | ')}` : null,
      `Proxima acao: ${profile.nextAction}`,
    ].filter(Boolean).join('\n');

    const salesStore = getSalesStore(getStore(req));
    salesStore.profileCards[conversationId] = profile;

    return res.status(200).json({
      profile,
      suggestedText,
      success: true,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || 'Failed to generate profile card.',
      success: false,
    });
  }
}

async function generateBilling(req, res) {
  try {
    const { conversationId } = req.params;
    const amount = Number(req.body?.amount);
    const autoSend = req.body?.autoSend !== false;
    const description = trimMessage(req.body?.description || 'Atendimento CRM');

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        error: 'The field amount must be a positive number.',
        success: false,
      });
    }

    const conversation = await loadConversationForOperation(conversationId);
    const store = getStore(req);
    const salesStore = getSalesStore(store);
    const billingId = buildBillingToken(conversationId);
    const paymentCode = `PIX-${billingId.toUpperCase()}`;
    const billing = {
      id: billingId,
      amount,
      amountLabel: formatMoneyBRL(amount),
      conversationId,
      createdAt: new Date().toISOString(),
      description,
      phone: conversation.phone,
      status: 'pending',
    };

    const publicUrl = resolveBasePublicUrl(store);
    const paymentUrl = `${publicUrl}/conversations/${conversationId}/billing/${billingId}`;
    billing.paymentUrl = paymentUrl;
    billing.paymentCode = paymentCode;
    salesStore.billings[billingId] = billing;

    const messageText = [
      `Perfeito! Segue sua cobranca de ${billing.amountLabel}.`,
      `Descricao: ${description}`,
      `Link de pagamento: ${paymentUrl}`,
      `Codigo PIX: ${paymentCode}`,
    ].join('\n');

    let sentMessage = null;
    if (autoSend) {
      sentMessage = await sendAutomatedConversationMessage({
        conversation,
        store,
        text: messageText,
      });
    }

    return res.status(200).json({
      billing,
      messageText,
      sentMessage,
      success: true,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || 'Failed to generate billing.',
      success: false,
    });
  }
}

async function getBillingDetails(req, res) {
  try {
    const { conversationId, billingId } = req.params;
    const store = getStore(req);
    const salesStore = getSalesStore(store);
    const billing = salesStore.billings[billingId];

    if (!billing || String(billing.conversationId) !== String(conversationId)) {
      return res.status(404).json({
        error: 'Billing not found for this conversation.',
        success: false,
      });
    }

    return res.status(200).json({
      billing,
      success: true,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Failed to load billing details.',
      success: false,
    });
  }
}

async function listConversationControls(req, res) {
  try {
    const companyId = req.query?.companyId || process.env.DEFAULT_COMPANY_ID || 'default';
    const conversations = await conversationRepository.listConversations(companyId, 200, { useCache: false });
    const mapped = conversations.map(conv => ({
      conversation_id: conv.id,
      conversationId: conv.id,
      ai_enabled: conv.aiEnabled !== false,
      aiEnabled: conv.aiEnabled !== false,
      assigned_to: conv.agent_name || 'Camila',
      tags: conv.tags || [],
      summary: conv.summary || '',
      updated_at: conv.updatedAt,
    }));
    return res.status(200).json(mapped);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to list conversation controls.' });
  }
}

async function upsertConversationControl(req, res) {
  try {
    const { conversation_id, conversationId, ai_enabled, aiEnabled, assigned_to, tags, summary } = req.body || {};
    const targetId = conversationId || conversation_id;

    if (!targetId) {
      return res.status(400).json({ error: 'The field conversation_id is required.' });
    }

    const fields = {};
    if (typeof aiEnabled !== 'undefined') fields.aiEnabled = Boolean(aiEnabled);
    else if (typeof ai_enabled !== 'undefined') fields.aiEnabled = Boolean(ai_enabled);
    if (typeof summary !== 'undefined') fields.summary = summary;
    if (Array.isArray(tags)) fields.tags = tags;
    if (typeof assigned_to !== 'undefined') fields.agent_name = assigned_to;

    const updated = await conversationRepository.updateConversationState(targetId, fields);
    if (!updated) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    const responsePayload = {
      conversation_id: updated.id,
      conversationId: updated.id,
      ai_enabled: updated.aiEnabled !== false,
      aiEnabled: updated.aiEnabled !== false,
      assigned_to: updated.agent_name || 'Camila',
      tags: updated.tags || [],
      summary: updated.summary || '',
      updated_at: updated.updatedAt,
    };

    const store = getStore(req);
    emitConversationUpdated(store, updated);

    return res.status(200).json(responsePayload);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to upsert conversation control.' });
  }
}

async function getConversationControl(req, res) {
  try {
    const { conversationId } = req.params;
    const conv = await conversationRepository.getConversationById(conversationId);
    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }
    const responsePayload = {
      conversation_id: conv.id,
      conversationId: conv.id,
      ai_enabled: conv.aiEnabled !== false,
      aiEnabled: conv.aiEnabled !== false,
      assigned_to: conv.agent_name || 'Camila',
      tags: conv.tags || [],
      summary: conv.summary || '',
      updated_at: conv.updatedAt,
    };
    return res.status(200).json(responsePayload);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to get conversation control.' });
  }
}

async function updateConversationMeta(req, res) {
  const { conversationId } = req.params;
  const fields = {};

  const allowedFields = [
    'status',
    'lead_temperature',
    'funnel_stage',
    'tags',
    'summary',
    'agent_name',
    'aiEnabled'
  ];

  for (const field of allowedFields) {
    if (typeof req.body[field] !== 'undefined') {
      fields[field] = req.body[field];
    }
  }

  try {
    const updated = await conversationRepository.updateConversationState(conversationId, fields);

    if (!updated) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    const store = getStore(req);

    if (store?.conversations) {
      const index = store.conversations.findIndex((item) => item.id === updated.id);
      if (index >= 0) {
        store.conversations[index] = updated;
      } else {
        store.conversations.push(updated);
      }
    }

    const decorated = toConversationStateWithRuntime(store, updated);
    emitConversationUpdated(store, decorated);

    return res.status(200).json(decorated);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to update conversation metadata.' });
  }
}

module.exports = {
  clearConversationDraft,
  createConversation,
  generateBilling,
  generateProfileCard,
  getBillingDetails,
  getConversationDraft,
  getConversationInsights,
  getConversationMessages,
  getConversationRuntime,
  getConversations,
  getPublicUrl,
  markConversationRead,
  saveConversationDraft,
  suggestConversationReply,
  setConversationHandoff,
  updateTypingState,
  updateConversationAI,
  listConversationControls,
  upsertConversationControl,
  getConversationControl,
  updateConversationMeta,
};
