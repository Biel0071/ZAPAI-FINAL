const { Pool } = require('pg');
const { runMigrations } = require('../services/migrationRunner');
const { backendLog, errorLog } = require('../services/logger');

const SLOW_QUERY_THRESHOLD_MS = Math.max(50, Number(process.env.DB_SLOW_QUERY_MS || 500));

function shouldUseSsl() {
  // Explicit disable always wins
  if (process.env.PGSSLMODE === 'disable') {
    return false;
  }

  // Explicit enable: DB_SSL=true or PGSSLMODE=require
  const explicitEnable =
    String(process.env.DB_SSL || '').trim().toLowerCase() === 'true' ||
    String(process.env.PGSSLMODE || '').trim().toLowerCase() === 'require';

  if (explicitEnable) {
    return { rejectUnauthorized: false };
  }

  // Docker internal hosts never need SSL
  const hostFromUrl = (() => {
    try {
      return process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : '';
    } catch {
      return '';
    }
  })();

  const effectiveHost = String(hostFromUrl || process.env.POSTGRES_HOST || process.env.DB_HOST || '').trim().toLowerCase();
  const isLocalDockerHost = ['localhost', '127.0.0.1', 'postgres', 'db', ''].includes(effectiveHost);
  if (isLocalDockerHost) {
    return false;
  }

  // External host without explicit config: default to SSL off (safe for Docker)
  // Set DB_SSL=true if connecting to an external managed database
  console.log(`[DB] Host "${effectiveHost}" detected. SSL disabled by default. Set DB_SSL=true to enable.`);
  return false;
}

function getNumericSetting(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getPoolConfig() {
  const isProduction = String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';

  const sharedConfig = {
    connectionTimeoutMillis: getNumericSetting(process.env.DB_CONNECTION_TIMEOUT_MS, 8000),
    idleTimeoutMillis: getNumericSetting(process.env.DB_IDLE_TIMEOUT_MS, 30000),
    // Production: 20 connections (concurrent API + metrics + session ops)
    // Development: 5 (low resource)
    max: getNumericSetting(process.env.DB_POOL_MAX, isProduction ? 20 : 5),
    // 30s for reports/bulk queries, 5s in dev
    query_timeout: getNumericSetting(process.env.DB_QUERY_TIMEOUT_MS, isProduction ? 30000 : 5000),
    statement_timeout: getNumericSetting(process.env.DB_STATEMENT_TIMEOUT_MS, isProduction ? 30000 : 5000),
  };

  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: shouldUseSsl(),
      ...sharedConfig,
    };
  }

  return {
    host: process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.DB_PORT || process.env.POSTGRES_PORT) || 5432,
    database: process.env.DB_NAME || process.env.POSTGRES_DB || 'zapai_crm',
    user: process.env.DB_USER || process.env.POSTGRES_USER || 'zapai',
    password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || '',
    ssl: shouldUseSsl(),
    ...sharedConfig,
  };
}

const pool = new Pool(getPoolConfig());

pool
  .connect()
  .then((client) => {
    console.log('PostgreSQL connected');
    client.release();
  })
  .catch((err) => {
    console.warn('PostgreSQL connection warning:', err.message);
  });

function summarizeQuery(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

async function query(text, params = []) {
  const startedAt = Date.now();

  try {
    const result = await pool.query(text, params);
    const durationMs = Date.now() - startedAt;

    if (durationMs >= SLOW_QUERY_THRESHOLD_MS) {
      backendLog('warn', 'slow_db_query', {
        durationMs,
        paramsCount: Array.isArray(params) ? params.length : 0,
        query: summarizeQuery(text),
        scope: 'database',
        thresholdMs: SLOW_QUERY_THRESHOLD_MS,
      });
    }

    return result;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    errorLog(error, {
      durationMs,
      paramsCount: Array.isArray(params) ? params.length : 0,
      query: summarizeQuery(text),
      scope: 'database',
    });
    throw error;
  }
}

async function initDatabase(options = {}) {
  const shouldRunMigrations = options.runMigrations === true;

  if (!shouldRunMigrations) {
    await query('SELECT 1');
    return {
      mode: 'connectivity-check',
      migrated: false,
    };
  }

  const migrationResult = await runMigrations({ pool });
  return {
    mode: 'migration-runner',
    migrated: true,
    ...migrationResult,
  };
}

module.exports = {
  initDatabase,
  pool,
  query,
};
