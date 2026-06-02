const fs = require('fs/promises');
const path = require('path');
const sessionRepository = require('../repositories/sessionRepository');
const sessionRegistry = require('./sessionRegistry');
// NOTE: whatsappService is required lazily inside startSession() to break the
// circular dependency: sessionManager → whatsappService → sessionManager.
// A top-level require would cause whatsappService.createStableSession to be
// undefined because Node.js returns the partially-initialised module object.
let _whatsappService = null;
function getWhatsappService() {
  if (!_whatsappService) {
    _whatsappService = require('./whatsappService');
  }
  return _whatsappService;
}
// Shared mutable registry — same object reference as stableSession.js uses.
const { activeSessions } = require('./whatsapp/state/registry');

const SESSIONS_DIRECTORY = path.join(__dirname, '..', 'sessions');
const sessions = new Map();
const DEFAULT_SESSION = 'main';   // always exactly 'main'
const startupPromises = new Map();
const reconnectTimers = new Map();
const reconnectAttempts = new Map();
const reconnectInFlight = new Set();
const MAX_RECONNECT_ATTEMPTS = 10;

// Latest QR code for the single session (expires after 60 s)
let _latestQr = null;
let _qrExpiresAt = 0;
const QR_TTL_MS = 60_000;

function setLatestQr(qr) {
  _latestQr = qr;
  _qrExpiresAt = Date.now() + QR_TTL_MS;
}

function clearLatestQr() {
  _latestQr = null;
  _qrExpiresAt = 0;
}

function getLatestQr() {
  if (!_latestQr || Date.now() > _qrExpiresAt) return null;
  return _latestQr;
}

let managerOptions = {
  io: null,
  onIncomingMessage: async () => {},
  onSessionConnected: () => {},
};
let runtimeActive = false;

function normalizeSessionName(sessionName = DEFAULT_SESSION) {
  const normalized = String(sessionName || DEFAULT_SESSION)
    .trim()
    .replace(/\s+/g, '_')
    .toLowerCase();

  return normalized || DEFAULT_SESSION;
}

function normalizeLifecycleStatus(status = 'disconnected') {
  const normalized = String(status || '').toLowerCase();

  if (normalized === 'qr_ready') {
    return 'qr';
  }

  if (normalized === 'error') {
    return 'connecting';
  }

  if (['connected', 'connecting', 'qr', 'disconnected'].includes(normalized)) {
    return normalized;
  }

  return 'disconnected';
}

function configureSessionManager(options = {}) {
  managerOptions = {
    ...managerOptions,
    ...options,
  };
}

function setSession(name, session) {
  const normalizedName = normalizeSessionName(name);
  session.sessionId = normalizedName;
  session.sessionName = session.sessionName || session.displayName || normalizedName;
  session.name = session.displayName || session.sessionName || normalizedName;
  sessions.set(normalizedName, session);
  // Keep activeSessions registry in sync (shared with stableSession.js)
  activeSessions[normalizedName] = session;
  emitRuntimeStatus();
  return session;
}

function hasSession(name = DEFAULT_SESSION) {
  const normalizedName = normalizeSessionName(name);
  return sessions.has(normalizedName);
}

function getSession(name = DEFAULT_SESSION) {
  const normalizedName = normalizeSessionName(name);
  return sessions.get(normalizedName) || null;
}

function listSessions() {
  return Array.from(sessions.entries()).map(([sessionName, session]) => ({
    name: session.displayName || session.sessionName || sessionName,
    phone: session.phone,
    sessionId: sessionName,
    sessionName: session.displayName || session.sessionName || sessionName,
    status: normalizeLifecycleStatus(session.status),
  }));
}

function emitRuntimeStatus() {
  const io = managerOptions.io;

  if (!io) {
    return;
  }

  const activeSessions = listSessions().filter((session) =>
    ['connected', 'connecting', 'qr'].includes(String(session.status || '').toLowerCase())
  );

  io.emit('system:runtime-status', {
    sessions: activeSessions,
    status: runtimeActive && activeSessions.length > 0 ? 'online' : 'offline',
  });
}

function emitSessionStatusCompat(payload = {}) {
  const io = managerOptions.io;

  if (!io) {
    return;
  }

  io.emit('session_status', payload);
  io.emit('session:status', payload);
}

