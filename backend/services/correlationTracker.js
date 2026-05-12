/**
 * Correlation Tracker — Request/message tracing with correlation IDs.
 *
 * Provides:
 * - Unique correlation ID generation
 * - Request context propagation
 * - Message tracing across pipeline stages
 * - Tenant-scoped tracing
 * - WebSocket event correlation
 * - Structured logging with trace context
 *
 * Each trace entry records:
 *   - correlationId (unique per request/message flow)
 *   - tenantId
 *   - stage (pipeline stage name)
 *   - timestamp
 *   - metadata
 */

const crypto = require('crypto');

const MAX_TRACE_ENTRIES = Math.max(1000, Number(process.env.TRACE_MAX_ENTRIES) || 10_000);
const TRACE_TTL_MS = Math.max(60_000, Number(process.env.TRACE_TTL_MS) || 5 * 60_000); // 5 minutes

// ─── Storage ───
const traces = new Map(); // correlationId → TraceEntry[]
const traceTimestamps = new Map(); // correlationId → createdAt (for TTL)

/**
 * @typedef {Object} TraceEvent
 * @property {string} stage
 * @property {string} timestamp
 * @property {number} elapsed - ms since trace start
 * @property {Object} metadata
 */

// ─── ID Generation ───

function generateCorrelationId(prefix = 'req') {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `${prefix}_${timestamp}_${random}`;
}

function generateMessageTraceId() {
  return generateCorrelationId('msg');
}

function generateSessionTraceId() {
  return generateCorrelationId('sess');
}

// ─── Trace Operations ───

function startTrace(correlationId, metadata = {}) {
  if (!correlationId) {
    correlationId = generateCorrelationId();
  }

  evictExpiredTraces();

  traces.set(correlationId, []);
  traceTimestamps.set(correlationId, Date.now());

  addTraceEvent(correlationId, 'start', metadata);
  return correlationId;
}

function addTraceEvent(correlationId, stage, metadata = {}) {
  if (!correlationId) return null;

  let events = traces.get(correlationId);
  if (!events) {
    events = [];
    traces.set(correlationId, events);
    traceTimestamps.set(correlationId, Date.now());
  }

  const createdAt = traceTimestamps.get(correlationId) || Date.now();

  const event = {
    stage: String(stage || 'unknown'),
    timestamp: new Date().toISOString(),
    elapsed: Date.now() - createdAt,
    metadata: typeof metadata === 'object' ? metadata : { value: metadata },
  };

  events.push(event);
  return event;
}

function endTrace(correlationId, metadata = {}) {
  addTraceEvent(correlationId, 'end', metadata);
  return getTrace(correlationId);
}

function getTrace(correlationId) {
  if (!correlationId) return null;
  const events = traces.get(correlationId);
  if (!events) return null;

  return {
    correlationId,
    startedAt: new Date(traceTimestamps.get(correlationId) || 0).toISOString(),
    events: [...events],
    totalElapsed: events.length > 0 ? events[events.length - 1].elapsed : 0,
  };
}

// ─── TTL Eviction ───

function evictExpiredTraces() {
  if (traces.size <= MAX_TRACE_ENTRIES) return;

  const now = Date.now();
  const toRemove = [];

  for (const [id, createdAt] of traceTimestamps) {
    if (now - createdAt > TRACE_TTL_MS) {
      toRemove.push(id);
    }
  }

  // If TTL eviction isn't enough, remove oldest
  if (toRemove.length === 0 && traces.size > MAX_TRACE_ENTRIES) {
    const targetSize = Math.floor(MAX_TRACE_ENTRIES * 0.9);
    const removeCount = traces.size - targetSize;
    let removed = 0;
    for (const id of traces.keys()) {
      if (removed >= removeCount) break;
      toRemove.push(id);
      removed += 1;
    }
  }

  for (const id of toRemove) {
    traces.delete(id);
    traceTimestamps.delete(id);
  }
}

// ─── Express Middleware ───

function correlationMiddleware() {
  return (req, _res, next) => {
    const incoming = req.headers['x-correlation-id'] || req.headers['x-request-id'];
    const correlationId = incoming || generateCorrelationId();

    req.correlationId = correlationId;
    req.tenantId = req.headers['x-tenant-id'] || req.headers['x-company-id'] || null;

    // Start trace for this request
    startTrace(correlationId, {
      method: req.method,
      path: req.path,
      tenantId: req.tenantId,
      ip: req.ip,
    });

    next();
  };
}

// ─── Structured Log Helper ───

function traceLog(correlationId, stage, message, metadata = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    correlationId: correlationId || 'unknown',
    stage,
    message,
    ...metadata,
  };

  addTraceEvent(correlationId, stage, { message, ...metadata });

  // Structured JSON log
  console.log(JSON.stringify(logEntry));
}

// ─── Stats ───

function getStats() {
  return {
    activeTraces: traces.size,
    maxEntries: MAX_TRACE_ENTRIES,
    ttlMs: TRACE_TTL_MS,
  };
}

module.exports = {
  addTraceEvent,
  correlationMiddleware,
  endTrace,
  generateCorrelationId,
  generateMessageTraceId,
  generateSessionTraceId,
  getStats,
  getTrace,
  startTrace,
  traceLog,
};
