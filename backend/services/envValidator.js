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
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';

  // ─── Required Variables ───
  const required = [
    { key: 'PORT', fallback: '3000' },
    { key: 'DATABASE_URL', critical: true },
    { key: 'JWT_SECRET', critical: true, minLength: 16 },
    { key: 'ENCRYPTION_KEY', critical: true, minLength: 16 },
  ];

  if (isProduction) {
    required.push({ key: 'PUBLIC_URL', critical: true });
    required.push({ key: 'REDIS_URL', critical: true });
  }

  for (const { key, critical, fallback, minLength } of required) {
    const value = String(process.env[key] || '').trim();
    if (!value && !fallback) {
      const msg = `Missing required environment variable: ${key}`;
      if (critical) errors.push(msg);
      else warnings.push(msg);
    }
    if (minLength && value.length > 0 && value.length < minLength) {
      const msg = `${key} is too short (${value.length} chars, recommended >= ${minLength})`;
      if (isProduction && critical) {
        errors.push(`${key} must be >= ${minLength} characters in production`);
      } else {
        warnings.push(msg);
      }
    }
  }

  // ─── Recommended Variables ───
  const recommended = [
    'DEFAULT_COMPANY_ID',
    'NODE_ENV',
    'CORS_ORIGIN',
  ];

  if (!isProduction) {
    recommended.push('REDIS_URL');
  }

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

  // ─── Forbidden Default Secrets Check ───
  const forbiddenSecrets = [
    'your-secret-key',
    'dev_jwt_secret_change_me',
    'zapadmin_secret_key_123456789',
    'ZAPFLOW_SECURE_SALT_KEY_2026'
  ];

  const jwtSecret = process.env.JWT_SECRET || '';
  if (jwtSecret && forbiddenSecrets.includes(jwtSecret)) {
    errors.push('JWT_SECRET is using a default placeholder/development key — change it for production');
  }

  const encKey = process.env.ENCRYPTION_KEY || '';
  if (encKey && forbiddenSecrets.includes(encKey)) {
    errors.push('ENCRYPTION_KEY is using a default placeholder/development key — change it for production');
  }

  // ─── Node Environment ───
  if (isProduction) {
    if (!process.env.CORS_ORIGIN) {
      warnings.push('CORS_ORIGIN not set in production — will use permissive CORS');
    }
    if (jwtSecret.length < 32) {
      errors.push('JWT_SECRET must be >= 32 characters in production');
    }
    if (encKey.length < 32) {
      errors.push('ENCRYPTION_KEY must be >= 32 characters in production');
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
