const { listSessionIds, validateSession } = require('./whatsapp/connection/sessionPersistenceValidator');
const sessionManager = require('./sessionManager');

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

      if (status !== 'connected' && status !== 'connecting') {
        console.log(`[SessionRecoveryService] Session "${normalizedId}" is disconnected but has valid credentials. Recovering...`);
        
        // Trigger connection asynchronously
        sessionManager.startSession(normalizedId, {
          allowInactive: true,
          displayName: normalizedId,
        }).catch(err => {
          console.error(`[SessionRecoveryService] Failed to reconnect session "${normalizedId}":`, err.message || err);
        });

        recovered.push(normalizedId);
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
};