function setRuntimeActive(value) {
  runtimeActive = Boolean(value);

  if (!runtimeActive) {
    for (const timer of reconnectTimers.values()) {
      clearTimeout(timer);
    }

    reconnectTimers.clear();
  }

  emitRuntimeStatus();
}

function isRuntimeActive() {
  return runtimeActive;
}

function isSessionCreating(sessionName = DEFAULT_SESSION) {
  const normalizedName = normalizeSessionName(sessionName);
  return startupPromises.has(normalizedName);
}

async function closeSocket(session, { logout = false } = {}) {
  if (!session) {
    return;
  }

  session.isClosing = true;

  if (session.heartbeatTimer) {
    clearInterval(session.heartbeatTimer);
    session.heartbeatTimer = null;
  }

  if (session.qrTimeoutTimer) {
    clearTimeout(session.qrTimeoutTimer);
    session.qrTimeoutTimer = null;
  }

  if (session.reconnectCooldownTimer) {
    clearTimeout(session.reconnectCooldownTimer);
    session.reconnectCooldownTimer = null;
  }

  if (session.reconnectRequestTimer) {
    clearTimeout(session.reconnectRequestTimer);
    session.reconnectRequestTimer = null;
  }

  session.reconnecting = false;
  session.reconnectRequestPending = false;

  try {
    session.sock?.ev?.removeAllListeners?.();
  } catch {
    // ignore listener cleanup errors
  }

  try {
    if (logout && session.sock?.logout) {
      await session.sock.logout();
    }
  } catch {
    // ignore logout errors
  }

  try {
    if (session.sock?.end) {
      session.sock.end(undefined);
    }
  } catch {
    // ignore socket end errors
  }

  try {
    if (session.sock?.ws?.close) {
      session.sock.ws.close();
    }
  } catch {
    // ignore close errors
  }

  session.isClosing = false;
}

async function deleteSessionFolder(sessionName) {
  const normalizedName = normalizeSessionName(sessionName);
  const sessionPath = path.join(SESSIONS_DIRECTORY, normalizedName);

  await fs.rm(sessionPath, { force: true, recursive: true });
}

function clearReconnectTimer(sessionName) {
  const normalizedName = normalizeSessionName(sessionName);
  const timer = reconnectTimers.get(normalizedName);

  if (timer) {
    clearTimeout(timer);
    reconnectTimers.delete(normalizedName);
  }
}

function resetReconnectAttempts(sessionName) {
  const normalizedName = normalizeSessionName(sessionName);
  reconnectAttempts.delete(normalizedName);
}

function nextReconnectAttempt(sessionName) {
  const normalizedName = normalizeSessionName(sessionName);
  const attempt = Number(reconnectAttempts.get(normalizedName) || 0) + 1;
  reconnectAttempts.set(normalizedName, attempt);
  return attempt;
}

function setSessionSystemConnection(sessionName = DEFAULT_SESSION, enabled = true) {
  const normalizedName = normalizeSessionName(sessionName);
  const session = getSession(normalizedName);

  if (!session) {
    return null;
  }

  session.systemConnected = Boolean(enabled);
  session.updatedAt = new Date().toISOString();
  setSession(normalizedName, session);

  const io = managerOptions.io;
  if (io) {
    io.emit('session:system-connection', {
      sessionId: normalizedName,
      sessionName: session.sessionName || normalizedName,
      systemConnected: session.systemConnected,
      updatedAt: session.updatedAt,
    });
  }

  return session;
}

