'use strict';

const { query } = require('../../infrastructure/config/database');

async function adminCompanyContext(req, res, next) {
  const companyId = String(req.headers['x-admin-company-context'] || '').trim();
  if (!companyId) return next();
  const role = String(req.auth?.role || '').toLowerCase();
  if (role !== 'master' && role !== 'master_admin') return res.status(403).json({ error: 'Somente master pode selecionar uma empresa.' });
  try {
    const result = await query('SELECT id FROM companies WHERE id = $1 AND status = $2', [companyId, 'active']);
    if (!result.rowCount) return res.status(404).json({ error: 'Empresa não encontrada ou inativa.' });
    req.adminCompanyContext = companyId;
    req.authTenantId = companyId;
    return next();
  } catch (error) {
    console.error('[AUTH] Company context lookup failed:', error.message);
    return res.status(503).json({ error: 'Não foi possível validar a empresa selecionada.' });
  }
}

module.exports = { adminCompanyContext };
