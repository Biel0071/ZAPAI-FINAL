const express = require('express');
const { query } = require('../config/database');

const router = express.Router();

const MASTER_PANEL_TOKEN = process.env.MASTER_PANEL_TOKEN || process.env.MASTER_TOKEN || '';

function requireMasterToken(req, res, next) {
  if (!MASTER_PANEL_TOKEN) {
    return res.status(503).json({ success: false, error: 'MASTER token not configured' });
  }
  const header = String(req.headers.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token || token !== MASTER_PANEL_TOKEN) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  return next();
}

// ── GET /api/cluster/overview ─────────────────────────────────────────────
router.get('/overview', requireMasterToken, async (_req, res) => {
  try {
    const nodesResult = await query(`
      SELECT COUNT(*) AS total,
             COUNT(*) FILTER (WHERE status = 'online') AS online,
             COUNT(*) FILTER (WHERE status = 'offline') AS offline,
             COUNT(*) FILTER (WHERE status = 'degraded') AS degraded
        FROM nodes
    `);

    const metricsResult = await query(`
      SELECT node_id, metric_type, metric_name, metric_value, recorded_at
        FROM node_metrics
       WHERE recorded_at > NOW() - INTERVAL '5 minutes'
       ORDER BY recorded_at DESC
       LIMIT 100
    `);

    const alertsResult = await query(`
      SELECT id, node_id, alert_type, severity, title, status, created_at
        FROM runtime_alerts
       WHERE status = 'active'
       ORDER BY created_at DESC
       LIMIT 20
    `);

    const deploymentsResult = await query(`
      SELECT id, node_id, deployment_type, status, started_at, completed_at, duration_seconds
        FROM node_deployments
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
      recent_metrics: metricsResult.rows,
      active_alerts: alertsResult.rows,
      recent_deployments: deploymentsResult.rows,
    });
  } catch (error) {
    console.error('[Cluster] overview error:', error);
    return res.status(500).json({ success: false, error: 'Failed to get cluster overview' });
  }
});

// ── GET /api/cluster/events ──────────────────────────────────────────────
router.get('/events', requireMasterToken, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const nodeId = String(req.query.node_id || '').trim();
    const severity = String(req.query.severity || '').trim();

    let sql = 'SELECT * FROM cluster_events WHERE 1=1';
    const params = [];

    if (nodeId) {
      params.push(nodeId);
      sql += ` AND node_id = $${params.length}`;
    }
    if (severity) {
      params.push(severity);
      sql += ` AND severity = $${params.length}`;
    }

    params.push(limit);
    sql += ` ORDER BY created_at DESC LIMIT $${params.length}`;

    const result = await query(sql, params);
    return res.json({ success: true, events: result.rows, total: result.rows.length });
  } catch (error) {
    console.error('[Cluster] events error:', error);
    return res.status(500).json({ success: false, error: 'Failed to get cluster events' });
  }
});

// ── GET /api/cluster/alerts ─────────────────────────────────────────────
router.get('/alerts', requireMasterToken, async (_req, res) => {
  try {
    const result = await query(`
      SELECT ra.*, n.name AS node_name, n.ip_address AS node_ip
        FROM runtime_alerts ra
        LEFT JOIN nodes n ON ra.node_id = n.node_id
       WHERE ra.status = 'active'
       ORDER BY ra.created_at DESC
       LIMIT 50
    `);
    return res.json({ success: true, alerts: result.rows });
  } catch (error) {
    console.error('[Cluster] alerts error:', error);
    return res.status(500).json({ success: false, error: 'Failed to get alerts' });
  }
});

// ── POST /api/cluster/alerts/:id/acknowledge ────────────────────────────
router.post('/alerts/:id/acknowledge', requireMasterToken, async (req, res) => {
  try {
    const alertId = Number(req.params.id);
    await query(`
      UPDATE runtime_alerts
         SET status = 'acknowledged',
             acknowledged_by = $2,
             acknowledged_at = NOW(),
             updated_at = NOW()
       WHERE id = $1
    `, [alertId, String(req.body.acknowledged_by || 'admin')]);
    return res.json({ success: true });
  } catch (error) {
    console.error('[Cluster] acknowledge error:', error);
    return res.status(500).json({ success: false, error: 'Failed to acknowledge alert' });
  }
});

// ── GET /api/cluster/nodes/:nodeId/metrics ──────────────────────────────
router.get('/nodes/:nodeId/metrics', requireMasterToken, async (req, res) => {
  try {
    const nodeId = String(req.params.nodeId).trim();
    const hours = Math.min(Number(req.query.hours || 1), 24);

    const result = await query(`
      SELECT metric_type, metric_name, metric_value, unit, recorded_at
        FROM node_metrics
       WHERE node_id = $1
         AND recorded_at > NOW() - ($2::text || ' hours')::interval
       ORDER BY recorded_at DESC
       LIMIT 500
    `, [nodeId, hours]);

    return res.json({ success: true, node_id: nodeId, metrics: result.rows });
  } catch (error) {
    console.error('[Cluster] node metrics error:', error);
    return res.status(500).json({ success: false, error: 'Failed to get node metrics' });
  }
});

// ── GET /api/cluster/nodes/:nodeId/deployments ──────────────────────────
router.get('/nodes/:nodeId/deployments', requireMasterToken, async (req, res) => {
  try {
    const nodeId = String(req.params.nodeId).trim();
    const result = await query(`
      SELECT * FROM node_deployments
       WHERE node_id = $1
       ORDER BY created_at DESC
       LIMIT 20
    `, [nodeId]);
    return res.json({ success: true, deployments: result.rows });
  } catch (error) {
    console.error('[Cluster] node deployments error:', error);
    return res.status(500).json({ success: false, error: 'Failed to get deployments' });
  }
});

// ── POST /api/cluster/nodes/:nodeId/deploy ──────────────────────────────
router.post('/nodes/:nodeId/deploy', requireMasterToken, async (req, res) => {
  try {
    const nodeId = String(req.params.nodeId).trim();
    const deployType = String(req.body.type || 'deploy').trim();
    const gitRef = String(req.body.git_ref || 'main').trim();

    // Insert deployment record
    const result = await query(`
      INSERT INTO node_deployments (node_id, deployment_type, git_ref, status, started_at, triggered_by)
      VALUES ($1, $2, $3, 'pending', NOW(), $4)
      RETURNING id
    `, [nodeId, deployType, gitRef, String(req.body.triggered_by || 'api')]);

    // Queue the remote command
    await query(`
      INSERT INTO remote_commands (node_id, command_type, payload, status)
      VALUES ($1, $2, $3, 'pending')
    `, [nodeId, deployType, JSON.stringify({ deployment_id: result.rows[0].id, git_ref: gitRef })]);

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

    // Verify node credentials
    const check = await query('SELECT node_id FROM nodes WHERE node_id = $1 AND token = $2 LIMIT 1', [nodeId, nodeToken]);
    if (!check.rows.length) {
      return res.status(401).json({ success: false, error: 'Invalid node credentials' });
    }

    const metrics = req.body.metrics || [];
    if (!Array.isArray(metrics) || metrics.length === 0) {
      return res.json({ success: true, ingested: 0 });
    }

    // Batch insert
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
