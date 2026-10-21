/**
 * Tenant Context Middleware
 *
 * Resolves the tenant/company ID from multiple sources (JWT, header, query, body, env default).
 * In production with DEFAULT_COMPANY_ID set, requests without an explicit header
 * are allowed and fall back to DEFAULT_COMPANY_ID — never returns 400 in this case.
 */

function resolveTenantHeader(req) {
  return String(req?.headers?.['x-tenant-id'] || req?.headers?.['x-company-id'] || '').trim();
}

function resolveTenantIdFromRequest(req) {
  const authTenant = req?.authTenantId || req?.auth?.tenantId || req?.auth?.companyId;
  // Security shield: if request has authenticated JWT tenant, enforce it strictly.
  // Attackers in Burp cannot spoof another tenant by injecting headers or query/body params.
  if (authTenant) {
    return String(authTenant).trim();
  }

  const headerTenant = resolveTenantHeader(req);
  const queryTenant = req.query?.tenantId || req.query?.companyId;
  const bodyTenant = req.body?.tenantId || req.body?.companyId;

  return String(
    headerTenant || queryTenant || bodyTenant ||
    process.env.DEFAULT_COMPANY_ID || 'default'
  ).trim();
}

function shouldSkipTenantValidation(req) {
  const path = String(req?.path || req?.originalUrl || '').toLowerCase();

  return (
    path === '/health' ||
    path === '/api/health' ||
    path.startsWith('/diagnostics') ||
    path.startsWith('/api/diagnostics') ||
    path.startsWith('/auth/login') ||
    path.startsWith('/api/auth/login') ||
    path.startsWith('/auth/forgot-password') ||
    path.startsWith('/api/auth/forgot-password') ||
    path === '/api' ||
    path.startsWith('/api/master/register-node') ||
    path.startsWith('/api/master/heartbeat') ||
    path.startsWith('/api/cluster/metrics/ingest')
  );
}

function isStrictTenantHeaderRequired() {
  const configured = String(process.env.REQUIRE_TENANT_HEADER || '').trim();

  if (!configured) {
    return String(process.env.NODE_ENV || 'development').toLowerCase() === 'production';
  }

  return configured.toLowerCase() !== 'false';
}

function tenantContextMiddleware(req, res, next) {
  const strictHeader = isStrictTenantHeaderRequired();
  const headerTenant = resolveTenantHeader(req);
  const defaultCompanyId = String(process.env.DEFAULT_COMPANY_ID || '').trim();

  // Shield against Burp Suite IDOR / Cross-Tenant snooping:
  if (req?.authTenantId && headerTenant && headerTenant !== req.authTenantId) {
    const isMaster = req?.auth?.role === 'master_admin' || req?.auth?.role === 'master';
    if (!isMaster) {
      return res.status(403).json({
        error: 'Acesso negado: tentativa de manipulação de tenant interceptada.',
      });
    }
  }

  // Only block if: strict mode ON, no header, no JWT tenant, AND no DEFAULT_COMPANY_ID configured.
  // If DEFAULT_COMPANY_ID is set (always in production), use it as fallback — never 400.
  if (
    strictHeader &&
    !shouldSkipTenantValidation(req) &&
    !headerTenant &&
    !req?.authTenantId &&
    !defaultCompanyId
  ) {
    return res.status(400).json({
      error: 'x-tenant-id or x-company-id header is required.',
    });
  }

  req.tenantId = resolveTenantIdFromRequest(req);
  req.companyId = req.tenantId;
  next();
}

function getCompanyId(req, fallback) {
  return String(
    req?.tenantId || req?.companyId || fallback ||
    process.env.DEFAULT_COMPANY_ID || 'default'
  ).trim();
}

module.exports = {
  getCompanyId,
  resolveTenantIdFromRequest,
  tenantContextMiddleware,
};
