const express = require('express');
const { query } = require('../config/database');

const router = express.Router();

function requireMasterAdmin(req, res, next) {
  console.log('[DEBUG] requireMasterAdmin - req.auth:', req.auth);
  const role = String(req.auth?.role || '').trim().toLowerCase();
  if (role !== 'master_admin' && role !== 'admin' && role !== 'master') {
    console.log('[DEBUG] requireMasterAdmin - Denied role:', role);
    return res.status(403).json({ success: false, error: 'master_admin or admin role required.' });
  }
  return next();
}


// ── GET /api/cluster/overview ─────────────────────────────────────────────
router.get('/overview', requireMasterAdmin, async (_req, res) => {
  try {
    const nodesResult = await query(`
      SELECT COUNT(*) AS total,
             COUNT(*) FILTER (WHERE status = 'online') AS online,
             COUNT(*) FILTER (WHERE status = 'offline') AS offline,
             COUNT(*) FILTER (WHERE status = 'degraded') AS degraded
        FROM nodes
    `);

    const healthResult = await query(`
      SELECT node_id, component, status, message, last_check_at
        FROM runtime_health
       WHERE status != 'healthy'
       ORDER BY last_check_at DESC
       LIMIT 20
    `);

    const deploymentsResult = await query(`
      SELECT id, node_id, deployment_type, status, started_at, completed_at, duration_seconds
        FROM deployments
       ORDER BY created_at DESC
       LIMIT 10
    `);

    const stats = nodesResult.rows[0] || {};

    return res.json({
      success: true,
      cluster: {
        nodes_total: Number(stats.total || 0),
        nodes_online: Number(stats.online || 0),
        nodes_offline: Number(stats.offline || 0),
        nodes_degraded: Number(stats.degraded || 0),
      },
      health_alerts: healthResult.rows,
      recent_deployments: deploymentsResult.rows,
    });
  } catch (error) {
    console.error('[Cluster] overview error:', error);
    return res.status(500).json({ success: false, error: 'Failed to get cluster overview' });
  }
});

// ── GET /api/cluster/nodes ────────────────────────────────────────────────
router.get('/nodes', requireMasterAdmin, async (_req, res) => {
  try {
    const result = await query(`
      SELECT n.id, n.node_id, n.name,
             COALESCE(NULLIF(n.hostname, 'unknown'), n.name, n.node_id) AS hostname,
             COALESCE(NULLIF(n.ip, '0.0.0.0'), n.ip_address) AS ip,
             n.status, n.node_type, n.last_heartbeat, n.cpu_cores, n.ram_total, 
             n.uptime_seconds, n.provider, n.version, n.docker_version, n.sessions_active, n.health_status, n.services, n.build_hash,
             h.cpu_usage, h.memory_usage, h.disk_usage, h.uptime_seconds AS hb_uptime, h.active_sessions AS hb_sessions
        FROM nodes n
        LEFT JOIN LATERAL (
          SELECT cpu_usage, memory_usage, disk_usage, uptime_seconds, active_sessions
            FROM heartbeats
           WHERE node_id = n.node_id
           ORDER BY received_at DESC
           LIMIT 1
        ) h ON true
       ORDER BY n.created_at DESC
    `);

    const nodes = result.rows.map(row => {
      let services = row.services;
      if (typeof services === 'string') {
        try {
          services = JSON.parse(services);
        } catch {
          services = {};
        }
      }
      return {
        id: row.node_id,
        node_id: row.node_id,
        name: row.name || row.hostname || row.node_id,
        hostname: row.hostname,
        ip: row.ip,
        publicIp: row.ip,
        status: row.status,
        node_type: row.node_type,
        last_heartbeat: row.last_heartbeat,
        cpu_cores: row.cpu_cores,
        ram_total: row.ram_total,
        uptime_seconds: row.uptime_seconds,
        provider: row.provider,
        version: row.version,
        docker_version: row.docker_version,
        sessions_active: row.sessions_active,
        health_status: row.health_status,
        services: services || {},
        build: {
          version: row.version,
          buildHash: row.build_hash || null,
        },
        metrics: {
          cpuPercent: row.cpu_usage !== null ? Number(row.cpu_usage) : null,
          ramPercent: row.memory_usage !== null ? Number(row.memory_usage) : null,
          diskPercent: row.disk_usage !== null ? Number(row.disk_usage) : null,
          activeSessions: row.hb_sessions !== null ? Number(row.hb_sessions) : Number(row.sessions_active || 0),
          uptime: row.hb_uptime !== null ? Number(row.hb_uptime) : Number(row.uptime_seconds || 0),
        }
      };
    });

    return res.json({ success: true, nodes });
  } catch (error) {
    console.error('[Cluster] nodes error:', error);
    return res.status(500).json({ success: false, error: 'Failed to get nodes' });
  }
});

