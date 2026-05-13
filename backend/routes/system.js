const express = require('express');
const { execFile } = require('child_process');
const fs = require('fs/promises');
const path = require('path');
const { promisify } = require('util');
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

module.exports = router;