async function disposeSession(sessionName, options = {}) {
  const normalizedName = normalizeSessionName(sessionName);
  const session = getSession(normalizedName);

  clearReconnectTimer(normalizedName);
  reconnectInFlight.delete(normalizedName);
  startupPromises.delete(normalizedName);

  if (options.preserveReconnectAttempts !== true) {
    resetReconnectAttempts(normalizedName);
  }

  if (session) {
    session.isDisposed = true;
    session.status = 'disconnected';
    await closeSocket(session, { logout: options.logout === true });
    sessions.delete(normalizedName);
    // CRITICAL: also clean the shared activeSessions registry
    delete activeSessions[normalizedName];
    emitRuntimeStatus();
  } else {
    // Even if session isn't in the Map, clean activeSessions to prevent ghosts
    const activeRef = activeSessions[normalizedName];
    if (activeRef) {
      activeRef.isDisposed = true;
      activeRef.status = 'disconnected';
      await closeSocket(activeRef, { logout: options.logout === true });
      delete activeSessions[normalizedName];
    }
  }

  // Update session registry status
  try {
    if (options.logout === true || options.deleteFolder === true) {
      await sessionRegistry.removeSession(normalizedName);
    } else {
      sessionRegistry.setDisconnected(normalizedName);
      await sessionRegistry.persistSession(normalizedName);
    }
  } catch (err) {
    // ignore
  }

  // Try-catch database status fallback
  try {
    await sessionRepository.updateSessionStatus(
      normalizedName,
      'disconnected',
      session?.phone || null,
      undefined,
      session?.displayName || session?.sessionName || normalizedName
    );
  } catch (err) {
    // ignore
  }

  if (options.deleteFolder === true) {
    await deleteSessionFolder(normalizedName);
  }
}

async function listStoredSessionNames() {
  const sessionMap = new Map();
  const activeOnly = String(process.env.WHATSAPP_RESTORE_ACTIVE_ONLY || 'true').toLowerCase() !== 'false';

  try {
    const persistedSessions = await sessionRepository.getSessions(undefined, { activeOnly });

    for (const session of persistedSessions) {
      if (session?.sessionId) {
        const normalizedId = normalizeSessionName(session.sessionId);
        sessionMap.set(normalizedId, {
          sessionId: normalizedId,
          sessionName: session.sessionName || session.name || normalizedId,
        });
      }
    }
  } catch {
    // ignore database lookup issues
  }

  try {
    const entries = await fs.readdir(SESSIONS_DIRECTORY, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const normalizedId = normalizeSessionName(entry.name);

        if (!sessionMap.has(normalizedId)) {
          sessionMap.set(normalizedId, {
            sessionId: normalizedId,
            sessionName: entry.name,
          });
        }
      }
    }
  } catch {
    // ignore file system lookup issues
  }

  return Array.from(sessionMap.values());
}

