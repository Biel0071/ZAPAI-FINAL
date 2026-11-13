/**
 * Admin Users Router
 * Provides /api/admin/users endpoints with standardized envelope.
 * Delegates to userRepository (same as adminMaster.js but accessible at /admin/users).
 * Complements the existing /admin/master/users routes — does not replace them.
 */

const express = require('express');
const router = express.Router();
const userRepository = require('../../data/repositories/userRepository');
const { errorLog } = require('../../../services/logger');

function safeEnvelope(data) {
  const arr = Array.isArray(data) ? data : [];
  return { ok: true, data: arr, total: arr.length };
}

const MASTER_ROLES = new Set(['master', 'master_admin']);
function roleOf(req) { return String(req.auth?.role || '').toLowerCase(); }
function canManageUsers(req) { return MASTER_ROLES.has(roleOf(req)) || roleOf(req) === 'admin'; }
function canAccessTenant(req, tenantId) {
  if (req.adminCompanyContext) return String(tenantId) === String(req.adminCompanyContext);
  return MASTER_ROLES.has(roleOf(req)) || String(tenantId) === String(req.authTenantId);
}
function forbidden(res) {
  return res.status(403).json({ ok: false, error: { code: 'FORBIDDEN', message: 'Acesso não autorizado.' } });
}

/**
 * GET /api/admin/users — list users
 */
router.get('/users', async (req, res) => {
  try {
    const role = roleOf(req);
    const users = MASTER_ROLES.has(role) && !req.adminCompanyContext
      ? (await require('../../infrastructure/config/database').query('SELECT id, tenant_id, username, email, role, blocked, plan, whatsapp_limit, created_at, updated_at, last_login_at FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC')).rows
      : MASTER_ROLES.has(role) || role === 'admin'
        ? await userRepository.listUsers({ tenantId: req.authTenantId, includeDeleted: false })
        : [await userRepository.getUserByUsername(String(req.auth?.username || req.auth?.sub || ''))]
          .filter(Boolean)
          .map((user) => { const safe = { ...user }; delete safe.password_hash; delete safe.passwordHash; return safe; });
    const safeUsers = users.map((user) => { const safe = { ...user }; delete safe.password_hash; delete safe.passwordHash; return safe; });
    return res.status(200).json(safeEnvelope(safeUsers));
  } catch (error) {
    errorLog(error, { scope: 'admin_users', action: 'list' });
    // Never 500 on empty/unavailable — return empty state
    return res.status(200).json({ ok: true, data: [], total: 0 });
  }
});

/**
 * GET /api/admin/users/:id — get user by ID
 */
router.get('/users/:id', async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId)) {
      return res.status(400).json({ ok: false, error: { code: 'INVALID_ID', message: 'ID inválido.' } });
    }
    const user = await userRepository.getUserById(userId);
    if (!user) {
      return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Usuário não encontrado.' } });
    }
    const safeUser = { ...user };
    delete safeUser.password_hash;
    delete safeUser.passwordHash;
    if (!canAccessTenant(req, user.tenant_id) || (!canManageUsers(req) && user.username !== String(req.auth?.username || req.auth?.sub || ''))) return forbidden(res);
    return res.status(200).json({ ok: true, data: safeUser });
  } catch (error) {
    errorLog(error, { scope: 'admin_users', action: 'get' });
    return res.status(500).json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao buscar usuário.' } });
  }
});

/**
 * POST /api/admin/users — create user
 */
router.post('/users', async (req, res) => {
  try {
    const { username, email, password, role, tenantId } = req.body || {};

    if (!canManageUsers(req)) return forbidden(res);

    const normalizedUsername = typeof username === 'string' ? username.trim() : '';
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!normalizedUsername || typeof password !== 'string' || password.length < 12 || password.length > 128) {
      return res.status(400).json({
        ok: false,
        error: { code: 'MISSING_FIELDS', message: 'Informe login e uma senha entre 12 e 128 caracteres.' },
      });
    }
    if (normalizedUsername.length > 80 || (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail))) return res.status(400).json({ ok: false, error: { code: 'INVALID_FIELDS', message: 'Login ou e-mail inválido.' } });

    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash(password, 12);

    const actorRole = roleOf(req);
    if (actorRole === 'admin' && role && role !== 'user') return forbidden(res);
    const assignedRole = actorRole === 'admin' ? 'user' : (role || 'user');
    if (!['user', 'admin', 'master', 'master_admin'].includes(assignedRole)) return res.status(400).json({ ok: false, error: { code: 'INVALID_ROLE', message: 'Papel de usuário inválido.' } });
    const assignedTenant = MASTER_ROLES.has(actorRole) && !req.adminCompanyContext ? (tenantId || req.authTenantId) : req.authTenantId;
    if (MASTER_ROLES.has(actorRole)) {
      const company = await require('../../infrastructure/config/database').query('SELECT id FROM companies WHERE id = $1', [assignedTenant]);
      if (!company.rowCount) return res.status(404).json({ ok: false, error: { code: 'COMPANY_NOT_FOUND', message: 'Empresa não encontrada.' } });
    }
    const user = await userRepository.createUser({
      username: normalizedUsername,
      email: normalizedEmail || null,
      passwordHash,
      role: assignedRole,
      tenantId: assignedTenant,
    });

    return res.status(201).json({ ok: true, data: user });
  } catch (error) {
    errorLog(error, { scope: 'admin_users', action: 'create' });
    return res.status(500).json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao criar usuário.' } });
  }
});

