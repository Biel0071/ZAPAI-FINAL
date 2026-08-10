async function runTask(payload = {}) {
  const store = payload.store;

  if (!store) {
    return payload;
  }

  store.metricsSnapshot = {
    activeConversations: Array.isArray(store.conversations)
      ? store.conversations.filter((item) => item.status !== 'closed').length
      : 0,
    generatedAt: new Date().toISOString(),
    totalMessages: Array.isArray(store.messages) ? store.messages.length : 0,
  };

  return payload;
}

module.exports = { runTask };
