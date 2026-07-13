const db = require('../config/database');

let lastMetricsSnapshot = {
  generatedAt: null,
  activeConversations: 0,
  connectedSessions: 0,
  messagesProcessed: 0,
  messagesToday: 0,
  aiResponses: 0,
  totalConversations: 0,
  totalMessages: 0,
  uptime: 0,
};
let metricsRecalcInFlight = null;
let lastDbMetricsAt = 0;

const isProduction = String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
const MIN_DB_METRICS_INTERVAL_MS = Math.max(
  10_000,
  Number(process.env.METRICS_MIN_DB_INTERVAL_MS) || (isProduction ? 30_000 : 120_000)
);

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
    messagesToday: messages.filter((item) => {
      const createdAt = new Date(item.created_at || item.createdAt || item.timestamp || 0);
      return Number.isFinite(createdAt.getTime()) && createdAt.toDateString() === new Date().toDateString();
    }).length,
    aiResponses: messages.filter((item) => item?.source === 'ai' || item?.isAI === true || item?.sender === 'ai').length,
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
  const sessionId = options.sessionId || null;
  const isFiltered = sessionId && sessionId !== 'all';

  if (!store?.databaseEnabled) {
    const snapshot = buildMetricsSnapshot(store);
    if (!isFiltered) {
      persistMetricsSnapshot(store, snapshot);
      emitMetrics(store, snapshot);
    }
    return snapshot;
  }

  if (!isFiltered && options.force !== true && store.metricsSnapshot) {
    return store.metricsSnapshot;
  }

  const now = Date.now();
  if (!isFiltered && metricsRecalcInFlight) {
    return metricsRecalcInFlight;
  }

  if (!isFiltered && store.metricsSnapshot && (now - lastDbMetricsAt) < MIN_DB_METRICS_INTERVAL_MS) {
    return store.metricsSnapshot;
  }

  const fetchFunc = async () => {
    const companyId = process.env.DEFAULT_COMPANY_ID || 'default';
    const connectedSessions = Array.from(store.sessionManager?.sessions?.values?.() || []).filter(
      (session) => session?.status === 'connected'
    ).length;

    let conversationQuery = 'SELECT COUNT(*)::int AS total FROM conversations WHERE company_id = $1';
    let messageQuery = 'SELECT COUNT(*)::int AS total FROM messages m INNER JOIN conversations c ON c.id = m.conversation_id WHERE c.company_id = $1';
    let messagesTodayQuery = "SELECT COUNT(*)::int AS total FROM messages m INNER JOIN conversations c ON c.id = m.conversation_id WHERE c.company_id = $1 AND COALESCE(m.created_at, m.timestamp, NOW()) >= CURRENT_DATE";
    let aiResponsesQuery = "SELECT COUNT(*)::int AS total FROM messages m INNER JOIN conversations c ON c.id = m.conversation_id WHERE c.company_id = $1 AND LOWER(COALESCE(m.sender, '')) IN ('ai', 'bot', 'assistant')";
    let openConversationQuery = 'SELECT COUNT(*)::int AS total FROM conversations WHERE company_id = $1 AND status <> $2';

    const convParams = [companyId];
    const msgParams = [companyId];
    const todayParams = [companyId];
    const aiParams = [companyId];
    const openParams = [companyId, 'closed'];

    if (isFiltered) {
      conversationQuery += ' AND session_id = $2';
      convParams.push(sessionId);

      messageQuery += ' AND c.session_id = $2';
      msgParams.push(sessionId);

      messagesTodayQuery += ' AND c.session_id = $2';
      todayParams.push(sessionId);

      aiResponsesQuery += ' AND c.session_id = $2';
      aiParams.push(sessionId);

      openConversationQuery += ' AND session_id = $3';
      openParams.push(sessionId);
    }

    const [conversationCount, messageCount, messagesTodayCount, aiResponsesCount, openConversationCount] = await Promise.all([
      db.query(conversationQuery, convParams),
      db.query(messageQuery, msgParams),
      db.query(messagesTodayQuery, todayParams),
      db.query(aiResponsesQuery, aiParams),
      db.query(openConversationQuery, openParams),
    ]);

    const snapshot = {
      activeConversations: Number(openConversationCount.rows?.[0]?.total) || 0,
      connectedSessions,
      generatedAt: new Date().toISOString(),
      messagesProcessed: Number(messageCount.rows?.[0]?.total) || 0,
      messagesToday: Number(messagesTodayCount.rows?.[0]?.total) || 0,
      aiResponses: Number(aiResponsesCount.rows?.[0]?.total) || 0,
      totalConversations: Number(conversationCount.rows?.[0]?.total) || 0,
      totalMessages: Number(messageCount.rows?.[0]?.total) || 0,
      uptime: Number(process.uptime().toFixed(3)),
    };

    if (!isFiltered) {
      lastDbMetricsAt = Date.now();
      persistMetricsSnapshot(store, snapshot);
      emitMetrics(store, snapshot);
    }

    return snapshot;
  };

  if (isFiltered) {
    return fetchFunc();
  }

  metricsRecalcInFlight = fetchFunc().finally(() => {
    metricsRecalcInFlight = null;
  });

  return metricsRecalcInFlight;
}

function startMetricsTracking(store, options = {}) {
  const intervalMs = Math.max(
    30_000,
    Number(options.intervalMs) || Number(process.env.METRICS_TRACKING_INTERVAL_MS) || (isProduction ? 30_000 : 120_000)
  );

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
