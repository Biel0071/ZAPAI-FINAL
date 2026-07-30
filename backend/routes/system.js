const express = require('express');
const { execFile } = require('child_process');
const fs = require('fs/promises');
const path = require('path');
const { promisify } = require('util');
const os = require('os');

// Cross-platform CPU usage tracking via delta-sampling
let lastCpuTimes = null;
let cachedCpuPct = 0;

function getCpuPercentage() {
  const cpus = os.cpus();
  if (!cpus || cpus.length === 0) return 0;
  
  let user = 0;
  let nice = 0;
  let sys = 0;
  let idle = 0;
  let irq = 0;
  
  for (const cpu of cpus) {
    user += cpu.times.user;
    nice += cpu.times.nice;
    sys += cpu.times.sys;
    idle += cpu.times.idle;
    irq += cpu.times.irq;
  }
  
  const total = user + nice + sys + idle + irq;
  
  if (!lastCpuTimes) {
    lastCpuTimes = { user, nice, sys, idle, irq, total };
    return 0;
  }
  
  const deltaTotal = total - lastCpuTimes.total;
  const deltaIdle = idle - lastCpuTimes.idle;
  
  lastCpuTimes = { user, nice, sys, idle, irq, total };
  
  if (deltaTotal <= 0) return cachedCpuPct;
  
  const cpuPct = Math.round((1 - deltaIdle / deltaTotal) * 100);
  cachedCpuPct = Math.max(0, Math.min(100, cpuPct));
  return cachedCpuPct;
}

const { query } = require('../config/database');

const router = express.Router();
const systemController = require('../controllers/systemController');
const execFileAsync = promisify(execFile);

const BACKEND_ROOT = path.join(__dirname, '..');
const REPO_ROOT = path.resolve(BACKEND_ROOT, '..');
const HOST_WORKSPACE_ROOT = process.env.HOST_WORKSPACE_ROOT || '/workspace';
const UPDATE_SCRIPT = process.env.SYSTEM_UPDATE_SCRIPT || path.join(HOST_WORKSPACE_ROOT, 'deploy', 'update.sh');

async function readPackageVersion() {
  const packageJsonPath = path.join(BACKEND_ROOT, 'package.json');
  const raw = await fs.readFile(packageJsonPath, 'utf8');
  const parsed = JSON.parse(raw);
  return String(parsed.version || '0.0.0');
}

function formatUptime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainingSeconds = total % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
  return `${remainingSeconds}s`;
}

async function ensureSystemInfo(version) {
  await query(`
    CREATE TABLE IF NOT EXISTS system_info (
      id INTEGER PRIMARY KEY DEFAULT 1,
      version VARCHAR(100) NOT NULL DEFAULT '0.0.0',
      last_update TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      CONSTRAINT system_info_singleton CHECK (id = 1)
    )
  `);
  await query(`
    INSERT INTO system_info (id, version, last_update, created_at, updated_at)
    VALUES (1, $1, NOW(), NOW(), NOW())
    ON CONFLICT (id)
    DO UPDATE SET version = EXCLUDED.version, updated_at = NOW()
  `, [version]);
}

async function loadSystemInfo() {
  const version = await readPackageVersion();
  await ensureSystemInfo(version);
  const result = await query('SELECT version, last_update FROM system_info WHERE id = 1');
  return result.rows[0] || { version, last_update: null };
}

async function getGitOutput(args, cwd = REPO_ROOT) {
  const { stdout } = await execFileAsync('git', args, {
    cwd,
    timeout: 15000,
    maxBuffer: 1024 * 1024,
  });
  return String(stdout || '').trim();
}

