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
  const headerTenant = resolveTenantHeader(req);
  const queryTenant = req.query?.tenantId || req.query?.companyId;
  const bodyTenant = req.body?.tenantId || req.body?.companyId;

  return String(
    authTenant || headerTenant || queryTenant || bodyTenant ||
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
    path === '/api' ||
    path.startsWith('/system') ||
    path.startsWith('/api/system')
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
