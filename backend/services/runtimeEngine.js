/**
 * Runtime Engine — Central orchestrator for all backend workers and lifecycle.
 *
 * Responsibilities:
 * - Session heartbeat monitoring
 * - Stale session cleanup
 * - Orphan socket detection
 * - Worker coordination (message, sync, cleanup, metrics)
 * - Recovery orchestration
 * - Runtime health reporting via WebSocket
 *
 * This module does NOT replace sessionManager or systemManager — it sits
 * above them as a coordination layer.
 */

const sessionManager = require('./sessionManager');
const metricsTracker = require('./metricsTracker');
const messageDedupeService = require('./messageDedupeService');
const { emitRuntimeStatus: emitRealtimeRuntimeStatus } = require('./whatsapp/realtime/events');

// ─── Configuration ───
const isProduction = String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
const HEARTBEAT_INTERVAL_MS = Math.max(5_000, Number(process.env.RUNTIME_HEARTBEAT_MS) || (isProduction ? 15_000 : 60_000));
const STALE_SESSION_THRESHOLD_MS = Math.max(30_000, Number(process.env.STALE_SESSION_MS) || 90_000);
const CLEANUP_INTERVAL_MS = Math.max(30_000, Number(process.env.RUNTIME_CLEANUP_MS) || (isProduction ? 60_000 : 180_000));
const METRICS_EMIT_INTERVAL_MS = Math.max(10_000, Number(process.env.RUNTIME_METRICS_EMIT_MS) || (isProduction ? 30_000 : 120_000));
const DIAGNOSTICS_INTERVAL_MS = Math.max(15_000, Number(process.env.RUNTIME_DIAGNOSTICS_MS) || (isProduction ? 45_000 : 180_000));

// ─── Runtime State ───
const runtimeState = {
  started: false,
  startedAt: null,
  heartbeatTimer: null,
  cleanupTimer: null,
  metricsTimer: null,
  diagnosticsTimer: null,
  sessionHeartbeats: new Map(), // sessionId → lastHeartbeatAt (epoch)
  reconnectCounts: new Map(),   // sessionId → count
  totalMessagesProcessed: 0,
  totalReconnects: 0,
  lastDiagnostics: null,
  storeRef: null,
};

// ─── Heartbeat Worker ───
function recordSessionHeartbeat(sessionId) {
  runtimeState.sessionHeartbeats.set(sessionId, Date.now());
}

function getSessionHeartbeat(sessionId) {
  return runtimeState.sessionHeartbeats.get(sessionId) || null;
}

function heartbeatTick() {
  const sessions = sessionManager.listSessions();
  const now = Date.now();

  for (const session of sessions) {
    const id = session.id || session.sessionId;
    if (!id) continue;

    const isConnected = session.connected ||
      String(session.status || '').toLowerCase() === 'connected';

    if (isConnected) {
      recordSessionHeartbeat(id);
    } else {
      // Check for stale sessions (heartbeat too old)
      const lastBeat = runtimeState.sessionHeartbeats.get(id);
      if (lastBeat && (now - lastBeat) > STALE_SESSION_THRESHOLD_MS) {
        console.warn(`[RuntimeEngine] Stale session detected: ${id} (last heartbeat ${Math.round((now - lastBeat) / 1000)}s ago)`);
        runtimeState.sessionHeartbeats.delete(id);
      }
    }
  }
}

// ─── Cleanup Worker ───
function cleanupTick() {
  const sessions = sessionManager.listSessions();
  const now = Date.now();
  let orphansCleaned = 0;

  // Find sessions registered in heartbeat map but no longer in session manager
  for (const [sessionId] of runtimeState.sessionHeartbeats) {
    const exists = sessions.some(
      (s) => (s.id || s.sessionId) === sessionId
    );
    if (!exists) {
      runtimeState.sessionHeartbeats.delete(sessionId);
      runtimeState.reconnectCounts.delete(sessionId);
      orphansCleaned += 1;
    }
  }

  if (orphansCleaned > 0) {
    console.log(`[RuntimeEngine] Cleaned ${orphansCleaned} orphan heartbeat entries`);
  }

  // Emit runtime status
  emitRuntimeStatus();
}

// ─── Metrics Worker ───
function metricsTick() {
  if (!runtimeState.storeRef) return;

  try {
    metricsTracker.recalcMetricsFromDB(runtimeState.storeRef, { force: true })
      .catch((err) => {
        console.error('[RuntimeEngine] Metrics recalc failed:', err?.message || err);
      });
  } catch (err) {
    console.error('[RuntimeEngine] Metrics tick error:', err?.message || err);
  }
}

