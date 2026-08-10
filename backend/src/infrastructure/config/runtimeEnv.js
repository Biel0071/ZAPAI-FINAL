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
  // APP_PUBLIC_URL is the single source of truth for production CORS.
  const appPublicUrl = String(process.env.APP_PUBLIC_URL || '').trim();
  const allowedOriginsFromEnv = parseOrigins(process.env.CORS_ALLOWED_ORIGINS || '');
  const allowedOriginsExtra = parseOrigins(process.env.ALLOWED_ORIGINS || '');
  const runMigrationsOnBoot = parseBoolean(process.env.DB_RUN_MIGRATIONS_ON_BOOT, false);
  const enableAdminMasterRoutes = parseBoolean(process.env.FEATURE_ADMIN_MASTER, isMaster);
  const enableNodeRegistrationServer = parseBoolean(process.env.FEATURE_NODE_MASTER_API, isMaster);
  const enableNodeAutoRegisterClient = parseBoolean(process.env.FEATURE_NODE_AUTO_REGISTER, !isMaster);

  return {
    allowedOriginsFromEnv: [...allowedOriginsFromEnv, ...allowedOriginsExtra],
    appPublicUrl,
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

function hasDatabaseConfig() {
  if (String(process.env.DATABASE_URL || '').trim()) {
    return true;
  }

  const host = String(process.env.DB_HOST || process.env.POSTGRES_HOST || '').trim();
  const database = String(process.env.DB_NAME || process.env.POSTGRES_DB || '').trim();
  const user = String(process.env.DB_USER || process.env.POSTGRES_USER || '').trim();
  return Boolean(host && database && user);
}

function hasValidFrontendUrl() {
  const rawValue = String(process.env.FRONTEND_URL || '').trim();
  if (!rawValue) {
    return false;
  }

  try {
    const parsed = new URL(rawValue);
    return Boolean(parsed.protocol && parsed.host);
  } catch {
    return false;
  }
}

function logRuntimeWarnings(runtimeEnv) {
  if (!runtimeEnv.isProduction) {
    return;
  }

  const fatalErrors = [];

  if (!process.env.JWT_SECRET && !process.env.AUTH_JWT_SECRET) {
    fatalErrors.push('JWT secret is not configured for production.');
  }

  if (!hasDatabaseConfig()) {
    fatalErrors.push('Database connection variables are not configured for production.');
  }

  if (fatalErrors.length > 0) {
    for (const error of fatalErrors) {
      console.error(`[ENV] ${error}`);
    }
    throw new Error(`Production environment configuration invalid: ${fatalErrors.join(' ')}`);
  }

  if (!process.env.AUTH_DEFAULT_USERNAME || !process.env.AUTH_DEFAULT_PASSWORD) {
    console.warn('[ENV] Authentication credentials are not configured for production.');
  }

  if (!process.env.DEFAULT_COMPANY_ID) {
    console.warn('[ENV] DEFAULT_COMPANY_ID not defined. Using fallback tenant "default".');
  }

  if (process.env.EMAIL_PROVIDER && !hasValidFrontendUrl()) {
    console.warn('[ENV] FRONTEND_URL is missing or invalid. Password recovery links will be disabled.');
  }
}

module.exports = {
  loadRuntimeEnv,
  logRuntimeWarnings,
  parseOrigins,
};
