/**
 * Diagnostics Engine — Real-time observability for all system components.
 *
 * Probes:
 * - WebSocket (Socket.IO) health
 * - Redis health
 * - PostgreSQL health
 * - Baileys session health
 * - Orphan sessions (registered but no socket)
 * - Stale sockets (heartbeat expired)
 * - Reconnect loops (excessive reconnects)
 * - Memory usage (heap, RSS)
 * - Event listener count (leak detection)
 * - Queue health (outbound queue depth, DLQ size)
 *
 * Each probe returns a standard { status, details } object.
 * Combined results are emitted via WebSocket every cycle.
 */

const db = require('../config/database');
const sessionManager = require('./sessionManager');
const sessionRegistry = require('./sessionRegistry');
const messageDedupeService = require('./messageDedupeService');

const RECONNECT_LOOP_THRESHOLD = Number(process.env.DIAG_RECONNECT_LOOP_THRESHOLD) || 10;
const MEMORY_HEAP_WARNING_MB = Number(process.env.DIAG_MEMORY_WARN_MB) || 512;
const LISTENER_WARNING_THRESHOLD = Number(process.env.DIAG_LISTENER_WARN_COUNT) || 50;

// ─── Probes ───

async function probePostgres() {
  try {
    const start = Date.now();
    const result = await db.query('SELECT 1 AS ok');
    const latencyMs = Date.now() - start;
    const ok = result?.rows?.[0]?.ok === 1;
    return {
      status: ok ? 'healthy' : 'degraded',
      details: { latencyMs, connected: ok },
    };
  } catch (err) {
    return {
      status: 'unhealthy',
      details: { error: err?.message || String(err), connected: false },
    };
  }
}

function probeRedis(storeRef) {
  const redisConnected = Boolean(storeRef?.redisConnected);
  return {
    status: redisConnected ? 'healthy' : 'unavailable',
    details: { connected: redisConnected },
  };
}

function probeWebSocket(storeRef) {
  const io = storeRef?.io || global.io;
  if (!io) {
    return { status: 'unavailable', details: { reason: 'no_io_instance' } };
  }

  const engine = io.engine || {};
  const clientCount = io.engine?.clientsCount ?? io.sockets?.sockets?.size ?? 0;

  return {
    status: 'healthy',
    details: {
      clientCount,
      transport: engine.transports || ['unknown'],
    },
  };
}

function probeBaileys() {
  const sessions = sessionManager.listSessions();
  const connected = sessions.filter(
    (s) => s.connected || String(s.status || '').toLowerCase() === 'connected'
  );
  const disconnected = sessions.filter(
    (s) => !s.connected && String(s.status || '').toLowerCase() !== 'connected'
  );

  return {
    status: connected.length > 0 ? 'healthy' : sessions.length > 0 ? 'degraded' : 'idle',
    details: {
      total: sessions.length,
      connected: connected.length,
      disconnected: disconnected.length,
      sessions: sessions.map((s) => ({
        id: s.id || s.sessionId,
        status: s.status || 'unknown',
        phone: s.phone || null,
      })),
    },
  };
}

function probeOrphanSessions() {
  const registryEntries = sessionRegistry.list();
  const managerSessions = sessionManager.listSessions();
  const managerIds = new Set(managerSessions.map((s) => s.id || s.sessionId));

  const orphans = registryEntries.filter(
    (entry) => entry.connected && !managerIds.has(entry.sessionId)
  );

  return {
    status: orphans.length === 0 ? 'healthy' : 'warning',
    details: {
      orphanCount: orphans.length,
      orphanIds: orphans.map((o) => o.sessionId),
    },
  };
}

function probeStaleSessions() {
  const entries = sessionRegistry.list();
  const now = Date.now();
  const staleThresholdMs = 90_000;

  const stale = entries.filter(
    (entry) => entry.connected && (now - entry.lastHeartbeatAt) > staleThresholdMs
  );

  return {
    status: stale.length === 0 ? 'healthy' : 'warning',
    details: {
      staleCount: stale.length,
      staleIds: stale.map((s) => ({
        sessionId: s.sessionId,
        staleSinceMs: now - s.lastHeartbeatAt,
      })),
    },
  };
}