async function startSession(sessionName = DEFAULT_SESSION, options = {}) {
  const normalizedName = normalizeSessionName(sessionName);
  const requestedSessionName = normalizedName;
  const existingSession = getSession(normalizedName);
  const displayName = options.displayName || requestedSessionName;

  if (!runtimeActive && options.allowInactive !== true) {
    throw new Error('System is inactive. Activate it with POST /system/start.');
  }

  if (existingSession && !options.forceNew) {
    return existingSession;
  }

  if (hasSession(normalizedName) && !options.forceNew) {
    return getSession(normalizedName);
  }

  if (startupPromises.has(normalizedName)) {
    return startupPromises.get(normalizedName);
  }

  const startupPromise = (async () => {
    if (existingSession) {
      await disposeSession(normalizedName, { preserveReconnectAttempts: true });
    }

    const session = await getWhatsappService().createStableSession({
      displayName,
      io: managerOptions.io,
      onConnectionUpdate: async () => {},
      onIncomingMessage: managerOptions.onIncomingMessage,
      onMessageUpdate: async () => {},
      onQrGenerated: (qr) => {
        setLatestQr(qr);
      },
      onReconnectRequested: async (targetSessionName, metadata = {}) => {
        const normalizedTarget = normalizeSessionName(targetSessionName);
        const targetSession = getSession(normalizedTarget);
        const closeCode = Number(metadata?.closeCode || 0) || null;

        // Guard: prevent duplicate reconnect scheduling
        if (
          !runtimeActive ||
          reconnectTimers.has(normalizedTarget) ||
          reconnectInFlight.has(normalizedTarget) ||
          targetSession?.isDisposed ||
          targetSession?.isClosing
        ) {
          console.log(`[WHATSAPP] Reconnect suppressed for ${normalizedTarget} (guard triggered)`);
          return;
        }

        const attempt = nextReconnectAttempt(normalizedTarget);

        if (attempt > MAX_RECONNECT_ATTEMPTS) {
          console.warn(`[WHATSAPP] Reconnect limit reached for ${normalizedTarget} (attempt ${attempt-1}/${MAX_RECONNECT_ATTEMPTS})`);
          if (targetSession) {
            targetSession.status = 'error';
            targetSession.lastError = `Reconnect limit reached (${MAX_RECONNECT_ATTEMPTS} attempts, last close code: ${closeCode || 'unknown'})`;
            setSession(normalizedTarget, targetSession);
          }
          // Emit final status so frontend stops showing 'connecting'
          emitSessionStatusCompat({
            sessionId: normalizedTarget,
            sessionName: targetSession?.sessionName || normalizedTarget,
            status: 'error',
            lastError: 'Reconnect limit reached',
          });
          return;
        }

        // Exponential backoff: 3s, 6s, 12s, 24s, 30s (capped)
        const backoffMs = Math.min(3000 * Math.pow(2, attempt - 1), 30000);
        console.log(`[WHATSAPP] Reconnect scheduled for ${normalizedTarget} in ${backoffMs}ms (attempt ${attempt}/${MAX_RECONNECT_ATTEMPTS}, closeCode=${closeCode || 'n/a'})`);

        const timer = setTimeout(async () => {
          reconnectTimers.delete(normalizedTarget);

          // Re-check guards before actually reconnecting
          const freshSession = getSession(normalizedTarget);
          if (freshSession !== targetSession) {
            console.log(`[WHATSAPP] Reconnect aborted for ${normalizedTarget} (session instance changed)`);
            return;
          }
          if (!runtimeActive || freshSession?.isDisposed || reconnectInFlight.has(normalizedTarget)) {
            console.log(`[WHATSAPP] Reconnect aborted for ${normalizedTarget} (post-backoff guard)`);
            return;
          }

          reconnectInFlight.add(normalizedTarget);

          try {
            // Dispose old session cleanly before recreating
            await disposeSession(normalizedTarget, { preserveReconnectAttempts: true });
            await startSession(normalizedTarget, {
              forceNew: true,
              displayName: freshSession?.displayName || normalizedTarget,
            });
          } catch (error) {
            console.error(`[WHATSAPP] Reconnect failed for ${normalizedTarget}:`, error.message || error);
          } finally {
            reconnectInFlight.delete(normalizedTarget);
          }
        }, backoffMs);

        reconnectTimers.set(normalizedTarget, timer);
      },
      onSessionConnected: async (connectedSession) => {
        connectedSession.displayName = displayName;
        connectedSession.retryCount = 0;
        connectedSession.lastRetryAt = null;
        connectedSession.systemConnected =
          typeof connectedSession.systemConnected === 'boolean' ? connectedSession.systemConnected : true;
        resetReconnectAttempts(normalizedName);
        setSession(normalizedName, connectedSession);
        clearLatestQr();
        managerOptions.onSessionConnected(connectedSession);
      },
      sessionName: normalizedName,
    });

    session.displayName = displayName;
    try {
      const persisted = await sessionRepository.getSessions(undefined, { activeOnly: false });
      const record = persisted.find(s => s.sessionId === normalizedName);
      if (record && record.phone) {
        session.phone = record.phone;
      }
    } catch (e) {
      // ignore
    }
    setSession(normalizedName, session);
    return session;
  })().finally(() => {
    startupPromises.delete(normalizedName);
  });

  startupPromises.set(normalizedName, startupPromise);
  return startupPromise;
}

async function restartSession(sessionName = DEFAULT_SESSION, options = {}) {
  const requestedSessionName = String(sessionName || DEFAULT_SESSION).trim();
  const normalizedName = normalizeSessionName(sessionName);
  const currentSession = getSession(normalizedName);
  const displayName =
    options.displayName ||
    currentSession?.displayName ||
    currentSession?.sessionName ||
    requestedSessionName ||
    normalizedName;

  console.log('Restarting session:', normalizedName);

  await disposeSession(normalizedName, { deleteFolder: true });
  resetReconnectAttempts(normalizedName);

  return startSession(normalizedName, { displayName, forceNew: true });
}

