#!/usr/bin/env node
/**
 * ZAPAI Production Healthcheck
 *
 * Checks all system components and returns a structured report.
 *
 * Usage:
 *   node scripts/healthcheck.js
 *   node scripts/healthcheck.js --json
 *   node scripts/healthcheck.js --strict   (exit 1 if any check fails)
 *
 * Checks:
 *   1. PostgreSQL connectivity + basic query
 *   2. Redis connectivity (optional)
 *   3. Filesystem (sessions dir, logs dir, uploads dir)
 *   4. Memory (heap, rss)
 *   5. Process (PID, uptime, event loop)
 *   6. Backend HTTP (/health endpoint)
 *   7. WebSocket upgrade
 *   8. Baileys session auth state on disk
 */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env.production') });

const IS_JSON  = process.argv.includes('--json');
const IS_STRICT = process.argv.includes('--strict');
const PORT = Number(process.env.PORT || 4025);
const SESSIONS_DIR = path.join(__dirname, '../sessions');
const LOGS_DIR = path.join(__dirname, '../logs');
const UPLOADS_DIR = path.join(__dirname, '../uploads');

const checks = [];
let passed = 0, failed = 0, warned = 0;

// ─── Reporter ───────────────────────────────────────────────────────────────

function result(name, status, detail = '') {
  const entry = { name, status, detail, timestamp: new Date().toISOString() };
  checks.push(entry);
  if (status === 'ok') { passed++; }
  else if (status === 'fail') { failed++; }
  else { warned++; }

  if (!IS_JSON) {
    const icon = status === 'ok' ? '✅' : status === 'warn' ? '⚠️ ' : '❌';
    console.log(`${icon} [${name}]${detail ? ': ' + detail : ''}`);
  }
}

// ─── 1. PostgreSQL ───────────────────────────────────────────────────────────

async function checkPostgres() {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    host: process.env.POSTGRES_HOST || process.env.DB_HOST,
    port: Number(process.env.POSTGRES_PORT || process.env.DB_PORT || 5432),
    user: process.env.POSTGRES_USER || process.env.DB_USER,
    password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD,
    database: process.env.POSTGRES_DB || process.env.DB_NAME || 'zapai_crm',
    connectionTimeoutMillis: 5000,
    max: 1,
  });

  try {
    const start = Date.now();
    const r = await pool.query('SELECT 1 AS ok, NOW() AS ts');
    const ms = Date.now() - start;
    result('postgres', 'ok', `SELECT 1 in ${ms}ms | server_time=${r.rows[0].ts}`);

    // Table check
    try {
      const t = await pool.query(
        "SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema='public'"
      );
      result('postgres_tables', 'ok', `${t.rows[0].c} public tables`);
    } catch {
      result('postgres_tables', 'warn', 'Could not count tables');
    }
  } catch (err) {
    result('postgres', 'fail', err.message);
  } finally {
    await pool.end().catch(() => {});
  }
}

// ─── 2. Redis ────────────────────────────────────────────────────────────────

async function checkRedis() {
  const REDIS_URL = process.env.REDIS_URL;
  if (!REDIS_URL) {
    result('redis', 'warn', 'REDIS_URL not configured — Redis disabled');
    return;
  }

  try {
    const { createClient } = require('redis');
    const client = createClient({ url: REDIS_URL, socket: { connectTimeout: 5000 } });
    await client.connect();
    const pong = await client.ping();
    await client.disconnect();
    result('redis', 'ok', `PING → ${pong}`);
  } catch (err) {
    result('redis', 'warn', `Redis unavailable: ${err.message}`);
  }
}

// ─── 3. Filesystem ───────────────────────────────────────────────────────────

