const sessionManager = require('../../../services/sessionManager');
const systemManager = require('../../../services/systemManager');
const connectionService = require('../../../services/connectionService');

const SINGLE_SESSION = sessionManager.DEFAULT_SESSION; // always 'main'

function getTargetSessionId(req) {
  return sessionManager.normalizeSessionName(
    req?.params?.id ||
      req?.params?.sessionId ||
      req?.query?.sessionId ||
      req?.query?.id ||
      req?.body?.sessionId ||
      SINGLE_SESSION
  );
}

function getRequestedDisplayName(req) {
  const bodyName = String(req?.body?.sessionName || req?.body?.name || '').trim();
  return bodyName || SINGLE_SESSION;
}

function getRequestedSessionId(req) {
  const bodyId = String(req?.body?.sessionId || req?.body?.sessionName || '').trim();
  return sessionManager.normalizeSessionName(bodyId || SINGLE_SESSION);
}

async function create(req, res) {
  const targetSessionId = getRequestedSessionId(req);
  const requestedDisplayName = getRequestedDisplayName(req);

  // Bind the number to the verified JWT tenant before the socket can deliver history.
  if (!req.authTenantId) return res.status(401).json({ error: 'Autenticação da empresa obrigatória.' });
  try {
    const { query } = require('../../infrastructure/config/database');
    const owner = await query('SELECT company_id FROM sessions WHERE session_id=$1', [targetSessionId]);
    if (owner.rows[0] && owner.rows[0].company_id !== req.authTenantId) return res.status(403).json({ error: 'Sessão pertence a outra empresa.' });
    await query(`INSERT INTO sessions(company_id,session_id,session_name,status) VALUES($1,$2,$3,'connecting') ON CONFLICT(session_id) DO NOTHING`, [req.authTenantId, targetSessionId, requestedDisplayName]);
    const verified = await query('SELECT company_id FROM sessions WHERE session_id=$1', [targetSessionId]);
    if (verified.rows[0]?.company_id !== req.authTenantId) return res.status(403).json({ error: 'Sessão pertence a outra empresa.' });
    const agents = await require('../../ai/agents/services/aiAgentService').listAgents(req.authTenantId);
    const targetAgent = agents.find(agent => agent.key === 'camila') || agents.find(agent => agent.active);
    // New QR onboarding generates a draft automatically. Existing enrollment or a
    // deliberate pause survives reconnects; nothing enables live replies here.
    await query(`INSERT INTO whatsapp_history_sync(company_id,session_id,learning_enabled,target_agent_key)
      VALUES($1,$2,TRUE,$3) ON CONFLICT(company_id,session_id) DO NOTHING`, [req.authTenantId, targetSessionId, targetAgent?.key || null]);
  } catch (_) { return res.status(503).json({ error: 'Não foi possível vincular a sessão à empresa.' }); }

  // Auto-activate system if not yet running — no manual POST /system/start needed
  if (!sessionManager.isRuntimeActive()) {
    try {
      await systemManager.startSystem(req.app.locals.store);
    } catch (error) {
      return res.status(500).json({
        error: error.message || 'Failed to start system.',
      });
    }
  }

  try {
    const session = await connectionService.createConnection(targetSessionId, requestedDisplayName);

    return res.status(session.alreadyRunning ? 200 : 201).json({
      name: session.sessionName || requestedDisplayName,
      phone: session.phone,
      session: targetSessionId,
      sessionId: targetSessionId,
      sessionName: session.sessionName || requestedDisplayName,
      status: connectionService.toPublicStatus(session.status),
      success: true,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Failed to create session.',
    });
  }
}

async function start(req, res) {
  return create(req, res);
}

async function list(req, res) {
  try {
    const sessionRecoveryService = require('../../../services/sessionRecoveryService');
    sessionRecoveryService.recoverSessions().catch((err) => {
      console.error('[SessionsController] Async recoverSessions failed:', err);
    });
  } catch (err) {
    console.error('[SessionsController] Failed to load sessionRecoveryService:', err);
  }

  if (!req.authTenantId) return res.status(401).json({ error: 'Autenticação da empresa obrigatória.' });
  const result = await connectionService.listConnections(req.authTenantId);
  return res.status(200).json(result);
}

