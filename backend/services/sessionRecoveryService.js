const { listSessionIds, validateSession } = require('./whatsapp/connection/sessionPersistenceValidator');
const sessionManager = require('./sessionManager');

const recoveryInFlight = new Map();
const lastRecoveryAttemptAt = new Map();
const RECOVERY_COOLDOWN_MS = Math.max(
  5_000,
  Number(process.env.WHATSAPP_RECOVERY_COOLDOWN_MS || 30_000)
);
const NON_RECOVERABLE_STATUSES = new Set(['connected', 'connecting', 'qr', 'reconnecting']);

function shouldRecoverSession(session) {
  const status = String(session?.status || 'disconnected').toLowerCase();
  return !NON_RECOVERABLE_STATUSES.has(status);
}

async function reconnectPersistedSession(sessionId, session) {
  const existingRecovery = recoveryInFlight.get(sessionId);
  if (existingRecovery) {
    await existingRecovery;
    return false;
  }

  const lastAttemptAt = Number(lastRecoveryAttemptAt.get(sessionId) || 0);
  if (Date.now() - lastAttemptAt < RECOVERY_COOLDOWN_MS) {
    return false;
  }

  lastRecoveryAttemptAt.set(sessionId, Date.now());
  const recoveryPromise = Promise.resolve().then(() =>
    sessionManager.reconnectSession(sessionId, {
      displayName: session?.displayName || session?.sessionName || sessionId,
      force: true,
    })
  );
  recoveryInFlight.set(sessionId, recoveryPromise);

  try {
    await recoveryPromise;
    return true;
  } finally {
    if (recoveryInFlight.get(sessionId) === recoveryPromise) {
      recoveryInFlight.delete(sessionId);
    }
  }
}

/**
 * Scans all session directories and automatically reconnects sessions
 * that have valid credentials but are not currently connected.
 * 
 * @returns {Promise<string[]>} List of session IDs that were triggered for reconnection.
 */
async function recoverSessions() {
  const recovered = [];
  try {
    const sessionIds = await listSessionIds();
    console.log(`[SessionRecoveryService] Found session directories:`, sessionIds);

    for (const id of sessionIds) {
      const normalizedId = sessionManager.normalizeSessionName(id);
      
      // 1. Verify credentials validity
      const validation = await validateSession(normalizedId);
      if (!validation.ok) {
        console.log(`[SessionRecoveryService] Session "${normalizedId}" has invalid or incomplete credentials. Skipping.`);
        continue;
      }

      // 2. Check current in-memory status
      const session = sessionManager.getSession(normalizedId);
      const status = session ? String(session.status || '').toLowerCase() : 'disconnected';

      if (shouldRecoverSession(session)) {
        console.log(`[SessionRecoveryService] Session "${normalizedId}" is disconnected but has valid credentials. Recovering...`);

        try {
          const triggered = await reconnectPersistedSession(normalizedId, session);
          if (triggered) {
            recovered.push(normalizedId);
          }
        } catch (err) {
          console.error(`[SessionRecoveryService] Failed to reconnect session "${normalizedId}":`, err.message || err);
        }
      } else {
        console.log(`[SessionRecoveryService] Session "${normalizedId}" is already ${status}.`);
      }
    }
  } catch (error) {
    console.error('[SessionRecoveryService] Error during session recovery:', error.message || error);
  }

  return recovered;
}

module.exports = {
  recoverSessions,
  shouldRecoverSession,
};
