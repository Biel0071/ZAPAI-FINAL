const sessionManager = require('../services/sessionManager');
const systemManager = require('../services/systemManager');
const connectionService = require('../services/connectionService');

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
      status: session.status,
      connected: session.connected,
      health: session.health,
      alreadyRunning: Boolean(session.alreadyRunning),
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
  const result = await connectionService.listConnections();

  return res.status(200).json(result);
}

async function getStatus(req, res) {
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

module.exports = {
  connectSystem,
  create,
  disconnectSystem,
  getQr,
  getStatus,
  list,
  logout,
  remove,
  reconnect,
  restart,
  start,
};

