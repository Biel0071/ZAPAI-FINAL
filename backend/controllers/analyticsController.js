const analyticsService = require('../services/analyticsService');
const metricsTracker = require('../services/metricsTracker');

function getStore(req) {
  return req.app.locals.store;
}

function getSummary(req, res) {
  try {
    const summary = analyticsService.buildAnalyticsSummary(getStore(req));
    return res.status(200).json(summary);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to load analytics summary.' });
  }
}

async function getMetrics(req, res) {
  try {
    const snapshot = await metricsTracker.recalcMetricsFromDB(getStore(req));
    return res.status(200).json({
      activeConversations: Number(snapshot?.activeConversations) || 0,
      generatedAt: snapshot?.generatedAt || new Date().toISOString(),
      leads: Number(snapshot?.totalConversations) || 0,
      messages: Number(snapshot?.totalMessages) || 0,
      sessions: Number(snapshot?.connectedSessions) || 0,
      totalConversations: Number(snapshot?.totalConversations) || 0,
      totalMessages: Number(snapshot?.totalMessages) || 0,
      uptime: Number(snapshot?.uptime) || 0,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to load metrics.' });
  }
}

function getDashboard(req, res) {
  try {
    const summary = analyticsService.buildAnalyticsSummary(getStore(req));
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