async function rename(req, res) {
  const sessionId = getTargetSessionId(req);
  const sessionName = String(req.body?.sessionName || '').trim();
  if (!req.authTenantId) return res.status(401).json({ error: 'Autenticação da empresa obrigatória.' });
  if (!sessionName || sessionName.length > 100 || /[\u0000-\u001f]/.test(sessionName)) {
    return res.status(400).json({ error: 'Informe um nome de sessão com até 100 caracteres.' });
  }
  const { query } = require('../../infrastructure/config/database');
  const result = await query(`UPDATE sessions SET session_name=$3 WHERE company_id=$1 AND session_id=$2 AND status<>'deleted' RETURNING session_id,session_name`,
    [req.authTenantId, sessionId, sessionName]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Sessão não encontrada.' });
  const runtime = sessionManager.getSession?.(sessionId);
  if (runtime) {
    runtime.sessionName = sessionName;
    runtime.displayName = sessionName;
  }
  return res.json({ success: true, sessionId, sessionName });
}

async function getStatus(req, res) {
  if (!req.authTenantId) return res.status(401).json({ error: 'Autenticação da empresa obrigatória.' });
  try {
    const sessionRecoveryService = require('../../../services/sessionRecoveryService');
    sessionRecoveryService.recoverSessions().catch((err) => {
      console.error('[SessionsController] Async recoverSessions failed:', err);
    });
  } catch (err) {
    console.error('[SessionsController] Failed to load sessionRecoveryService:', err);
  }

  const hasSpecificTarget = Boolean(
    req?.params?.id ||
      req?.params?.sessionId ||
      req?.query?.sessionId ||
      req?.query?.id
  );

  if (!hasSpecificTarget) {
    const sessions = await connectionService.listConnections(req.authTenantId);
    const ownMain = sessions.some(session => session.sessionId === SINGLE_SESSION);
    const status = ownMain ? await connectionService.getConnectionStatus(SINGLE_SESSION) : {
      sessionId: SINGLE_SESSION, sessionName: SINGLE_SESSION, status: 'disconnected', connected: false, qrReady: false,
    };
    return res.status(200).json({
      ...status,
      sessions,
    });
  }

  const targetSessionId = getTargetSessionId(req);
  const owned = (await connectionService.listConnections(req.authTenantId)).some(session => session.sessionId === targetSessionId);
  if (!owned) return res.status(404).json({ error: 'Session not found.' });
  const status = await connectionService.getConnectionStatus(targetSessionId);

  return res.status(200).json(status);
}

async function getHealth(req, res) {
  const targetSessionId = getTargetSessionId(req);
  try {
    const health = await connectionService.getSessionHealth(targetSessionId);
    return res.status(200).json(health);
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Failed to get session health.',
    });
  }
}

async function getQr(req, res) {
  const targetSessionId = getTargetSessionId(req);
  const qrResult = await connectionService.getConnectionQr(targetSessionId);

  if (!qrResult.qr && qrResult.status !== 'connected') {
    return res.status(404).json({ error: 'QR not yet available. Session may still be initializing.' });
  }

  return res.status(200).json(qrResult);
}

async function disconnectSystem(req, res) {
  const targetSessionId = getTargetSessionId(req);
  const session = sessionManager.setSessionSystemConnection(targetSessionId, false);

  if (!session) {
    return res.status(404).json({ error: 'Session not found.' });
  }

  return res.status(200).json({
    sessionId: targetSessionId,
    status: session.status,
    systemConnected: false,
    success: true,
  });
}

async function connectSystem(req, res) {
  const targetSessionId = getTargetSessionId(req);
  const session = sessionManager.setSessionSystemConnection(targetSessionId, true);

  if (!session) {
    return res.status(404).json({ error: 'Session not found.' });
  }

  return res.status(200).json({
    sessionId: targetSessionId,
    status: session.status,
    systemConnected: true,
    success: true,
  });
}

async function remove(req, res) {
  const targetSessionId = getTargetSessionId(req);
  const removed = await connectionService.deleteConnection(targetSessionId);

  if (!removed) {
    return res.status(404).json({ error: 'Session not found.' });
  }

  return res.status(200).json({ success: true });
}

async function restart(req, res) {
  const targetSessionId = getTargetSessionId(req);

  if (!sessionManager.isRuntimeActive()) {
    try {
      await systemManager.startSystem(req.app.locals.store);
    } catch (error) {
      return res.status(500).json({ error: error.message || 'Failed to start system.' });
    }
  }

  try {
    const owned = (await require('../../data/repositories/sessionRepository').getSessions(req.authTenantId))
      .find(item => item.sessionId === targetSessionId);
    if (!owned) return res.status(404).json({ error: 'Session not found.' });
    const session = await sessionManager.restartSession(targetSessionId, {
      displayName: owned.sessionName,
    });

    return res.status(200).json({
      name: owned.sessionName,
      sessionId: targetSessionId,
      sessionName: owned.sessionName,
      status: session.status,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Failed to restart session.',
    });
  }
}

async function logout(req, res) {
  const targetSessionId = getTargetSessionId(req);
  const removed = await sessionManager.logoutSession(targetSessionId);

  if (!removed) {
    return res.status(404).json({ error: 'Session not found.' });
  }

  return res.status(200).json({ success: true });
}

