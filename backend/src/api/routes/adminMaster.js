const express = require('express');
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

const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { query, pool } = require('../../infrastructure/config/database');
const { backendLog, errorLog } = require('../../../services/logger');
const runtimeManager = require('../../../services/runtimeManager');
const userRepository = require('../../data/repositories/userRepository');
const auditLogRepository = require('../../data/repositories/auditLogRepository');
const sessionManager = require('../../../services/sessionManager');
const { clearCompanyStatusCache } = require('../middleware/companyStatus');

const router = express.Router();

function requireMasterAdmin(req, res, next) {
  const role = String(req.auth?.role || '').trim().toLowerCase();
  if (role !== 'master_admin' && role !== 'master') {
    return res.status(403).json({ error: 'master_admin or master role required.' });
  }
  return next();
}

router.use('/master', requireMasterAdmin);
router.use('/impersonate', requireMasterAdmin);

async function logAdminAction(req, action, details = {}) {
  await auditLogRepository.createAuditLog({
    tenantId: req.authTenantId || req.auth?.tenantId || 'default',
    actorUsername: req.auth?.username || req.auth?.sub || 'unknown',
    actorRole: req.auth?.role || 'unknown',
    actorTenantId: req.authTenantId || req.auth?.tenantId || null,
    action,
    targetType: details.targetType || null,
    targetId: details.targetId || null,
    ipAddress: req.ip || null,
    userAgent: req.headers?.['user-agent'] || null,
    metadata: details,
  });
}

