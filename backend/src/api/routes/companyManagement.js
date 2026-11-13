'use strict';

const crypto = require('crypto');
const express = require('express');
const { query, pool } = require('../../infrastructure/config/database');

const router = express.Router();
const masterRoles = new Set(['master', 'master_admin']);
const roleOf = (req) => String(req.auth?.role || '').toLowerCase();
const canManageCompany = (req) => (masterRoles.has(roleOf(req)) && (req.path === '/company/entitlements' || !req.adminCompanyContext)) || roleOf(req) === 'admin';

router.get('/company/entitlements', async (req, res) => {
  if (masterRoles.has(roleOf(req)) && !req.adminCompanyContext) return res.status(403).json({ error: 'Selecione uma empresa antes de consultar dados do tenant.' });
  try {
    const company = await query('SELECT id, name, responsible_name, status, legacy_access, zai_enabled FROM companies WHERE id = $1', [req.authTenantId]);
    if (!company.rowCount) return res.status(404).json({ error: 'Empresa não encontrada.' });
    const license = await query(`SELECT l.id, l.expires_at, p.name AS plan, p.modules, p.number_limit
      FROM company_licenses l JOIN license_plans p ON p.id = l.plan_id
      WHERE l.company_id = $1 AND l.redeemed_at IS NOT NULL AND l.revoked_at IS NULL
        AND (l.expires_at IS NULL OR l.expires_at > NOW()) AND p.active = true
      ORDER BY l.redeemed_at DESC LIMIT 1`, [req.authTenantId]);
    const legacy = company.rows[0].legacy_access;
    return res.json({ company: company.rows[0], legacyAccess: legacy, license: license.rows[0] || null,
      modules: legacy ? ['inbox', 'contacts', 'campaigns'] : (license.rows[0]?.modules || []),
      numberLimit: legacy ? null : (license.rows[0]?.number_limit ?? 0) });
  } catch (error) {
    console.error('[COMPANY] Failed to load entitlements:', error.message);
    return res.status(503).json({ error: 'Não foi possível carregar a licença da empresa.' });
  }
});

router.patch('/company', async (req, res) => {
  if (!canManageCompany(req)) return res.status(403).json({ error: 'Permissão administrativa necessária.' });
  const name = String(req.body?.name || '').trim();
  const responsibleName = String(req.body?.responsibleName || '').trim();
  if (!name || name.length > 200 || responsibleName.length > 160) return res.status(400).json({ error: 'Nome da empresa ou responsável inválido.' });
  try {
    const result = await query(`UPDATE companies SET name = $2, responsible_name = $3, updated_at = NOW()
      WHERE id = $1 RETURNING id, name, responsible_name, status`, [req.authTenantId, name, responsibleName || null]);
    if (!result.rowCount) return res.status(404).json({ error: 'Empresa não encontrada.' });
    return res.json({ company: result.rows[0] });
  } catch (error) {
    console.error('[COMPANY] Company profile update failed:', error.message);
    return res.status(503).json({ error: 'Não foi possível salvar os dados da empresa.' });
  }
});

router.post('/licenses/redeem', async (req, res) => {
  if (masterRoles.has(roleOf(req)) && !req.adminCompanyContext) return res.status(403).json({ error: 'Selecione uma empresa antes de resgatar licenças.' });
  if (!canManageCompany(req)) return res.status(403).json({ error: 'Somente administradores podem resgatar licenças.' });
  const token = String(req.body?.token || '').trim();
  if (token.length < 32) return res.status(400).json({ error: 'Token inválido.' });
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const license = await client.query(`SELECT id FROM company_licenses WHERE token_hash = $1 AND company_id = $2
      AND redeemed_at IS NULL AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW()) FOR UPDATE`, [tokenHash, req.authTenantId]);
    if (!license.rowCount) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Licença inválida, expirada, revogada ou destinada a outra empresa.' }); }
    await client.query('UPDATE company_licenses SET redeemed_at = NOW() WHERE id = $1', [license.rows[0].id]);
    await client.query('UPDATE companies SET legacy_access = false, updated_at = NOW() WHERE id = $1', [req.authTenantId]);
    await client.query('COMMIT');
    return res.json({ redeemed: true, licenseId: license.rows[0].id });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('[COMPANY] License redemption failed:', error.message);
    return res.status(500).json({ error: 'Não foi possível resgatar a licença.' });
  } finally { if (client) client.release(); }
});