function checkFilesystem() {
  const dirs = [
    { path: SESSIONS_DIR, name: 'sessions_dir', critical: true },
    { path: LOGS_DIR,     name: 'logs_dir',     critical: false },
    { path: UPLOADS_DIR,  name: 'uploads_dir',  critical: false },
  ];

  for (const dir of dirs) {
    try {
      if (!fs.existsSync(dir.path)) {
        fs.mkdirSync(dir.path, { recursive: true });
        result(dir.name, 'warn', `Created missing directory: ${dir.path}`);
        continue;
      }
      // Write test
      const testFile = path.join(dir.path, '.healthcheck_probe');
      fs.writeFileSync(testFile, String(Date.now()));
      fs.unlinkSync(testFile);
      result(dir.name, 'ok', dir.path);
    } catch (err) {
      result(dir.name, dir.critical ? 'fail' : 'warn', err.message);
    }
  }

  // Disk space (Linux only)
  try {
    const df = execSync('df -h / 2>/dev/null | tail -1', { encoding: 'utf8', timeout: 3000 }).trim();
    const parts = df.split(/\s+/);
    const used = parts[4] || 'N/A';
    const pctNum = parseInt(used, 10);
    if (pctNum >= 90) {
      result('disk_space', 'fail', `${used} used — CRITICAL`);
    } else if (pctNum >= 80) {
      result('disk_space', 'warn', `${used} used`);
    } else {
      result('disk_space', 'ok', `${used} used`);
    }
  } catch {
    result('disk_space', 'warn', 'Could not check disk (non-Linux?)');
  }
}

// ─── 4. Memory ───────────────────────────────────────────────────────────────

function checkMemory() {
  const mem = process.memoryUsage();
  const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
  const rssMB = Math.round(mem.rss / 1024 / 1024);
  const limitMB = Number(process.env.HEALTH_MEMORY_LIMIT_MB || 800);

  if (heapUsedMB > limitMB) {
    result('memory_heap', 'warn', `${heapUsedMB}/${heapTotalMB}MB — above limit ${limitMB}MB`);
  } else {
    result('memory_heap', 'ok', `heap=${heapUsedMB}MB rss=${rssMB}MB`);
  }

  // System free memory (Linux)
  try {
    const freeMem = execSync('free -m 2>/dev/null | grep Mem', { encoding: 'utf8', timeout: 3000 });
    const parts = freeMem.trim().split(/\s+/);
    const totalMB = parseInt(parts[1], 10);
    const availMB = parseInt(parts[6] || parts[3], 10);
    const usedPct = Math.round(((totalMB - availMB) / totalMB) * 100);
    const status = usedPct > 90 ? 'fail' : usedPct > 80 ? 'warn' : 'ok';
    result('memory_system', status, `${availMB}MB free of ${totalMB}MB (${usedPct}% used)`);
  } catch {
    result('memory_system', 'warn', 'Could not check system memory');
  }
}

// ─── 5. Backend HTTP ─────────────────────────────────────────────────────────

async function checkBackendHttp() {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = http.get(`http://127.0.0.1:${PORT}/health`, { timeout: 5000 }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        const ms = Date.now() - start;
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(body);
            const hasSys = !!json.data?.system;
            result('backend_http', 'ok', `HTTP 200 in ${ms}ms | has_system=${hasSys}`);
          } catch {
            result('backend_http', 'ok', `HTTP 200 in ${ms}ms (non-JSON)`);
          }
        } else {
          result('backend_http', 'fail', `HTTP ${res.statusCode} in ${ms}ms`);
        }
        resolve();
      });
    });
    req.on('error', (err) => {
      result('backend_http', 'fail', `Connection refused: ${err.message}`);
      resolve();
    });
    req.on('timeout', () => {
      req.destroy();
      result('backend_http', 'fail', 'Timeout after 5s');
      resolve();
    });
  });
}

// ─── 6. WebSocket ────────────────────────────────────────────────────────────

async function checkWebSocket() {
  return new Promise((resolve) => {
    const opts = {
      host: '127.0.0.1',
      port: PORT,
      path: '/socket.io/?EIO=4&transport=polling',
      timeout: 5000,
      headers: { 'Accept': '*/*' },
    };
    const req = http.get(opts, (res) => {
      result('websocket_route', res.statusCode < 400 ? 'ok' : 'warn',
        `Socket.IO polling: HTTP ${res.statusCode}`);
      resolve();
    });
    req.on('error', (err) => {
      result('websocket_route', 'warn', `WS route error: ${err.message}`);
      resolve();
    });
    req.on('timeout', () => {
      req.destroy();
      result('websocket_route', 'warn', 'WS route timeout');
      resolve();
    });
  });
}

