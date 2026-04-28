const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.MASTER_PORT || 5000;
const MASTER_PANEL_TOKEN = process.env.MASTER_PANEL_TOKEN || process.env.MASTER_TOKEN;
const NODE_REGISTRATION_TOKEN = process.env.NODE_REGISTRATION_TOKEN || '';
const OFFLINE_AFTER_SECONDS = Number(process.env.NODE_OFFLINE_AFTER_SECONDS || 90);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

app.use(helmet());
app.use(cors());
app.use(express.json());

function generateNodeId() {
  return `node_${crypto.randomBytes(16).toString('hex')}`;
}

function generateNodeToken() {
  return crypto.randomBytes(48).toString('hex');
}

function getBearerToken(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return '';
  }
  return header.slice(7);
}

function requireMasterAuth(req, res, next) {
  if (!MASTER_PANEL_TOKEN) {
    return res.status(503).json({ success: false, error: 'MASTER_PANEL_TOKEN not configured' });
  }

  const token = getBearerToken(req);
  if (!token || token !== MASTER_PANEL_TOKEN) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  next();
}

async function requireNodeAuth(req, res, next) {
  const { nodeId } = req.params;
  const token = getBearerToken(req);

  if (!token || !nodeId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  try {
    const result = await pool.query(
      'SELECT node_id FROM nodes WHERE node_id = $1 AND token = $2',
      [nodeId, token]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid node credentials' });
    }

    req.nodeId = nodeId;
    next();
  } catch (error) {
    console.error('Node auth error:', error.message);
    return res.status(500).json({ success: false, error: 'Auth check failed' });
  }
}

async function setNodeDerivedStatus(nodeId) {
  await pool.query(
    `UPDATE nodes
     SET status = CASE
       WHEN last_seen IS NULL THEN status
       WHEN last_seen >= NOW() - ($2::text || ' seconds')::interval THEN 'online'
       ELSE 'offline'
     END,
     updated_at = NOW()
     WHERE node_id = $1`,
    [nodeId, OFFLINE_AFTER_SECONDS]
  );
}

async function createRemoteCommand(nodeId, commandType, payload = {}) {
  const result = await pool.query(
    `INSERT INTO remote_commands (node_id, command_type, payload, status)
     VALUES ($1, $2, $3, 'pending')
     RETURNING *`,
    [nodeId, commandType, payload]
  );
  return result.rows[0];
}

async function ensureClientNodeLink(clientId, clientName, nodeId) {
  if (!clientId || !clientName) {
    return;
  }

  await pool.query(
    `INSERT INTO clients (client_id, name, status)
     VALUES ($1, $2, 'active')
     ON CONFLICT (client_id)
     DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()`,
    [clientId, clientName]
  );

  await pool.query(
    `INSERT INTO client_nodes (client_id, node_id)
     VALUES ($1, $2)
     ON CONFLICT (client_id, node_id)
     DO NOTHING`,
    [clientId, nodeId]
  );
}

app.post('/api/nodes/register', async (req, res) => {
  const {
    name,
    ip_address,
    domain,
    api_port,
    hostname,
    version,
    client_id,
    client_name,
  } = req.body;

  if (!name || !ip_address) {
    return res.status(400).json({
      success: false,
      error: 'name and ip_address are required'
    });
  }

  if (NODE_REGISTRATION_TOKEN) {
    const registrationToken = req.headers['x-registration-token'];
    if (!registrationToken || registrationToken !== NODE_REGISTRATION_TOKEN) {
      return res.status(401).json({ success: false, error: 'Invalid registration token' });
    }
  }

  try {
    const existing = await pool.query(
      `SELECT node_id, token
       FROM nodes
       WHERE name = $1 AND ip_address = $2
       ORDER BY created_at ASC
       LIMIT 1`,
      [name, ip_address]
    );

    let nodeId;
    let nodeToken;

    if (existing.rows.length > 0) {
      nodeId = existing.rows[0].node_id;
      nodeToken = existing.rows[0].token;

      await pool.query(
        `UPDATE nodes
         SET domain = $2,
             api_port = $3,
             version = $4,
             status = 'online',
             last_seen = NOW(),
             last_heartbeat = NOW(),
             updated_at = NOW()
         WHERE node_id = $1`,
        [nodeId, domain || null, api_port || 4025, version || null]
      );
    } else {
      nodeId = generateNodeId();
      nodeToken = generateNodeToken();

      await pool.query(
        `INSERT INTO nodes (
          node_id, name, ip_address, domain, api_port, token, status, version, last_seen, last_heartbeat
        ) VALUES ($1, $2, $3, $4, $5, $6, 'online', $7, NOW(), NOW())`,
        [nodeId, hostname || name, ip_address, domain || null, api_port || 4025, nodeToken, version || null]
      );
    }

    await ensureClientNodeLink(client_id, client_name, nodeId);
    await setNodeDerivedStatus(nodeId);

    res.status(201).json({
      success: true,
      data: {
        node_id: nodeId,
        token: nodeToken,
        master_api_url: `${req.protocol}://${req.get('host')}/api`,
        heartbeat_interval_ms: 30000,
      }
    });
  } catch (error) {
    console.error('Error registering node:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register node'
    });
  }
});

