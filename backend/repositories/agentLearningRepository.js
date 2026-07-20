const { query } = require('../config/database');

async function createLearningEvent({
  agentKey,
  eventType,
  customerQuestion,
  aiResponse = null,
  contactPhone = null,
  contactName = null,
  conversationId = null,
  companyId = 'default',
}) {
  const result = await query(
    `
      INSERT INTO agent_learning_events (
        agent_key, company_id, event_type, customer_question,
        ai_response, contact_phone, contact_name, conversation_id,
        status, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW())
      RETURNING *
    `,
    [
      agentKey,
      companyId || 'default',
      eventType,
      customerQuestion,
      aiResponse,
      contactPhone,
      contactName,
      conversationId,
    ]
  );
  return result.rows[0] || null;
}

async function getPendingEvents(agentKey, companyId = 'default', limit = 50) {
  const result = await query(
    `
      SELECT *
      FROM agent_learning_events
      WHERE agent_key = $1 AND company_id = $2 AND status = 'pending'
      ORDER BY created_at DESC
      LIMIT $3
    `,
    [agentKey, companyId || 'default', limit]
  );
  return result.rows;
}

async function getEventsByStatus(agentKey, status, companyId = 'default') {
  const result = await query(
    `
      SELECT *
      FROM agent_learning_events
      WHERE agent_key = $1 AND status = $2 AND company_id = $3
      ORDER BY created_at DESC
    `,
    [agentKey, status, companyId || 'default']
  );
  return result.rows;
}

async function answerEvent(id, humanAnswer) {
  const result = await query(
    `
      UPDATE agent_learning_events
      SET human_answer = $2,
          status = 'answered',
          resolved_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, humanAnswer]
  );
  return result.rows[0] || null;
}

async function markApplied(id, appliedToField) {
  const result = await query(
    `
      UPDATE agent_learning_events
      SET status = 'applied',
          applied_to_field = $2,
          resolved_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, appliedToField]
  );
  return result.rows[0] || null;
}

async function ignoreEvent(id) {
  const result = await query(
    `
      UPDATE agent_learning_events
      SET status = 'ignored',
          resolved_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id]
  );
  return result.rows[0] || null;
}

async function getEventStats(agentKey, companyId = 'default') {
  const result = await query(
    `
      SELECT status, COUNT(*) as count
      FROM agent_learning_events
      WHERE agent_key = $1 AND company_id = $2
      GROUP BY status
    `,
    [agentKey, companyId || 'default']
  );
  
  const stats = {
    pending: 0,
    answered: 0,
    applied: 0,
    ignored: 0,
  };
  
  result.rows.forEach((row) => {
    if (row.status in stats) {
      stats[row.status] = parseInt(row.count, 10);
    }
  });
  
  return stats;
}

async function createEvolutionLog({
  agentKey,
  changeType,
  sourceDescription,
  fieldsChanged,
  appliedBy = 'owner',
  companyId = 'default',
}) {
  const result = await query(
    `
      INSERT INTO agent_evolution_log (
        agent_key, company_id, change_type, source_description,
        fields_changed, applied_by, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
    `,
    [
      agentKey,
      companyId || 'default',
      changeType,
      sourceDescription,
      JSON.stringify(fieldsChanged),
      appliedBy,
    ]
  );
  return result.rows[0] || null;
}

async function getEvolutionHistory(agentKey, companyId = 'default', limit = 30) {
  const result = await query(
    `
      SELECT *
      FROM agent_evolution_log
      WHERE agent_key = $1 AND company_id = $2
      ORDER BY created_at DESC
      LIMIT $3
    `,
    [agentKey, companyId || 'default', limit]
  );
  return result.rows;
}

async function getRecentAppliedEvents(agentKey, companyId = 'default', limit = 12) {
  const result = await query(
    `
      SELECT id, customer_question, human_answer, applied_to_field, resolved_at
      FROM agent_learning_events
      WHERE agent_key = $1 AND company_id = $2 AND status = 'applied'
      ORDER BY resolved_at DESC NULLS LAST, id DESC
      LIMIT $3
    `,
    [agentKey, companyId || 'default', limit]
  );
  return result.rows;
}







module.exports = {
  createLearningEvent,
  getPendingEvents,
  getEventsByStatus,
  answerEvent,
  markApplied,
  ignoreEvent,
  getEventStats,
  createEvolutionLog,
  getEvolutionHistory,
  getRecentAppliedEvents,
};