// ─── 7. Baileys Sessions ─────────────────────────────────────────────────────

function checkBaileySessions() {
  if (!fs.existsSync(SESSIONS_DIR)) {
    result('baileys_sessions', 'warn', 'Sessions directory does not exist');
    return;
  }

  let sessionCount = 0;
  let healthySessions = 0;

  try {
    const entries = fs.readdirSync(SESSIONS_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === '.gitkeep') continue;
      sessionCount++;
      const credsPath = path.join(SESSIONS_DIR, entry.name, 'creds.json');
      if (fs.existsSync(credsPath)) {
        try {
          const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
          if (creds.noiseKey && creds.signedIdentityKey) healthySessions++;
        } catch { /* corrupt creds */ }
      }
    }

    if (sessionCount === 0) {
      result('baileys_sessions', 'warn', 'No sessions found — scan QR to connect WhatsApp');
    } else if (healthySessions === 0) {
      result('baileys_sessions', 'fail', `${sessionCount} session dirs but 0 with valid creds.json`);
    } else {
      result('baileys_sessions', 'ok', `${healthySessions}/${sessionCount} sessions with valid auth`);
    }
  } catch (err) {
    result('baileys_sessions', 'warn', err.message);
  }
}

// ─── 8. PM2 Process ──────────────────────────────────────────────────────────

function checkPm2() {
  try {
    const out = execSync('pm2 jlist 2>/dev/null', { encoding: 'utf8', timeout: 5000 });
    const procs = JSON.parse(out || '[]');
    const zapflow = procs.find((p) => p.name === 'zapflow-api');
    if (!zapflow) {
      result('pm2_process', 'warn', 'zapflow-api not found in PM2 list');
      return;
    }
    const status = zapflow.pm2_env?.status;
    const restarts = zapflow.pm2_env?.restart_time ?? 0;
    const uptimeSec = Math.round((Date.now() - (zapflow.pm2_env?.pm_uptime || Date.now())) / 1000);
    if (status === 'online') {
      result('pm2_process', 'ok', `status=online restarts=${restarts} uptime=${uptimeSec}s`);
    } else {
      result('pm2_process', 'fail', `status=${status} restarts=${restarts}`);
    }
    if (restarts > 10) {
      result('pm2_restarts', 'warn', `High restart count: ${restarts} — check logs`);
    }
  } catch {
    result('pm2_process', 'warn', 'PM2 not available or not running');
  }
}

// ─── 9. CPU ──────────────────────────────────────────────────────────────────

function checkCpu() {
  try {
    // Read /proc/stat twice with 500ms gap for accurate CPU usage
    const read1 = fs.readFileSync('/proc/stat', 'utf8').split('\n')[0].trim().split(/\s+/);
    const [, u1, n1, s1, i1, w1] = read1.map(Number);
    const idle1 = i1 + (w1 || 0);
    const total1 = u1 + n1 + s1 + idle1;

    // Brief sleep via synchronous approach
    const start = Date.now();
    while (Date.now() - start < 300) { /* busy wait */ }

    const read2 = fs.readFileSync('/proc/stat', 'utf8').split('\n')[0].trim().split(/\s+/);
    const [, u2, n2, s2, i2, w2] = read2.map(Number);
    const idle2 = i2 + (w2 || 0);
    const total2 = u2 + n2 + s2 + idle2;

    const idleDelta = idle2 - idle1;
    const totalDelta = total2 - total1;
    const cpuUsedPct = totalDelta > 0 ? Math.round((1 - idleDelta / totalDelta) * 100) : 0;

    const status = cpuUsedPct > 90 ? 'fail' : cpuUsedPct > 75 ? 'warn' : 'ok';
    result('cpu_usage', status, `${cpuUsedPct}% used`);
  } catch {
    // Non-Linux or /proc not available
    try {
      const loadavg = fs.readFileSync('/proc/loadavg', 'utf8').split(' ');
      result('cpu_usage', 'ok', `loadavg=${loadavg[0]} ${loadavg[1]} ${loadavg[2]}`);
    } catch {
      result('cpu_usage', 'warn', 'Cannot read CPU stats (non-Linux?)');
    }
  }
}