async function reconnectSession(sessionName = DEFAULT_SESSION, options = {}) {
  const normalizedName = normalizeSessionName(sessionName);
  const currentSession = getSession(normalizedName);

  if (currentSession?.status === 'connected' && options.force !== true) {
    return currentSession;
  }

  if (currentSession) {
    await disposeSession(normalizedName, { deleteFolder: false, logout: false });
  }

  resetReconnectAttempts(normalizedName);
  return startSession(normalizedName, {
    displayName: options.displayName || currentSession?.displayName || normalizedName,
    forceNew: true,
  });
}

async function createSession(sessionName = DEFAULT_SESSION, options = {}) {
  return startSession(sessionName, options);
}

async function getDefaultSession() {
  const session = getSession(DEFAULT_SESSION);

  if (session) {
    return session;
  }

  if (!runtimeActive) {
    return null;
  }

  return startSession(DEFAULT_SESSION);
}

async function removeSession(name = DEFAULT_SESSION) {
  const normalizedName = normalizeSessionName(name);
  const session = getSession(normalizedName);

  console.log('Deleting session:', normalizedName);

  await disposeSession(normalizedName, { logout: true, deleteFolder: true });
  resetReconnectAttempts(normalizedName);

  try {
    await sessionRepository.updateSessionStatus(
      normalizedName,
      'disconnected',
      session?.phone || null,
      undefined,
      session?.displayName || session?.sessionName || normalizedName
    );
  } catch {
    // ignore persistence errors
  }

  managerOptions.io?.emit('session_deleted', {
    name: session?.displayName || session?.sessionName || normalizedName,
    sessionId: normalizedName,
    sessionName: session?.displayName || session?.sessionName || normalizedName,
  });

  return true;
}

async function logoutSession(name = DEFAULT_SESSION) {
  const normalizedName = normalizeSessionName(name);
  const session = getSession(normalizedName);

  if (!session) {
    return false;
  }

  await disposeSession(normalizedName, { deleteFolder: true, logout: true });
  resetReconnectAttempts(normalizedName);

  managerOptions.io?.emit('session_disconnected', {
    name: session.displayName || session.sessionName || normalizedName,
    sessionId: normalizedName,
    sessionName: session.displayName || session.sessionName || normalizedName,
  });
  emitSessionStatusCompat({
    name: session.displayName || session.sessionName || normalizedName,
    sessionId: normalizedName,
    sessionName: session.displayName || session.sessionName || normalizedName,
    status: 'disconnected',
  });
  emitRuntimeStatus();

  return true;
}

async function restoreSessions() {
  const restoredSessions = [];
  const storedSessions = await listStoredSessionNames();
  const restoreMode = String(process.env.WHATSAPP_RESTORE_MODE || '').trim().toLowerCase();
  const defaultRestoreMode = 'active';
  const effectiveRestoreMode = restoreMode || defaultRestoreMode;
  const allowList = String(process.env.WHATSAPP_RESTORE_SESSION_ALLOWLIST || '')
    .split(',')
    .map((item) => normalizeSessionName(item))
    .filter(Boolean);
  const maxRestore = Math.max(1, Number(process.env.WHATSAPP_RESTORE_MAX_SESSIONS || 1));

  let sessionsToRestore = [{ sessionId: DEFAULT_SESSION, sessionName: DEFAULT_SESSION }];

  if (effectiveRestoreMode === 'none') {
    sessionsToRestore = [];
  } else if (effectiveRestoreMode === 'persisted' || effectiveRestoreMode === 'active') {
    sessionsToRestore =
      Array.isArray(storedSessions) && storedSessions.length > 0
        ? storedSessions
        : [{ sessionId: DEFAULT_SESSION, sessionName: DEFAULT_SESSION }];
  } else if (effectiveRestoreMode === 'allowlist' && allowList.length > 0) {
    sessionsToRestore = allowList.map((sessionId) => ({
      sessionId,
      sessionName: sessionId,
    }));
  }

  sessionsToRestore = sessionsToRestore.slice(0, maxRestore);

  if (!sessionsToRestore.length) {
    return restoredSessions;
  }

  for (const candidate of sessionsToRestore) {
    const sessionId = normalizeSessionName(candidate?.sessionId || candidate?.sessionName || DEFAULT_SESSION);
    const displayName = candidate?.sessionName || sessionId;

    try {
      const session = await startSession(sessionId, {
        displayName,
      });

      restoredSessions.push({
        name: displayName,
        sessionId,
        sessionName: displayName,
        status: normalizeLifecycleStatus(session.status),
      });
    } catch (error) {
      console.error(`[WHATSAPP] Failed to restore session ${sessionId}:`, error.message || error);
    }
  }

  return restoredSessions;
}