// ── GET /api/cluster/metrics ──────────────────────────────────────────────
router.get('/metrics', requireMasterAdmin, async (req, res) => {
  try {
    const nodeId = String(req.query.node_id || '').trim();
    const limit = Math.min(Number(req.query.limit || 100), 1000);

    let sql = `
      SELECT node_id, cpu_usage, memory_usage, disk_usage, uptime_seconds, active_sessions, received_at AS timestamp
        FROM heartbeats
       WHERE received_at > NOW() - INTERVAL '24 hours'
    `;
    const params = [];

    if (nodeId) {
      params.push(nodeId);
      sql += ` AND node_id = $${params.length}`;
    }

    params.push(limit);
    sql += ` ORDER BY received_at DESC LIMIT $${params.length}`;

    const result = await query(sql, params);

    const formattedMetrics = result.rows.map(row => ({
      nodeId: row.node_id,
      cpuPercent: row.cpu_usage !== null ? Number(row.cpu_usage) : null,
      ramPercent: row.memory_usage !== null ? Number(row.memory_usage) : null,
      diskPercent: row.disk_usage !== null ? Number(row.disk_usage) : null,
      activeSessions: row.active_sessions !== null ? Number(row.active_sessions) : null,
      uptime: row.uptime_seconds !== null ? Number(row.uptime_seconds) : null,
      timestamp: row.timestamp,
    }));

    return res.json({ success: true, metrics: formattedMetrics });
  } catch (error) {
    console.error('[Cluster] metrics error:', error);
    return res.status(500).json({ success: false, error: 'Failed to get metrics' });
  }
});

// ── GET /api/cluster/logs ─────────────────────────────────────────────────
router.get('/logs', requireMasterAdmin, async (req, res) => {
  try {
    const deploymentId = Number(req.query.deployment_id || 0);
    const limit = Math.min(Number(req.query.limit || 100), 500);

    let sql = `
      SELECT id, deployment_id, log_level, message, created_at
        FROM deployment_logs
       WHERE 1=1
    `;
    const params = [];

    if (deploymentId) {
      params.push(deploymentId);
      sql += ` AND deployment_id = $${params.length}`;
    }

    params.push(limit);
    sql += ` ORDER BY created_at DESC LIMIT $${params.length}`;

    const result = await query(sql, params);
    return res.json({ success: true, logs: result.rows });
  } catch (error) {
    console.error('[Cluster] logs error:', error);
    return res.status(500).json({ success: false, error: 'Failed to get logs' });
  }
});

// ── GET /api/cluster/deployments ──────────────────────────────────────────
router.get('/deployments', requireMasterAdmin, async (req, res) => {
  try {
    const nodeId = String(req.query.node_id || '').trim();
    const limit = Math.min(Number(req.query.limit || 20), 100);

    let sql = `
      SELECT id, node_id, deployment_type, git_ref, build_hash, status, started_at, completed_at, duration_seconds
        FROM deployments
       WHERE 1=1
    `;
    const params = [];

    if (nodeId) {
      params.push(nodeId);
      sql += ` AND node_id = $${params.length}`;
    }

    params.push(limit);
    sql += ` ORDER BY created_at DESC LIMIT $${params.length}`;

    const result = await query(sql, params);
    return res.json({ success: true, deployments: result.rows });
  } catch (error) {
    console.error('[Cluster] deployments error:', error);
    return res.status(500).json({ success: false, error: 'Failed to get deployments' });
  }
});

