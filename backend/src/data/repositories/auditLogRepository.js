const { query } = require('../../infrastructure/config/database');

async function createAuditLog(log) {
  const { tenantId = 'default', actorUsername, actorRole, actorTenantId, action, targetType, targetId, ipAddress, userAgent, metadata = {} } = log;
  const result = await query(
    `INSERT INTO audit_logs (tenant_id, actor_username, actor_role, actor_tenant_id, action, target_type, target_id, ip_address, user_agent, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, tenant_id, actor_username, actor_role, action, target_type, target_id, ip_address, created_at`,
    [tenantId, actorUsername, actorRole, actorTenantId, action, targetType, targetId, ipAddress, userAgent, JSON.stringify(metadata)]
  );
  return result.rows[0];
}

async function listAuditLogs(options = {}) {
  const { tenantId = 'default', limit = 100, offset = 0, actorUsername, action, targetType, targetId } = options;
  const conditions = ['tenant_id = $1'];
  const values = [tenantId];
  let paramIndex = 2;

  if (actorUsername) {
    conditions.push(`actor_username = $${paramIndex++}`);
    values.push(actorUsername);
  }
  if (action) {
    conditions.push(`action = $${paramIndex++}`);
    values.push(action);
  }
  if (targetType) {
    conditions.push(`target_type = $${paramIndex++}`);
    values.push(targetType);
  }
  if (targetId) {
    conditions.push(`target_id = $${paramIndex++}`);
    values.push(targetId);
  }

  values.push(limit, offset);

  const result = await query(
    `SELECT id, tenant_id, actor_username, actor_role, actor_tenant_id, action, target_type, target_id, ip_address, user_agent, metadata, created_at
     FROM audit_logs
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    values
  );
  return result.rows;
}

async function getAuditLogCount(options = {}) {
  const { tenantId = 'default', actorUsername, action, targetType, targetId } = options;
  const conditions = ['tenant_id = $1'];
  const values = [tenantId];
  let paramIndex = 2;

  if (actorUsername) {
    conditions.push(`actor_username = $${paramIndex++}`);
    values.push(actorUsername);
  }
  if (action) {
    conditions.push(`action = $${paramIndex++}`);
    values.push(action);
  }
  if (targetType) {
    conditions.push(`target_type = $${paramIndex++}`);
    values.push(targetType);
  }
  if (targetId) {
    conditions.push(`target_id = $${paramIndex++}`);
    values.push(targetId);
  }

  const result = await query(
    `SELECT COUNT(*)::int AS total FROM audit_logs WHERE ${conditions.join(' AND ')}`,
    values
  );
  return Number(result.rows[0]?.total || 0);
}

module.exports = {
  createAuditLog,
  listAuditLogs,
  getAuditLogCount,
};