router.get('/version', async (req, res) => {
  try {
    const info = await loadSystemInfo();
    return res.status(200).json({
      version: info.version,
      env: process.env.NODE_ENV || 'development',
      uptime: formatUptime(process.uptime()),
      uptimeSeconds: Math.floor(process.uptime()),
      lastUpdate: info.last_update,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load system version.' });
  }
});

router.get('/check-update', async (req, res) => {
  if (!String(req.originalUrl || '').startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found.' });
  }

  try {
    const currentVersion = await readPackageVersion();
    await getGitOutput(['fetch', 'origin', 'main'], HOST_WORKSPACE_ROOT);
    const localCommit = await getGitOutput(['rev-parse', 'HEAD'], HOST_WORKSPACE_ROOT);
    const remoteCommit = await getGitOutput(['rev-parse', 'origin/main'], HOST_WORKSPACE_ROOT);
    return res.status(200).json({
      currentVersion,
      localCommit,
      remoteCommit,
      updateAvailable: localCommit !== remoteCommit,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to check updates.', detail: error.message });
  }
});

router.post('/update', async (req, res) => {
  if (!String(req.originalUrl || '').startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found.' });
  }

  try {
    const { stdout, stderr } = await execFileAsync('bash', [UPDATE_SCRIPT], {
      cwd: HOST_WORKSPACE_ROOT,
      timeout: Number(process.env.SYSTEM_UPDATE_TIMEOUT_MS || 15 * 60 * 1000),
      maxBuffer: 1024 * 1024 * 10,
    });
    const version = await readPackageVersion();
    await ensureSystemInfo(version);
    await query('UPDATE system_info SET version = $1, last_update = NOW(), updated_at = NOW() WHERE id = 1', [version]);
    return res.status(200).json({
      success: true,
      version,
      output: String(stdout || '').slice(-12000),
      errorOutput: String(stderr || '').slice(-4000),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'System update failed.',
      detail: error.message,
      output: String(error.stdout || '').slice(-12000),
      errorOutput: String(error.stderr || '').slice(-4000),
    });
  }
});

// Activation endpoints
router.post('/activate', systemController.activate);
router.get('/activation-logs', systemController.getActivationLogs);

// Runtime management endpoints
router.get('/runtime/status', systemController.getRuntimeStatus);
router.get('/runtime/debug', systemController.getRuntimeDebug);
router.post('/runtime/restart-ngrok', systemController.restartNgrok);
router.get('/runtime/logs', systemController.getRuntimeLogs);
router.delete('/runtime/logs', systemController.clearRuntimeLogs);

// Existing system endpoints
router.get('/ai-diagnostics', systemController.getAIDiagnostics);
router.get('/error-log', systemController.errorLog);
router.post('/error-log', systemController.receiveErrorLog);
router.post('/start', systemController.start);
router.post('/stop', systemController.stop);
router.get('/status', systemController.status);

router.post('/debug-send', async (req, res) => {
  const { phone, text, sessionId } = req.body;
  
  if (!phone || !text) {
    return res.status(400).json({ error: 'phone and text are required' });
  }

  try {
    const { activeSessions } = require('../services/whatsapp/state/registry');
    const targetSessionId = sessionId || 'material';
    const session = activeSessions[targetSessionId];
    const sock = session?.sock;

    if (!sock) {
      return res.status(400).json({ error: `Session ${targetSessionId} offline or not found`, activeKeys: Object.keys(activeSessions) });
    }

    const { ensureWhatsAppJid } = require('../services/whatsapp/shared/identifiers');
    const jid = ensureWhatsAppJid(phone);
    console.log(`[DEBUG-SEND] Sending message to JID=${jid}`);

    const startTime = Date.now();
    const sendResult = await sock.sendMessage(jid, { text });
    const messageId = sendResult?.key?.id;

    if (!messageId) {
      return res.status(500).json({ error: 'Failed to retrieve message ID from sendResult', sendResult });
    }

    console.log(`[DEBUG-SEND] Message sent, key ID=${messageId}. Waiting for ACKs...`);

    const { ackEmitter, ACK_STATES } = require('../services/messageAckPipeline');
    const timeline = [];
    timeline.push({ event: 'sent_to_baileys', timestamp: new Date().toISOString(), elapsedMs: Date.now() - startTime });

    let serverAckReceived = false;
    let deviceAckReceived = false;
    let errorDetails = null;

    const waitForEvents = new Promise((resolve) => {
      const timeout = setTimeout(() => {
        ackEmitter.off(messageId, handler);
        resolve({ timeout: true });
      }, 15000);

      function handler(entry) {
        const elapsed = Date.now() - startTime;
        timeline.push({
          event: `ack_update:${entry.status}`,
          timestamp: new Date().toISOString(),
          elapsedMs: elapsed,
          entry,
        });

        if (entry.status === ACK_STATES.SERVER_ACK) {
          serverAckReceived = true;
        }
        if (entry.status === ACK_STATES.DEVICE_ACK || entry.status === ACK_STATES.READ || entry.status === ACK_STATES.PLAYED) {
          deviceAckReceived = true;
        }
        if (entry.status === ACK_STATES.FAILED) {
          errorDetails = entry;
          clearTimeout(timeout);
          ackEmitter.off(messageId, handler);
          resolve({ error: true });
        }

        if (deviceAckReceived) {
          clearTimeout(timeout);
          ackEmitter.off(messageId, handler);
          resolve({ success: true });
        }
      }

      ackEmitter.on(messageId, handler);
    });

    const waitResult = await waitForEvents;

    return res.json({
      success: !waitResult.timeout && !waitResult.error,
      messageId,
      jid,
      sendResult,
      waitResult,
      serverAckReceived,
      deviceAckReceived,
      errorDetails,
      timeline,
      totalTimeMs: Date.now() - startTime,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// ─── NEW: Frontend-required endpoints ───────────────────────────────────────

/**
 * GET /api/system/info
 * Returns hostname, platform, uptime, version, environment
 */
router.get('/info', async (req, res) => {
  try {
    const os = require('os');
    let version = '1.0.0';
    try { version = await readPackageVersion(); } catch { /* ignore */ }

    return res.status(200).json({
      ok: true,
      data: {
        hostname: os.hostname() || '',
        platform: `${os.platform()} ${os.release()}`.trim(),
        arch: os.arch(),
        uptime: Math.floor(process.uptime()),
        uptimeFormatted: formatUptime(process.uptime()),
        version,
        environment: process.env.NODE_ENV || 'production',
        nodeVersion: process.version,
        pid: process.pid,
      },
    });
  } catch (error) {
    return res.status(200).json({
      ok: true,
      data: { hostname: '', platform: '', uptime: 0, version: '1.0.0', environment: 'production' },
    });
  }
});

/**
 * GET /api/system/resources
 * Returns CPU, memory, disk usage
 */
router.get('/resources', async (req, res) => {
  try {
    const os = require('os');

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const cpuPercent = getCpuPercentage();

    // Disk probe
    let disk = { total: 0, used: 0, free: 0, usedPercent: 0 };
    try {
      if (process.platform !== 'win32') {
        const { exec } = require('child_process');
        disk = await new Promise((resolve) => {
          exec('df -k /', { timeout: 1500, windowsHide: true }, (err, stdout) => {
            if (err) return resolve({ total: 0, used: 0, free: 0, usedPercent: 0 });
            const lines = String(stdout || '').trim().split(/\r?\n/);
            const cols = (lines[1] || '').trim().split(/\s+/);
            const totalKb = Number(cols[1] || 0);
            const usedKb = Number(cols[2] || 0);
            const freeKb = Number(cols[3] || 0);
            resolve({
              total: totalKb * 1024,
              used: usedKb * 1024,
              free: freeKb * 1024,
              usedPercent: totalKb > 0 ? Math.round((usedKb / totalKb) * 100) : 0,
            });
          });
        });
      }
    } catch { /* ignore disk errors */ }

    return res.status(200).json({
      ok: true,
      data: {
        cpu: {
          percent: cpuPercent,
          loadAvg: os.loadavg(),
          cores: cpuCount,
        },
        memory: {
          total: totalMem,
          used: usedMem,
          free: freeMem,
          usedPercent: Math.round((usedMem / totalMem) * 100),
          totalMb: Math.round(totalMem / 1024 / 1024),
          usedMb: Math.round(usedMem / 1024 / 1024),
          freeMb: Math.round(freeMem / 1024 / 1024),
        },
        disk,
        process: {
          heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          heapTotalMb: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        },
      },
    });
  } catch (error) {
    return res.status(200).json({
      ok: true,
      data: {
        cpu: { percent: 0, loadAvg: [0, 0, 0], cores: 1 },
        memory: { total: 0, used: 0, free: 0, usedPercent: 0, totalMb: 0, usedMb: 0, freeMb: 0 },
        disk: { total: 0, used: 0, free: 0, usedPercent: 0 },
        process: { heapUsedMb: 0, heapTotalMb: 0, rssMb: 0 },
      },
    });
  }
});

/**
 * GET /api/system/nodes
 * Returns registered cluster nodes — empty array if table doesn't exist
 */
router.get('/nodes', async (req, res) => {
  try {
    const store = req.app.locals.store;
    if (!store?.databaseEnabled) {
      return res.status(200).json({ ok: true, data: [], total: 0 });
    }

    try {
      const offlineAfterSeconds = Number(process.env.NODE_OFFLINE_AFTER_SECONDS || 90);
      const result = await query(
        `SELECT
            node_id, name, ip_address, domain, api_port,
            CASE
              WHEN last_seen IS NULL THEN 'pending'
              WHEN last_seen >= NOW() - ($1::text || ' seconds')::interval THEN 'online'
              ELSE 'offline'
            END AS status,
            last_seen, last_heartbeat
          FROM nodes
          ORDER BY last_seen DESC NULLS LAST
          LIMIT 100`,
        [offlineAfterSeconds]
      );
      const nodes = result.rows || [];
      return res.status(200).json({ ok: true, data: nodes, total: nodes.length });
    } catch {
      // Table doesn't exist or query failed — safe empty state
      return res.status(200).json({ ok: true, data: [], total: 0 });
    }
  } catch (error) {
    return res.status(200).json({ ok: true, data: [], total: 0 });
  }
});

/**
 * POST /api/system/refresh
 * Triggers a system refresh (clears caches, re-reads config)
 */
router.post('/refresh', (req, res) => {
  try {
    const store = req.app.locals.store;
    // Signal workers to refresh if possible
    if (store?.io) {
      try { store.io.emit('system:refresh', { timestamp: new Date().toISOString() }); } catch { /* ignore */ }
    }
    return res.status(200).json({
      ok: true,
      data: { refreshed: true, timestamp: new Date().toISOString() },
    });
  } catch (error) {
    return res.status(200).json({ ok: true, data: { refreshed: false } });
  }
});

/**
 * POST /api/system/e2e-smoke & GET /api/system/e2e-smoke
 * Runs automated headless synthetic E2E tests across all core application subsystems
 */
const { executeFullE2ESmokeSuite } = require('../services/e2eSmokeRunner');

router.post('/e2e-smoke', async (req, res) => {
  try {
    const report = await executeFullE2ESmokeSuite();
    return res.status(200).json({
      ok: true,
      success: true,
      data: report,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      success: false,
      error: error?.message || 'Falha ao executar suíte de testes E2E',
    });
  }
});

router.get('/e2e-smoke', async (req, res) => {
  try {
    const report = await executeFullE2ESmokeSuite();
    return res.status(200).json({
      ok: true,
      success: true,
      data: report,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      success: false,
      error: error?.message || 'Falha ao executar suíte de testes E2E',
    });
  }
});

const { fastCacheMiddleware } = require('../middleware/fastCache');

router.get('/grafify', systemController.getGrafifyAnalysis);

router.get('/sync-center', fastCacheMiddleware(2000), (req, res) => {
  const { getSyncCenterMetrics } = require('../services/sync');
  res.status(200).json(getSyncCenterMetrics());
});

router.get('/feature-flags', fastCacheMiddleware(5000), (req, res) => {
  const featureFlags = require('../config/featureFlags');
  res.status(200).json(featureFlags.getFlags());
});

router.post('/feature-flags', (req, res) => {
  const featureFlags = require('../config/featureFlags');
  const { flag, value } = req.body || {};
  const updated = featureFlags.setFlag(flag, value);
  if (!updated) return res.status(400).json({ error: 'Flag inválida' });
  return res.status(200).json({ success: true, flags: featureFlags.getFlags() });
});

module.exports = router;