// ── GET /api/cluster/health ───────────────────────────────────────────────
router.get('/health', requireMasterAdmin, async (req, res) => {
  try {
    const nodeId = String(req.query.node_id || '').trim();
    let sql = `
      SELECT id, node_id, component, status, message, last_check_at, error_count
        FROM runtime_health
       WHERE 1=1
    `;
    const params = [];

    if (nodeId) {
      params.push(nodeId);
      sql += ` AND node_id = $${params.length}`;
    }

    sql += ` ORDER BY last_check_at DESC LIMIT 100`;

    const result = await query(sql, params);
    return res.json({ success: true, health: result.rows });
  } catch (error) {
    console.error('[Cluster] health error:', error);
    return res.status(500).json({ success: false, error: 'Failed to get health' });
  }
});

// ── POST /api/cluster/nodes/:nodeId/deploy ──────────────────────────────
router.post('/nodes/:nodeId/deploy', requireMasterAdmin, async (req, res) => {
  try {
    const nodeId = String(req.params.nodeId).trim();
    const deployType = String(req.body.type || 'deploy').trim();
    const gitRef = String(req.body.git_ref || 'main').trim();

    const result = await query(`
      INSERT INTO deployments (node_id, deployment_type, git_ref, status, started_at, triggered_by)
      VALUES ($1, $2, $3, 'pending', NOW(), $4)
      RETURNING id
    `, [nodeId, deployType, gitRef, String(req.body.triggered_by || 'api')]);

    await query(`
      INSERT INTO deployment_logs (deployment_id, log_level, message)
      VALUES ($1, 'info', 'Deployment initiated by API')
    `, [result.rows[0].id]);

    return res.json({ success: true, deployment_id: result.rows[0].id, node_id: nodeId });
  } catch (error) {
    console.error('[Cluster] deploy error:', error);
    return res.status(500).json({ success: false, error: 'Failed to create deployment' });
  }
});

// ── POST /api/cluster/metrics/ingest (for node agent) ───────────────────
router.post('/metrics/ingest', async (req, res) => {
  try {
    const nodeId = String(req.body.node_id || '').trim();
    const nodeToken = String(req.headers['x-node-token'] || '').trim();

    if (!nodeId || !nodeToken) {
      return res.status(401).json({ success: false, error: 'node_id and x-node-token required' });
    }

    const check = await query('SELECT node_id FROM nodes WHERE node_id = $1 AND token = $2 LIMIT 1', [nodeId, nodeToken]);
    if (!check.rows.length) {
      return res.status(401).json({ success: false, error: 'Invalid node credentials' });
    }

    const metrics = req.body.metrics || [];
    if (!Array.isArray(metrics) || metrics.length === 0) {
      return res.json({ success: true, ingested: 0 });
    }

    const values = [];
    const placeholders = [];
    let paramIndex = 1;

    for (const m of metrics.slice(0, 50)) {
      placeholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4})`);
      values.push(
        nodeId,
        String(m.type || 'unknown'),
        String(m.name || 'unknown'),
        Number(m.value || 0),
        String(m.unit || ''),
      );
      paramIndex += 5;
    }

    if (placeholders.length > 0) {
      await query(
        `INSERT INTO node_metrics (node_id, metric_type, metric_name, metric_value, unit)
         VALUES ${placeholders.join(', ')}`,
        values,
      );
    }

    return res.json({ success: true, ingested: placeholders.length });
  } catch (error) {
    console.error('[Cluster] metrics ingest error:', error);
    return res.status(500).json({ success: false, error: 'Failed to ingest metrics' });
  }
});

module.exports = router;
