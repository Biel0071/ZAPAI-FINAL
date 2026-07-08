const sessionManager = require('./sessionManager');
const sessionRegistry = require('./sessionRegistry');
const { activeSessions } = require('./whatsapp/state/registry');
const { backendLog, errorLog } = require('./logger');

let intervalId = null;

async function checkAndRecoverSessions() {
  try {
    const registeredSessions = sessionRegistry.list();
    const now = Date.now();

    for (const reg of registeredSessions) {
      const { sessionId, status, connected } = reg;
      const session = activeSessions[sessionId];

      let needsReconnect = false;
      let reason = '';

      // 1. Registered session is marked connected/active in registry, but no active session object exists in activeSessions
      if ((connected || status === 'connected') && (!session || session.isDisposed || session.isClosing)) {
        needsReconnect = true;
        reason = 'Session active in registry but missing or disposed in activeSessions';
      }
      // 2. Stored session object exists in activeSessions but status is 'disconnected' (and not closing/disposed)
      else if (session && !session.isDisposed && !session.isClosing && session.status === 'disconnected') {
        needsReconnect = true;
        reason = 'Session status is disconnected in activeSessions';
      }

      // 4. Session socket is closed but status remains connected
      else if (session && !session.isDisposed && !session.isClosing && session.status === 'connected') {
        const isSocketClosed = session.sock?.ws?.readyState !== undefined && session.sock.ws.readyState !== 1;
        if (isSocketClosed) {
          needsReconnect = true;
          reason = 'Socket connection is not in OPEN state while session status is connected';
        }
      }
      // 5. Session is stuck in 'connecting' or 'qr' state for over 2 minutes
      else if (session && !session.isDisposed && !session.isClosing && (session.status === 'connecting' || session.status === 'qr')) {
        const lastUpdate = session.updatedAt ? new Date(session.updatedAt).getTime() : (session.lastPingAt || session.connectedAt || 0);
        const hungTimeMs = now - lastUpdate;
        if (hungTimeMs > 120_000) {
          needsReconnect = true;
          reason = `Session stuck in ${session.status} state for ${Math.round(hungTimeMs / 1000)}s (threshold 120s)`;
        }
      }

      if (needsReconnect) {
        backendLog('warn', 'connection_recovery:triggered', {
          sessionId,
          reason,
          status: session ? session.status : 'missing',
        });

        try {
          await sessionManager.reconnectSession(sessionId, { force: true });
        } catch (reconnectError) {
          errorLog(reconnectError, {
            scope: 'connection_recovery',
            action: 'reconnect',
            sessionId,
          });
        }
      }
    }
  } catch (error) {
    errorLog(error, { scope: 'connection_recovery', action: 'check' });
  }
}

function start() {
  if (intervalId) {
    return;
  }
  intervalId = setInterval(checkAndRecoverSessions, 25_000);
  backendLog('info', 'connection_recovery:started', { intervalMs: 25_000 });
}

function stop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    backendLog('info', 'connection_recovery:stopped');
  }
}

module.exports = {
  start,
  stop,
  checkAndRecoverSessions,
};
