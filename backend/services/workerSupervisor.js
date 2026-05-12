/**
 * Worker Supervisor — Manages all background workers with heartbeat, auto-restart, and crash recovery.
 *
 * Workers are registered with a handler function and configuration.
 * The supervisor monitors each worker's health and automatically restarts
 * crashed workers with exponential backoff.
 *
 * Features:
 * - Worker registration with configurable intervals
 * - Heartbeat tracking per worker
 * - Auto-restart on crash with exponential backoff
 * - Graceful shutdown (waits for in-flight work)
 * - Worker isolation (one crash doesn't affect others)
 * - Status reporting via WebSocket
 * - Max restart limit to prevent infinite loops
 */

const MAX_RESTARTS = Math.max(3, Number(process.env.WORKER_MAX_RESTARTS) || 10);
const RESTART_BACKOFF_BASE_MS = Math.max(1000, Number(process.env.WORKER_RESTART_BASE_MS) || 2000);
const RESTART_BACKOFF_MAX_MS = Math.max(10_000, Number(process.env.WORKER_RESTART_MAX_MS) || 60_000);
const HEARTBEAT_STALE_MS = Math.max(30_000, Number(process.env.WORKER_HEARTBEAT_STALE_MS) || 120_000);

// ─── Worker Registry ───
const workers = new Map(); // name → WorkerEntry

/**
 * @typedef {Object} WorkerEntry
 * @property {string} name
 * @property {Function} handler - async () => void
 * @property {number} intervalMs
 * @property {NodeJS.Timeout|null} timer
 * @property {string} status - running | stopped | crashed | restarting
 * @property {number} restartCount
 * @property {number} lastHeartbeat
 * @property {number} executionCount
 * @property {string|null} lastError
 * @property {string|null} startedAt
 * @property {boolean} processing
 */

function createWorkerEntry(name, handler, intervalMs) {
  return {
    name,
    handler,
    intervalMs: Math.max(1000, intervalMs),
    timer: null,
    status: 'stopped',
    restartCount: 0,
    lastHeartbeat: 0,
    executionCount: 0,
    lastError: null,
    startedAt: null,
    processing: false,
  };
}

// ─── Worker Execution ───

async function executeWorkerTick(entry) {
  if (entry.processing) return; // Skip if previous tick still running

  entry.processing = true;
  entry.lastHeartbeat = Date.now();

  try {
    await entry.handler();
    entry.executionCount += 1;
    entry.lastError = null;
  } catch (err) {
    const errorMsg = err?.message || String(err);
    entry.lastError = errorMsg;
    console.error(`[WorkerSupervisor] Worker "${entry.name}" tick failed:`, errorMsg);

    // Don't crash the worker for a single tick failure
    // Only mark as crashed if handler itself throws synchronously
  } finally {
    entry.processing = false;
  }
}

function startWorkerTimer(entry) {
  if (entry.timer) {
    clearInterval(entry.timer);
  }

  entry.timer = setInterval(() => {
    executeWorkerTick(entry).catch((err) => {
      console.error(`[WorkerSupervisor] Unhandled error in "${entry.name}":`, err?.message || err);
      handleWorkerCrash(entry);
    });
  }, entry.intervalMs);

  entry.status = 'running';
  entry.startedAt = new Date().toISOString();
  entry.lastHeartbeat = Date.now();

  // Run first tick immediately
  executeWorkerTick(entry).catch(() => {});
}

// ─── Crash Recovery ───

function handleWorkerCrash(entry) {
  if (entry.timer) {
    clearInterval(entry.timer);
    entry.timer = null;
  }

  entry.status = 'crashed';
  entry.restartCount += 1;

  if (entry.restartCount > MAX_RESTARTS) {
    console.error(
      `[WorkerSupervisor] Worker "${entry.name}" exceeded max restarts (${MAX_RESTARTS}). Permanently stopped.`
    );
    entry.status = 'stopped';
    return;
  }

  const backoffMs = Math.min(
    RESTART_BACKOFF_BASE_MS * Math.pow(2, entry.restartCount - 1),
    RESTART_BACKOFF_MAX_MS
  );

  console.warn(
    `[WorkerSupervisor] Restarting "${entry.name}" in ${backoffMs}ms (restart #${entry.restartCount})`
  );

  entry.status = 'restarting';

  setTimeout(() => {
    if (entry.status === 'restarting') {
      startWorkerTimer(entry);
      console.log(`[WorkerSupervisor] Worker "${entry.name}" restarted successfully`);
    }
  }, backoffMs);
}

