const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Middleware para validar token master
const validateMasterToken = (req, res, next) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  const masterToken = process.env.MASTER_TOKEN || process.env.JWT_SECRET;
  
  if (!token || token !== masterToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

/**
 * POST /api/node/register
 * Registra um novo node worker no master
 */
router.post('/register', async (req, res) => {
  const client = req.app.locals.db;
  
  if (!client) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const { node_id, hostname, ip, port, version, metrics } = req.body;
    
    if (!node_id || !hostname || !ip) {
      return res.status(400).json({ error: 'Missing required fields: node_id, hostname, ip' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    
    // Check if node exists
    const existing = await client.query(
      'SELECT id FROM nodes WHERE node_id = $1',
      [node_id]
    );

    let result;
    if (existing.rows.length > 0) {
      // Update existing node
      result = await client.query(
        `UPDATE nodes 
         SET hostname = $1, ip = $2, port = $3, version = $4, 
             status = 'online', last_heartbeat = NOW(), last_seen = NOW(),
             cpu_cores = $5, ram_total = $6, updated_at = NOW()
         WHERE node_id = $7
         RETURNING *`,
        [
          hostname,
          ip,
          port || 4025,
          version || '1.0.0',
          metrics?.cpu?.cores || 0,
          metrics?.ram?.total || 0,
          node_id
        ]
      );
    } else {
      // Insert new node
      result = await client.query(
        `INSERT INTO nodes 
         (node_id, hostname, ip, port, version, status, token, 
          last_heartbeat, last_seen, cpu_cores, ram_total)
         VALUES ($1, $2, $3, $4, $5, 'online', $6, NOW(), NOW(), $7, $8)
         RETURNING *`,
        [
          node_id,
          hostname,
          ip,
          port || 4025,
          version || '1.0.0',
          token,
          metrics?.cpu?.cores || 0,
          metrics?.ram?.total || 0
        ]
      );
    }

    // Log registration
    await client.query(
      `INSERT INTO node_logs (node_id, log_type, message, level, metadata)
       VALUES ($1, 'register', 'Node registered successfully', 'info', $2)`,
      [node_id, JSON.stringify({ ip, version, metrics })]
    );

    res.json({
      success: true,
      node: result.rows[0],
      token: result.rows[0].token
    });
  } catch (error) {
    console.error('[NodeRoutes] Register error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/node/heartbeat
 * Recebe heartbeat de um node worker
 */
router.post('/heartbeat', validateMasterToken, async (req, res) => {
  const client = req.app.locals.db;
  
  if (!client) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const { node_id, metrics } = req.body;
    
    if (!node_id) {
      return res.status(400).json({ error: 'Missing node_id' });
    }

    const result = await client.query(
      `UPDATE nodes 
       SET status = 'online', 
           last_heartbeat = NOW(), 
           last_seen = NOW(),
           cpu_cores = $2,
           ram_total = $3,
           uptime_seconds = $4,
           updated_at = NOW()
       WHERE node_id = $1
       RETURNING *`,
      [
        node_id,
        metrics?.cpu?.cores || 0,
        metrics?.ram?.total || 0,
        metrics?.uptime?.seconds || 0
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Node not found' });
    }

    res.json({
      success: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[NodeRoutes] Heartbeat error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/node/stats
 * Recebe estatísticas detalhadas de um node
 */
router.post('/stats', validateMasterToken, async (req, res) => {
  const client = req.app.locals.db;
  
  if (!client) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const { node_id, metrics } = req.body;
    
    if (!node_id) {
      return res.status(400).json({ error: 'Missing node_id' });
    }

    // Log stats
    await client.query(
      `INSERT INTO node_logs (node_id, log_type, message, level, metadata)
       VALUES ($1, 'stats', 'Node stats received', 'info', $2)`,
      [node_id, JSON.stringify(metrics)]
    );

    res.json({
      success: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[NodeRoutes] Stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/node/update
 * Solicita atualização de um node remoto
 */
router.post('/update', async (req, res) => {
  const client = req.app.locals.db;
  
  if (!client) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const { node_id, version } = req.body;
    
    if (!node_id) {
      return res.status(400).json({ error: 'Missing node_id' });
    }

    // Record version update
    await client.query(
      `INSERT INTO node_versions (node_id, version, status, changelog)
       VALUES ($1, $2, 'deployed', 'Manual update from master')`,
      [node_id, version || 'latest']
    );

    // Update node version
    await client.query(
      `UPDATE nodes SET version = $2, updated_at = NOW() WHERE node_id = $1`,
      [node_id, version || 'latest']
    );

    res.json({
      success: true,
      message: 'Update recorded',
      version
    });
  } catch (error) {
    console.error('[NodeRoutes] Update error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/master/nodes
 * Lista todos os nodes registrados
 */
router.get('/master/nodes', async (req, res) => {
  const client = req.app.locals.db;
  
  if (!client) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const result = await client.query(
      `SELECT *, 
       CASE 
         WHEN last_seen > NOW() - INTERVAL '2 minutes' THEN 'online'
         WHEN last_seen > NOW() - INTERVAL '5 minutes' THEN 'degraded'
         ELSE 'offline'
       END as computed_status
       FROM nodes 
       ORDER BY last_seen DESC`
    );

    res.json({
      success: true,
      nodes: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('[NodeRoutes] List nodes error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/master/nodes/:nodeId/restart
 * Solicita restart de um node remoto
 */
router.post('/master/nodes/:nodeId/restart', async (req, res) => {
  const client = req.app.locals.db;
  
  if (!client) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    const { nodeId } = req.params;

    const result = await client.query(
      'SELECT ip, port FROM nodes WHERE node_id = $1',
      [nodeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Node not found' });
    }

    const node = result.rows[0];

    // Log restart request
    await client.query(
      `INSERT INTO node_logs (node_id, log_type, message, level, metadata)
       VALUES ($1, 'restart', 'Restart requested from master', 'warning', $2)`,
      [nodeId, JSON.stringify({ ip: node.ip, port: node.port })]
    );

    // TODO: Implement actual restart via HTTP call to node
    res.json({
      success: true,
      message: 'Restart request logged',
      node_id: nodeId
    });
  } catch (error) {
    console.error('[NodeRoutes] Restart error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
