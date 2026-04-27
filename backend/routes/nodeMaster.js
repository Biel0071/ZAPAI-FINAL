const express = require('express');
const crypto = require('crypto');
const { query } = require('../config/database');

const router = express.Router();

const MASTER_PANEL_TOKEN = process.env.MASTER_PANEL_TOKEN || process.env.MASTER_TOKEN || '';
const NODE_REGISTRATION_TOKEN = process.env.NODE_REGISTRATION_TOKEN || '';
const OFFLINE_AFTER_SECONDS = Number(process.env.NODE_OFFLINE_AFTER_SECONDS || 90);
const MASTER_MODE = String(process.env.MASTER || '').trim().toLowerCase() === 'true';

function getBearerToken(req) {
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) return '';
  return header.slice(7).trim();
}

function requireMasterToken(req, res, next) {
  if (!MASTER_PANEL_TOKEN) {
    return res.status(503).json({ success: false, error: 'MASTER token not configured' });
  }

  const token = getBearerToken(req);
  if (!token || token !== MASTER_PANEL_TOKEN) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  return next();
}

async function requireNodeToken(req, res, next) {
  const bodyNodeId = String(req.body.node_id || '').trim();
  if (!bodyNodeId) {
    return res.status(400).json({ success: false, error: 'node_id is required' });
  }

  const bearer = getBearerToken(req);
  const token = bearer || String(req.headers['x-node-token'] || req.body.token || '').trim();
  if (!token) {
    return res.status(401).json({ success: false, error: 'Node token required' });
  }

  const check = await query('SELECT node_id FROM nodes WHERE node_id = $1 AND token = $2 LIMIT 1', [bodyNodeId, token]);
  if (!check.rows.length) {
    return res.status(401).json({ success: false, error: 'Invalid node credentials' });
  }

  req.nodeId = bodyNodeId;
  return next();
}

function generateNodeToken() {
  return crypto.randomBytes(48).toString('hex');
}

async function registerNodeHandler(req, res) {
  try {
    if (NODE_REGISTRATION_TOKEN) {
      const registrationToken = String(req.headers['x-registration-token'] || '').trim();
      if (!registrationToken || registrationToken !== NODE_REGISTRATION_TOKEN) {
        return res.status(401).json({ success: false, error: 'Invalid registration token' });
      }
    }

    const explicitNodeId = String(req.body.node_id || '').trim();
    const hostname = String(req.body.hostname || req.body.name || '').trim();
    const ipAddress = String(req.body.ip || req.body.ip_address || '').trim();
    const version = String(req.body.version || '1.0.0').trim();
    const port = Number(req.body.port || req.body.api_port || 4025);

    if (!hostname || !ipAddress) {
      return res.status(400).json({ success: false, error: 'hostname and ip are required' });
    }

    const baseNodeId = explicitNodeId || `node_${hostname.replace(/[^a-zA-Z0-9_-]/g, '-')}_${ipAddress.replace(/[^0-9a-zA-Z]/g, '_')}`;

    const existing = await query(
      `SELECT node_id, token
         FROM nodes
        WHERE node_id = $1 OR (name = $2 AND ip_address = $3)
        ORDER BY created_at ASC
        LIMIT 1`,
      [baseNodeId, hostname, ipAddress],
    );

    let nodeId = baseNodeId;
    let nodeToken = generateNodeToken();

    if (existing.rows.length) {
      nodeId = String(existing.rows[0].node_id);
      nodeToken = String(existing.rows[0].token);

      await query(
        `UPDATE nodes
            SET name = $2,
                ip_address = $3,
                api_port = $4,
                version = $5,
                status = 'online',
                last_heartbeat = NOW(),
                last_seen = NOW(),
                updated_at = NOW()
          WHERE node_id = $1`,
        [nodeId, hostname, ipAddress, port, version],
      );
    } else {
      await query(
        `INSERT INTO nodes (node_id, name, ip_address, api_port, token, status, version, last_heartbeat, last_seen)
              VALUES ($1, $2, $3, $4, $5, 'online', $6, NOW(), NOW())`,
        [nodeId, hostname, ipAddress, port, nodeToken, version],
      );
    }

    return res.json({
      success: true,
      master_mode: MASTER_MODE,
      node: {
        node_id: nodeId,
        hostname,
        ip: ipAddress,
        status: 'online',
      },
      token: nodeToken,
      heartbeat_interval_ms: 30_000,
    });
  } catch (error) {
    console.error('[NodeMaster] register error:', error);
    return res.status(500).json({ success: false, error: 'Failed to register node' });
  }
}

