const express = require('express');
const os = require('os');
const { spawnSync } = require('child_process');
const { query } = require('../config/database');
const { backendLog, errorLog } = require('../services/logger');
const runtimeManager = require('../services/runtimeManager');

const router = express.Router();

function requireMasterAdmin(req, res, next) {
  const role = String(req.auth?.role || '').trim().toLowerCase();
  if (role !== 'master_admin') {
    return res.status(403).json({ error: 'master_admin role required.' });
  }
  return next();
}

function logAdminAction(req, action, details = {}) {
  backendLog('info', 'admin_master_action', {
    action,
    actor: req.auth?.username || req.auth?.sub || 'unknown',
    role: req.auth?.role || 'unknown',
    tenantId: req.authTenantId || req.auth?.tenantId || null,
    ip: req.ip,
    scope: 'admin_master',
    ...details,
  });
}

function canExecuteAdminRestart() {
  return String(process.env.ALLOW_ADMIN_BACKEND_RESTART || '').trim().toLowerCase() === 'true';
}

function runPm2Command(args = []) {
  const candidates = process.platform === 'win32' ? ['pm2.cmd', 'pm2'] : ['pm2'];

  for (const command of candidates) {
    try {
      const result = spawnSync(command, args, {
        timeout: 15_000,
        windowsHide: true,
        encoding: 'utf8',
      });

      if (!result.error) {
        return {
          ok: result.status === 0,
          status: result.status,
          stdout: String(result.stdout || '').trim(),
          stderr: String(result.stderr || '').trim(),
          command,
        };
      }
    } catch (_error) {
      // Try next candidate.
    }
  }

  return {
    ok: false,
    status: -1,
    stdout: '',
    stderr: 'Unable to execute PM2 command.',
    command: 'pm2',
  };
}

async function loadDatabaseStats() {
  const [sizeResult, connectionsResult] = await Promise.all([
    query("SELECT pg_size_pretty(pg_database_size(current_database())) AS size"),
    query('SELECT COUNT(*)::int AS total FROM pg_stat_activity WHERE datname = current_database()'),
  ]);

  return {
    online: true,
    size: sizeResult.rows?.[0]?.size || 'n/a',
    connections: Number(connectionsResult.rows?.[0]?.total || 0) || 0,
  };
}

function loadInfraStats() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMemPct = totalMem > 0 ? Math.round(((totalMem - freeMem) / totalMem) * 100) : 0;
  const cpuLoad = os.loadavg()[0] || 0;
  const cpuCount = os.cpus()?.length || 1;
  const cpuPct = Math.max(0, Math.min(100, Math.round((cpuLoad / cpuCount) * 100)));

  const probe = (command, args = []) => {
    try {
      const result = spawnSync(command, args, {
        timeout: 1200,
        windowsHide: true,
        stdio: 'ignore',
      });
      return result.status === 0;
    } catch {
      return false;
    }
  };

  return {
    cpuPercent: cpuPct,
    ramPercent: usedMemPct,
    uptimeSec: Math.floor(os.uptime()),
    nodeUptimeSec: Math.floor(process.uptime()),
    platform: `${os.platform()} ${os.release()}`,
    services: {
      pm2: probe('pm2', ['ping']),
      docker: probe('docker', ['info']),
      nginx: probe('nginx', ['-v']) || probe('nginx.exe', ['-v']),
      openresty: probe('openresty', ['-v']) || probe('openresty.exe', ['-v']),
    },
  };
}

function loadBackendStats(req) {
  const store = req.app.locals.store || {};
  const runtimeStatus = runtimeManager.getStatus ? runtimeManager.getStatus() : {};

  return {
    health: store.databaseEnabled === false ? 'degraded' : 'healthy',
    runtimeActive: Boolean(store.system?.active),
    runtimeStatus: store.system?.status || 'inactive',
    queueJobs: Number(store.pendingBackgroundUpdates || 0),
    logsStream: 'backend/errors/requests/whatsapp',
    runtime: runtimeStatus,
  };
}

function loadWhatsappStats(req) {
  const sessionManager = req.app.locals.store?.sessionManager;
  const sessions = sessionManager?.listSessions ? sessionManager.listSessions() : [];
  const onlineSessions = sessions.filter((session) => String(session?.status || '').toLowerCase() === 'connected').length;
  const pendingQr = sessions.filter((session) => String(session?.status || '').toLowerCase() === 'qr').length;

  return {
    totalSessions: sessions.length,
    onlineSessions,
    pendingQr,
    activeNumbers: sessions.filter((session) => Boolean(session?.phone)).length,
    sessionErrors: sessions.filter((session) => String(session?.status || '').toLowerCase() === 'error').length,
  };
}

function loadUserStats(req) {
  const actorRole = String(req.auth?.role || 'admin').toLowerCase();
  return {
    totalUsers: null,
    admins: actorRole === 'master_admin' ? 1 : 0,
    accessesToday: null,
    plans: null,
  };
}

router.use(requireMasterAdmin);

router.get('/master/overview', async (req, res) => {
  try {
    const [database, infra] = await Promise.all([
      loadDatabaseStats(),
      Promise.resolve(loadInfraStats()),
    ]);

    const payload = {
      generatedAt: new Date().toISOString(),
      infra,
      backend: loadBackendStats(req),
      database,
      whatsapp: loadWhatsappStats(req),
      users: loadUserStats(req),
    };

    logAdminAction(req, 'overview_read');
    return res.status(200).json(payload);
  } catch (error) {
    errorLog(error, { scope: 'admin_master', action: 'overview_read' });
    return res.status(500).json({ error: 'Failed to load admin master overview.' });
  }
});

router.post('/master/actions/restart-backend', async (req, res) => {
  try {
    const processName = String(process.env.PM2_BACKEND_PROCESS_NAME || 'zapai-backend').trim() || 'zapai-backend';

    if (!canExecuteAdminRestart()) {
      logAdminAction(req, 'restart_backend_blocked', {
        reason: 'ALLOW_ADMIN_BACKEND_RESTART is false',
      });
      return res.status(403).json({
        accepted: false,
        message: 'Backend restart is disabled. Set ALLOW_ADMIN_BACKEND_RESTART=true to enable.',
      });
    }

    const restartResult = runPm2Command(['restart', processName]);

    logAdminAction(req, 'restart_backend_executed', {
      ok: restartResult.ok,
      command: restartResult.command,
      processName,
      statusCode: restartResult.status,
      stderr: restartResult.stderr || null,
    });

    if (!restartResult.ok) {
      return res.status(500).json({
        accepted: false,
        message: 'PM2 restart failed.',
        detail: restartResult.stderr || restartResult.stdout || 'Unknown PM2 error',
      });
    }

    return res.status(200).json({
      accepted: true,
      message: `Backend process '${processName}' restarted via PM2.`,
      detail: restartResult.stdout || null,
    });
  } catch (error) {
    errorLog(error, { scope: 'admin_master', action: 'restart_backend_requested' });
    return res.status(500).json({ error: 'Failed to register restart request.' });
  }
});

router.get('/master/audit', async (_req, res) => {
  return res.status(200).json({
    stream: 'backend.log',
    filter: 'scope=admin_master',
    message: 'Use centralized logs to inspect admin actions.',
  });
});

module.exports = router;