async function stopAllSessions() {
  const activeSessions = Array.from(sessions.keys());

  for (const sessionName of activeSessions) {
    await disposeSession(sessionName);
  }
}

/**
 * Removes zombie sessions: sessions whose auth directory is empty or missing.
 * Should be called before restoreSessions() during startup.
 */
async function cleanupZombieSessions() {
  const cleaned = [];

  try {
    const entries = await fs.readdir(SESSIONS_DIRECTORY, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const sessionDir = path.join(SESSIONS_DIRECTORY, entry.name);
      const normalizedName = normalizeSessionName(entry.name);

      // Never clean the default session directory — it should always exist
      if (normalizedName === DEFAULT_SESSION) continue;

      try {
        const files = await fs.readdir(sessionDir);
        const hasAuthFiles = files.some((f) =>
          f.endsWith('.json') || f === 'creds.json' || f.startsWith('pre-key') || f.startsWith('sender-key')
        );

        if (!hasAuthFiles) {
          // Empty session dir — remove it and its in-memory/registry entry
          console.log(`[SESSION CLEANUP] Removing zombie session: ${normalizedName} (empty auth dir)`);

          // Remove from in-memory map
          const session = sessions.get(normalizedName);
          if (session) {
            session.isDisposed = true;
            session.status = 'disconnected';
            sessions.delete(normalizedName);
            delete activeSessions[normalizedName];
          }

          // Remove from registry
          try { await sessionRegistry.removeSession(normalizedName); } catch {}
          try { await sessionRepository.updateSessionStatus(normalizedName, 'disconnected'); } catch {}

          // Remove directory
          await fs.rm(sessionDir, { force: true, recursive: true });
          cleaned.push(normalizedName);
        }
      } catch {
        // Ignore per-session errors
      }
    }
  } catch (err) {
    console.error('[SESSION CLEANUP] Failed to scan sessions directory:', err.message || err);
  }

  // Also clean in-memory sessions that don't have a corresponding directory
  for (const [sessionName, session] of sessions.entries()) {
    if (sessionName === DEFAULT_SESSION) continue;

    const sessionDir = path.join(SESSIONS_DIRECTORY, sessionName);
    try {
      await fs.access(sessionDir);
    } catch {
      // Directory doesn't exist — remove the in-memory session
      console.log(`[SESSION CLEANUP] Removing orphan in-memory session: ${sessionName}`);
      session.isDisposed = true;
      session.status = 'disconnected';
      sessions.delete(sessionName);
      delete activeSessions[sessionName];
      cleaned.push(sessionName);
    }
  }

  if (cleaned.length > 0) {
    console.log(`[SESSION CLEANUP] Cleaned ${cleaned.length} zombie sessions: ${cleaned.join(', ')}`);
  } else {
    console.log('[SESSION CLEANUP] No zombie sessions found.');
  }

  return cleaned;
}

/**
 * Comprehensive session reconciliation — called at system startup.
 *
 * 1. Runs cleanupZombieSessions (filesystem/memory orphans)
 * 2. Removes sessions stuck in "connecting" without a socket for > 5 min
 * 3. Removes duplicate/orphan sessionRegistry entries
 * 4. Clears stale reconnect timers
 *
 * Returns a summary of all cleaned entries.
 */
