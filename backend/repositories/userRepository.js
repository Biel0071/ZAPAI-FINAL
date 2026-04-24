const { query } = require('../config/database');

async function listUsers(options = {}) {
  const { tenantId = 'default', includeDeleted = false } = options;
  const deletedFilter = includeDeleted ? '' : 'AND deleted_at IS NULL';
  const result = await query(
    `SELECT id, tenant_id, username, email, role, blocked, plan, whatsapp_limit, created_at, updated_at, last_login_at, deleted_at
     FROM users
     WHERE tenant_id = $1 ${deletedFilter}
     ORDER BY created_at DESC`,
    [tenantId]
  );
  return result.rows;
}

async function getUserById(id) {
  const result = await query(
    `SELECT id, tenant_id, username, email, role, blocked, plan, whatsapp_limit, created_at, updated_at, last_login_at, deleted_at
     FROM users
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  return result.rows[0] || null;
}

async function getUserByUsername(username) {
  const result = await query(
    `SELECT id, tenant_id, username, email, password_hash, role, blocked, plan, whatsapp_limit, created_at, updated_at, last_login_at, deleted_at
     FROM users
     WHERE username = $1 AND deleted_at IS NULL`,
    [username]
  );
  return result.rows[0] || null;
}

async function createUser(user) {
  const { tenantId = 'default', username, email, passwordHash, role = 'admin', plan = 'free', whatsappLimit = 1 } = user;
  const result = await query(
    `INSERT INTO users (tenant_id, username, email, password_hash, role, plan, whatsapp_limit)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, tenant_id, username, email, role, blocked, plan, whatsapp_limit, created_at, updated_at`,
    [tenantId, username, email, passwordHash, role, plan, whatsappLimit]
  );
  return result.rows[0];
}

async function updateUser(id, updates) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  if (updates.email !== undefined) {
    fields.push(`email = $${paramIndex++}`);
    values.push(updates.email);
  }
  if (updates.passwordHash !== undefined) {
    fields.push(`password_hash = $${paramIndex++}`);
    values.push(updates.passwordHash);
  }
  if (updates.role !== undefined) {
    fields.push(`role = $${paramIndex++}`);
    values.push(updates.role);
  }
  if (updates.blocked !== undefined) {
    fields.push(`blocked = $${paramIndex++}`);
    values.push(updates.blocked);
  }
  if (updates.plan !== undefined) {
    fields.push(`plan = $${paramIndex++}`);
    values.push(updates.plan);
  }
  if (updates.whatsappLimit !== undefined) {
    fields.push(`whatsapp_limit = $${paramIndex++}`);
    values.push(updates.whatsappLimit);
  }

  fields.push(`updated_at = NOW()`);
  values.push(id);

  if (fields.length === 1) {
    return getUserById(id);
  }

  const result = await query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL
     RETURNING id, tenant_id, username, email, role, blocked, plan, whatsapp_limit, created_at, updated_at, last_login_at`,
    values
  );
  return result.rows[0] || null;
}

async function softDeleteUser(id) {
  const result = await query(
    `UPDATE users SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL
     RETURNING id, tenant_id, username, deleted_at`,
    [id]
  );
  return result.rows[0] || null;
}

async function hardDeleteUser(id) {
  const result = await query(
    `DELETE FROM users WHERE id = $1 RETURNING id, username`,
    [id]
  );
  return result.rows[0] || null;
}

async function updateLastLogin(id) {
  await query(
    `UPDATE users SET last_login_at = NOW() WHERE id = $1`,
    [id]
  );
}

module.exports = {
  listUsers,
  getUserById,
  getUserByUsername,
  createUser,
  updateUser,
  softDeleteUser,
  hardDeleteUser,
  updateLastLogin,
};
