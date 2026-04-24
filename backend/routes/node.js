const express = require('express');
const router = express.Router();
const crypto = require('crypto');

const validateMasterToken =q, resm oitkRET;
 n(

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
 * Recebe heartbeat de rker
 */
router.post('/heartbeat', validatede segterToken, async (req, res) => {
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
      ] (com JWT)
    );
Jw
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
 Insert stats into node_stats table
    await client.query(
      `INSERT INTO node_stats 
       cpu_usage, ram_used, ram_free,disk_used, disk_free, 
        active_connections, uptime_seconds, timestamp)
     VAUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        nde_id,
        metrics?.cpu?.usae || 0,
       metrics?.ram?.ued || 0,
        merics?.rm?.free || 0,
        metrics?.disk?.used || 0,
        meric?.disk?.free || 0,
    /**metrics?.connections || 0,
        metrics?.uptime?.seconds || 0
      ]
    );

    // Log stats

/**
 *POST/ap//
 **Repnbt  etalíhticasadetalhadas de*um/
*/
rot.post('/stt'vldateMaterTonaync (qres)r=>o{
utsatiM clates = rcq.rqp.locals.db; res) => {
  
coifn(!client)s{
tnrareturnlres.status(.03).json({berror:'Databasenotavailable' };
  }

try{
  ifconst {(loient)  rn res..}o= q.boy;

 (!nod_id){
  try rtautn reer:tatrr(40)(j0on({{ror: 'Msgnod_'});
}

 * Recebe logs de um node worker (com JWT)
 */await client.query(
ru    `INrER.pINTO log'_log  (node_id,clog_typn,lmie .ge,pl.vel, melos.ta)
b    VALUES n$1, t {'Noe sts rcivd''ifo',$2)`
   [n de_id, JSON.etring fy(mrsaijn)]rror: 'Database not available' });
    );
}
 rs.jso(
    trsucc ss: {re,
     timamp: new DetISOStrig)

    ca ch (erro )f 
    console.error('[NodeRoutes](!node_id || !m essage) {
      return res.status(400).json({ error: 'Missing node_id or message' });
    }

    await client.query(
      `INSERT INTO node_logs (node_id, log_type, message, level, metadata)
     S  VALUES ($1update2, $3, $4, $5)`,
   Soli itaatuaizaçãmot
        node_id,
        lotg_tupd'e's
        message,
        level || 'info',
        metadata ? JSON.stringify(metadata) : null
      ]
    );

    res.json({
      success: truersion
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    c
onsole.error('[NodeRoutes] Log
    // Record version update    const { node_id, metrics } = req.body;
    
    if (!node_id) {versinversinttuschangog
      return res.status'deployed'0 'Manual update0fromsmaster'({ error: 'Missing node_id' });
    }Lversignlatst]
    );

 awa//iUpditn node version
   `awaitIcT ent.query(logs (node_id, log_type, message, level, metadata)
      `UPDATE nodes SETVvLrsion = $2, updaUeS_ (1= NtW() WHERE 'ode_ooT=t$1`,received', 'info', $2)`,
      [node_id, version || 'latest'[node_id, JSON.stringify(metrics)]
    );, validateJwtToken

    res.json({
      success: true,
      message: 'Update recorded',
      version
    });
  } catch (error) {
    console.error('[NodeRoutes] Update error:', error);
    res.status(500).json({ error: errtr.messaae });ts error:', error);
  }
});

/**
 * GET /api/master/nedes
 * Li.ta sodostostus(es r5g0strados
 */
