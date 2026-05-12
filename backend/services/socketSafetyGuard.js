/**
 * Socket Safety Guard — Prevents memory leaks from socket/listener/timer accumulation.
 *
 * Monitors:
 * - Socket.IO listener count per event
 * - Global timer/interval accumulation
 * - EventEmitter listener warnings
 * - Orphan socket detection
 *
 * Provides:
 * - Safe listener registration (auto-cleanup)
 * - Timer registry with cleanup
 * - Periodic audit of listener counts
 * - Memory growth alerts
 */

const LISTENER_WARN_THRESHOLD = Math.max(10, Number(process.env.SOCKET_LISTENER_WARN) || 30);
const AUDIT_INTERVAL_MS = Math.max(30_000, Number(process.env.SOCKET_AUDIT_MS) || 60_000);
const HEAP_GROWTH_WARN_MB = Math.max(50, Number(process.env.SOCKET_HEAP_GROWTH_WARN_MB) || 100);

// ─── Timer Registry ───
const registeredTimers = new Map(); // id → { type, ref, owner, createdAt }
let timerIdCounter = 0;

function registerInterval(ref, owner = 'unknown') {
  const id = `timer_${++timerIdCounter}`;
  registeredTimers.set(id, { type: 'interval', ref, owner, createdAt: Date.now() });
  return id;
}

function registerTimeout(ref, owner = 'unknown') {
  const id = `timer_${++timerIdCounter}`;
  registeredTimers.set(id, { type: 'timeout', ref, owner, createdAt: Date.now() });
  return id;
}

function clearRegisteredTimer(id) {
  const entry = registeredTimers.get(id);
  if (!entry) return false;

  if (entry.type === 'interval') {
    clearInterval(entry.ref);
  } else {
    clearTimeout(entry.ref);
  }

  registeredTimers.delete(id);
  return true;
}

function clearAllTimers(owner = null) {
  let cleared = 0;
  for (const [id, entry] of registeredTimers) {
    if (owner && entry.owner !== owner) continue;

    if (entry.type === 'interval') {
      clearInterval(entry.ref);
    } else {
      clearTimeout(entry.ref);
    }

    registeredTimers.delete(id);
    cleared += 1;
  }
  return cleared;
}

// ─── Listener Audit ───

function auditSocketListeners(io) {
  if (!io) return { warnings: [], eventCounts: {} };

  const warnings = [];
  const eventCounts = {};

  // Check server-level listeners
  const serverEvents = io.eventNames?.() || [];
  for (const event of serverEvents) {
    const count = io.listenerCount?.(event) ?? 0;
    eventCounts[`server:${event}`] = count;
    if (count > LISTENER_WARN_THRESHOLD) {
      warnings.push({
        level: 'warning',
        target: 'server',
        event: String(event),
        count,
        threshold: LISTENER_WARN_THRESHOLD,
      });
    }
  }

  // Check connected socket listeners
  const sockets = io.sockets?.sockets;
  if (sockets instanceof Map) {
    for (const [socketId, socket] of sockets) {
      const socketEvents = socket.eventNames?.() || [];
      let totalListeners = 0;
      for (const event of socketEvents) {
        const count = socket.listenerCount?.(event) ?? 0;
        totalListeners += count;
      }

      if (totalListeners > LISTENER_WARN_THRESHOLD * 2) {
        warnings.push({
          level: 'warning',
          target: 'socket',
          socketId,
          totalListeners,
          threshold: LISTENER_WARN_THRESHOLD * 2,
        });
      }
    }
  }

  return { warnings, eventCounts };
}

function auditProcessListeners() {
  const warnings = [];
  const events = ['uncaughtException', 'unhandledRejection', 'SIGINT', 'SIGTERM', 'exit'];

  for (const event of events) {
    const count = process.listenerCount(event);
    if (count > 5) {
      warnings.push({
        level: 'warning',
        target: 'process',
        event,
        count,
        threshold: 5,
      });
    }
  }

  return warnings;
}

// ─── Memory Growth Detection ───

let lastHeapSnapshot = null;

function checkHeapGrowth() {
  const current = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

  if (lastHeapSnapshot === null) {
    lastHeapSnapshot = current;
    return { growthMB: 0, warning: false };
  }

  const growth = current - lastHeapSnapshot;
  lastHeapSnapshot = current;

  return {
    currentMB: current,
    previousMB: current - growth,
    growthMB: growth,
    warning: growth > HEAP_GROWTH_WARN_MB,
  };
}

// ─── Full Safety Audit ───

function runFullAudit(io) {
  const socketAudit = auditSocketListeners(io);
  const processAudit = auditProcessListeners();
  const heapCheck = checkHeapGrowth();

  const allWarnings = [
    ...socketAudit.warnings,
    ...processAudit,
    ...(heapCheck.warning ? [{
      level: 'warning',
      target: 'memory',
      growthMB: heapCheck.growthMB,
      currentMB: heapCheck.currentMB,
      threshold: HEAP_GROWTH_WARN_MB,
    }] : []),
  ];

  return {
    timestamp: new Date().toISOString(),
    timersRegistered: registeredTimers.size,
    socketListeners: socketAudit.eventCounts,
    heap: heapCheck,
    warnings: allWarnings,
    healthy: allWarnings.length === 0,
  };
}

// ─── Auto Audit Worker ───

let auditTimer = null;

function startAuditWorker(io) {
  if (auditTimer) return;

  auditTimer = setInterval(() => {
    const result = runFullAudit(io);
    if (!result.healthy) {
      console.warn('[SocketSafety] Audit warnings:', JSON.stringify(result.warnings));
    }
  }, AUDIT_INTERVAL_MS);

  console.log(`[SocketSafety] Audit worker started (interval=${AUDIT_INTERVAL_MS}ms)`);
}

function stopAuditWorker() {
  if (auditTimer) {
    clearInterval(auditTimer);
    auditTimer = null;
  }
}

// ─── Safe Socket Cleanup ───

function cleanupSocket(socket) {
  if (!socket) return;

  try {
    socket.removeAllListeners();
    socket.disconnect?.(true);
  } catch (err) {
    console.error('[SocketSafety] Socket cleanup failed:', err?.message || err);
  }
}

function getTimerStats() {
  const byOwner = {};
  for (const entry of registeredTimers.values()) {
    byOwner[entry.owner] = (byOwner[entry.owner] || 0) + 1;
  }

  return {
    total: registeredTimers.size,
    byOwner,
  };
}

module.exports = {
  auditProcessListeners,
  auditSocketListeners,
  checkHeapGrowth,
  cleanupSocket,
  clearAllTimers,
  clearRegisteredTimer,
  getTimerStats,
  registerInterval,
  registerTimeout,
  runFullAudit,
  startAuditWorker,
  stopAuditWorker,
};
