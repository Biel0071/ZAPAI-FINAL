function resolveTenantHeader(req) {
  return String(req?.headers?.['x-tenant-id'] || req?.headers?.['x-company-id'] || '').trim();
}

function resolveTenantIdFromRequest(req) {
  const authTenant = req?.authTenantId || req?.auth?.tenantId || req?.auth?.companyId;
  const headerTenant = resolveTenantHeader(req);
  const queryTenant = req.query?.tenantId || req.query?.companyId;
  const bodyTenant = req.body?.tenantId || req.body?.companyId;

  return String(authTenant || headerTenant || queryTenant || bodyTenant || process.env.DEFAULT_COMPANY_ID || 'default').trim();
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
    path.startsWith('/system') ||
    path.startsWith('/api/system') ||
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

  if (strictHeader && !shouldSkipTenantValidation(req) && !headerTenant && !req?.authTenantId) {
    return res.status(400).json({
      error: 'x-tenant-id or x-company-id header is required.',
    });
  }

  req.tenantId = resolveTenantIdFromRequest(req);
  req.companyId = req.tenantId;
  next();
}

function getCompanyId(req, fallback) {
  return String(req?.tenantId || req?.companyId || fallback || process.env.DEFAULT_COMPANY_ID || 'default').trim();
}

module.exports = {
  getCompanyId,
  resolveTenantIdFromRequest,
  tenantContextMiddleware,
};
