const analyticsService = require('../../../services/analyticsService');
const metricsTracker = require('../../../services/metricsTracker');
const { getCompanyId } = require('../../../services/tenantContext');

function getStore(req) {
  return req.app.locals.store;
}

function getSummary(req, res) {
  try {
    const sessionId = req.query.sessionId || req.query.session_id || null;
    const summary = analyticsService.buildAnalyticsSummary(getStore(req), sessionId, getCompanyId(req));
    return res.status(200).json(summary);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to load analytics summary.' });
  }
}

async function getMetrics(req, res) {
  try {
    const store = getStore(req);
    const sessionId = req.query.sessionId || req.query.session_id || null;

    const companyId = getCompanyId(req);
    if (req.query.start || req.query.end) {
      const start = req.query.start ? new Date(String(req.query.start)) : new Date(0);
      const end = req.query.end ? new Date(String(req.query.end)) : new Date();
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) {
        return res.status(400).json({ error: 'Período inválido.' });
      }
      const { pool } = require('../../infrastructure/config/database');
      if (sessionId) {
        const owned = await pool.query('SELECT 1 FROM sessions WHERE company_id=$1 AND session_id=$2 AND status<>\'deleted\'', [companyId, sessionId]);
        if (!owned.rowCount) return res.status(404).json({ error: 'Conexão não encontrada.' });
      }
      const params = [companyId, sessionId, start.toISOString(), end.toISOString()];
      const [messageRows, conversationRows, connectedRows] = await Promise.all([
        pool.query(`SELECT COUNT(*)::int AS messages,
          COUNT(*) FILTER (WHERE sender IN ('ai','bot') OR message_origin='ai')::int AS ai_responses,
          COUNT(DISTINCT conversation_id)::int AS active_chats
          FROM messages WHERE company_id=$1 AND ($2::text IS NULL OR session_id=$2)
          AND timestamp >= $3::timestamp AND timestamp <= $4::timestamp`, params),
        pool.query(`SELECT COUNT(*)::int AS conversations,COUNT(DISTINCT lead_id)::int AS leads
          FROM conversations WHERE company_id=$1 AND ($2::text IS NULL OR session_id=$2)
          AND created_at >= $3::timestamp AND created_at <= $4::timestamp`, params),
        pool.query(`SELECT COUNT(*)::int AS sessions FROM sessions WHERE company_id=$1 AND status='connected' AND ($2::text IS NULL OR session_id=$2)`, [companyId, sessionId]),
      ]);
      const messages = messageRows.rows[0];
      const conversations = conversationRows.rows[0];
      return res.json({
        messagesToday: messages.messages,
        messages: messages.messages,
        aiResponses: messages.ai_responses,
        activeChats: messages.active_chats,
        totalConversations: conversations.conversations,
        newLeads: conversations.leads,
        leads: conversations.leads,
        sessions: connectedRows.rows[0].sessions,
        generatedAt: new Date().toISOString(),
      });
    }
    const snapshot = await metricsTracker.recalcMetricsFromDB(store, {
      companyId,
      force: true,
      sessionId,
    });
    return res.status(200).json({
      activeConversations: Number(snapshot?.activeConversations) || 0,
      activeChats: Number(snapshot?.activeConversations) || 0,
      aiResponses: Number(snapshot?.aiResponses) || 0,
      generatedAt: snapshot?.generatedAt || new Date().toISOString(),
      leads: Number(snapshot?.totalConversations) || 0,
      messages: Number(snapshot?.messagesToday) || 0,
      messagesToday: Number(snapshot?.messagesToday) || 0,
      sessions: Number(snapshot?.connectedSessions) || 0,
      totalConversations: Number(snapshot?.totalConversations) || 0,
      totalMessages: Number(snapshot?.totalMessages) || 0,
      tenantId: companyId,
      uptime: Number(snapshot?.uptime) || 0,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to load metrics.' });
  }
}

function getDashboard(req, res) {
  try {
    const sessionId = req.query.sessionId || req.query.session_id || null;
    const summary = analyticsService.buildAnalyticsSummary(getStore(req), sessionId, getCompanyId(req));
    return res.status(200).json({
      charts: summary?.charts || { daily: [] },
      metrics: {
        leads: Number(summary?.metrics?.leads) || 0,
        messages: Number(summary?.metrics?.messages) || 0,
        sessions: Number(summary?.metrics?.sessions) || 0,
      },
      resolvedConversations: Number(summary?.resolvedConversations) || 0,
      responseRate: Number(summary?.responseRate) || 0,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to load dashboard.' });
  }
}

module.exports = {
  getDashboard,
  getMetrics,
  getSummary,
};
