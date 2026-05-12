/**
 * Backpressure Controller — Rate limiting and throughput protection.
 *
 * Prevents system overload by:
 * - Rate limiting inbound/outbound message processing
 * - Queue depth monitoring with backpressure signals
 * - WebSocket throttling (max events per second)
 * - Memory pressure detection
 * - Per-session throughput limits
 *
 * This module is advisory — callers check shouldProcess() before doing work.
 * If backpressure is active, callers should delay or drop non-critical work.
 */

const INBOUND_RATE_LIMIT = Math.max(10, Number(process.env.BACKPRESSURE_INBOUND_RATE) || 100); // msg/s
const OUTBOUND_RATE_LIMIT = Math.max(5, Number(process.env.BACKPRESSURE_OUTBOUND_RATE) || 50); // msg/s
const WEBSOCKET_EVENT_RATE = Math.max(10, Number(process.env.BACKPRESSURE_WS_RATE) || 200); // events/s
const QUEUE_DEPTH_WARN = Math.max(100, Number(process.env.BACKPRESSURE_QUEUE_WARN) || 1000);
const QUEUE_DEPTH_CRITICAL = Math.max(500, Number(process.env.BACKPRESSURE_QUEUE_CRITICAL) || 5000);
const MEMORY_PRESSURE_MB = Math.max(256, Number(process.env.BACKPRESSURE_MEMORY_MB) || 768);
const WINDOW_MS = 1000; // 1 second sliding window

// ─── Sliding Window Counters ───
const counters = {
  inbound: { count: 0, windowStart: Date.now() },
  outbound: { count: 0, windowStart: Date.now() },
  websocket: { count: 0, windowStart: Date.now() },
};

function resetWindowIfNeeded(counter) {
  const now = Date.now();
  if (now - counter.windowStart >= WINDOW_MS) {
    counter.count = 0;
    counter.windowStart = now;
  }
}

function incrementCounter(name) {
  const counter = counters[name];
  if (!counter) return 0;
  resetWindowIfNeeded(counter);
  counter.count += 1;
  return counter.count;
}

function getRate(name) {
  const counter = counters[name];
  if (!counter) return 0;
  resetWindowIfNeeded(counter);
  return counter.count;
}

// ─── Backpressure Checks ───

function isMemoryPressure() {
  const heapMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
  return heapMB > MEMORY_PRESSURE_MB;
}

function shouldProcessInbound() {
  if (isMemoryPressure()) return false;
  const current = incrementCounter('inbound');
  return current <= INBOUND_RATE_LIMIT;
}

function shouldProcessOutbound() {
  if (isMemoryPressure()) return false;
  const current = incrementCounter('outbound');
  return current <= OUTBOUND_RATE_LIMIT;
}

function shouldEmitWebSocket() {
  const current = incrementCounter('websocket');
  return current <= WEBSOCKET_EVENT_RATE;
}

function getQueuePressure(queueDepth = 0) {
  if (queueDepth >= QUEUE_DEPTH_CRITICAL) return 'critical';
  if (queueDepth >= QUEUE_DEPTH_WARN) return 'warning';
  return 'normal';
}

// ─── Per-Session Rate Limiting ───
const sessionRates = new Map(); // sessionId → { count, windowStart }
const SESSION_RATE_LIMIT = Math.max(5, Number(process.env.BACKPRESSURE_SESSION_RATE) || 30); // msg/s per session

function shouldProcessForSession(sessionId) {
  if (!sessionId) return true;

  let entry = sessionRates.get(sessionId);
  if (!entry) {
    entry = { count: 0, windowStart: Date.now() };
    sessionRates.set(sessionId, entry);
  }

  const now = Date.now();
  if (now - entry.windowStart >= WINDOW_MS) {
    entry.count = 0;
    entry.windowStart = now;
  }

  entry.count += 1;
  return entry.count <= SESSION_RATE_LIMIT;
}

// ─── Session rate cleanup (prevent memory leak) ───
function cleanupSessionRates() {
  const now = Date.now();
  const staleMs = 60_000;
  for (const [sessionId, entry] of sessionRates) {
    if (now - entry.windowStart > staleMs) {
      sessionRates.delete(sessionId);
    }
  }
}

// ─── Status ───

function getStatus() {
  const mem = process.memoryUsage();
  return {
    rates: {
      inbound: { current: getRate('inbound'), limit: INBOUND_RATE_LIMIT },
      outbound: { current: getRate('outbound'), limit: OUTBOUND_RATE_LIMIT },
      websocket: { current: getRate('websocket'), limit: WEBSOCKET_EVENT_RATE },
    },
    memory: {
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      pressureThresholdMB: MEMORY_PRESSURE_MB,
      underPressure: isMemoryPressure(),
    },
    queueLimits: {
      warn: QUEUE_DEPTH_WARN,
      critical: QUEUE_DEPTH_CRITICAL,
    },
    sessionRateLimit: SESSION_RATE_LIMIT,
    activeSessions: sessionRates.size,
  };
}

module.exports = {
  cleanupSessionRates,
  getQueuePressure,
  getRate,
  getStatus,
  isMemoryPressure,
  shouldEmitWebSocket,
  shouldProcessForSession,
  shouldProcessInbound,
  shouldProcessOutbound,
};
