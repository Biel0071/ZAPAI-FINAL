function safePercent(numerator, denominator) {
  if (!denominator) return 0;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

function normalizeTenantId(value) {
  return String(value || process.env.DEFAULT_COMPANY_ID || 'default').trim() || 'default';
}

function belongsToTenant(item, companyId) {
  const itemTenant = item?.companyId || item?.company_id || item?.tenantId || item?.tenant_id;
  if (!itemTenant) {
    return normalizeTenantId(companyId) === normalizeTenantId(process.env.DEFAULT_COMPANY_ID || 'default');
  }
  return normalizeTenantId(itemTenant) === normalizeTenantId(companyId);
}

function buildAnalyticsSummary(store = {}, sessionId = null, companyId = null) {
  const conversations = (Array.isArray(store.conversations) ? store.conversations : [])
    .filter((item) => belongsToTenant(item, companyId));
  const conversationIds = new Set(conversations.map((item) => item.id));
  const messages = (Array.isArray(store.messages) ? store.messages : [])
    .filter((item) => belongsToTenant(item, companyId) || conversationIds.has(item.conversationId || item.conversation_id));
  const sessions = (store?.sessionManager?.listSessions ? store.sessionManager.listSessions() : [])
    .filter((item) => belongsToTenant(item, companyId));

  const isFiltered = sessionId && sessionId !== 'all';
  let filteredConversations = conversations;
  let filteredMessages = messages;
  let filteredSessions = sessions;

  if (isFiltered) {
    const targetSession = String(sessionId).trim().toLowerCase();
    filteredConversations = conversations.filter((c) => String(c.sessionId || 'main').trim().toLowerCase() === targetSession);
    const convIds = new Set(filteredConversations.map((c) => c.id));
    filteredMessages = messages.filter((m) => convIds.has(m.conversationId));
    filteredSessions = sessions.filter((s) => String(s.id).trim().toLowerCase() === targetSession);
  }

  const resolvedConversations = filteredConversations.filter((conversation) => {
    const status = String(conversation.status || '').toLowerCase();
    return status === 'closed' || status === 'resolved';
  }).length;

  const totalConversations = filteredConversations.length;
  const responseRate = safePercent(filteredMessages.filter((message) => message.fromMe === true).length, Math.max(filteredMessages.length, 1));

  const now = new Date();
  const dailySeries = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);

    const dayMessages = filteredMessages.filter((message) => String(message.createdAt || message.timestamp || '').slice(0, 10) === key).length;
    const dayLeads = filteredConversations.filter((conversation) => String(conversation.createdAt || '').slice(0, 10) === key).length;

    return {
      date: key,
      messages: dayMessages,
      leads: dayLeads,
    };
  });

  return {
    aiErrors: Array.isArray(store.aiLearningLogs)
      ? store.aiLearningLogs.filter((entry) => entry.status === 'error' && belongsToTenant(entry, companyId)).length
      : 0,
    averageServiceTime: 0,
    charts: {
      daily: dailySeries,
    },
    metrics: {
      leads: totalConversations,
      messages: filteredMessages.length,
      sessions: Array.isArray(filteredSessions) ? filteredSessions.length : 0,
    },
    resolvedConversations,
    responseRate,
    topWords: ['pedido', 'entrega', 'orcamento'],
    totalConversations,
  };
}

module.exports = {
  buildAnalyticsSummary,
};
