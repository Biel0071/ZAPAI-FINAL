const sessionManager = require('./sessionManager');
const sessionRepository = require('../repositories/sessionRepository');

const DEFAULT_SESSION = sessionManager.DEFAULT_SESSION || 'main';

function normalizeStatus(status = 'disconnected') {
  const value = String(status || '').toLowerCase();

  if (value === 'connected') return 'connected';
  if (['qr_ready', 'qr', 'awaiting_qr'].includes(value)) return 'qr_ready';
  if (['creating', 'connecting', 'error', 'reconnecting'].includes(value)) return 'connecting';
  return 'disconnected';
}

function toPublicStatus(status = 'disconnected') {
  return normalizeStatus(status);
}

function toHealth(status = 'disconnected') {
  if (status === 'connected') return 'healthy';
  if (status === 'disconnected') return 'offline';
  return 'degraded';
}

function formatPhoneNumber(num) {
  if (!num) return null;
  // Remove non-numeric characters except +
  let cleaned = String(num).replace(/[^\d+]/g, '');
  if (!cleaned) return null;

  let digitsOnly = cleaned.replace(/\D/g, '');
  if (digitsOnly.startsWith('55') && digitsOnly.length >= 10) {
    const ddd = digitsOnly.slice(2, 4);
    const body = digitsOnly.slice(4);
    if (body.length === 9) {
      return `+55 (${ddd}) ${body.slice(0, 5)}-${body.slice(5)}`;
    } else if (body.length === 8) {
      return `+55 (${ddd}) ${body.slice(0, 4)}-${body.slice(4)}`;
    }
  } else if (digitsOnly.length === 11) {
    return `+55 (${digitsOnly.slice(2, 4)}) ${digitsOnly.slice(4, 9)}-${digitsOnly.slice(9)}`;
  } else if (digitsOnly.length === 10) {
    return `+55 (${digitsOnly.slice(2, 4)}) ${digitsOnly.slice(4, 8)}-${digitsOnly.slice(8)}`;
  }

  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

function extractPhoneNumber(session) {
  if (!session) return null;
  let phone = session.phone || 
              session.number || 
              session.wid || 
              session.user?.id || 
              session.user?.jid || 
              session.auth?.creds?.me?.id || 
              session.sock?.user?.id || 
              session.sock?.user?.jid;
  if (!phone) return null;

  let cleaned = String(phone);
  if (cleaned.includes('@')) {
    cleaned = cleaned.split('@')[0];
  }
  if (cleaned.includes(':')) {
    cleaned = cleaned.split(':')[0];
  }
  cleaned = cleaned.replace(/[^\d]/g, '');
  return cleaned || null;
}

function normalizeSession(session) {
  if (!session) return { status: 'disconnected', connected: false };

  const isReallyConnected = !!(
    session.sock?.user ||
    session.connected === true ||
    session.connection === 'open' ||
    session.state === 'CONNECTED' ||
    session.status === 'connected'
  );

  let status = 'disconnected';
  if (isReallyConnected) {
    status = 'connected';
  } else if (
    session.status === 'reconnecting' || 
    session.state === 'RECONNECTING' || 
    session.connection === 'reconnecting'
  ) {
    status = 'reconnecting';
  } else if (
    session.status === 'qr_ready' || 
    session.status === 'qr' || 
    session.status === 'awaiting_qr' || 
    session.qrCode || 
    session.qr
  ) {
    status = 'qr_ready';
  } else if (
    session.status === 'connecting' || 
    session.state === 'CONNECTING' || 
    session.connection === 'connecting'
  ) {
    status = 'connecting';
  } else if (
    session.status === 'offline' || 
    session.state === 'OFFLINE'
  ) {
    status = 'offline';
  } else {
    status = session.status || 'disconnected';
  }

  return {
    status,
    connected: isReallyConnected,
  };
}

function mapSession(session = {}, sessionId = DEFAULT_SESSION) {
  const id = String(session.sessionId || sessionId || DEFAULT_SESSION);
  const isCreating = typeof sessionManager.isSessionCreating === 'function'
    ? sessionManager.isSessionCreating(id)
    : false;

  const norm = normalizeSession(session);
  let status = norm.status;
  if (isCreating && status !== 'connected') {
    status = 'connecting';
  }

  let phone = extractPhoneNumber(session);
  if (!phone) {
    const candidateId = String(session.sessionId || id || '');
    const cleanId = candidateId.replace(/[^\d]/g, '');
    if (cleanId && cleanId.length >= 5 && /^\+?\d+$/.test(candidateId.replace(/\s+/g, ''))) {
      phone = candidateId;
    } else {
      const candidateName = String(session.sessionName || session.name || '');
      const cleanName = candidateName.replace(/[^\d]/g, '');
      if (cleanName && cleanName.length >= 5 && /^\+?\d+$/.test(candidateName.replace(/\s+/g, ''))) {
        phone = candidateName;
      }
    }
  }

  console.log({
    id,
    extractedPhone: phone || null,
    connection: session.connection || null,
    state: session.state || null,
    connected: status === 'connected'
  });

  return {
    name: session.sessionName || session.name || id,
    phone: formatPhoneNumber(phone),
    sessionId: id,
    sessionName: session.sessionName || session.name || id,
    status,
    connected: status === 'connected',
    systemConnected: session.systemConnected !== false,
    retryCount: Number(session.retryCount || 0),
    health: toHealth(status),
    lastError: session.lastError || null,
    whatsAppName: session.whatsAppName || null,
    profilePictureUrl: session.profilePictureUrl || null,
    connectedAt: session.connectedAt || null,
    lastPingAt: session.lastPingAt || null,
    websocketStatus: (session.sock?.ws && (session.sock.ws.readyState === undefined || session.sock.ws.readyState === 1)) ? 'connected' : 'disconnected',
    lastDisconnectReason: session.lastDisconnectReason || session.lastError || null,
    reconnectCount: session.reconnectRequestCount || 0,
    isBanned: Boolean(session.isBanned || String(session.lastError || '').toLowerCase().includes('ban') || String(session.lastDisconnectReason || '').toLowerCase().includes('ban')),
    hasConflict: Boolean(session.hasConflict || session.lastDisconnectCode === 409)
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
  const activeSessions = sessionManager.listSessions?.() || [];
  let dbSessions = [];
  try {
    dbSessions = await sessionRepository.getSessions(undefined, { activeOnly: false });
  } catch (err) {
    // ignore
  }

  const merged = new Map();

  for (const dbSession of dbSessions) {
    if (dbSession.status === 'deleted') continue;
    const id = dbSession.sessionId || dbSession.id;
    if (id) {
      merged.set(id, {
        sessionId: id,
        sessionName: dbSession.sessionName || dbSession.name || id,
        status: dbSession.status || 'disconnected',
        phone: dbSession.phone || null,
        systemConnected: false,
      });
    }
  }

  for (const activeSession of activeSessions) {
    const id = activeSession.sessionId;
    const existing = merged.get(id);
    const realSession = getSessionCompat(id) || activeSession;
    merged.set(id, {
      ...realSession,
      sessionId: id,
      sessionName: activeSession.sessionName || activeSession.name || id,
      status: realSession.status || activeSession.status || 'disconnected',
      phone: realSession.phone || activeSession.phone || (existing ? existing.phone : null),
      systemConnected: true,
    });
  }

  return Array.from(merged.values()).map((session) => mapSession(session, session.sessionId));
}

async function getConnectionStatus(sessionId = DEFAULT_SESSION) {
  const session = getSessionCompat(sessionId);
  const creating = typeof sessionManager.isSessionCreating === 'function'
    ? sessionManager.isSessionCreating(sessionId)
    : false;

  if (!session && !creating) {
    try {
      const persisted = await sessionRepository.getSessions(undefined, { activeOnly: false });
      const dbSession = persisted.find((s) => String(s.sessionId || s.id) === String(sessionId));
      if (dbSession) {
        return {
          ...mapSession({
            ...dbSession,
            status: 'disconnected',
          }, sessionId),
          qrReady: false,
          logs: [],
        };
      }
    } catch (err) {
      // ignore
    }

    return {
      sessionId,
      sessionName: sessionId,
      status: 'disconnected',
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
      status: 'connecting',
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
    qrReady: status === 'qr_ready',
    logs: Array.isArray(session.connectionLogs) ? session.connectionLogs.slice(-50) : [],
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
      status: 'connecting',
      connected: false,
      systemConnected: true,
      retryCount: 0,
      health: 'degraded',
      lastError: null,
      alreadyRunning: true,
    };
  }

  const existing = getSessionCompat(sessionId);

  if (existing && toPublicStatus(existing.status) !== 'disconnected') {
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

  const qr = session?.qrCode || (typeof sessionManager.getSessionQr === 'function' ? sessionManager.getSessionQr(sessionId) : null);

  if (!qr) {
    if (creating) {
      return { status: 'connecting', qr: null };
    }

    return { status: session ? toPublicStatus(session.status) : 'disconnected', qr: null };
  }

  return { status: session ? toPublicStatus(session.status) : 'qr_ready', qr };
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
