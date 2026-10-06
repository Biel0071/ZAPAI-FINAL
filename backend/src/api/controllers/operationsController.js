const { query: dbQuery } = require('../../infrastructure/config/database');

async function getOperationsMetrics(req, res) {
  try {
    const companyId = String(req.authTenantId || '').trim();
    if (!companyId) {
      return res.status(401).json({ success: false, error: 'Autenticação obrigatória.' });
    }
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfDayIso = startOfDay.toISOString();

    const convQuery = await dbQuery(
      `SELECT 
        COUNT(*) as total_conversations,
        COUNT(CASE WHEN status IN ('open', 'active') OR status IS NULL THEN 1 END) as open_conversations,
        COUNT(CASE WHEN status = 'waiting' THEN 1 END) as waiting_conversations,
        COUNT(CASE WHEN status = 'closed' OR status = 'resolved' THEN 1 END) as closed_conversations,
        COUNT(CASE WHEN updated_at >= $1 THEN 1 END) as active_today
       FROM conversations
       WHERE company_id = $2`,
      [startOfDayIso, companyId]
    );

    const msgQuery = await dbQuery(
      `SELECT 
        COUNT(*) as total_messages,
        COUNT(CASE WHEN created_at >= $1 THEN 1 END) as messages_today,
        COUNT(CASE WHEN created_at >= $1 AND from_me = false THEN 1 END) as incoming_today,
        COUNT(CASE WHEN created_at >= $1 AND from_me = true THEN 1 END) as outgoing_today
       FROM messages
       WHERE company_id = $2`,
      [startOfDayIso, companyId]
    );

    const totalConversations = Number(convQuery.rows[0]?.total_conversations || 0);
    const openConversations = Number(convQuery.rows[0]?.open_conversations || 0);
    const waitingConversations = Number(convQuery.rows[0]?.waiting_conversations || 0);
    const closedConversations = Number(convQuery.rows[0]?.closed_conversations || 0);
    const messagesToday = Number(msgQuery.rows[0]?.messages_today || 0);
    const incomingMessagesToday = Number(msgQuery.rows[0]?.incoming_today || 0);
    const outgoingMessagesToday = Number(msgQuery.rows[0]?.outgoing_today || 0);

    const data = {
      queue: {
        totalWaiting: waitingConversations,
        averageWaitSeconds: null,
        slaStatus: 'unavailable',
        slaCompliancePercent: null,
      },
      operators: [],
      metrics: {
        totalConversations,
        openConversations,
        waitingConversations,
        closedConversations,
        messagesToday,
        incomingMessagesToday,
        outgoingMessagesToday,
        avgResponseTimeSeconds: null,
        avgHandlingTimeMinutes: null,
        slaCompliancePercent: null,
        transfersToday: null,
        productivityIndex: null,
      },
      timestamp: new Date().toISOString(),
    };

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('[OPERATIONS_CTRL_ERROR]', error);
    return res.status(500).json({ success: false, error: error.message || 'Erro ao carregar métricas de operações.' });
  }
}

module.exports = {
  getOperationsMetrics,
};