function signHs256Jwt(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const signedData = `${encodedHeader}.${encodedPayload}`;
  const encodedSignature = crypto.createHmac('sha256', secret).update(signedData).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${signedData}.${encodedSignature}`;
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

async function loadNodesStats() {
  const offlineAfterSeconds = Number(process.env.NODE_OFFLINE_AFTER_SECONDS || 90);

  await query(
    `UPDATE nodes
        SET status = 'offline', updated_at = NOW()
      WHERE last_seen IS NOT NULL
        AND last_seen < NOW() - ($1::text || ' seconds')::interval
        AND status <> 'offline'`,
    [offlineAfterSeconds],
  );

  const counters = await query(
    `SELECT
        COUNT(*)::int AS total_nodes,
        COUNT(CASE WHEN last_seen >= NOW() - ($1::text || ' seconds')::interval THEN 1 END)::int AS online_nodes,
        COUNT(CASE WHEN last_seen < NOW() - ($1::text || ' seconds')::interval OR last_seen IS NULL THEN 1 END)::int AS offline_nodes
      FROM nodes`,
    [offlineAfterSeconds],
  );

  const nodes = await query(
    `SELECT
        n.node_id,
        n.name,
        n.ip_address,
        n.domain,
        n.api_port,
        CASE
          WHEN n.last_seen IS NULL THEN 'pending'
          WHEN n.last_seen >= NOW() - ($1::text || ' seconds')::interval THEN 'online'
          ELSE 'offline'
        END AS status,
        n.last_heartbeat,
        n.last_seen,
        h.cpu_usage,
        h.memory_usage,
        h.disk_usage,
        h.uptime_seconds
      FROM nodes n
      LEFT JOIN LATERAL (
        SELECT cpu_usage, memory_usage, disk_usage, uptime_seconds
        FROM heartbeats
        WHERE node_id = n.node_id
        ORDER BY received_at DESC
        LIMIT 1
      ) h ON true
      ORDER BY n.last_seen DESC NULLS LAST
      LIMIT 100`,
    [offlineAfterSeconds],
  );

  return {
    summary: counters.rows?.[0] || {
      total_nodes: 0,
      online_nodes: 0,
      offline_nodes: 0,
    },
    nodes: nodes.rows || [],
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

function probeAsync(command, args = []) {
  return new Promise((resolve) => {
    const { exec } = require('child_process');
    const cmdStr = `${command} ${args.join(' ')}`.trim();
    exec(cmdStr, { timeout: 1200, windowsHide: true }, (err) => {
      resolve(!err);
    });
  });
}

async function loadInfraStats() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMemPct = totalMem > 0 ? Math.round(((totalMem - freeMem) / totalMem) * 100) : 0;
  const cpuPct = getCpuPercentage();

  const diskProbe = await new Promise((resolve) => {
    try {
      const { exec } = require('child_process');
      if (process.platform === 'win32') {
        exec('wmic logicaldisk where "DeviceID=\'C:\'" get Size,FreeSpace /value', {
          timeout: 1500,
          windowsHide: true
        }, (err, stdout) => {
          if (err) return resolve({ usedPercent: null, totalBytes: null, freeBytes: null });
          const output = String(stdout || '');
          const size = Number((output.match(/Size=(\d+)/) || [])[1] || 0);
          const free = Number((output.match(/FreeSpace=(\d+)/) || [])[1] || 0);
          const usedPct = size > 0 ? Math.round(((size - free) / size) * 100) : null;
          resolve({ usedPercent: usedPct, totalBytes: size || null, freeBytes: free || null });
        });
      } else {
        exec('df -k /', {
          timeout: 1500,
          windowsHide: true
        }, (err, stdout) => {
          if (err) return resolve({ usedPercent: null, totalBytes: null, freeBytes: null });
          const lines = String(stdout || '').trim().split(/\r?\n/);
          const data = lines[1] || '';
          const columns = data.trim().split(/\s+/);
          const totalKb = Number(columns[1] || 0);
          const usedKb = Number(columns[2] || 0);
          const usedPct = totalKb > 0 ? Math.round((usedKb / totalKb) * 100) : null;
          resolve({
            usedPercent: usedPct,
            totalBytes: totalKb > 0 ? totalKb * 1024 : null,
            freeBytes: Number(columns[3] || 0) > 0 ? Number(columns[3]) * 1024 : null,
          });
        });
      }
    } catch {
      resolve({ usedPercent: null, totalBytes: null, freeBytes: null });
    }
  });

  const [pm2Ok, dockerOk, nginxOk, openrestyOk] = await Promise.all([
    probeAsync('pm2', ['ping']),
    probeAsync('docker', ['info']),
    probeAsync('nginx', ['-v']).then((ok) => ok || probeAsync('nginx.exe', ['-v'])),
    probeAsync('openresty', ['-v']).then((ok) => ok || probeAsync('openresty.exe', ['-v'])),
  ]);

  return {
    cpuPercent: cpuPct,
    ramPercent: usedMemPct,
    uptimeSec: Math.floor(os.uptime()),
    nodeUptimeSec: Math.floor(process.uptime()),
    platform: `${os.platform()} ${os.release()}`,
    disk: diskProbe,
    services: {
      pm2: pm2Ok,
      docker: dockerOk,
      nginx: nginxOk,
      openresty: openrestyOk,
    },
  };
}

function loadBackendStats(req) {
  const store = req.app.locals.store || {};
  const runtimeStatus = runtimeManager.getStatus ? runtimeManager.getStatus() : {};
  const runtimeLogs = runtimeManager.getRecentLogs ? runtimeManager.getRecentLogs(20) : [];
  const io = req.app.get('io');

  return {
    health: store.databaseEnabled === false ? 'degraded' : 'healthy',
    runtimeActive: Boolean(store.system?.active),
    runtimeStatus: store.system?.status || 'inactive',
    queueJobs: Number(store.pendingBackgroundUpdates || 0),
    usersOnline: Number(io?.engine?.clientsCount || 0),
    recentLogs: Array.isArray(runtimeLogs) ? runtimeLogs.slice(-20) : [],
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
    sessions: sessions.map((session) => ({
      id: session.sessionId,
      name: session.sessionName,
      status: session.status,
      phone: session.phone,
      createdAt: session.createdAt,
    })),
  };
}

async function loadUserStats(req) {
  const users = await userRepository.listUsers({ includeDeleted: false });
  const io = req.app.get('io');
  return {
    totalUsers: users.length,
    admins: users.filter((u) => u.role === 'master_admin').length,
    accessesToday: Number(io?.engine?.clientsCount || 0),
    plans: {
      free: users.filter((u) => u.plan === 'free').length,
      pro: users.filter((u) => u.plan === 'pro').length,
      enterprise: users.filter((u) => u.plan === 'enterprise').length,
    },
  };
}

// Version history contains deployment metadata and remains restricted to the
// same master roles as the rest of this router.
router.get('/master/versions', requireMasterAdmin, getMasterVersions);

router.post('/master/registration-links', requireMasterAdmin, async (req, res) => {
  const base = String(process.env.FRONTEND_URL || '').replace(/\/+$/, '');
  if (!base) return res.status(503).json({ error: 'FRONTEND_URL deve estar configurado para gerar links compartilháveis.' });
  const hours = Math.min(168, Math.max(1, Number(req.body?.validHours) || 72));
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  try {
    const result = await query(
      `INSERT INTO company_registration_links (token_hash, expires_at, created_by)
       VALUES ($1, NOW() + ($2 * INTERVAL '1 hour'), $3) RETURNING id, expires_at`,
      [tokenHash, hours, req.auth?.username || req.auth?.sub || 'master']
    );
    await logAdminAction(req, 'company_registration_link_created', { targetType: 'company_registration_link', targetId: String(result.rows[0].id) });
    return res.status(201).json({ link: `${base}/company/register?token=${encodeURIComponent(token)}`, expiresAt: result.rows[0].expires_at, delivery: 'manual' });
  } catch (error) {
    errorLog(error, { scope: 'admin_master', action: 'registration_link_create' });
    return res.status(500).json({ error: 'Não foi possível criar o link de cadastro.' });
  }
});

router.get('/master/companies', requireMasterAdmin, async (_req, res) => {
  try {
    const result = await query(`SELECT c.id, c.name, c.responsible_name, c.status, c.legacy_access, c.zai_enabled, c.created_at,
      (SELECT COUNT(*)::int FROM users u WHERE u.tenant_id = c.id AND u.deleted_at IS NULL) AS users_count,
      (SELECT COUNT(*)::int FROM ai_stores s WHERE s.company_id = c.id) AS stores_count
      FROM companies c ORDER BY c.created_at DESC`);
    return res.json({ companies: result.rows });
  } catch (error) {
    errorLog(error, { scope: 'admin_master', action: 'companies_list' });
    return res.status(500).json({ error: 'Não foi possível listar empresas.' });
  }
});

router.get('/master/license-plans', requireMasterAdmin, async (_req, res) => {
  try {
    const result = await query('SELECT id, name, modules, number_limit, active, created_at FROM license_plans ORDER BY created_at DESC');
    return res.json({ plans: result.rows });
  } catch (error) {
    errorLog(error, { scope: 'admin_master', action: 'license_plans_list' });
    return res.status(500).json({ error: 'Não foi possível listar planos.' });
  }
});

router.get('/master/licenses', requireMasterAdmin, async (_req, res) => {
  try {
    const result = await query(`SELECT l.id, l.company_id, c.name AS company_name, p.name AS plan_name,
      l.expires_at, l.redeemed_at, l.revoked_at, l.created_at
      FROM company_licenses l JOIN companies c ON c.id = l.company_id JOIN license_plans p ON p.id = l.plan_id
      ORDER BY l.created_at DESC`);
    return res.json({ licenses: result.rows });
  } catch (error) {
    errorLog(error, { scope: 'admin_master', action: 'licenses_list' });
    return res.status(500).json({ error: 'Não foi possível listar licenças.' });
  }
});

router.patch('/master/companies/:id/zai', requireMasterAdmin, async (req, res) => {
  if (typeof req.body?.enabled !== 'boolean') return res.status(400).json({ error: 'enabled deve ser booleano.' });
  try {
    const result = await query('UPDATE companies SET zai_enabled = $2, updated_at = NOW() WHERE id = $1 RETURNING id, zai_enabled', [req.params.id, req.body.enabled]);
    if (!result.rowCount) return res.status(404).json({ error: 'Empresa não encontrada.' });
    await logAdminAction(req, 'zai_assistant_company_updated', { targetType: 'company', targetId: req.params.id, enabled: req.body.enabled });
    return res.json(result.rows[0]);
  } catch (error) {
    errorLog(error, { scope: 'admin_master', action: 'zai_assistant_company_update' });
    return res.status(500).json({ error: 'Não foi possível alterar a ativação da empresa.' });
  }
});

router.patch('/master/companies/:id/status', requireMasterAdmin, async (req, res) => {
  const status = String(req.body?.status || '');
  if (!['active', 'suspended'].includes(status)) return res.status(400).json({ error: 'Status inválido.' });
  try {
    const result = await query('UPDATE companies SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING id, status', [req.params.id, status]);
    if (!result.rowCount) return res.status(404).json({ error: 'Empresa não encontrada.' });
    clearCompanyStatusCache(req.params.id);
    await logAdminAction(req, 'company_status_updated', { targetType: 'company', targetId: req.params.id, status });
    return res.json(result.rows[0]);
  } catch (error) {
    errorLog(error, { scope: 'admin_master', action: 'company_status_update' });
    return res.status(500).json({ error: 'Não foi possível alterar o status da empresa.' });
  }
});

router.get('/master/registration-requests', requireMasterAdmin, async (_req, res) => {
  try {
    const result = await query(`SELECT id, company_name, responsible_name, username, email, status, created_at
      FROM company_registration_requests ORDER BY created_at DESC`);
    return res.json({ requests: result.rows });
  } catch (error) {
    errorLog(error, { scope: 'admin_master', action: 'registration_requests' });
    return res.status(500).json({ error: 'Não foi possível listar solicitações.' });
  }
});

router.post('/master/registration-requests/:id/approve', requireMasterAdmin, async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const pending = await client.query(`SELECT * FROM company_registration_requests WHERE id = $1 AND status = 'pending' FOR UPDATE`, [req.params.id]);
    if (!pending.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Solicitação pendente não encontrada.' }); }
    const application = pending.rows[0];
    const companyId = crypto.randomUUID();
    await client.query(`INSERT INTO companies (id, name, responsible_name, status, legacy_access, zai_enabled) VALUES ($1, $2, $3, 'active', false, true)`, [companyId, application.company_name, application.responsible_name]);
    await client.query(`INSERT INTO users (tenant_id, username, email, password_hash, role, is_active)
      VALUES ($1, $2, $3, $4, 'admin', true)`, [companyId, application.username, application.email, application.password_hash]);
    await client.query(`UPDATE company_registration_requests SET status = 'approved', reviewed_by = $2, reviewed_at = NOW() WHERE id = $1`, [application.id, req.auth?.username || req.auth?.sub || 'master']);
    await client.query('COMMIT');
    await logAdminAction(req, 'company_registration_approved', { targetType: 'company', targetId: companyId });
    return res.json({ companyId, status: 'approved' });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    errorLog(error, { scope: 'admin_master', action: 'registration_approve' });
    return res.status(500).json({ error: 'Não foi possível aprovar a solicitação.' });
  } finally { if (client) client.release(); }
});

router.post('/master/registration-requests/:id/reject', requireMasterAdmin, async (req, res) => {
  try {
    const result = await query(`UPDATE company_registration_requests SET status = 'rejected', reviewed_by = $2, reviewed_at = NOW()
      WHERE id = $1 AND status = 'pending' RETURNING id`, [req.params.id, req.auth?.username || req.auth?.sub || 'master']);
    if (!result.rowCount) return res.status(404).json({ error: 'Solicitação pendente não encontrada.' });
    await logAdminAction(req, 'company_registration_rejected', { targetType: 'company_registration_request', targetId: String(req.params.id) });
    return res.json({ id: Number(req.params.id), status: 'rejected' });
  } catch (error) {
    errorLog(error, { scope: 'admin_master', action: 'registration_reject' });
    return res.status(500).json({ error: 'Não foi possível rejeitar a solicitação.' });
  }
});

router.post('/master/license-plans', requireMasterAdmin, async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const modules = Array.isArray(req.body?.modules) ? [...new Set(req.body.modules.map(String))] : [];
  const numberLimit = Number(req.body?.numberLimit);
  const allowedModules = new Set(['inbox', 'contacts', 'campaigns']);
  if (!name || name.length > 120 || !Number.isInteger(numberLimit) || numberLimit < 0 || modules.some((item) => !allowedModules.has(item))) {
    return res.status(400).json({ error: 'Plano, módulos ou limite inválidos.' });
  }
  try {
    const result = await query(`INSERT INTO license_plans (name, modules, number_limit, created_by)
      VALUES ($1, $2::jsonb, $3, $4) RETURNING id, name, modules, number_limit, active, created_at`,
    [name, JSON.stringify(modules), numberLimit, req.auth?.username || req.auth?.sub || 'master']);
    return res.status(201).json({ plan: result.rows[0] });
  } catch (error) {
    errorLog(error, { scope: 'admin_master', action: 'license_plan_create' });
    return res.status(500).json({ error: 'Não foi possível criar o plano.' });
  }
});

router.post('/master/companies/:companyId/licenses', requireMasterAdmin, async (req, res) => {
  const planId = Number(req.body?.planId);
  const expiry = req.body?.expiresAt ? new Date(req.body.expiresAt) : null;
  if (!Number.isInteger(planId) || (expiry && (!Number.isFinite(expiry.getTime()) || expiry.getTime() <= Date.now()))) return res.status(400).json({ error: 'Plano ou validade inválidos.' });
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  try {
    const result = await query(`INSERT INTO company_licenses (company_id, plan_id, token_hash, expires_at, created_by)
      SELECT c.id, p.id, $3, $4, $5 FROM companies c CROSS JOIN license_plans p WHERE c.id = $1 AND p.id = $2 AND p.active = true
      RETURNING id, expires_at`, [req.params.companyId, planId, tokenHash, expiry, req.auth?.username || req.auth?.sub || 'master']);
    if (!result.rowCount) return res.status(404).json({ error: 'Empresa ou plano ativo não encontrado.' });
    return res.status(201).json({ token, licenseId: result.rows[0].id, expiresAt: result.rows[0].expires_at });
  } catch (error) {
    errorLog(error, { scope: 'admin_master', action: 'license_issue' });
    return res.status(500).json({ error: 'Não foi possível emitir a licença.' });
  }
});

router.post('/master/licenses/:id/revoke', requireMasterAdmin, async (req, res) => {
  try {
    const result = await query('UPDATE company_licenses SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL RETURNING id, company_id, revoked_at', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Licença ativa não encontrada.' });
    await logAdminAction(req, 'company_license_revoked', { targetType: 'company_license', targetId: req.params.id, companyId: result.rows[0].company_id });
    return res.json({ license: result.rows[0] });
  } catch (error) {
    errorLog(error, { scope: 'admin_master', action: 'license_revoke' });
    return res.status(500).json({ error: 'Não foi possível revogar a licença.' });
  }
});

const ZAI_GLOBAL_SETTING_KEY = 'zai_system_assistant_global_enabled';
const zaiUserSettingKey = (userId) => `zai_system_assistant_user:${userId}`;
const zaiCompanySettingKey = (tenantId) => `zai_system_assistant_config:${tenantId}`;
const settingJson = (value) => {
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return value; }
  }
  return value;
};

router.get('/master/zai-assistant', requireMasterAdmin, async (req, res) => {
  try {
    const usersResult = await query(
      `SELECT id, tenant_id, username, email, role FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC`
    );
    const users = usersResult.rows || [];
    const keys = [ZAI_GLOBAL_SETTING_KEY];
    for (const user of users) {
      keys.push(zaiUserSettingKey(user.id), zaiCompanySettingKey(user.tenant_id));
    }
    const settingsResult = await query('SELECT key, value FROM system_settings WHERE key = ANY($1::text[])', [keys]);
    const settings = new Map((settingsResult.rows || []).map((row) => [row.key, settingJson(row.value)]));
    const globalSetting = settings.get(ZAI_GLOBAL_SETTING_KEY);
    const globalEnabled = typeof globalSetting === 'boolean' ? globalSetting : true;
    return res.json({
      globalEnabled,
      users: users.map((user) => {
        const personal = settings.get(zaiUserSettingKey(user.id));
        const legacy = settings.get(zaiCompanySettingKey(user.tenant_id));
        return {
          id: user.id,
          tenantId: user.tenant_id,
          name: user.username,
          email: user.email,
          role: user.role,
          enabled: typeof personal === 'boolean' ? personal : Boolean(legacy?.enabled),
        };
      }),
    });
  } catch (error) {
    errorLog(error, { scope: 'admin_master', action: 'zai_assistant_settings_read' });
    return res.status(500).json({ error: 'Failed to load ZAI assistant settings.' });
  }
});

router.patch('/master/zai-assistant/global', requireMasterAdmin, async (req, res) => {
  if (typeof req.body?.enabled !== 'boolean') return res.status(400).json({ error: 'enabled must be a boolean.' });
  try {
    await query(
      `INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [ZAI_GLOBAL_SETTING_KEY, JSON.stringify(req.body.enabled)]
    );
    await logAdminAction(req, 'zai_assistant_global_updated', { enabled: req.body.enabled });
    return res.json({ globalEnabled: req.body.enabled });
  } catch (error) {
    errorLog(error, { scope: 'admin_master', action: 'zai_assistant_global_update' });
    return res.status(500).json({ error: 'Failed to update global ZAI assistant setting.' });
  }
});