async function reconcileSessions() {
  const summary = { zombies: [], stale: [], orphanRegistry: [] };

  // Phase 1: filesystem & memory orphans
  try {
    const zombies = await cleanupZombieSessions();
    summary.zombies = zombies;
  } catch (err) {
    console.error('[RECONCILE] cleanupZombieSessions error:', err.message);
  }

  // Phase 2: sessions stuck in "connecting" without a real socket
  const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
  const now = Date.now();
  for (const [name, session] of sessions.entries()) {
    if (name === DEFAULT_SESSION) continue;

    const status = String(session?.status || '').toLowerCase();
    const hasSock = Boolean(session?.sock);
    const isStale = (status === 'connecting' || status === 'qr_ready' || status === 'qr')
      && !hasSock;

    // Check how long it's been in this state
    const sessionAge = session?.connectedAt
      ? now - session.connectedAt
      : session?.createdAt
        ? now - session.createdAt
        : STALE_THRESHOLD_MS + 1;

    if (isStale && sessionAge > STALE_THRESHOLD_MS) {
      console.log(`[RECONCILE] Removing stale session: ${name} (status=${status}, age=${Math.round(sessionAge / 1000)}s, hasSock=${hasSock})`);
      session.isDisposed = true;
      session.status = 'disconnected';
      sessions.delete(name);
      delete activeSessions[name];
      summary.stale.push(name);

      // Clear reconnect state
      resetReconnectAttempts(name);
      clearReconnectTimer(name);
      reconnectInFlight.delete(name);

      // Remove from registry
      try { await sessionRegistry.removeSession(name); } catch {}
      try { await sessionRepository.updateSessionStatus(name, 'disconnected'); } catch {}
    }
  }

  // Phase 3: clean orphan entries in sessionRegistry not present in sessions map
  try {
    const registryList = sessionRegistry.list ? sessionRegistry.list() : [];
    for (const entry of registryList) {
      const regName = typeof entry === 'string' ? entry : entry?.sessionId || entry?.name;
      if (!regName || regName === DEFAULT_SESSION) continue;
      if (!sessions.has(regName)) {
        console.log(`[RECONCILE] Removing orphan registry entry: ${regName}`);
        try { await sessionRegistry.removeSession(regName); } catch {}
        summary.orphanRegistry.push(regName);
      }
    }
  } catch (err) {
    // sessionRegistry may not have a list method
    console.warn('[RECONCILE] Could not enumerate sessionRegistry:', err.message);
  }

  const total = summary.zombies.length + summary.stale.length + summary.orphanRegistry.length;
  if (total > 0) {
    console.log(`[RECONCILE] Cleaned ${total} entries — zombies: ${summary.zombies.length}, stale: ${summary.stale.length}, orphanRegistry: ${summary.orphanRegistry.length}`);
  } else {
    console.log('[RECONCILE] All sessions are healthy. No cleanup needed.');
  }

  return summary;
}

/**
 * Resets a session that reached the reconnect error limit.
 * Clears the error state and allows reconnection.
 */
async function resetSessionError(sessionName = DEFAULT_SESSION) {
  const normalizedName = normalizeSessionName(sessionName);
  const session = getSession(normalizedName);

  if (session) {
    session.status = 'disconnected';
    session.lastError = null;
    session.retryCount = 0;
    setSession(normalizedName, session);
  }

  resetReconnectAttempts(normalizedName);
  clearReconnectTimer(normalizedName);
  reconnectInFlight.delete(normalizedName);

  emitSessionStatusCompat({
    sessionId: normalizedName,
    sessionName: session?.sessionName || normalizedName,
    status: 'disconnected',
    lastError: null,
  });

  return { sessionId: normalizedName, status: 'disconnected', message: 'Error state cleared. Ready for reconnection.' };
}

/**
 * Returns the first truly connected session, or null.
 */
function getConnectedSessionOrNull() {
  for (const [, session] of sessions.entries()) {
    if (
      session &&
      !session.isDisposed &&
      !session.isClosing &&
      session.sock &&
      String(session.status || '').toLowerCase() === 'connected'
    ) {
      return session;
    }
  }
  return null;
}

module.exports = {
  cleanupZombieSessions,
  clearLatestQr,
  configureSessionManager,
  createSession,
  DEFAULT_SESSION,
  getConnectedSessionOrNull,
  getDefaultSession,
  getLatestQr,
  getSession,
  hasSession,
  isSessionCreating,
  isRuntimeActive,
  listSessions,
  logoutSession,
  normalizeSessionName,
  reconcileSessions,
  removeSession,
  reconnectSession,
  resetSessionError,
  restartSession,
  restoreSessions,
  sessions,
  setLatestQr,
  setSessionSystemConnection,
  setRuntimeActive,
  setSession,
  startSession,
  stopAllSessions,
};