async function processHeartbeat(nodeId, req, res) {
  const metrics = req.body.metrics || {};

  const cpuUsage = Number(metrics.cpu?.usage ?? req.body.cpu_usage ?? 0) || 0;
  const memoryUsage = Number(metrics.ram?.usage ?? req.body.memory_usage ?? 0) || 0;
  const diskUsage = Number(metrics.disk?.usedPercent ?? req.body.disk_usage ?? 0) || 0;
  const uptimeSeconds = Number(metrics.uptime?.seconds ?? req.body.uptime_seconds ?? 0) || 0;

  await query(
    `UPDATE nodes
        SET status = 'online',
            last_heartbeat = NOW(),
            last_seen = NOW(),
            version = COALESCE($2, version),
            updated_at = NOW()
      WHERE node_id = $1`,
    [nodeId, String(req.body.version || '').trim() || null],
  );

  await query(
    `INSERT INTO heartbeats (
        node_id, cpu_usage, memory_usage, disk_usage, uptime_seconds,
        active_sessions, total_sessions, whatsapp_connected, messages_today, errors_count
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      nodeId,
      cpuUsage,
      memoryUsage,
      diskUsage,
      uptimeSeconds,
      Number(req.body.active_sessions || 0),
      Number(req.body.total_sessions || 0),
      Boolean(req.body.whatsapp_connected || false),
      Number(req.body.messages_today || 0),
      Number(req.body.errors_count || 0),
    ],
  );

  return res.json({ success: true, timestamp: new Date().toISOString(), master_mode: MASTER_MODE });
}

async function heartbeatHandler(req, res) {
  try {
    const nodeId = req.nodeId;
    return await processHeartbeat(nodeId, req, res);
  } catch (error) {
    console.error('[NodeMaster] heartbeat error:', error);
    return res.status(500).json({ success: false, error: 'Failed to process heartbeat' });
  }
}

router.post('/node/register', registerNodeHandler);

router.post('/master/register-node', registerNodeHandler);

router.post('/node/heartbeat', requireNodeToken, heartbeatHandler);

router.post('/master/heartbeat', requireNodeToken, heartbeatHandler);

router.get('/master/registration-token', requireMasterToken, async (_req, res) => {
  try {
    return res.json({
      success: true,
      master_mode: MASTER_MODE,
      token: NODE_REGISTRATION_TOKEN || null,
      has_token: Boolean(NODE_REGISTRATION_TOKEN),
    });
  } catch (error) {
    console.error('[NodeMaster] registration token error:', error);
    return res.status(500).json({ success: false, error: 'Failed to read registration token' });
  }
});

router.get('/master/nodes', requireMasterToken, async (_req, res) => {
  try {
    await query(
      `UPDATE nodes
          SET status = 'offline', updated_at = NOW()
        WHERE last_seen IS NOT NULL
          AND last_seen < NOW() - ($1::text || ' seconds')::interval
          AND status <> 'offline'`,
      [OFFLINE_AFTER_SECONDS],
    );

    const result = await query(
      `SELECT
          n.node_id,
          n.name AS hostname,
          n.ip_address AS ip,
          n.status,
          n.last_heartbeat,
          n.last_seen,
          h.cpu_usage AS cpu,
          h.memory_usage AS ram,
          h.disk_usage AS disk
       FROM nodes n
       LEFT JOIN LATERAL (
         SELECT cpu_usage, memory_usage, disk_usage
           FROM heartbeats
          WHERE node_id = n.node_id
          ORDER BY received_at DESC
          LIMIT 1
       ) h ON true
       ORDER BY n.last_seen DESC NULLS LAST`,
      [],
    );

    return res.json({ success: true, nodes: result.rows, total: result.rows.length });
  } catch (error) {
    console.error('[NodeMaster] list nodes error:', error);
    return res.status(500).json({ success: false, error: 'Failed to list nodes' });
  }
});

router.post('/master/nodes/:nodeId/restart', requireMasterToken, async (req, res) => {
  try {
    const nodeId = String(req.params.nodeId || '').trim();
    if (!nodeId) {
      return res.status(400).json({ success: false, error: 'nodeId is required' });
    }

    await query(
      `INSERT INTO remote_commands (node_id, command_type, payload, status)
       VALUES ($1, 'restart', $2, 'pending')`,
      [nodeId, req.body?.payload || {}],
    );

    return res.json({ success: true, message: 'Restart command queued', node_id: nodeId });
  } catch (error) {
    console.error('[NodeMaster] restart error:', error);
    return res.status(500).json({ success: false, error: 'Failed to request restart' });
  }
});

module.exports = router;
