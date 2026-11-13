'use strict';

const { query } = require('../../infrastructure/config/database');
const statusCache = new Map();
const STATUS_CACHE_TTL_MS = 15_000;

function clearCompanyStatusCache(companyId) {
  statusCache.delete(String(companyId));
}

async function companyStatus(req, res, next) {
  const role = String(req.auth?.role || '').toLowerCase();
  if (role === 'master' || role === 'master_admin') return next();
  try {
    const companyId = String(req.authTenantId || '');
    const cached = statusCache.get(companyId);
    let status;
    if (cached && cached.expiresAt > Date.now()) status = cached.status;
    else {
      const result = await query('SELECT status FROM companies WHERE id = $1', [companyId]);
      status = result.rowCount ? result.rows[0].status : null;
      statusCache.set(companyId, { status, expiresAt: Date.now() + STATUS_CACHE_TTL_MS });
    }
    // Companies not yet imported into the registry retain the current legacy flow.
    if (!status || status === 'active') return next();
    return res.status(403).json({ error: 'O acesso desta empresa está suspenso.', code: 'COMPANY_INACTIVE' });
  } catch (error) {
    console.error('[COMPANY] Status lookup failed:', error.message);
    return res.status(503).json({ error: 'Não foi possível validar o status da empresa.' });
  }
}

module.exports = { companyStatus, clearCompanyStatusCache };