app.post('/api/nodes/:nodeId/heartbeat', requireNodeAuth, async (req, res) => {
  const { nodeId } = req;
  const {
    cpu_usage,
    memory_usage,
    disk_usage,
    uptime_seconds,
    active_sessions,
    total_sessions,
    whatsapp_connected,
    messages_today,
    errors_count
  } = req.body;

  try {
    await pool.query(
      `UPDATE nodes
       SET status = 'online',
           last_heartbeat = NOW(),
           last_seen = NOW(),
           version = COALESCE($2, version),
           updated_at = NOW()
       WHERE node_id = $1`,
      [nodeId, req.body.version || null]
    );

    await pool.query(
      `INSERT INTO heartbeats
       (node_id, cpu_usage, memory_usage, disk_usage, uptime_seconds,
        active_sessions, total_sessions, whatsapp_connected, messages_today, errors_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        nodeId,
        cpu_usage || null,
        memory_usage || null,
        disk_usage || null,
        uptime_seconds || null,
        active_sessions || 0,
        total_sessions || 0,
        whatsapp_connected || false,
        messages_today || 0,
        errors_count || 0
      ]
    );

    await setNodeDerivedStatus(nodeId);

    const commandsResult = await pool.query(
      `SELECT * FROM remote_commands
       WHERE node_id = $1 AND status = 'pending'
       ORDER BY created_at ASC
       LIMIT 10`,
      [nodeId]
    );

    if (commandsResult.rows.length > 0) {
      const commandIds = commandsResult.rows.map(c => c.id);
      await pool.query(
        `UPDATE remote_commands
         SET status = 'sent', sent_at = NOW(), updated_at = NOW()
         WHERE id = ANY($1)`,
        [commandIds]
      );
    }

    res.json({
      success: true,
      data: {
        commands: commandsResult.rows.map(cmd => ({
          id: cmd.id,
          command_type: cmd.command_type,
          payload: cmd.payload
        }))
      }
    });
  } catch (error) {
    console.error('Error processing heartbeat:', error);
    res.status(500).json({ success: false, error: 'Failed to process heartbeat' });
  }
});

app.get('/api/nodes', requireMasterAuth, async (req, res) => {
  const limit = Number(req.query.limit || 100);
  const offset = Number(req.query.offset || 0);

  try {
    await pool.query(
      `UPDATE nodes
       SET status = 'offline', updated_at = NOW()
       WHERE last_seen IS NOT NULL
         AND last_seen < NOW() - ($1::text || ' seconds')::interval
         AND status <> 'offline'`,
      [OFFLINE_AFTER_SECONDS]
    );

    const result = await pool.query(
      `SELECT
        n.node_id,
        n.name,
        n.ip_address,
        n.domain,
        n.api_port,
        CASE
          WHEN n.last_seen IS NULL THEN 'pending'
          WHEN n.last_seen >= NOW() - ($3::text || ' seconds')::interval THEN 'online'
          ELSE 'offline'
        END AS status,
        n.version,
        n.last_heartbeat,
        n.last_seen,
        n.installed_at,
        n.created_at,
        n.updated_at,
        h.cpu_usage,
        h.memory_usage,
        h.disk_usage,
        h.active_sessions,
        h.total_sessions,
        h.whatsapp_connected,
        h.messages_today,
        h.errors_count
      FROM nodes n
      LEFT JOIN LATERAL (
        SELECT *
        FROM heartbeats
        WHERE node_id = n.node_id
        ORDER BY received_at DESC
        LIMIT 1
      ) h ON true
      ORDER BY n.last_seen DESC NULLS LAST
      LIMIT $1 OFFSET $2`,
      [limit, offset, OFFLINE_AFTER_SECONDS]
    );

    res.json({
      success: true,
      data: result.rows,
      meta: { limit, offset }
    });
  } catch (error) {
    console.error('Error fetching nodes:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch nodes' });
  }
});

app.get('/api/master/nodes', requireMasterAuth, async (req, res) => {
  const limit = Number(req.query.limit || 100);
  const offset = Number(req.query.offset || 0);

  try {
    await pool.query(
      `UPDATE nodes
       SET status = 'offline', updated_at = NOW()
       WHERE last_seen IS NOT NULL
         AND last_seen < NOW() - ($1::text || ' seconds')::interval
         AND status <> 'offline'`,
      [OFFLINE_AFTER_SECONDS]
    );

    const result = await pool.query(
      `SELECT
         n.node_id,
         n.name,
         n.ip_address,
         n.domain,
         n.api_port,
         CASE
           WHEN n.last_seen IS NULL THEN 'pending'
           WHEN n.last_seen >= NOW() - ($3::text || ' seconds')::interval THEN 'online'
           ELSE 'offline'
         END AS status,
         n.version,
         n.last_heartbeat,
         n.last_seen,
         h.cpu_usage,
         h.memory_usage,
         h.disk_usage
       FROM nodes n
       LEFT JOIN LATERAL (
         SELECT *
         FROM heartbeats
         WHERE node_id = n.node_id
         ORDER BY received_at DESC
         LIMIT 1
       ) h ON true
       ORDER BY n.last_seen DESC NULLS LAST
       LIMIT $1 OFFSET $2`,
      [limit, offset, OFFLINE_AFTER_SECONDS]
    );

    res.json({ success: true, data: result.rows, meta: { limit, offset } });
  } catch (error) {
    console.error('Error fetching master nodes:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch master nodes' });
  }
});

app.get('/api/nodes/:nodeId', requireMasterAuth, async (req, res) => {
  const { nodeId } = req.params;

  try {
    const result = await pool.query(
      `SELECT * FROM nodes WHERE node_id = $1`,
      [nodeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Node not found' });
    }

    const heartbeatResult = await pool.query(
      `SELECT * FROM heartbeats
       WHERE node_id = $1
       ORDER BY received_at DESC
       LIMIT 1`,
      [nodeId]
    );

    res.json({
      success: true,
      data: {
        ...result.rows[0],
        latest_heartbeat: heartbeatResult.rows[0] || null
      }
    });
  } catch (error) {
    console.error('Error fetching node:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch node' });
  }
});

app.post('/api/master/nodes/:nodeId/deploy', requireMasterAuth, async (req, res) => {
  const { nodeId } = req.params;

  try {
    const command = await createRemoteCommand(nodeId, 'deploy', req.body.payload || req.body || {});
    res.status(201).json({ success: true, data: command });
  } catch (error) {
    console.error('Error creating deploy command:', error);
    res.status(500).json({ success: false, error: 'Failed to create deploy command' });
  }
});

app.post('/api/master/nodes/:nodeId/restart', requireMasterAuth, async (req, res) => {
  const { nodeId } = req.params;

  try {
    const command = await createRemoteCommand(nodeId, 'restart', req.body.payload || {});
    res.status(201).json({ success: true, data: command });
  } catch (error) {
    console.error('Error creating restart command:', error);
    res.status(500).json({ success: false, error: 'Failed to create restart command' });
  }
});

app.post('/api/nodes/:nodeId/commands', requireMasterAuth, async (req, res) => {
  const { nodeId } = req.params;
  const { command_type, payload } = req.body;

  if (!command_type) {
    return res.status(400).json({ success: false, error: 'command_type is required' });
  }

  const validCommands = ['restart', 'deploy', 'update', 'rebuild', 'disconnect_whatsapp', 'backup', 'clear_cache'];
  if (!validCommands.includes(command_type)) {
    return res.status(400).json({ success: false, error: 'Invalid command_type' });
  }

  try {
    const command = await createRemoteCommand(nodeId, command_type, payload || {});
    res.status(201).json({ success: true, data: command });
  } catch (error) {
    console.error('Error creating command:', error);
    res.status(500).json({ success: false, error: 'Failed to create command' });
  }
});

app.get('/api/nodes/:nodeId/commands', requireMasterAuth, async (req, res) => {
  const { nodeId } = req.params;

  try {
    const result = await pool.query(
      `SELECT * FROM remote_commands 
       WHERE node_id = $1 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [nodeId]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching commands:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch commands' });
  }
});

app.post('/api/nodes/:nodeId/commands/:commandId/result', requireNodeAuth, async (req, res) => {
  const { nodeId, commandId } = req.params;
  const { status, result, error_message } = req.body;

  try {
    const updateResult = await pool.query(
      `UPDATE remote_commands
       SET status = $1,
           result = $2,
           error_message = $3,
           completed_at = NOW(),
           updated_at = NOW()
       WHERE id = $4 AND node_id = $5
       RETURNING *`,
      [status, result || {}, error_message || null, commandId, nodeId]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Command not found' });
    }

    res.json({ success: true, data: updateResult.rows[0] });
  } catch (error) {
    console.error('Error updating command result:', error);
    res.status(500).json({ success: false, error: 'Failed to update command result' });
  }
});

app.get('/api/nodes/:nodeId/logs', requireMasterAuth, async (req, res) => {
  const { nodeId } = req.params;
  const { level, limit = 100 } = req.query;

  try {
    let query = `SELECT * FROM node_logs WHERE node_id = $1`;
    const params = [nodeId];

    if (level) {
      query += ` AND level = $2`;
      params.push(level);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch logs' });
  }
});

app.post('/api/nodes/:nodeId/logs', requireNodeAuth, async (req, res) => {
  const { nodeId } = req.params;
  const { logs } = req.body;

  if (!Array.isArray(logs) || logs.length === 0) {
    return res.status(400).json({ success: false, error: 'logs array is required' });
  }

  try {
    for (const log of logs) {
      await pool.query(
        `INSERT INTO node_logs (node_id, level, service, message, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [nodeId, log.level || 'info', log.service || 'agent', log.message || '', log.metadata || {}]
      );
    }

    res.json({ success: true, data: { received: logs.length } });
  } catch (error) {
    console.error('Error saving logs:', error);
    res.status(500).json({ success: false, error: 'Failed to save logs' });
  }
});

app.get('/api/nodes/:nodeId/sessions', requireMasterAuth, async (req, res) => {
  const { nodeId } = req.params;

  try {
    const result = await pool.query(
      `SELECT * FROM whatsapp_sessions 
       WHERE node_id = $1 
       ORDER BY updated_at DESC`,
      [nodeId]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch sessions' });
  }
});

app.post('/api/nodes/:nodeId/sessions', requireNodeAuth, async (req, res) => {
  const { nodeId } = req.params;
  const { sessions } = req.body;

  if (!Array.isArray(sessions)) {
    return res.status(400).json({ success: false, error: 'sessions array is required' });
  }

  try {
    for (const session of sessions) {
      await pool.query(
        `INSERT INTO whatsapp_sessions 
         (node_id, session_id, session_name, phone_number, status, last_activity)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (node_id, session_id) 
         DO UPDATE SET 
           session_name = EXCLUDED.session_name,
           phone_number = EXCLUDED.phone_number,
           status = EXCLUDED.status,
           last_activity = EXCLUDED.last_activity,
           updated_at = NOW()`,
        [
          nodeId,
          session.session_id,
          session.session_name || null,
          session.phone_number || null,
          session.status || 'unknown'
        ]
      );
    }

    res.json({ success: true, data: { updated: sessions.length } });
  } catch (error) {
    console.error('Error updating sessions:', error);
    res.status(500).json({ success: false, error: 'Failed to update sessions' });
  }
});

app.post('/api/master/clients/:clientId/nodes/:nodeId', requireMasterAuth, async (req, res) => {
  const { clientId, nodeId } = req.params;
  const { client_name } = req.body;

  if (!client_name) {
    return res.status(400).json({ success: false, error: 'client_name is required' });
  }

  try {
    await ensureClientNodeLink(clientId, client_name, nodeId);
    res.status(201).json({ success: true, data: { client_id: clientId, node_id: nodeId } });
  } catch (error) {
    console.error('Error linking client and node:', error);
    res.status(500).json({ success: false, error: 'Failed to link client and node' });
  }
});

app.get('/api/master/clients/:clientId/nodes', requireMasterAuth, async (req, res) => {
  const { clientId } = req.params;

  try {
    const result = await pool.query(
      `SELECT n.node_id, n.name, n.ip_address, n.domain, n.status, n.last_seen, n.version
       FROM client_nodes cn
       INNER JOIN nodes n ON n.node_id = cn.node_id
       WHERE cn.client_id = $1
       ORDER BY n.last_seen DESC NULLS LAST`,
      [clientId]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching client nodes:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch client nodes' });
  }
});

app.get('/api/lovable/dashboard', requireMasterAuth, async (req, res) => {
  try {
    const nodesResult = await pool.query(`
      SELECT 
        n.*,
        h.cpu_usage,
        h.memory_usage,
        h.disk_usage,
        h.active_sessions,
        h.whatsapp_connected,
        h.messages_today,
        h.errors_count
      FROM nodes n
      LEFT JOIN LATERAL (
        SELECT * FROM heartbeats 
        WHERE node_id = n.node_id 
        ORDER BY received_at DESC 
        LIMIT 1
      ) h ON true
      ORDER BY n.last_seen DESC
    `);

    const totalNodes = nodesResult.rows.length;
    const onlineNodes = nodesResult.rows.filter(n => n.last_seen && new Date(n.last_seen).getTime() >= Date.now() - (OFFLINE_AFTER_SECONDS * 1000)).length;
    const offlineNodes = totalNodes - onlineNodes;
    const totalSessions = nodesResult.rows.reduce((sum, n) => sum + (n.active_sessions || 0), 0);
    const totalMessages = nodesResult.rows.reduce((sum, n) => sum + (n.messages_today || 0), 0);

    res.json({
      success: true,
      data: {
        summary: {
          total_nodes: totalNodes,
          online_nodes: onlineNodes,
          offline_nodes: offlineNodes,
          total_sessions: totalSessions,
          total_messages_today: totalMessages
        },
        nodes: nodesResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard' });
  }
});

app.get('/api/dashboard/overview', requireMasterAuth, async (_req, res) => {
  try {
    const overview = await pool.query(
      `SELECT
         COUNT(*)::int AS total_nodes,
         COUNT(CASE WHEN last_seen >= NOW() - ($1::text || ' seconds')::interval THEN 1 END)::int AS online_nodes,
         COUNT(CASE WHEN last_seen < NOW() - ($1::text || ' seconds')::interval OR last_seen IS NULL THEN 1 END)::int AS offline_nodes
       FROM nodes`,
      [OFFLINE_AFTER_SECONDS]
    );

    const avgMetrics = await pool.query(
      `SELECT
         ROUND(AVG(cpu_usage)::numeric, 2) AS avg_cpu_usage,
         ROUND(AVG(memory_usage)::numeric, 2) AS avg_memory_usage,
         ROUND(AVG(disk_usage)::numeric, 2) AS avg_disk_usage
       FROM heartbeats
       WHERE received_at >= NOW() - INTERVAL '15 minutes'`
    );

    res.json({
      success: true,
      data: {
        summary: overview.rows[0],
        metrics_15m: avgMetrics.rows[0],
      }
    });
  } catch (error) {
    console.error('Error fetching overview:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch overview' });
  }
});

app.get('/api/master/nodes/status', requireMasterAuth, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         node_id,
         name,
         ip_address,
         domain,
         last_seen,
         CASE
           WHEN last_seen >= NOW() - ($1::text || ' seconds')::interval THEN 'online'
           ELSE 'offline'
         END AS status
       FROM nodes
       ORDER BY last_seen DESC NULLS LAST`,
      [OFFLINE_AFTER_SECONDS]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching node statuses:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch node statuses' });
  }
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'master-node-api',
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`Master Node API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