async function reconnect(req, res) {
  const targetSessionId = getTargetSessionId(req);

  if (!sessionManager.isRuntimeActive()) {
    try {
      await systemManager.startSystem(req.app.locals.store);
    } catch (error) {
      return res.status(500).json({
        error: error.message || 'Failed to start system.',
      });
    }
  }

  try {
    const session = await sessionManager.reconnectSession(targetSessionId, {
      force: Boolean(req.body?.force),
    });

    return res.status(200).json({
      sessionId: targetSessionId,
      sessionName: session.sessionName || targetSessionId,
      status: connectionService.toPublicStatus(session.status),
      success: true,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Failed to reconnect session.',
      success: false,
    });
  }
}

async function resetError(req, res) {
  const targetSessionId = getTargetSessionId(req);

  try {
    const result = await sessionManager.resetSessionError(targetSessionId);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Failed to reset session error.',
      success: false,
    });
  }
}

async function purge(req, res) {
  const targetSessionId = getTargetSessionId(req);
  const purgeData = req.query.purgeData === 'true' || req.body?.purgeData === true;

  // 1. Remove the session first
  const removed = await connectionService.deleteConnection(targetSessionId);
  if (!removed) {
    return res.status(404).json({ error: 'Session not found.' });
  }

  const purged = { session: true, conversations: 0, contacts: 0, aiMemory: 0 };

  // 2. If purgeData requested, cascade-delete related data
  if (purgeData) {
    try {
      const db = require('../../infrastructure/config/database');
      // Delete conversations by sessionId
      const convResult = await db.query(
        'DELETE FROM conversations WHERE session_id = $1',
        [targetSessionId]
      );
      purged.conversations = convResult.rowCount || 0;

      // contacts table is deprecated, leads are preserved in CRM
      purged.contacts = 0;

      // Delete AI conversation memory by sessionId
      const aiResult = await db.query(
        'DELETE FROM ai_conversation_memory WHERE session_id = $1',
        [targetSessionId]
      );
      purged.aiMemory = aiResult.rowCount || 0;

      // Delete AI short memory
      const aiShortResult = await db.query(
        'DELETE FROM ai_memory_short WHERE session_id = $1',
        [targetSessionId]
      );
      purged.aiMemory += aiShortResult.rowCount || 0;

      // Delete AI long memory
      const aiLongResult = await db.query(
        'DELETE FROM ai_memory_long WHERE session_id = $1',
        [targetSessionId]
      );
      purged.aiMemory += aiLongResult.rowCount || 0;

      // Delete AI context
      const aiCtxResult = await db.query(
        'DELETE FROM ai_context WHERE session_id = $1',
        [targetSessionId]
      );
      purged.aiMemory += aiCtxResult.rowCount || 0;
    } catch (dbError) {
      // If specific tables don't exist or query fails, log and continue
      console.warn(`[sessions:purge] DB cleanup partial for "${targetSessionId}":`, dbError.message);
    }
  }

  return res.status(200).json({ success: true, purged });
}
async function reconcile(req, res) {
  try {
    const summary = await sessionManager.reconcileSessions();
    return res.status(200).json({ success: true, data: summary });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to reconcile sessions.' });
  }
}
async function recover(req, res) {
  if (!sessionManager.isRuntimeActive()) {
    try {
      await systemManager.startSystem(req.app.locals.store);
    } catch (error) {
      return res.status(500).json({
        error: error.message || 'Failed to start system.',
        success: false,
      });
    }
  }

  try {
    const sessionRecoveryService = require('../../../services/sessionRecoveryService');
    const recovered = await sessionRecoveryService.recoverSessions();
    return res.status(200).json({
      success: true,
      recovered,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Failed to recover sessions.',
      success: false,
    });
  }
}

async function checkNumber(req, res) {
  const sessionId = getTargetSessionId(req);
  const { phone } = req.params;

  if (!phone) {
    return res.status(400).json({
      ok: false,
      error: 'Telefone é obrigatório.'
    });
  }

  const session = sessionManager.getSession(sessionId);
  if (!session || session.status !== 'connected' || !session.sock) {
    return res.status(400).json({
      ok: false,
      error: 'A sessão do WhatsApp não está conectada.'
    });
  }

  try {
    const cleanPhone = phone.replace(/\D/g, '');
    const jid = `${cleanPhone}@s.whatsapp.net`;
    const checkResult = await session.sock.onWhatsApp(jid);

    if (Array.isArray(checkResult) && checkResult.length > 0 && checkResult[0].exists) {
      return res.status(200).json({
        ok: true,
        exists: true,
        jid: checkResult[0].jid
      });
    } else {
      return res.status(200).json({
        ok: true,
        exists: false
      });
    }
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || 'Erro ao verificar número no WhatsApp.'
    });
  }
}

module.exports = {
  checkNumber,
  connectSystem,
  create,
  disconnectSystem,
  getHealth,
  getQr,
  getStatus,
  list,
  logout,
  purge,
  reconcile,
  recover,
  remove,
  reconnect,
  rename,
  resetError,
  restart,
  start,
};
