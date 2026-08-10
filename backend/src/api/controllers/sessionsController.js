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

  const result = await connectionService.listConnections();
  return res.status(200).json(result);
}

async function getStatus(req, res) {
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
    const sessions = await connectionService.listConnections();
    const status = await connectionService.getConnectionStatus(SINGLE_SESSION);
    return res.status(200).json({
      ...status,
      sessions,
    });
  }

  const targetSessionId = getTargetSessionId(req);
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
    const session = await sessionManager.restartSession(targetSessionId, {
      displayName: targetSessionId,
    });

    return res.status(200).json({
      name: targetSessionId,
      sessionId: targetSessionId,
      sessionName: targetSessionId,
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
  resetError,
  restart,
  start,
};
