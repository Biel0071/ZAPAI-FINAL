/**
 * Session Watchdog — Detects and cleans up stale/zombie WhatsApp sessions.
 *
 * Runs as a supervised worker (registered with WorkerSupervisor) that:
 * - Scans activeSessions for zombies (connected status but no heartbeat)
 * - Detects sessions stuck in 'connecting' for > 2 minutes
 * - Detects sessions stuck in 'error' with expired reconnect timers
 * - Emits diagnostics via WebSocket
 * - Auto-restarts stuck sessions when safe
 *
 * This is NOT a replacement for reconnect logic in stableSession.js.
 * It's a safety net that catches edge cases the reconnect handler misses.
 */

const { activeSessions } = require('./whatsapp/state/registry');
const sessionRegistry = require('./sessionRegistry');
const runtimeEngine = require('./runtimeEngine');

const STALE_CONNECTING_MS = 2 * 60_000;   // 2 min in connecting = stuck
const STALE_ERROR_MS = 5 * 60_000;        // 5 min in error = zombie
const STALE_HEARTBEAT_MS = 3 * 60_000;    // 3 min no heartbeat = dead
const MAX_AUTO_RESTART_PER_HOUR = 3;

// Track auto-restarts to prevent infinite loops
const autoRestartCounts = new Map(); // sessionId → { count, windowStart }

function getAutoRestartWindow(sessionId) {
  let entry = autoRestartCounts.get(sessionId);
  if (!entry || Date.now() - entry.windowStart > 3600_000) {
    entry = { count: 0, windowStart: Date.now() };
    autoRestartCounts.set(sessionId, entry);
  }
  return entry;
}

function canAutoRestart(sessionId) {
  const window = getAutoRestartWindow(sessionId);
  return window.count < MAX_AUTO_RESTART_PER_HOUR;
}

function recordAutoRestart(sessionId) {
  const window = getAutoRestartWindow(sessionId);
  window.count += 1;
}

// ─── Core Audit ───

function auditSessions() {
  const now = Date.now();
  const results = {
    total: 0,
    healthy: 0,
    stale: [],
    zombies: [],
    stuck: [],
    autoRestarted: [],
    timestamp: new Date().toISOString(),
  };

  for (const [sessionId, session] of Object.entries(activeSessions)) {
    if (!session || session.isDisposed) continue;
    results.total += 1;

    const status = session.status || 'unknown';
    const lastHeartbeat = runtimeEngine.getSessionHeartbeat?.(sessionId) || 0;
    const heartbeatAge = lastHeartbeat > 0 ? now - lastHeartbeat : Infinity;

    // Check: connected but no heartbeat for 3+ minutes
    if (status === 'connected' && heartbeatAge > STALE_HEARTBEAT_MS) {
      results.zombies.push({
        sessionId,
        status,
        heartbeatAge: Math.round(heartbeatAge / 1000),
        reason: 'connected_no_heartbeat',
      });
      continue;
    }

    // Check: stuck in 'connecting' for 2+ minutes
    if (status === 'connecting') {
      const connectingDuration = session._connectingStartedAt
        ? now - session._connectingStartedAt
        : 0;

      // Track when connecting started
      if (!session._connectingStartedAt) {
        session._connectingStartedAt = now;
      }

      if (connectingDuration > STALE_CONNECTING_MS) {
        results.stuck.push({
          sessionId,
          status,
          stuckMs: connectingDuration,
          reason: 'connecting_timeout',
        });
      }
      continue;
    }

    // Clear connecting tracker if no longer connecting
    if (session._connectingStartedAt && status !== 'connecting') {
      delete session._connectingStartedAt;
    }

    // Check: stuck in 'error' with no active reconnect for 5+ min
    if (status === 'error' && !session.reconnecting && !session.reconnectRequestPending) {
      const errorDuration = session._errorStartedAt
        ? now - session._errorStartedAt
        : 0;

      if (!session._errorStartedAt) {
        session._errorStartedAt = now;
      }

      if (errorDuration > STALE_ERROR_MS) {
        results.stale.push({
          sessionId,
          status,
          staleMs: errorDuration,
          reason: 'error_no_reconnect',
        });
      }
      continue;
    }

    // Clear error tracker
    if (session._errorStartedAt && status !== 'error') {
      delete session._errorStartedAt;
    }

    // Healthy
    results.healthy += 1;
  }

  return results;
}

// ─── Cleanup Actions ───

function cleanupZombieSessions(auditResult, io) {
  const cleaned = [];

  for (const zombie of auditResult.zombies || []) {
    const session = activeSessions[zombie.sessionId];
    if (!session) continue;

    // Mark as disconnected — don't destroy auth state
    session.status = 'disconnected';
    session.lastError = 'Watchdog: zombie session detected (no heartbeat)';
    session.isClosing = true;

    try {
      session.sock?.ev?.removeAllListeners?.();
      session.sock?.end?.(undefined);
    } catch { /* ignore */ }

    sessionRegistry.setDisconnected(zombie.sessionId, 'watchdog_cleanup');
    cleaned.push(zombie.sessionId);

    console.warn(`[WATCHDOG] Cleaned zombie session: ${zombie.sessionId}`);

    io?.emit('session_watchdog', {
      action: 'zombie_cleaned',
      sessionId: zombie.sessionId,
      timestamp: new Date().toISOString(),
    });
  }

  return cleaned;
}

function restartStuckSessions(auditResult, restartFn, io) {
  const restarted = [];

  for (const stuck of [...(auditResult.stuck || []), ...(auditResult.stale || [])]) {
    if (!canAutoRestart(stuck.sessionId)) {
      console.warn(`[WATCHDOG] Auto-restart limit reached for ${stuck.sessionId}`);
      continue;
    }

    const session = activeSessions[stuck.sessionId];
    if (!session) continue;

    // Clean up old socket
    try {
      session.sock?.ev?.removeAllListeners?.();
      session.sock?.end?.(undefined);
    } catch { /* ignore */ }
    delete activeSessions[stuck.sessionId];

    recordAutoRestart(stuck.sessionId);
    restarted.push(stuck.sessionId);

    console.warn(`[WATCHDOG] Auto-restarting stuck session: ${stuck.sessionId} (${stuck.reason})`);

    // Trigger reconnect via the provided function
    if (typeof restartFn === 'function') {
      restartFn(stuck.sessionId).catch((err) => {
        console.error(`[WATCHDOG] Restart failed for ${stuck.sessionId}:`, err?.message || err);
      });
    }

    io?.emit('session_watchdog', {
      action: 'auto_restart',
      reason: stuck.reason,
      sessionId: stuck.sessionId,
      timestamp: new Date().toISOString(),
    });
  }

  return restarted;
}

// ─── Diagnostics ───

function getWatchdogDiagnostics() {
  const audit = auditSessions();

  return {
    ...audit,
    autoRestartLimits: Object.fromEntries(
      Array.from(autoRestartCounts.entries()).map(([id, entry]) => [
        id,
        {
          count: entry.count,
          remaining: MAX_AUTO_RESTART_PER_HOUR - entry.count,
          windowResetAt: new Date(entry.windowStart + 3600_000).toISOString(),
        },
      ])
    ),
  };
}

module.exports = {
  auditSessions,
  cleanupZombieSessions,
  getWatchdogDiagnostics,
  restartStuckSessions,
};