function probeReconnectLoops() {
  const entries = sessionRegistry.list();
  const loops = entries.filter((e) => (e.reconnectCount || 0) >= RECONNECT_LOOP_THRESHOLD);

  return {
    status: loops.length === 0 ? 'healthy' : 'warning',
    details: {
      loopCount: loops.length,
      sessions: loops.map((s) => ({
        sessionId: s.sessionId,
        reconnectCount: s.reconnectCount,
      })),
    },
  };
}

function probeMemory() {
  const mem = process.memoryUsage();
  const heapMB = Math.round(mem.heapUsed / 1024 / 1024);
  const rssMB = Math.round(mem.rss / 1024 / 1024);
  const isWarning = heapMB > MEMORY_HEAP_WARNING_MB;

  return {
    status: isWarning ? 'warning' : 'healthy',
    details: {
      heapUsedMB: heapMB,
      heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
      rssMB,
      externalMB: Math.round((mem.external || 0) / 1024 / 1024),
      warningThresholdMB: MEMORY_HEAP_WARNING_MB,
    },
  };
}

function probeListenerLeaks(storeRef) {
  const io = storeRef?.io || global.io;
  const warnings = [];

  if (io) {
    const listenerCount = io.listenerCount?.('connection') ?? 0;
    if (listenerCount > LISTENER_WARNING_THRESHOLD) {
      warnings.push({
        target: 'io:connection',
        count: listenerCount,
        threshold: LISTENER_WARNING_THRESHOLD,
      });
    }
  }

  // Check process-level event listeners
  const processListeners = process.listenerCount?.('uncaughtException') ?? 0;
  if (processListeners > 5) {
    warnings.push({
      target: 'process:uncaughtException',
      count: processListeners,
      threshold: 5,
    });
  }

  return {
    status: warnings.length === 0 ? 'healthy' : 'warning',
    details: { warnings },
  };
}

function probeQueues() {
  const dedupeStats = messageDedupeService.stats();

  return {
    status: 'healthy',
    details: {
      dedupeSize: dedupeStats.size,
      dedupeMax: dedupeStats.maxEntries,
      dedupeUtilization: dedupeStats.maxEntries > 0
        ? Number(((dedupeStats.size / dedupeStats.maxEntries) * 100).toFixed(1))
        : 0,
    },
  };
}

// ─── Full Diagnostic Run ───

async function runFullDiagnostics(storeRef) {
  const [postgres] = await Promise.allSettled([probePostgres()]);

  const results = {
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    postgres: postgres.status === 'fulfilled' ? postgres.value : { status: 'error', details: {} },
    redis: probeRedis(storeRef),
    websocket: probeWebSocket(storeRef),
    baileys: probeBaileys(),
    orphanSessions: probeOrphanSessions(),
    staleSessions: probeStaleSessions(),
    reconnectLoops: probeReconnectLoops(),
    memory: probeMemory(),
    listenerLeaks: probeListenerLeaks(storeRef),
    queues: probeQueues(),
  };

  // Calculate overall health
  const probeValues = Object.values(results).filter(
    (v) => v && typeof v === 'object' && 'status' in v
  );
  const unhealthy = probeValues.filter((p) => p.status === 'unhealthy').length;
  const warnings = probeValues.filter((p) => p.status === 'warning').length;

  results.overall = unhealthy > 0 ? 'unhealthy' : warnings > 0 ? 'degraded' : 'healthy';

  return results;
}

// ─── Emit Diagnostics via WebSocket ───

async function emitDiagnostics(storeRef) {
  const diagnostics = await runFullDiagnostics(storeRef);
  const io = storeRef?.io || global.io;

  if (io) {
    io.emit('runtime:diagnostics', diagnostics);
    io.emit('diagnostics_update', diagnostics);
  }

  return diagnostics;
}

module.exports = {
  emitDiagnostics,
  probeBaileys,
  probeListenerLeaks,
  probeMemory,
  probeOrphanSessions,
  probePostgres,
  probeQueues,
  probeReconnectLoops,
  probeRedis,
  probeStaleSessions,
  probeWebSocket,
  runFullDiagnostics,
};