// ─── 10. Nginx ────────────────────────────────────────────────────────────────

function checkNginx() {
  try {
    const status = execSync('systemctl is-active nginx 2>/dev/null', { encoding: 'utf8', timeout: 3000 }).trim();
    if (status === 'active') {
      // Also check config
      try {
        execSync('nginx -t 2>/dev/null', { encoding: 'utf8', timeout: 5000 });
        result('nginx', 'ok', 'active + config valid');
      } catch {
        result('nginx', 'warn', 'active but config test failed');
      }
    } else {
      result('nginx', 'fail', `nginx status: ${status}`);
    }
  } catch {
    // systemctl not available — try process check
    try {
      execSync('pgrep nginx', { encoding: 'utf8', timeout: 3000 });
      result('nginx', 'ok', 'process running (no systemctl)');
    } catch {
      result('nginx', 'warn', 'nginx not found — may be proxied externally');
    }
  }
}

// ─── 11. Pending Migrations ───────────────────────────────────────────────────

async function checkMigrations() {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    host: process.env.POSTGRES_HOST || process.env.DB_HOST,
    port: Number(process.env.POSTGRES_PORT || process.env.DB_PORT || 5432),
    user: process.env.POSTGRES_USER || process.env.DB_USER,
    password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD,
    database: process.env.POSTGRES_DB || process.env.DB_NAME || 'zapai_crm',
    connectionTimeoutMillis: 5000,
    max: 1,
  });
  try {
    const r = await pool.query(
      "SELECT COUNT(*) AS c FROM schema_migrations WHERE applied_at IS NOT NULL"
    );
    result('migrations', 'ok', `${r.rows[0].c} migrations applied`);
  } catch {
    result('migrations', 'warn', 'Could not verify migration state (table may not exist yet)');
  } finally {
    await pool.end().catch(() => {});
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔍 ZAPAI Healthcheck — ${new Date().toISOString()}\n`);

  await checkPostgres();
  await checkRedis();
  checkFilesystem();
  checkMemory();
  checkCpu();
  await checkBackendHttp();
  await checkWebSocket();
  checkBaileySessions();
  checkPm2();
  checkNginx();
  await checkMigrations();

  const total = passed + failed + warned;

  // Build structured report (enterprise envelope)
  const byName = (name) => checks.find(c => c.name === name) || { status: 'unknown', detail: '' };
  const report = {
    success: failed === 0,
    timestamp: new Date().toISOString(),
    summary: { total, passed, failed, warned },
    services: {
      pm2:   { status: byName('pm2_process').status,   detail: byName('pm2_process').detail },
      nginx: { status: byName('nginx').status,         detail: byName('nginx').detail },
    },
    database: {
      postgres:   { status: byName('postgres').status,   detail: byName('postgres').detail },
      migrations: { status: byName('migrations').status, detail: byName('migrations').detail },
    },
    memory: {
      heap:   { status: byName('memory_heap').status,   detail: byName('memory_heap').detail },
      system: { status: byName('memory_system').status, detail: byName('memory_system').detail },
      disk:   { status: byName('disk_space').status,    detail: byName('disk_space').detail },
      cpu:    { status: byName('cpu_usage').status,     detail: byName('cpu_usage').detail },
    },
    sessions: {
      baileys: { status: byName('baileys_sessions').status, detail: byName('baileys_sessions').detail },
    },
    websocket: {
      route: { status: byName('websocket_route').status, detail: byName('websocket_route').detail },
    },
    checks,
  };

  if (IS_JSON) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`  Total: ${total} | ✅ ${passed} | ❌ ${failed} | ⚠️  ${warned}`);
    if (failed === 0) {
      console.log(`  🟢 SYSTEM HEALTHY`);
    } else {
      console.log(`  🔴 ${failed} CRITICAL FAILURE(S)`);
    }
    console.log(`${'─'.repeat(50)}\n`);
  }

  const exitCode = (IS_STRICT && failed > 0) ? 1 : 0;
  process.exit(exitCode);
}

main().catch((err) => {
  console.error('[healthcheck] Fatal:', err.message);
  process.exit(1);
});