/**
 * PATCH /api/admin/users/:id — update user
 */
router.patch('/users/:id', async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId)) {
      return res.status(400).json({ ok: false, error: { code: 'INVALID_ID', message: 'ID inválido.' } });
    }

    const updates = {};
    const body = req.body || {};
    const target = await userRepository.getUserById(userId);
    if (!target) return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Usuário não encontrado.' } });
    const selfEmailOnly = target.username === String(req.auth?.username || req.auth?.sub || '') && Object.keys(body).every((key) => key === 'email');
    if (!canAccessTenant(req, target.tenant_id) || (!canManageUsers(req) && !selfEmailOnly)) return forbidden(res);
    if (roleOf(req) === 'admin' && target.role !== 'user') return forbidden(res);
    if (MASTER_ROLES.has(roleOf(req)) && req.adminCompanyContext && target.role !== 'user' && (updates.role !== undefined || body.blocked !== undefined || body.plan !== undefined || body.password !== undefined)) return forbidden(res);
    if (body.email !== undefined) updates.email = String(body.email).trim() || null;
    if (body.role !== undefined) updates.role = String(body.role).trim();
    if (updates.role && !['user', 'admin', 'master', 'master_admin'].includes(updates.role)) return res.status(400).json({ ok: false, error: { code: 'INVALID_ROLE', message: 'Papel de usuário inválido.' } });
    if (roleOf(req) === 'admin' && updates.role && updates.role !== 'user') return forbidden(res);
    if (body.blocked !== undefined) updates.blocked = Boolean(body.blocked);
    if (body.plan !== undefined) updates.plan = String(body.plan).trim();
    if (body.password !== undefined) {
      if (typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 128) return res.status(400).json({ ok: false, error: { code: 'INVALID_PASSWORD', message: 'A senha deve ter entre 12 e 128 caracteres.' } });
      const bcrypt = require('bcryptjs');
      updates.passwordHash = await bcrypt.hash(body.password, 12);
    }

    const updated = await userRepository.updateUser(userId, updates);
    if (!updated) {
      return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Usuário não encontrado.' } });
    }
    return res.status(200).json({ ok: true, data: updated });
  } catch (error) {
    errorLog(error, { scope: 'admin_users', action: 'update' });
    return res.status(500).json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao atualizar usuário.' } });
  }
});

/**
 * DELETE /api/admin/users/:id — soft delete user
 */
router.delete('/users/:id', async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId)) {
      return res.status(400).json({ ok: false, error: { code: 'INVALID_ID', message: 'ID inválido.' } });
    }

    const user = await userRepository.getUserById(userId);
    if (!user) {
      return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Usuário não encontrado.' } });
    }
    if (!canAccessTenant(req, user.tenant_id) || !canManageUsers(req)) return forbidden(res);
    if (roleOf(req) === 'admin' && user.role !== 'user') return forbidden(res);
    if (MASTER_ROLES.has(roleOf(req)) && req.adminCompanyContext && user.role !== 'user') return forbidden(res);
    if (user.role === 'master_admin') {
      return res.status(403).json({ ok: false, error: { code: 'FORBIDDEN', message: 'Não é possível excluir master_admin.' } });
    }

    const deleted = await userRepository.softDeleteUser(userId);
    return res.status(200).json({ ok: true, data: deleted });
  } catch (error) {
    errorLog(error, { scope: 'admin_users', action: 'delete' });
    return res.status(500).json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao excluir usuário.' } });
  }
});

/**
 * POST /api/admin/users/:id/invite — send invite
 */
router.post('/users/:id/invite', async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const user = await userRepository.getUserById(userId);
    if (!user) return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Usuário não encontrado.' } });
    if (!canManageUsers(req) || !canAccessTenant(req, user.tenant_id)) return forbidden(res);
    if (MASTER_ROLES.has(roleOf(req)) && req.adminCompanyContext && user.role !== 'user') return forbidden(res);
    return res.status(200).json({
      ok: true,
      data: { userId, invited: false, message: 'Envio de convite por e-mail não está habilitado.' },
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao enviar convite.' } });
  }
});

/**
 * PATCH /api/admin/users/:id/role — change user role
 */
router.patch('/users/:id/role', async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { role } = req.body || {};

    if (!role) {
      return res.status(400).json({ ok: false, error: { code: 'MISSING_ROLE', message: 'Campo role é obrigatório.' } });
    }
    if (!['user', 'admin', 'master', 'master_admin'].includes(String(role))) return res.status(400).json({ ok: false, error: { code: 'INVALID_ROLE', message: 'Papel de usuário inválido.' } });

    const target = await userRepository.getUserById(userId);
    if (!target) return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Usuário não encontrado.' } });
    if (!canManageUsers(req) || !canAccessTenant(req, target.tenant_id)) return forbidden(res);
    if (roleOf(req) === 'admin' && (target.role !== 'user' || role !== 'user')) return forbidden(res);
    if (MASTER_ROLES.has(roleOf(req)) && req.adminCompanyContext && (target.role !== 'user' || role !== 'user')) return forbidden(res);

    const updated = await userRepository.updateUser(userId, { role });
    if (!updated) {
      return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Usuário não encontrado.' } });
    }
    return res.status(200).json({ ok: true, data: updated });
  } catch (error) {
    errorLog(error, { scope: 'admin_users', action: 'role_change' });
    return res.status(500).json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Erro ao alterar role.' } });
  }
});

module.exports = router;