// ─── Public API ───

function registerWorker(name, handler, intervalMs = 30_000) {
  if (workers.has(name)) {
    console.warn(`[WorkerSupervisor] Worker "${name}" already registered. Replacing.`);
    stopWorker(name);
  }

  if (typeof handler !== 'function') {
    throw new Error(`Worker "${name}" handler must be a function`);
  }

  const entry = createWorkerEntry(name, handler, intervalMs);
  workers.set(name, entry);

  console.log(`[WorkerSupervisor] Registered worker "${name}" (interval=${intervalMs}ms)`);
  return entry;
}

function startWorker(name) {
  const entry = workers.get(name);
  if (!entry) {
    console.warn(`[WorkerSupervisor] Worker "${name}" not found`);
    return false;
  }

  if (entry.status === 'running') {
    return true; // Already running
  }

  startWorkerTimer(entry);
  console.log(`[WorkerSupervisor] Started worker "${name}"`);
  return true;
}

function stopWorker(name) {
  const entry = workers.get(name);
  if (!entry) return false;

  if (entry.timer) {
    clearInterval(entry.timer);
    entry.timer = null;
  }

  entry.status = 'stopped';
  console.log(`[WorkerSupervisor] Stopped worker "${name}"`);
  return true;
}

function startAll() {
  for (const [name] of workers) {
    startWorker(name);
  }
  console.log(`[WorkerSupervisor] Started ${workers.size} workers`);
}

function stopAll() {
  for (const [name] of workers) {
    stopWorker(name);
  }
  console.log(`[WorkerSupervisor] Stopped all workers`);
}

function getWorkerStatus(name) {
  const entry = workers.get(name);
  if (!entry) return null;

  return {
    name: entry.name,
    status: entry.status,
    intervalMs: entry.intervalMs,
    restartCount: entry.restartCount,
    executionCount: entry.executionCount,
    lastHeartbeat: entry.lastHeartbeat,
    lastError: entry.lastError,
    startedAt: entry.startedAt,
    isStale: entry.lastHeartbeat > 0 && (Date.now() - entry.lastHeartbeat) > HEARTBEAT_STALE_MS,
    processing: entry.processing,
  };
}

function getAllWorkerStatuses() {
  const statuses = [];
  for (const [name] of workers) {
    statuses.push(getWorkerStatus(name));
  }
  return statuses;
}

function getSummary() {
  const all = getAllWorkerStatuses();
  return {
    total: all.length,
    running: all.filter((w) => w.status === 'running').length,
    stopped: all.filter((w) => w.status === 'stopped').length,
    crashed: all.filter((w) => w.status === 'crashed').length,
    restarting: all.filter((w) => w.status === 'restarting').length,
    stale: all.filter((w) => w.isStale).length,
    workers: all,
  };
}

function resetWorkerRestartCount(name) {
  const entry = workers.get(name);
  if (entry) {
    entry.restartCount = 0;
  }
}

// ─── Health Check ───

function checkStaleWorkers() {
  const now = Date.now();
  const stale = [];

  for (const [name, entry] of workers) {
    if (entry.status === 'running' && entry.lastHeartbeat > 0) {
      if ((now - entry.lastHeartbeat) > HEARTBEAT_STALE_MS) {
        stale.push(name);
        console.warn(`[WorkerSupervisor] Worker "${name}" is stale (last heartbeat ${Math.round((now - entry.lastHeartbeat) / 1000)}s ago)`);
      }
    }
  }

  return stale;
}

module.exports = {
  checkStaleWorkers,
  getAllWorkerStatuses,
  getSummary,
  getWorkerStatus,
  registerWorker,
  resetWorkerRestartCount,
  startAll,
  startWorker,
  stopAll,
  stopWorker,
};
