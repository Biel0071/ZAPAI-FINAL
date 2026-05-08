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

function cleanupEnabled() {
  return String(process.env.ALLOW_PRODUCTION_CLEANUP || '').trim().toLowerCase() === 'true';
}

async function executeCleanup(client, dryRun = true) {
  const actions = [];

  const plans = [
    {
      name: 'delete_demo_sessions',
      where: `session_id ILIKE 'dev-%' OR session_name ILIKE 'dev-%'`,
      deleteSql: `DELETE FROM sessions WHERE session_id ILIKE 'dev-%' OR session_name ILIKE 'dev-%'`,
      countSql: `SELECT COUNT(*)::int AS total FROM sessions WHERE session_id ILIKE 'dev-%' OR session_name ILIKE 'dev-%'`,
    },
    {
      name: 'delete_demo_campaigns',
      where: `id ILIKE 'dev-%'`,
      deleteSql: `DELETE FROM campaigns WHERE id ILIKE 'dev-%'`,
      countSql: `SELECT COUNT(*)::int AS total FROM campaigns WHERE id ILIKE 'dev-%'`,
    },
    {
      name: 'delete_seed_leads',
      where: `name IN ('João Silva','Maria Santos','Pedro Costa','Ana Oliveira','Carlos Ferreira')`,
      deleteSql: `DELETE FROM leads WHERE name IN ('João Silva','Maria Santos','Pedro Costa','Ana Oliveira','Carlos Ferreira')`,
      countSql: `SELECT COUNT(*)::int AS total FROM leads WHERE name IN ('João Silva','Maria Santos','Pedro Costa','Ana Oliveira','Carlos Ferreira')`,
    },
    {
      name: 'delete_seed_messages',
      where: `text ILIKE '%Estou interessado no produto%' OR text ILIKE '%Ótimo! Vou te enviar mais informações%'`,
      deleteSql: `DELETE FROM messages WHERE text ILIKE '%Estou interessado no produto%' OR text ILIKE '%Ótimo! Vou te enviar mais informações%'`,
      countSql: `SELECT COUNT(*)::int AS total FROM messages WHERE text ILIKE '%Estou interessado no produto%' OR text ILIKE '%Ótimo! Vou te enviar mais informações%'`,
    },
  ];

  for (const plan of plans) {
    const countResult = await client.query(plan.countSql);
    const total = Number(countResult.rows?.[0]?.total || 0);
    const entry = { action: plan.name, affected: total, mode: dryRun ? 'dry_run' : 'execute' };
    if (!dryRun && total > 0) {
      await client.query(plan.deleteSql);
    }
    actions.push(entry);
  }

  return actions;
}

async function main() {
  await fs.mkdir(REPORTS_DIR, { recursive: true });

  const dryRun = !cleanupEnabled();
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const actions = await executeCleanup(client, dryRun);

    if (dryRun) {
      await client.query('ROLLBACK');
    } else {
      await client.query('COMMIT');
    }

    const report = {
      generatedAt: new Date().toISOString(),
      mode: dryRun ? 'dry_run' : 'executed',
      protectedPolicy: [
        'Never remove connected whatsapp sessions without explicit policy',
        'Never remove real users and valid auth tokens',
        'Never remove real message history by broad criteria',
      ],
      actions,
    };

    const filePath = path.join(REPORTS_DIR, `safe-cleanup-${timestamp()}.json`);
    await fs.writeFile(filePath, JSON.stringify(report, null, 2), 'utf8');

    console.log(JSON.stringify({
      status: 'ok',
      mode: report.mode,
      reportFile: filePath,
      actions,
    }, null, 2));
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback failure
    }
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Failed to run safe cleanup:', error?.message || error);
  process.exit(1);
});
