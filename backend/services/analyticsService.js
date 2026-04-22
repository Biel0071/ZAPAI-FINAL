function safePercent(numerator, denominator) {
  if (!denominator) return 0;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

function buildAnalyticsSummary(store = {}) {
  const conversations = Array.isArray(store.conversations) ? store.conversations : [];
  const messages = Array.isArray(store.messages) ? store.messages : [];
  const sessions = store?.sessionManager?.listSessions ? store.sessionManager.listSessions() : [];

  const resolvedConversations = conversations.filter((conversation) => {
    const status = String(conversation.status || '').toLowerCase();
    return status === 'closed' || status === 'resolved';
  }).length;

  const totalConversations = conversations.length;
  const responseRate = safePercent(messages.filter((message) => message.fromMe === true).length, Math.max(messages.length, 1));

  const now = new Date();
  const dailySeries = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);

    const dayMessages = messages.filter((message) => String(message.createdAt || message.timestamp || '').slice(0, 10) === key).length;
    const dayLeads = conversations.filter((conversation) => String(conversation.createdAt || '').slice(0, 10) === key).length;

    return {
      date: key,
      messages: dayMessages,
      leads: dayLeads,
    };
  });

  return {
    aiErrors: Array.isArray(store.aiLearningLogs)
      ? store.aiLearningLogs.filter((entry) => entry.status === 'error').length
      : 0,
    averageServiceTime: 0,
    charts: {
      daily: dailySeries,
    },
    metrics: {
      leads: totalConversations,
      messages: messages.length,
      sessions: Array.isArray(sessions) ? sessions.length : 0,
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
