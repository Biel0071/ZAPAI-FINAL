const fs = require('fs/promises');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ROOT = path.join(__dirname, '..');
const REPORTS_DIR = path.join(ROOT, 'reports');

function timestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function getPool() {
  const ssl = String(process.env.DB_SSL || '').trim().toLowerCase() === 'true' ? { rejectUnauthorized: false } : false;
  if (process.env.DATABASE_URL) {
    return new Pool({ connectionString: process.env.DATABASE_URL, ssl });
  }

  return new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'zapai_crm',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl,
  });
}

async function listTables(client) {
  const result = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name ASC
  `);
  return result.rows.map((row) => row.table_name);
}

async function tableStats(client, tableName) {
  const countResult = await client.query(`SELECT COUNT(*)::bigint AS total FROM ${tableName}`);
  const total = Number(countResult.rows?.[0]?.total || 0);

  const columnsResult = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
  `, [tableName]);

  return {
    table: tableName,
    rowCount: total,
    columns: columnsResult.rows,
  };
}

function classifyTable(tableName) {
  const name = String(tableName || '').toLowerCase();
  if (name.includes('temp') || name.includes('tmp')) return 'temp';
  if (name.includes('queue')) return 'queues';
  if (name.includes('metric')) return 'metrics';
  if (name.includes('analytic')) return 'analytics';
  if (name.includes('log')) return 'logs';
  if (name === 'sessions') return 'sessions';
  if (name === 'messages') return 'messages';
  if (name === 'contacts' || name === 'leads') return 'contacts';
  if (name === 'campaigns') return 'campaigns';
  if (name === 'users' || name.includes('profile')) return 'users';
  return 'other';
}

async function detectDemoData(client) {
  const checks = [];

  checks.push({
    name: 'sessions_dev_prefix',
    query: `SELECT COUNT(*)::int AS total FROM sessions WHERE session_id ILIKE 'dev-%' OR session_name ILIKE 'dev-%'`,
  });

  checks.push({
    name: 'campaigns_dev_prefix',
    query: `SELECT COUNT(*)::int AS total FROM campaigns WHERE id ILIKE 'dev-%' OR name ILIKE '%Campanha%'`,
  });

  checks.push({
    name: 'leads_seed_names',
    query: `SELECT COUNT(*)::int AS total FROM leads WHERE name IN ('João Silva','Maria Santos','Pedro Costa','Ana Oliveira','Carlos Ferreira')`,
  });

  checks.push({
    name: 'messages_seed_phrase',
    query: `SELECT COUNT(*)::int AS total FROM messages WHERE text ILIKE '%Estou interessado no produto%' OR text ILIKE '%Ótimo! Vou te enviar mais informações%'`,
  });

  const results = [];
  for (const check of checks) {
    try {
      const result = await client.query(check.query);
      results.push({ check: check.name, total: Number(result.rows?.[0]?.total || 0) });
    } catch (error) {
      results.push({ check: check.name, error: error.message });
    }
  }

  return results;
}

async function detectDuplicates(client) {
  const queries = [
    {
      check: 'sessions_duplicate_session_id',
      sql: `SELECT COUNT(*)::int AS total FROM (SELECT session_id, COUNT(*) c FROM sessions GROUP BY session_id HAVING COUNT(*) > 1) t`,
    },
    {
      check: 'leads_duplicate_company_phone',
      sql: `SELECT COUNT(*)::int AS total FROM (SELECT company_id, phone, COUNT(*) c FROM leads GROUP BY company_id, phone HAVING COUNT(*) > 1) t`,
    },
    {
      check: 'messages_duplicate_signature',
      sql: `SELECT COUNT(*)::int AS total FROM (
              SELECT conversation_id, COALESCE(text,''), COALESCE(created_at::text,''), COUNT(*) c
              FROM messages
              GROUP BY conversation_id, COALESCE(text,''), COALESCE(created_at::text,'')
              HAVING COUNT(*) > 1
            ) t`,
    },
  ];

  const results = [];
  for (const item of queries) {
    try {
      const result = await client.query(item.sql);
      results.push({ check: item.check, total: Number(result.rows?.[0]?.total || 0) });
    } catch (error) {
      results.push({ check: item.check, error: error.message });
    }
  }
  return results;
}

async function detectUnusedOrEmpty(tables) {
  const emptyTables = tables.filter((table) => table.rowCount === 0).map((table) => table.table);
  const suspicious = tables
    .filter((table) => table.rowCount === 0 && ['temp', 'logs', 'analytics', 'metrics', 'queues'].includes(classifyTable(table.table)))
    .map((table) => table.table);

  return { emptyTables, suspiciousEmptyTables: suspicious };
}

async function main() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await fs.mkdir(REPORTS_DIR, { recursive: true });

    const tableNames = await listTables(client);
    const tableDetails = [];
    for (const tableName of tableNames) {
      tableDetails.push(await tableStats(client, tableName));
    }

    const demoData = await detectDemoData(client);
    const duplicates = await detectDuplicates(client);
    const empties = await detectUnusedOrEmpty(tableDetails);

    const grouped = tableDetails.reduce((acc, item) => {
      const group = classifyTable(item.table);
      if (!acc[group]) acc[group] = [];
      acc[group].push({ table: item.table, rowCount: item.rowCount });
      return acc;
    }, {});

    const report = {
      generatedAt: new Date().toISOString(),
      database: process.env.DB_NAME || 'zapai_crm',
      tableCount: tableDetails.length,
      groupedTables: grouped,
      tables: tableDetails,
      findings: {
        demoData,
        duplicates,
        empty: empties,
      },
      safeCleanupPolicy: {
        preserve: ['real users', 'connected whatsapp sessions', 'valid auth tokens', 'real messages'],
        removeCandidates: ['demo seeds', 'fake metrics', 'old useless logs', 'duplicate records'],
      },
    };

    const filePath = path.join(REPORTS_DIR, `production-audit-${timestamp()}.json`);
    await fs.writeFile(filePath, JSON.stringify(report, null, 2), 'utf8');

    console.log(JSON.stringify({
      status: 'ok',
      reportFile: filePath,
      tableCount: tableDetails.length,
    }, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Failed to run production audit:', error?.message || error);
  process.exit(1);
});
