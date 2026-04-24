const fs = require('fs/promises');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const ROOT = path.join(__dirname, '..');
const SESSIONS_DIR = path.join(ROOT, 'sessions');
const BACKUP_ROOT = path.join(ROOT, 'backups');

function timestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function getPool() {
  if (process.env.DATABASE_URL) {
    return new Pool({ connectionString: process.env.DATABASE_URL });
  }

  return new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'zapai_crm',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });
}

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function copyDirRecursive(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDirRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function exportDbSnapshot(outputDir) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const [sessions, stats] = await Promise.all([
      client.query(`
        SELECT id, company_id, session_id, session_name, status, phone_number, created_at
        FROM sessions
        ORDER BY created_at DESC
      `),
      client.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE lower(coalesce(status, '')) = 'connected')::int AS connected,
          COUNT(*) FILTER (WHERE lower(coalesce(status, '')) IN ('connecting','qr','qr_ready'))::int AS pending
        FROM sessions
      `),
    ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      stats: stats.rows[0] || { total: 0, connected: 0, pending: 0 },
      sessions: sessions.rows,
    };

    const outFile = path.join(outputDir, 'sessions-db-snapshot.json');
    await fs.writeFile(outFile, JSON.stringify(payload, null, 2), 'utf8');
    return { outFile, stats: payload.stats };
  } finally {
    client.release();
    await pool.end();
  }
}

async function validateReconnectReadiness(outputDir) {
  const checks = [];

  const sessionsExists = await pathExists(SESSIONS_DIR);
  checks.push({ check: 'sessions_folder_exists', ok: sessionsExists, value: SESSIONS_DIR });

  const stableSessionPath = path.join(ROOT, 'services', 'whatsapp', 'connection', 'stableSession.js');
  checks.push({ check: 'stable_session_module_exists', ok: await pathExists(stableSessionPath), value: stableSessionPath });

  const reconnectPath = path.join(ROOT, 'services', 'whatsapp', 'connection', 'reconnect.js');
  checks.push({ check: 'reconnect_module_exists', ok: await pathExists(reconnectPath), value: reconnectPath });

  const summary = {
    validatedAt: new Date().toISOString(),
    ok: checks.every((item) => item.ok),
    checks,
  };

  const reportFile = path.join(outputDir, 'reconnect-readiness.json');
  await fs.writeFile(reportFile, JSON.stringify(summary, null, 2), 'utf8');
  return { reportFile, summary };
}

async function main() {
  const stamp = timestamp();
  const outputDir = path.join(BACKUP_ROOT, `session-protection-${stamp}`);
  await fs.mkdir(outputDir, { recursive: true });

  const sessionsBackupDir = path.join(outputDir, 'auth-sessions-backup');
  if (await pathExists(SESSIONS_DIR)) {
    await copyDirRecursive(SESSIONS_DIR, sessionsBackupDir);
  } else {
    await fs.writeFile(path.join(outputDir, 'auth-sessions-backup.SKIPPED.txt'), 'sessions folder not found', 'utf8');
  }

  const dbSnapshot = await exportDbSnapshot(outputDir);
  const { reportFile, summary } = await validateReconnectReadiness(outputDir);

  const marker = {
    createdAt: new Date().toISOString(),
    outputDir,
    dbSnapshotFile: dbSnapshot.outFile,
    reconnectReadinessOk: summary.ok,
    policy: 'No cleanup without this protection snapshot',
  };
  await fs.writeFile(path.join(outputDir, 'PROTECTION_MARKER.json'), JSON.stringify(marker, null, 2), 'utf8');

  console.log(JSON.stringify({
    status: 'ok',
    outputDir,
    dbSnapshotFile: dbSnapshot.outFile,
    sessionStats: dbSnapshot.stats,
    reconnectReportFile: reportFile,
    reconnectReadinessOk: summary.ok,
  }, null, 2));
}

main().catch((error) => {
  console.error('Failed to protect WhatsApp sessions:', error?.message || error);
  process.exit(1);
});
