function parseBoolean(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }

  return fallback;
}

function parseOrigins(rawValue = '') {
  return String(rawValue || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function parseNodeRole() {
  const explicitRole = String(process.env.NODE_ROLE || '').trim().toLowerCase();
  if (explicitRole === 'master' || explicitRole === 'node') {
    return explicitRole;
  }

  const masterFlag = String(process.env.MASTER || '').trim().toLowerCase() === 'true';
  return masterFlag ? 'master' : 'node';
}

function loadRuntimeEnv() {
  const nodeEnv = String(process.env.NODE_ENV || 'development').toLowerCase();
  const isProduction = nodeEnv === 'production';
  const nodeRole = parseNodeRole();
  const isMaster = nodeRole === 'master';
  const port = Number(process.env.PORT || process.env.APP_PORT) || 4025;
  const frontendUrl = String(process.env.FRONTEND_URL || '').trim();
  const allowedOriginsFromEnv = parseOrigins(process.env.CORS_ALLOWED_ORIGINS || '');
  const runMigrationsOnBoot = parseBoolean(process.env.DB_RUN_MIGRATIONS_ON_BOOT, false);
  const enableAdminMasterRoutes = parseBoolean(process.env.FEATURE_ADMIN_MASTER, isMaster);
  const enableNodeRegistrationServer = parseBoolean(process.env.FEATURE_NODE_MASTER_API, isMaster);
  const enableNodeAutoRegisterClient = parseBoolean(process.env.FEATURE_NODE_AUTO_REGISTER, !isMaster);

  return {
    allowedOriginsFromEnv,
    enableAdminMasterRoutes,
    enableNodeAutoRegisterClient,
    enableNodeRegistrationServer,
    frontendUrl,
    isMaster,
    isProduction,
    nodeRole,
    nodeEnv,
    port,
    runMigrationsOnBoot,
  };
}

function logRuntimeWarnings(runtimeEnv) {
  if (!runtimeEnv.isProduction) {
    return;
  }

  if (!process.env.JWT_SECRET && !process.env.AUTH_JWT_SECRET) {
    console.warn('[ENV] JWT secret is not configured for production.');
  }

  if (!process.env.AUTH_DEFAULT_USERNAME || !process.env.AUTH_DEFAULT_PASSWORD) {
    console.warn('[ENV] Authentication credentials are not configured for production.');
  }

  if (!process.env.DATABASE_URL && !process.env.DB_HOST) {
    console.warn('[ENV] Database connection variables are not configured for production.');
  }

  if (!process.env.DEFAULT_COMPANY_ID) {
    console.warn('[ENV] DEFAULT_COMPANY_ID not defined. Using fallback tenant "default".');
  }
}

module.exports = {
  loadRuntimeEnv,
  logRuntimeWarnings,
  parseOrigins,
};
