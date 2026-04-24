/**
 * ============================================================================
 * MASTER NODE API - SERVER
 * ============================================================================
 * 
 * API central para gerenciamento de múltiplos nós VPS.
 * Zero mock. Tudo produção real.
 * 
 * Endpoints:
 * - POST /api/nodes/register - Registrar novo nó
 * - POST /api/nodes/:nodeId/heartbeat - Receber heartbeat
 * - GET /api/nodes - Listar todos os nós
 * - GET /api/nodes/:nodeId - Detalhes de um nó
 * - POST /api/nodes/:nodeId/commands - Enviar comando remoto
 * - GET /api/nodes/:nodeId/commands - Listar comandos
 * - GET /api/nodes/:nodeId/logs - Listar logs
 * - POST /api/nodes/:nodeId/logs - Receber logs
 * - GET /api/nodes/:nodeId/sessions - Listar sessões WhatsApp
 * - GET /api/lovable/dashboard - Dashboard para Lovable
 * ============================================================================
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.MASTER_PORT || 5000;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Generate unique node ID
function generateNodeId() {
  return `node_${crypto.randomBytes(16).toString('hex')}`;
}

// Generate auth token
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ============================================================================
// NODE REGISTRATION
// ============================================================================

app.post('/api/nodes/register', async (req, res) => {
  const { name, ip_address, domain, api_port } = req.body;

  if (!name || !ip_address) {
    return res.status(400).json({ 
      success: false, 
      error: 'name and ip_address are required' 
    });
  }

  try {
    const node_id = generateNodeId();
    const token = generateToken();

    const result = await pool.query(
      `INSERT INTO nodes (node_id, name, ip_address, domain, api_port, token, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING *`,
      [node_id, name, ip_address, domain || null, api_port || 4025, token]
    );

    res.status(201).json({
      success: true,
      data: {
        node_id: result.rows[0].node_id,
        token: result.rows[0].token,
        master_api_url: `${req.protocol}://${req.get('host')}/api`,
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

// ============================================================================
// HEARTBEAT
// ============================================================================

app.post('/api/nodes/:nodeId/heartbeat', async (req, res) => {
  const { nodeId } = req.params;
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
    // Verify node exists and token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const token = authHeader.substring(7);
    const nodeResult = await pool.query(
      'SELECT * FROM nodes WHERE node_id = $1 AND token = $2',
      [nodeId, token]
    );

    if (nodeResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Node not found or invalid token' });
    }

    // Update node status and last heartbeat
    await pool.query(
      `UPDATE nodes 
       SET status = 'online', 
           last_heartbeat = NOW(),
           last_seen = NOW()
       WHERE node_id = $1`,
      [nodeId]
    );

    // Insert heartbeat record
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

    // Check for pending commands
    const commandsResult = await pool.query(
      `SELECT * FROM remote_commands 
       WHERE node_id = $1 AND status = 'pending'
       ORDER BY created_at ASC
       LIMIT 10`,
      [nodeId]
    );

    // Update commands status to 'sent'
    if (commandsResult.rows.length > 0) {
      const commandIds = commandsResult.rows.map(c => c.id);
      await pool.query(
        `UPDATE remote_commands 
         SET status = 'sent', sent_at = NOW() 
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

// ============================================================================
// NODE MANAGEMENT
// ============================================================================

app.get('/api/nodes', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        node_id, name, ip_address, domain, api_port, status, version,
        last_heartbeat, last_seen, installed_at, created_at, updated_at
       FROM nodes 
       ORDER BY last_seen DESC`
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching nodes:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch nodes' });
  }
});

app.get('/api/nodes/:nodeId', async (req, res) => {
  const { nodeId } = req.params;

  try {
    const result = await pool.query(
      `SELECT * FROM nodes WHERE node_id = $1`,
      [nodeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Node not found' });
    }

    // Get latest heartbeat
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

// ============================================================================
// REMOTE COMMANDS
// ============================================================================

app.post('/api/nodes/:nodeId/commands', async (req, res) => {
  const { nodeId } = req.params;
  const { command_type, payload } = req.body;

  if (!command_type) {
    return res.status(400).json({ success: false, error: 'command_type is required' });
  }

  const validCommands = ['restart', 'update', 'rebuild', 'disconnect_whatsapp', 'backup', 'clear_cache'];
  if (!validCommands.includes(command_type)) {
    return res.status(400).json({ success: false, error: 'Invalid command_type' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO remote_commands (node_id, command_type, payload)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [nodeId, command_type, JSON.stringify(payload || {})]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error creating command:', error);
    res.status(500).json({ success: false, error: 'Failed to create command' });
  }
});

app.get('/api/nodes/:nodeId/commands', async (req, res) => {
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

app.post('/api/nodes/:nodeId/commands/:commandId/result', async (req, res) => {
  const { nodeId, commandId } = req.params;
  const { status, result, error_message } = req.body;

  try {
    const updateResult = await pool.query(
      `UPDATE remote_commands 
       SET status = $1, result = $2, error_message = $3, completed_at = NOW()
       WHERE id = $4 AND node_id = $5
       RETURNING *`,
      [status, JSON.stringify(result || {}), error_message || null, commandId, nodeId]
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

// ============================================================================
// LOGS
// ============================================================================

app.get('/api/nodes/:nodeId/logs', async (req, res) => {
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

app.post('/api/nodes/:nodeId/logs', async (req, res) => {
  const { nodeId } = req.params;
  const { logs } = req.body;

  if (!Array.isArray(logs) || logs.length === 0) {
    return res.status(400).json({ success: false, error: 'logs array is required' });
  }

  try {
    const values = logs.map(log => `(
      '${nodeId}',
      '${log.level}',
      '${log.service || 'unknown'}',
      $${logs.indexOf(log) + 1},
      '${JSON.stringify(log.metadata || {})}',
      NOW()
    )`).join(',');

    const query = `
      INSERT INTO node_logs (node_id, level, service, message, metadata, created_at)
      VALUES ${values}
    `;

    await pool.query(query, logs.map(log => log.message));

    res.json({ success: true, data: { received: logs.length } });
  } catch (error) {
    console.error('Error saving logs:', error);
    res.status(500).json({ success: false, error: 'Failed to save logs' });
  }
});

// ============================================================================
// WHATSAPP SESSIONS
// ============================================================================

app.get('/api/nodes/:nodeId/sessions', async (req, res) => {
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

app.post('/api/nodes/:nodeId/sessions', async (req, res) => {
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

// ============================================================================
// LOVABLE DASHBOARD API
// ============================================================================

app.get('/api/lovable/dashboard', async (req, res) => {
  try {
    // Get all nodes with latest heartbeat
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

    // Aggregate stats
    const totalNodes = nodesResult.rows.length;
    const onlineNodes = nodesResult.rows.filter(n => n.status === 'online').length;
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

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'master-node-api',
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log(`Master Node API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
