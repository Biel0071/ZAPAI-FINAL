const sessionManager = require('./sessionManager');

const DEFAULT_SESSION = sessionManager.DEFAULT_SESSION || 'main';

function normalizeStatus(status = 'disconnected') {
  const value = String(status || '').toLowerCase();

  if (value === 'qr_ready') return 'qr';
  if (value === 'error') return 'error';
  if (value === 'creating') return 'creating';
  if (['connected', 'connecting', 'qr', 'disconnected'].includes(value)) return value;

  return 'disconnected';
}

function toPublicStatus(status = 'disconnected') {
  const normalized = normalizeStatus(status);

  if (normalized === 'disconnected') return 'idle';
  return normalized;
}

function toHealth(status = 'idle') {
  if (status === 'connected') return 'healthy';
  if (status === 'idle') return 'offline';
  return 'degraded';
}

function mapSession(session = {}, sessionId = DEFAULT_SESSION) {
  const id = String(session.sessionId || sessionId || DEFAULT_SESSION);
  const isCreating = typeof sessionManager.isSessionCreating === 'function'
    ? sessionManager.isSessionCreating(id)
    : false;
  const status = isCreating ? 'creating' : toPublicStatus(session.status || 'disconnected');

  return {
    name: session.sessionName || session.name || id,
    phone: session.phone || null,
    sessionId: id,
    sessionName: session.sessionName || session.name || id,
    status,
    connected: status === 'connected',
    systemConnected: session.systemConnected !== false,
    retryCount: Number(session.retryCount || 0),
    health: toHealth(status),
    lastError: session.lastError || null,
  };
}

function getSessionCompat(sessionId = DEFAULT_SESSION) {
  if (typeof sessionManager.getSession === 'function') {
    return sessionManager.getSession(sessionId);
  }

  const rows = sessionManager.listSessions?.() || [];
  return rows.find((item) => String(item.sessionId || item.name) === String(sessionId)) || null;
}

async function listConnections() {
  const sessions = sessionManager.listSessions?.() || [];
  return sessions.map((session) => mapSession(session, session.sessionId || DEFAULT_SESSION));
}

async function getConnectionStatus(sessionId = DEFAULT_SESSION) {
  const session = getSessionCompat(sessionId);
  const creating = typeof sessionManager.isSessionCreating === 'function'
    ? sessionManager.isSessionCreating(sessionId)
    : false;

  if (!session && !creating) {
    return {
      sessionId,
      sessionName: sessionId,
      status: 'idle',
      connected: false,
      systemConnected: false,
      retryCount: 0,
      health: 'offline',
      qrReady: false,
      lastError: null,
      logs: [],
    };
  }

  if (!session && creating) {
    return {
      sessionId,
      sessionName: sessionId,
      status: 'creating',
      connected: false,
      systemConnected: true,
      retryCount: 0,
      health: 'degraded',
      qrReady: false,
      lastError: null,
      logs: [],
    };
  }

  const mapped = mapSession(session, sessionId);
  const status = mapped.status;

  return {
    ...mapped,
    qrReady: status === 'qr',
    logs: Array.isArray(session.connectionLogs) ? session.connectionLogs.slice(-10) : [],
  };
}

async function createConnection(sessionId = DEFAULT_SESSION, displayName = DEFAULT_SESSION) {
  const creating = typeof sessionManager.isSessionCreating === 'function'
    ? sessionManager.isSessionCreating(sessionId)
    : false;

  if (creating) {
    return {
      name: displayName || sessionId,
      phone: null,
      sessionId,
      sessionName: displayName || sessionId,
      status: 'creating',
      connected: false,
      systemConnected: true,
      retryCount: 0,
      health: 'degraded',
      lastError: null,
      alreadyRunning: true,
    };
  }

  const existing = getSessionCompat(sessionId);

  if (existing && toPublicStatus(existing.status) !== 'idle') {
    return {
      ...mapSession(existing, sessionId),
      alreadyRunning: true,
    };
  }

  const session = await sessionManager.startSession(sessionId, {
    displayName,
    forceNew: Boolean(existing),
  });

  return {
    ...mapSession(session, sessionId),
    alreadyRunning: false,
  };
}

async function deleteConnection(sessionId = DEFAULT_SESSION) {
  return sessionManager.removeSession(sessionId);
}

async function getConnectionQr(sessionId = DEFAULT_SESSION) {
  const session = getSessionCompat(sessionId);
  const creating = typeof sessionManager.isSessionCreating === 'function'
    ? sessionManager.isSessionCreating(sessionId)
    : false;

  if (session && toPublicStatus(session.status) === 'connected') {
    return { status: 'connected', qr: null };
  }

  const qr = session?.qrCode || (typeof sessionManager.getLatestQr === 'function' ? sessionManager.getLatestQr() : null);

  if (!qr) {
    if (creating) {
      return { status: 'creating', qr: null };
    }

    return { status: session ? toPublicStatus(session.status) : 'idle', qr: null };
  }

  return { status: session ? toPublicStatus(session.status) : 'qr', qr };
}

module.exports = {
  createConnection,
  deleteConnection,
  getConnectionQr,
  getConnectionStatus,
  listConnections,
  mapSession,
  normalizeStatus,
  toPublicStatus,
};
