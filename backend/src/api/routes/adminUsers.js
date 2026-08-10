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

/**
 * GET /api/admin/users — list users
 */
router.get('/users', async (req, res) => {
  try {
    const users = await userRepository.listUsers({ includeDeleted: false });
    return res.status(200).json(safeEnvelope(users));
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
    return res.status(200).json({ ok: true, data: user });
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

    if (!username || !password) {
      return res.status(400).json({
        ok: false,
        error: { code: 'MISSING_FIELDS', message: 'Campos obrigatórios: username, password' },
      });
    }

    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await userRepository.createUser({
      username,
      email: email || null,
      passwordHash,
      role: role || 'user',
      tenantId: tenantId || req.auth?.tenantId || process.env.DEFAULT_COMPANY_ID || 'default',
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
    if (body.email !== undefined) updates.email = String(body.email).trim() || null;
    if (body.role !== undefined) updates.role = String(body.role).trim();
    if (body.blocked !== undefined) updates.blocked = Boolean(body.blocked);
    if (body.plan !== undefined) updates.plan = String(body.plan).trim();
    if (body.password !== undefined) {
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
    // Invite logic placeholder — returns success for now
    return res.status(200).json({
      ok: true,
      data: { userId, invited: true, message: 'Convite registrado. Implementação de email pendente.' },
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
