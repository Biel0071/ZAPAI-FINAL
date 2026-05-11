const express = require('express');
const { query } = require('../config/database');

const router = express.Router();

function requireMasterAdmin(req, res, next) {
  const role = String(req.auth?.role || '').trim().toLowerCase();
  if (role !== 'master_admin') {
    return res.status(403).json({ success: false, error: 'master_admin role required.' });
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
      SELECT node_id, hostname, ip, status, node_type, last_heartbeat, cpu_cores, ram_total, 
             uptime_seconds, provider, version, docker_version, sessions_active, health_status
        FROM nodes
       ORDER BY created_at DESC
    `);
    return res.json({ success: true, nodes: result.rows });
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
      SELECT node_id, metric_type, metric_name, metric_value, unit, recorded_at
        FROM node_metrics
       WHERE recorded_at > NOW() - INTERVAL '24 hours'
    `;
    const params = [];

    if (nodeId) {
      params.push(nodeId);
      sql += ` AND node_id = $${params.length}`;
    }

    params.push(limit);
    sql += ` ORDER BY recorded_at DESC LIMIT $${params.length}`;

    const result = await query(sql, params);
    return res.json({ success: true, metrics: result.rows });
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
