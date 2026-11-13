'use strict';

const { query } = require('../../infrastructure/config/database');

const MODULE_PATHS = [
  { module: 'inbox', pattern: /\/(?:api\/)?(?:conversations|messages|send-message|send-media)(?:\/|$)/ },
  { module: 'contacts', pattern: /\/(?:api\/)?(?:contacts|leads)(?:\/|$)/ },
  { module: 'campaigns', pattern: /\/(?:api\/)?(?:campaigns|flows|automation)(?:\/|$)/ },
];

function getModule(path) {
  return MODULE_PATHS.find(({ pattern }) => pattern.test(path))?.module || null;
}

async function companyEntitlements(req, res, next) {
  try {
    const path = String(req.originalUrl || req.path || '').split('?')[0];
    let moduleName = getModule(path);
    const isSessionCreate = req.method === 'POST' && /\/(?:api\/)?(?:sessions?|whatsapp\/sessions)(?:\/(?:create|start))?\/?$/.test(path);
    if (!moduleName && !isSessionCreate) return next();
    if (isSessionCreate && !moduleName) moduleName = 'inbox';

    const tenantId = String(req.authTenantId || '');
    if (!tenantId) return res.status(403).json({ error: 'Empresa não identificada.' });

    const companyResult = await query(`SELECT c.legacy_access, l.id AS license_id, l.modules, l.number_limit,
        u.id AS user_id, ump.enabled AS user_module_enabled
      FROM companies c
      LEFT JOIN LATERAL (
        SELECT active_license.id, p.modules, p.number_limit FROM company_licenses active_license
        JOIN license_plans p ON p.id = active_license.plan_id
        WHERE active_license.company_id = c.id AND active_license.redeemed_at IS NOT NULL
          AND active_license.revoked_at IS NULL AND (active_license.expires_at IS NULL OR active_license.expires_at > NOW())
          AND p.active = true AND c.legacy_access = false
        ORDER BY active_license.redeemed_at DESC LIMIT 1
      ) l ON true
      LEFT JOIN users u ON u.username = $2 AND u.tenant_id = c.id AND u.deleted_at IS NULL
      LEFT JOIN user_module_permissions ump ON ump.user_id = u.id AND ump.module = $3
      WHERE c.id = $1`, [tenantId, req.auth?.username || req.auth?.sub || '', moduleName || 'inbox']);
    // Tenants that predate the canonical company registry retain access until migrated.
    if (!companyResult.rowCount) return next();
    const legacyAccess = companyResult.rows[0].legacy_access;

    let license = null;
    if (!legacyAccess) {
      if (!companyResult.rows[0].license_id) return res.status(403).json({ error: 'A empresa ainda não possui licença ativa.' });
      license = companyResult.rows[0];
    }

    if (moduleName) {
      const modules = Array.isArray(license?.modules) ? license.modules : [];
      if (!legacyAccess && !modules.includes(moduleName)) return res.status(403).json({ error: 'Este recurso não está incluído na licença da empresa.', code: 'MODULE_NOT_LICENSED' });
      if (!legacyAccess && !companyResult.rows[0].user_id) return res.status(403).json({ error: 'Usuário não está ativo nesta empresa.', code: 'USER_NOT_IN_COMPANY' });
      if (companyResult.rows[0].user_module_enabled === false) return res.status(403).json({ error: 'Seu usuário não possui acesso a este recurso.', code: 'USER_MODULE_DISABLED' });
    }

    if (isSessionCreate) {
      if (legacyAccess) return next();
      if (!Array.isArray(license?.modules) || !license.modules.includes('inbox')) return res.status(403).json({ error: 'Inbox/chat não está incluído na licença.', code: 'MODULE_NOT_LICENSED' });
      if (!Number(license.number_limit)) return res.status(403).json({ error: 'A licença não permite números WhatsApp.', code: 'NUMBER_LIMIT_REACHED' });
      const requestedSessionId = String(req.body?.sessionId || req.body?.sessionName || 'main').trim().replace(/\s+/g, '_').toLowerCase();
      const existingSession = await query("SELECT 1 FROM sessions WHERE company_id = $1 AND session_id = $2 AND COALESCE(status, '') <> 'deleted' LIMIT 1", [tenantId, requestedSessionId]);
      if (existingSession.rowCount) return next();
      const sessionCount = await query("SELECT COUNT(*)::int AS count FROM sessions WHERE company_id = $1 AND COALESCE(status, '') <> 'deleted'", [tenantId]);
      if (Number(sessionCount.rows[0]?.count || 0) >= Number(license.number_limit)) {
        return res.status(403).json({ error: 'Limite de números da licença atingido.', code: 'NUMBER_LIMIT_REACHED' });
      }
    }
    return next();
  } catch (error) {
    console.error('[ENTITLEMENTS] Failed to validate company access:', error.message);
    return res.status(503).json({ error: 'Não foi possível validar a licença da empresa.' });
  }
}

module.exports = { companyEntitlements, getModule };
