const db = require('../config/database');

let lastMetricsSnapshot = {
  generatedAt: null,
  activeConversations: 0,
  connectedSessions: 0,
  messagesProcessed: 0,
  totalConversations: 0,
  totalMessages: 0,
  uptime: 0,
};

function buildMetricsSnapshot(store = {}) {
  const conversations = Array.isArray(store.conversations) ? store.conversations : [];
  const messages = Array.isArray(store.messages) ? store.messages : [];
  const openConversations = conversations.filter((item) => item.status !== 'closed').length;
  const connectedSessions = Array.from(store.sessionManager?.sessions?.values?.() || []).filter(
    (session) => session?.status === 'connected'
  ).length;

  return {
    activeConversations: openConversations,
    connectedSessions,
    generatedAt: new Date().toISOString(),
    messagesProcessed: messages.length,
    totalConversations: conversations.length,
    totalMessages: messages.length,
    uptime: Number(process.uptime().toFixed(3)),
  };
}

function getMetrics(store = {}) {
  return store.metricsSnapshot || lastMetricsSnapshot || buildMetricsSnapshot(store);
}

function persistMetricsSnapshot(store, snapshot) {
  lastMetricsSnapshot = {
    ...snapshot,
  };

  if (store) {
    store.metricsSnapshot = snapshot;
  }

  return snapshot;
}

function emitMetrics(store, snapshot) {
  const io = store?.io || global.io;

  if (!io) {
    return;
  }

  io.emit('metrics.updated', snapshot);
  io.emit('metrics_update', snapshot);
  io.emit('analytics_update', snapshot);
  io.emit('dashboard_update', snapshot);
}

async function recalcMetricsFromDB(store = {}, options = {}) {
  if (!store?.databaseEnabled) {
    const snapshot = persistMetricsSnapshot(store, buildMetricsSnapshot(store));
    emitMetrics(store, snapshot);
    return snapshot;
  }

  if (options.force !== true && store.metricsSnapshot) {
    return store.metricsSnapshot;
  }

  const companyId = process.env.DEFAULT_COMPANY_ID || 'default';
  const connectedSessions = Array.from(store.sessionManager?.sessions?.values?.() || []).filter(
    (session) => session?.status === 'connected'
  ).length;
  const [conversationCount, messageCount, openConversationCount] = await Promise.all([
    db.query('SELECT COUNT(*)::int AS total FROM conversations WHERE company_id = $1', [companyId]),
    db.query(
      'SELECT COUNT(*)::int AS total FROM messages m INNER JOIN conversations c ON c.id = m.conversation_id WHERE c.company_id = $1',
      [companyId]
    ),
    db.query('SELECT COUNT(*)::int AS total FROM conversations WHERE company_id = $1 AND status <> $2', [companyId, 'closed']),
  ]);

  const snapshot = {
    activeConversations: Number(openConversationCount.rows?.[0]?.total) || 0,
    connectedSessions,
    generatedAt: new Date().toISOString(),
    messagesProcessed: Number(messageCount.rows?.[0]?.total) || 0,
    totalConversations: Number(conversationCount.rows?.[0]?.total) || 0,
    totalMessages: Number(messageCount.rows?.[0]?.total) || 0,
    uptime: Number(process.uptime().toFixed(3)),
  };

  persistMetricsSnapshot(store, snapshot);
  emitMetrics(store, snapshot);

  return snapshot;
}

function startMetricsTracking(store, options = {}) {
  const intervalMs = Number(options.intervalMs) || 5000;

  const run = async () => {
    try {
      await recalcMetricsFromDB(store, { force: true });
    } catch (error) {
      console.error('[METRICS] recalcMetricsFromDB failed:', error?.message || error);

      const snapshot = persistMetricsSnapshot(store, buildMetricsSnapshot(store));
      emitMetrics(store, snapshot);
    }
  };

  run();
  const timer = setInterval(() => {
    run();
  }, intervalMs);

  return {
    stop() {
      clearInterval(timer);
    },
  };
}

module.exports = {
  buildMetricsSnapshot,
  getMetrics,
  recalcMetricsFromDB,
  startMetricsTracking,
};