// ─── Diagnostics Worker ───
function diagnosticsTick() {
  const sessions = sessionManager.listSessions();
  const now = Date.now();

  const connectedSessions = sessions.filter(
    (s) => s.connected || String(s.status || '').toLowerCase() === 'connected'
  );

  const staleEntries = [];
  for (const [sessionId, lastBeat] of runtimeState.sessionHeartbeats) {
    if ((now - lastBeat) > STALE_SESSION_THRESHOLD_MS) {
      staleEntries.push({ sessionId, staleSinceMs: now - lastBeat });
    }
  }

  const mem = process.memoryUsage();
  const diagnostics = {
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    memory: {
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
      rssMB: Math.round(mem.rss / 1024 / 1024),
      externalMB: Math.round((mem.external || 0) / 1024 / 1024),
    },
    sessions: {
      total: sessions.length,
      connected: connectedSessions.length,
      disconnected: sessions.length - connectedSessions.length,
      stale: staleEntries.length,
    },
    workers: {
      heartbeat: runtimeState.heartbeatTimer !== null ? 'running' : 'stopped',
      cleanup: runtimeState.cleanupTimer !== null ? 'running' : 'stopped',
      metrics: runtimeState.metricsTimer !== null ? 'running' : 'stopped',
      diagnostics: 'running',
    },
    queues: {
      dedupeServiceSize: messageDedupeService.stats().size,
      dedupeServiceMax: messageDedupeService.stats().maxEntries,
    },
    counters: {
      totalMessagesProcessed: runtimeState.totalMessagesProcessed,
      totalReconnects: runtimeState.totalReconnects,
    },
    staleSessions: staleEntries,
    database: runtimeState.storeRef?.databaseEnabled ? 'connected' : 'unavailable',
    redis: runtimeState.storeRef?.redisConnected ? 'connected' : 'unavailable',
  };

  runtimeState.lastDiagnostics = diagnostics;

  // Emit via WebSocket
  const io = runtimeState.storeRef?.io || global.io;
  if (io) {
    io.emit('runtime:diagnostics', diagnostics);
  }
}

// ─── Runtime Status Emitter ───
function emitRuntimeStatus() {
  const io = runtimeState.storeRef?.io || global.io;
  if (!io) return;

  emitRealtimeRuntimeStatus(io, sessionManager.listSessions(), {
    runtimeActive: sessionManager.isRuntimeActive?.() !== false,
    workersActive: runtimeState.started,
    uptimeSeconds: Math.floor(process.uptime()),
  });
}

// ─── Public API ───

function incrementMessageCounter(count = 1) {
  runtimeState.totalMessagesProcessed += count;
}

function incrementReconnectCounter(sessionId) {
  const current = runtimeState.reconnectCounts.get(sessionId) || 0;
  runtimeState.reconnectCounts.set(sessionId, current + 1);
  runtimeState.totalReconnects += 1;
}

function getReconnectCount(sessionId) {
  return runtimeState.reconnectCounts.get(sessionId) || 0;
}

function getDiagnostics() {
  if (!runtimeState.lastDiagnostics) {
    diagnosticsTick();
  }
  return runtimeState.lastDiagnostics;
}

function getRuntimeSummary() {
  const sessions = sessionManager.listSessions();
  const connected = sessions.filter(
    (s) => s.connected || String(s.status || '').toLowerCase() === 'connected'
  );

  return {
    started: runtimeState.started,
    startedAt: runtimeState.startedAt,
    uptimeSeconds: Math.floor(process.uptime()),
    sessions: {
      total: sessions.length,
      connected: connected.length,
    },
    workers: {
      heartbeat: runtimeState.heartbeatTimer !== null,
      cleanup: runtimeState.cleanupTimer !== null,
      metrics: runtimeState.metricsTimer !== null,
      diagnostics: runtimeState.diagnosticsTimer !== null,
    },
    counters: {
      totalMessagesProcessed: runtimeState.totalMessagesProcessed,
      totalReconnects: runtimeState.totalReconnects,
    },
  };
}

function startRuntimeEngine(store) {
  if (runtimeState.started) {
    console.log('[RuntimeEngine] Already started, skipping');
    return;
  }

  runtimeState.storeRef = store;
  runtimeState.startedAt = new Date().toISOString();

  // Start workers
  runtimeState.heartbeatTimer = setInterval(heartbeatTick, HEARTBEAT_INTERVAL_MS);
  runtimeState.cleanupTimer = setInterval(cleanupTick, CLEANUP_INTERVAL_MS);
  runtimeState.metricsTimer = setInterval(metricsTick, METRICS_EMIT_INTERVAL_MS);
  runtimeState.diagnosticsTimer = setInterval(diagnosticsTick, DIAGNOSTICS_INTERVAL_MS);

  runtimeState.started = true;

  // Initial tick
  heartbeatTick();
  diagnosticsTick();

  console.log(`[RuntimeEngine] Started — heartbeat=${HEARTBEAT_INTERVAL_MS}ms, cleanup=${CLEANUP_INTERVAL_MS}ms, metrics=${METRICS_EMIT_INTERVAL_MS}ms, diagnostics=${DIAGNOSTICS_INTERVAL_MS}ms`);
}

function stopRuntimeEngine() {
  if (runtimeState.heartbeatTimer) {
    clearInterval(runtimeState.heartbeatTimer);
    runtimeState.heartbeatTimer = null;
  }
  if (runtimeState.cleanupTimer) {
    clearInterval(runtimeState.cleanupTimer);
    runtimeState.cleanupTimer = null;
  }
  if (runtimeState.metricsTimer) {
    clearInterval(runtimeState.metricsTimer);
    runtimeState.metricsTimer = null;
  }
  if (runtimeState.diagnosticsTimer) {
    clearInterval(runtimeState.diagnosticsTimer);
    runtimeState.diagnosticsTimer = null;
  }

  runtimeState.started = false;
  runtimeState.sessionHeartbeats.clear();
  runtimeState.reconnectCounts.clear();

  console.log('[RuntimeEngine] Stopped');
}

module.exports = {
  getDiagnostics,
  getReconnectCount,
  getRuntimeSummary,
  getSessionHeartbeat,
  incrementMessageCounter,
  incrementReconnectCounter,
  recordSessionHeartbeat,
  startRuntimeEngine,
  stopRuntimeEngine,
};