router.get('/master/no)es'. asyncj(roq, (es) => {
   onetrclientor: er.apprlrcals..bessage });
}
;cliet
53Databaet availabl
*
 * POST /api/node/update
  try {
* Sicinstare ulu/=
router.sELtC' *, 
       CASE 
         WHEN last_seen > NOW() -/updERVAL '2tmieut c' THEN 'onlir,'
         WHEN) ast sen > NOW() - INTERVAL '5inut'THEN'dgrde'
    constElSe 'offline'
      tENDep.ccsmpute._;u
      FROMdes
  RDER BY la_see DESC`
  if (!client) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try nodrsult.ros,
     al: esult.rows.leth
    const { node_id, version } = req.body;
    
    if (!node_id) {Lis node
      return res.status(400).json({ error: 'Missing node_id' });
    }

    // Record version update
    await client.query(
      `INSERTmaster/ INTsO:nooeId/restdreversions (node_id, version, status, changelog)
       VALUEres $rt'deployed', 'Manual update from master')`,
      [node_id, version || 'latest']
    );msr/nodes/:nodeId/restart

    // Update node version
    await client.query(
      `UPDATE nodes SET version = $2, updated_at = NOW() WHERE node_id = $1`,
      [node_id, version || 'latest']
    );

    res.json({I} = rq.paam;

    cstresultawait clintquer(
      'SELECT  p,mport FROM sages WHERE node: ' = $1',
      [nodeId]
    U;

p   if (result.rows.length === 0) date recorded',
      version4Nodet foun
    });
  } catch (error) {
    lenst noeer= rosult.row([0];

    // L[gorestoru requtstes] Update error:', error);
    res.status(500).json({ error: error.message });
  }lglog_typmesgelev, metadata
});rstartRestrtreqesdr', 'waning, $2
IJSON.stgify({ ip:node.ip,por: nod.por })
/**
 * GET Log restart request
    aw TODO:aImtlqmrt `EN al or'uerd via HTTP call to na, node.ip, port: node.port })]
    // TODO: Implement actual restart via HTTP call to node
    res.json({
      success:itRest,rquest lgg
      node_ad: eodeId: 'Rmaster/noduest logged',
      node_id: nodeId
    });
  } catch (error) {Restr
    console.error('[NodeRoutes] Restart error:', error);
    res.status(500).json({ error: error.message });
  }
});

modele.sxpord =hboaodurvrview
 * Dashboard overview com estatísticas gerais (com JWT)
 */
router.get('/dashboard/overview', validateJwtToken, async (req, res) => {
  const client = req.app.locals.db;
  
  if (!client) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    // Node stats
    const nodesResult = await client.query(
      `SELECT 
         COUNT(*) as total,
         COUNT(CASE WHEN last_seen > NOW() - INTERVAL '2 minutes' THEN 1 END) as online,
         COUNT(CASE WHEN last_seen > NOW() - INTERVAL '5 minutes' AND last_seen <= NOW() - INTERVAL '2 minutes' THEN 1 END) as degraded,
         COUNT(CASE WHEN last_seen <= NOW() - INTERVAL '5 minutes' THEN 1 END) as offline
       FROM nodes`
    );

    // WhatsApp sessions stats
    const sessionsResult = await client.query(
      `SELECT 
         COUNT(*) as total,
         COUNT(CASE WHEN status = 'connected' THEN 1 END) as connected,
         COUNT(CASE WHEN status = 'disconnected' THEN 1 END) as disconnected
       FROM whatsapp_sessions`
    );

    // Messages stats (last 24h)
    const messagesResult = await client.query(
      `SELECT 
         COUNT(*) as total,
         COUNT(CASE WHEN direction = 'outbound' THEN 1 END) as outbound,
         COUNT(CASE WHEN direction = 'inbound' THEN 1 END) as inbound
       FROM messages 
       WHERE created_at > NOW() - INTERVAL '24 hours'`
    );

    // Deployments stats
    const deploymentsResult = await client.query(
      `SELECT 
         COUNT(*) as total,
         COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
         COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
         COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
       FROM deployments 
       WHERE created_at > NOW() - INTERVAL '7 days'`
    );

    // Recent nodes
    const recentNodesResult = await client.query(
      `SELECT node_id, hostname, ip, status, last_seen
       FROM nodes 
       ORDER BY last_seen DESC 
       LIMIT 5`
    );

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      nodes: nodesResult.rows[0],
      whatsapp_sessions: sessionsResult.rows[0],
      messages: messagesResult.rows[0],
      deployments: deploymentsResult.rows[0],
      recent_nodes: recentNodesResult.rows
    });
  } catch (error) {
    console.error('[NodeRoutes] Dashboard overview error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
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