router.get('/company/users/:id/modules', async (req, res) => {
  if (!canManageCompany(req)) return res.status(403).json({ error: 'Permissão administrativa necessária.' });
  if (masterRoles.has(roleOf(req)) && !req.adminCompanyContext) return res.status(403).json({ error: 'Selecione uma empresa antes de consultar usuários.' });
  const userId = Number(req.params.id);
  try {
    const user = await query('SELECT tenant_id FROM users WHERE id = $1 AND deleted_at IS NULL', [userId]);
    if (!user.rowCount || (req.adminCompanyContext ? user.rows[0].tenant_id !== req.adminCompanyContext : (!masterRoles.has(roleOf(req)) && user.rows[0].tenant_id !== req.authTenantId))) return res.status(404).json({ error: 'Usuário não encontrado nesta empresa.' });
    const permissions = await query('SELECT module, enabled FROM user_module_permissions WHERE user_id = $1', [userId]);
    return res.json({ userId, permissions: permissions.rows });
  } catch (error) {
    console.error('[COMPANY] Module permission lookup failed:', error.message);
    return res.status(503).json({ error: 'Não foi possível consultar permissões.' });
  }
});

router.get('/company/users/modules', async (req, res) => {
  if (!canManageCompany(req)) return res.status(403).json({ error: 'Permissão administrativa necessária.' });
  if (masterRoles.has(roleOf(req)) && !req.adminCompanyContext) return res.status(403).json({ error: 'Selecione uma empresa antes de consultar usuários.' });
  try {
    const result = await query(`SELECT u.id AS user_id, p.module, p.enabled FROM users u
      JOIN user_module_permissions p ON p.user_id = u.id
      WHERE u.tenant_id = $1 AND u.deleted_at IS NULL`, [req.authTenantId]);
    return res.json({ permissions: result.rows });
  } catch (error) {
    console.error('[COMPANY] Module permission listing failed:', error.message);
    return res.status(503).json({ error: 'Não foi possível consultar permissões.' });
  }
});

router.put('/company/users/:id/modules/:module', async (req, res) => {
  if (!canManageCompany(req)) return res.status(403).json({ error: 'Permissão administrativa necessária.' });
  if (masterRoles.has(roleOf(req)) && !req.adminCompanyContext) return res.status(403).json({ error: 'Selecione uma empresa antes de alterar usuários.' });
  const module = String(req.params.module);
  const enabled = req.body?.enabled;
  if (!['inbox', 'contacts', 'campaigns'].includes(module) || typeof enabled !== 'boolean') return res.status(400).json({ error: 'Módulo ou estado inválido.' });
  const userId = Number(req.params.id);
  try {
    const user = await query('SELECT tenant_id FROM users WHERE id = $1 AND deleted_at IS NULL', [userId]);
    if (!user.rowCount || (req.adminCompanyContext ? user.rows[0].tenant_id !== req.adminCompanyContext : (!masterRoles.has(roleOf(req)) && user.rows[0].tenant_id !== req.authTenantId))) return res.status(404).json({ error: 'Usuário não encontrado nesta empresa.' });
    await query(`INSERT INTO user_module_permissions (user_id, module, enabled, updated_by) VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, module) DO UPDATE SET enabled = EXCLUDED.enabled, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
    [userId, module, enabled, req.auth?.username || req.auth?.sub || 'admin']);
    return res.json({ userId, module, enabled });
  } catch (error) {
    console.error('[COMPANY] Module permission update failed:', error.message);
    return res.status(503).json({ error: 'Não foi possível salvar a permissão.' });
  }
});

module.exports = router;
