const { Pool } = require('pg');
const { runMigrations } = require('../services/migrationRunner');

function shouldUseSsl() {
  if (process.env.PGSSLMODE === 'disable') {
    return false;
  }

  return process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false;
}

function getNumericSetting(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getPoolConfig() {
  const sharedConfig = {
    connectionTimeoutMillis: getNumericSetting(process.env.DB_CONNECTION_TIMEOUT_MS, 5000),
    idleTimeoutMillis: getNumericSetting(process.env.DB_IDLE_TIMEOUT_MS, 10000),
    max: getNumericSetting(process.env.DB_POOL_MAX, 10),
    query_timeout: getNumericSetting(process.env.DB_QUERY_TIMEOUT_MS, 5000),
    statement_timeout: getNumericSetting(process.env.DB_STATEMENT_TIMEOUT_MS, 5000),
  };

  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: shouldUseSsl(),
      ...sharedConfig,
    };
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'zapai_crm',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
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

async function query(text, params = []) {
  return pool.query(text, params);
}

async function initDatabase(options = {}) {
  const shouldRunMigrations = options.runMigrations === true;

  if (!shouldRunMigrations) {
    await pool.query('SELECT 1');
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
