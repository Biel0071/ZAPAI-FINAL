/**
 * Environment Validator — Production readiness checks.
 *
 * Validates all required environment variables, connection strings,
 * secret lengths, and configuration consistency at startup.
 * Logs warnings for optional but recommended settings.
 */

function validateEnvironment() {
  const errors = [];
  const warnings = [];

  // ─── Required Variables ───
  const required = [
    { key: 'PORT', fallback: '3000' },
    { key: 'DATABASE_URL', critical: true },
    { key: 'JWT_SECRET', critical: true, minLength: 16 },
  ];

  for (const { key, critical, fallback, minLength } of required) {
    const value = String(process.env[key] || '').trim();
    if (!value && !fallback) {
      const msg = `Missing required environment variable: ${key}`;
      if (critical) errors.push(msg);
      else warnings.push(msg);
    }
    if (minLength && value.length > 0 && value.length < minLength) {
      warnings.push(`${key} is too short (${value.length} chars, recommended >= ${minLength})`);
    }
  }

  // ─── Recommended Variables ───
  const recommended = [
    'REDIS_URL',
    'DEFAULT_COMPANY_ID',
    'NODE_ENV',
    'CORS_ORIGIN',
  ];

  for (const key of recommended) {
    if (!process.env[key]) {
      warnings.push(`Recommended variable not set: ${key}`);
    }
  }

  // ─── Database URL Format ───
  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl && !dbUrl.startsWith('postgres')) {
    errors.push('DATABASE_URL must be a PostgreSQL connection string');
  }

  // ─── JWT Secret Strength ───
  const jwtSecret = process.env.JWT_SECRET || '';
  if (jwtSecret && jwtSecret === 'your-secret-key') {
    errors.push('JWT_SECRET is using default placeholder — change it for production');
  }

  // ─── Node Environment ───
  const nodeEnv = process.env.NODE_ENV || 'development';
  if (nodeEnv === 'production') {
    if (!process.env.CORS_ORIGIN) {
      warnings.push('CORS_ORIGIN not set in production — will use permissive CORS');
    }
    if (jwtSecret.length < 32) {
      warnings.push('JWT_SECRET should be >= 32 chars in production');
    }
  }

  // ─── Log Results ───
  if (errors.length > 0) {
    console.error('═══════════════════════════════════════');
    console.error('[ENV] CRITICAL CONFIGURATION ERRORS:');
    for (const err of errors) {
      console.error(`  ✗ ${err}`);
    }
    console.error('═══════════════════════════════════════');
  }

  if (warnings.length > 0) {
    console.warn('[ENV] Configuration warnings:');
    for (const warn of warnings) {
      console.warn(`  ⚠ ${warn}`);
    }
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log('[ENV] All environment variables validated ✓');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    environment: nodeEnv,
  };
}

module.exports = { validateEnvironment };