router.patch('/master/zai-assistant/users/:id', requireMasterAdmin, async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0 || typeof req.body?.enabled !== 'boolean') {
    return res.status(400).json({ error: 'A valid user ID and boolean enabled value are required.' });
  }
  try {
    const user = await userRepository.getUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    await query(
      `INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [zaiUserSettingKey(user.id), JSON.stringify(req.body.enabled)]
    );
    await logAdminAction(req, 'zai_assistant_user_updated', { targetType: 'user', targetId: String(userId), enabled: req.body.enabled });
    return res.json({ userId, enabled: req.body.enabled });
  } catch (error) {
    errorLog(error, { scope: 'admin_master', action: 'zai_assistant_user_update' });
    return res.status(500).json({ error: 'Failed to update user ZAI assistant setting.' });
  }
});

router.get('/master/overview', async (req, res) => {
  try {
    const [database, infra, nodeData] = await Promise.all([
      loadDatabaseStats(),
      loadInfraStats(),
      loadNodesStats(),
    ]);

    const payload = {
      generatedAt: new Date().toISOString(),
      master: {
        enabled: String(process.env.MASTER || '').trim().toLowerCase() === 'true',
        hostname: process.env.MASTER_HOSTNAME || os.hostname(),
        registrationTokenConfigured: Boolean(String(process.env.NODE_REGISTRATION_TOKEN || '').trim()),
      },
      infra,
      backend: loadBackendStats(req),
      database,
      whatsapp: loadWhatsappStats(req),
      users: await loadUserStats(req),
      nodes: nodeData,
    };

    await logAdminAction(req, 'overview_read');
    return res.status(200).json(payload);
  } catch (error) {
    errorLog(error, { scope: 'admin_master', action: 'overview_read' });
    return res.status(500).json({ error: 'Failed to load admin master overview.' });
  }
});

router.get('/master/users', async (req, res) => {
  try {
    const users = (await query(`SELECT id, tenant_id, username, email, role, blocked, plan, whatsapp_limit, created_at, updated_at, last_login_at
      FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC`)).rows;
    await logAdminAction(req, 'users_list', { targetType: 'user' });
    const safeUsers = users.map((user) => { const safe = { ...user }; delete safe.password_hash; delete safe.passwordHash; return safe; });
    return res.status(200).json({ users: safeUsers, total: safeUsers.length });
  } catch (error) {
    errorLog(error, { scope: 'admin_master', action: 'users_list' });
    return res.status(500).json({ error: 'Failed to list users.' });
  }
});

router.get('/master/users/:id', async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId)) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }

    const user = await userRepository.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    await logAdminAction(req, 'user_read', { targetType: 'user', targetId: String(userId) });
    const safeUser = { ...user }; delete safeUser.password_hash; delete safeUser.passwordHash;
    return res.status(200).json({ user: safeUser });
  } catch (error) {
    errorLog(error, { scope: 'admin_master', action: 'user_read' });
    return res.status(500).json({ error: 'Failed to get user.' });
  }
});

router.patch('/master/users/:id', async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId)) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }

    const updates = {};
    if (req.body.email !== undefined) updates.email = String(req.body.email).trim() || null;
    if (req.body.role !== undefined) updates.role = String(req.body.role).trim();
    if (req.body.blocked !== undefined) updates.blocked = Boolean(req.body.blocked);
    if (req.body.plan !== undefined) updates.plan = String(req.body.plan).trim();
    if (req.body.whatsappLimit !== undefined) updates.whatsappLimit = Number(req.body.whatsappLimit) || 1;
    if (req.body.password !== undefined) {
      const hash = crypto.createHash('sha256').update(String(req.body.password)).digest('hex');
      updates.passwordHash = hash;
    }

    const updatedUser = await userRepository.updateUser(userId, updates);
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    await logAdminAction(req, 'user_updated', { targetType: 'user', targetId: String(userId), updates });
    const safeUser = { ...updatedUser }; delete safeUser.password_hash; delete safeUser.passwordHash;
    return res.status(200).json({ user: safeUser });
  } catch (error) {
    errorLog(error, { scope: 'admin_master', action: 'user_updated' });
    return res.status(500).json({ error: 'Failed to update user.' });
  }
});

router.delete('/master/users/:id', async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId)) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }

    const user = await userRepository.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (user.role === 'master_admin') {
      return res.status(403).json({ error: 'Cannot delete master_admin user.' });
    }

    const deletedUser = await userRepository.softDeleteUser(userId);
    await logAdminAction(req, 'user_deleted', { targetType: 'user', targetId: String(userId), username: user.username });
    return res.status(200).json({ user: deletedUser });
  } catch (error) {
    errorLog(error, { scope: 'admin_master', action: 'user_deleted' });
    return res.status(500).json({ error: 'Failed to delete user.' });
  }
});

router.post(['/master/impersonate/:id', '/impersonate'], async (req, res) => {
  try {
    const userId = Number(req.params.id || req.body.userId);
    if (!Number.isInteger(userId)) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }

    const targetUser = await userRepository.getUserById(userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (targetUser.blocked) {
      return res.status(403).json({ error: 'Cannot impersonate blocked user.' });
    }

    const secret = process.env.JWT_SECRET || process.env.AUTH_JWT_SECRET || '';
    if (!secret) {
      return res.status(503).json({ error: 'Authentication is not configured.' });
    }

    const issuedAt = Math.floor(Date.now() / 1000);
    const ttlSeconds = Number(process.env.AUTH_IMPERSONATE_TTL_SECONDS || 15 * 60);
    const expiresAt = issuedAt + ttlSeconds;

    const payload = {
      sub: targetUser.username,
      username: targetUser.username,
      tenantId: targetUser.tenant_id,
      companyId: targetUser.tenant_id,
      role: targetUser.role,
      impersonatedBy: req.auth?.username || 'unknown',
      impersonatedAt: issuedAt,
      iat: issuedAt,
      exp: expiresAt,
    };

    const token = signHs256Jwt(payload, secret);

    await logAdminAction(req, 'impersonate_user', { targetType: 'user', targetId: String(userId), username: targetUser.username });

    return res.status(200).json({
      token,
      tokenType: 'Bearer',
      expiresIn: expiresAt - issuedAt,
      expiresAt,
      user: {
        username: targetUser.username,
        role: targetUser.role,
        impersonatedBy: req.auth?.username || 'unknown',
      },
    });
  } catch (error) {
    errorLog(error, { scope: 'admin_master', action: 'impersonate_user' });
    return res.status(500).json({ error: 'Failed to impersonate user.' });
  }
});

router.post(['/master/return-session', '/impersonate/stop'], async (req, res) => {
  try {
    const secret = process.env.JWT_SECRET || process.env.AUTH_JWT_SECRET || '';
    if (!secret) {
      return res.status(503).json({ error: 'Authentication is not configured.' });
    }

    const issuedAt = Math.floor(Date.now() / 1000);
    const ttlSeconds = Number(process.env.AUTH_TOKEN_TTL_SECONDS || 8 * 60 * 60);
    const expiresAt = issuedAt + ttlSeconds;

    const payload = {
      sub: req.auth?.username || req.auth?.sub || 'admin',
      username: req.auth?.username || req.auth?.sub || 'admin',
      tenantId: req.authTenantId || req.auth?.tenantId || 'default',
      companyId: req.authTenantId || req.auth?.tenantId || 'default',
      role: 'master_admin',
      iat: issuedAt,
      exp: expiresAt,
    };

    const token = signHs256Jwt(payload, secret);

    await logAdminAction(req, 'return_session');

    return res.status(200).json({
      token,
      tokenType: 'Bearer',
      expiresIn: expiresAt - issuedAt,
      expiresAt,
      user: {
        username: payload.username,
        role: 'master_admin',
      },
    });
  } catch (error) {
    errorLog(error, { scope: 'admin_master', action: 'return_session' });
    return res.status(500).json({ error: 'Failed to return to admin session.' });
  }
});

router.get('/master/whatsapp', async (req, res) => {
  try {
    const stats = loadWhatsappStats(req);
    await logAdminAction(req, 'whatsapp_list', { targetType: 'session' });
    return res.status(200).json(stats);
  } catch (error) {
    errorLog(error, { scope: 'admin_master', action: 'whatsapp_list' });
    return res.status(500).json({ error: 'Failed to get WhatsApp sessions.' });
  }
});

router.post('/master/whatsapp/:id/restart', async (req, res) => {
  try {
    const sessionId = String(req.params.id).trim();
    await logAdminAction(req, 'whatsapp_restart', { targetType: 'session', targetId: sessionId });

    const sessionManager = req.app.locals.store?.sessionManager;
    if (!sessionManager) {
      return res.status(503).json({ error: 'Session manager not available.' });
    }

    await sessionManager.disposeSession(sessionId, { preserveReconnectAttempts: false });
    await sessionManager.startSession(sessionId, { forceNew: true });

    return res.status(200).json({ message: `Session ${sessionId} restarted.` });
  } catch (error) {
    errorLog(error, { scope: 'admin_master', action: 'whatsapp_restart' });
    return res.status(500).json({ error: 'Failed to restart WhatsApp session.' });
  }
});

router.post('/master/whatsapp/:id/disconnect', async (req, res) => {
  try {
    const sessionId = String(req.params.id).trim();
    await logAdminAction(req, 'whatsapp_disconnect', { targetType: 'session', targetId: sessionId });

    const sessionManager = req.app.locals.store?.sessionManager;
    if (!sessionManager) {
      return res.status(503).json({ error: 'Session manager not available.' });
    }

    await sessionManager.disposeSession(sessionId, { logout: true });

    return res.status(200).json({ message: `Session ${sessionId} disconnected.` });
  } catch (error) {
    errorLog(error, { scope: 'admin_master', action: 'whatsapp_disconnect' });
    return res.status(500).json({ error: 'Failed to disconnect WhatsApp session.' });
  }
});

router.get('/master/system', async (req, res) => {
  try {
    const infra = await loadInfraStats();
    const backend = loadBackendStats(req);
    const database = await loadDatabaseStats();

    await logAdminAction(req, 'system_status');

    return res.status(200).json({
      generatedAt: new Date().toISOString(),
      infra,
      backend,
      database,
    });
  } catch (error) {
    errorLog(error, { scope: 'admin_master', action: 'system_status' });
    return res.status(500).json({ error: 'Failed to get system status.' });
  }
});

router.get('/master/logs', async (req, res) => {
  try {
    const limit = Math.min(500, Number(req.query.limit) || 100);
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const action = req.query.action || null;
    const targetType = req.query.targetType || null;
    const targetId = req.query.targetId || null;

    const logs = await auditLogRepository.listAuditLogs({
      tenantId: req.authTenantId || req.auth?.tenantId || 'default',
      limit,
      offset,
      action,
      targetType,
      targetId,
    });

    const total = await auditLogRepository.getAuditLogCount({
      tenantId: req.authTenantId || req.auth?.tenantId || 'default',
      action,
      targetType,
      targetId,
    });

    return res.status(200).json({ logs, total, limit, offset });
  } catch (error) {
    errorLog(error, { scope: 'admin_master', action: 'logs_list' });
    return res.status(500).json({ error: 'Failed to get audit logs.' });
  }
});

router.post('/master/actions/restart-backend', async (req, res) => {
  try {
    const processName = String(process.env.PM2_BACKEND_PROCESS_NAME || 'zapai-backend').trim() || 'zapai-backend';

    if (!canExecuteAdminRestart()) {
      await logAdminAction(req, 'restart_backend_blocked', {
        reason: 'ALLOW_ADMIN_BACKEND_RESTART is false',
      });
      return res.status(403).json({
        accepted: false,
        message: 'Backend restart is disabled. Set ALLOW_ADMIN_BACKEND_RESTART=true to enable.',
      });
    }

    const restartResult = runPm2Command(['restart', processName]);

    await logAdminAction(req, 'restart_backend_executed', {
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


const path = require('path');
const { execSync } = require('child_process');

async function getMasterVersions(req, res) {
  try {
    let commits = [];
    try {
      const gitLogOutput = execSync(
        'git log -n 30 --pretty=format:"%H|%h|%ad|%s|%an" --date=short',
        { cwd: path.join(__dirname, '..', '..') }
      ).toString();

      commits = gitLogOutput.split('\n').filter(Boolean).map((line) => {
        const [hash, shortHash, date, message, author] = line.split('|');
        return {
          hash,
          shortHash,
          date,
          message,
          author,
        };
      });
    } catch (gitErr) {
      console.warn('[ADMIN-MASTER] Failed to get git log:', gitErr.message);
    }

    return res.status(200).json({
      success: true,
      commits,
      currentVersion: commits[0]?.shortHash || 'unknown',
    });
  } catch (error) {
    console.error('[ADMIN-MASTER] versions error:', error);
    return res.status(500).json({ error: 'Failed to retrieve version history.' });
  }
}

module.exports = router;
