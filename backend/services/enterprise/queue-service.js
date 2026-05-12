const bullmqEnabled = String(process.env.QUEUE_MODE || '').trim().toLowerCase() === 'bullmq';

const DEFAULT_ATTEMPTS = Math.max(1, Number(process.env.QUEUE_DEFAULT_ATTEMPTS || 5));
const DEFAULT_BACKOFF_MS = Math.max(250, Number(process.env.QUEUE_DEFAULT_BACKOFF_MS || 500));
const queueHandlers = new Map();
const inMemoryQueues = new Map();
let bullmqRuntime = null;
let initialized = false;

function logQueue(level, event, details = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    scope: 'queue_service',
    event,
    ...details,
  };

  const serialized = JSON.stringify(payload);

  if (level === 'error') {
    console.error(serialized);
    return;
  }

  if (level === 'warn') {
    console.warn(serialized);
    return;
  }

  console.log(serialized);
}

const QUEUE_NAMES = {
  aiJobs: 'ai_jobs',
  inboundMessages: 'inbound_messages',
  mediaJobs: 'media_jobs',
  outboundMessages: 'outbound_messages',
};

function calculateBackoffMs(attemptNumber = 1, baseDelayMs = DEFAULT_BACKOFF_MS) {
  const power = Math.max(0, Number(attemptNumber || 1) - 1);
  return Math.min(30_000, baseDelayMs * Math.pow(2, power));
}

async function tryInitializeBullMQ() {
  if (!bullmqEnabled) {
    return null;
  }

  let Queue = null;
  let Worker = null;
  let ioredisModule = null;

  try {
    ({ Queue, Worker } = require('bullmq'));
    ioredisModule = require('ioredis');
  } catch (error) {
    logQueue('warn', 'bullmq_dependency_missing', {
      error: error?.message || String(error),
    });
    return null;
  }

  const redisUrl = String(process.env.REDIS_URL || '').trim();

  if (!redisUrl) {
    logQueue('warn', 'redis_url_missing', {
      mode: 'inline',
    });
    return null;
  }

  try {
    const connection = new ioredisModule(redisUrl, {
      maxRetriesPerRequest: null,
    });

    connection.on('error', (error) => {
      logQueue('warn', 'redis_error', {
        error: error?.message || String(error),
      });
    });

    const queues = new Map();
    const workers = new Map();

    for (const queueName of Object.values(QUEUE_NAMES)) {
      queues.set(queueName, new Queue(queueName, { connection }));
    }

    for (const [queueName, handler] of queueHandlers.entries()) {
      workers.set(
        queueName,
        new Worker(
          queueName,
          async (job) => handler(job.data || {}, {
            attempt: Number(job.attemptsMade || 0) + 1,
            queueName,
          }),
          { connection }
        )
      );
    }

    return {
      connection,
      queues,
      workers,
    };
  } catch (error) {
    logQueue('warn', 'bullmq_init_failed', {
      error: error?.message || String(error),
      mode: 'inline',
    });
    return null;
  }
}

async function initialize() {
  if (initialized) {
    return;
  }

  initialized = true;
  bullmqRuntime = await tryInitializeBullMQ();
  logQueue('info', 'initialized', {
    mode: bullmqRuntime ? 'bullmq' : 'inline',
  });

  for (const queueName of Object.values(QUEUE_NAMES)) {
    if (!inMemoryQueues.has(queueName)) {
      inMemoryQueues.set(queueName, []);
    }
  }
}

function registerWorker(queueName, handler) {
  queueHandlers.set(queueName, handler);
  logQueue('info', 'worker_registered', {
    queueName,
  });
}

async function executeInlineJob({ queueName, payload, attempts, backoffMs }) {
  const handler = queueHandlers.get(queueName);

  if (typeof handler !== 'function') {
    return null;
  }

  const totalAttempts = Math.max(1, Number(attempts || DEFAULT_ATTEMPTS));

  let lastError = null;

  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    try {
      logQueue('info', 'inline_job_start', {
        attempt,
        queueName,
      });
      return await handler(payload, {
        attempt,
        queueName,
      });
    } catch (error) {
      lastError = error;
      const delay = calculateBackoffMs(attempt, backoffMs);
      logQueue(attempt < totalAttempts ? 'warn' : 'error', 'inline_job_retry', {
        attempt,
        delay,
        error: error?.message || String(error),
        queueName,
      });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

async function enqueue(queueName, payload = {}, options = {}) {
  if (!initialized) {
    await initialize();
  }

  const attempts = Math.max(1, Number(options.attempts || DEFAULT_ATTEMPTS));
  const backoffMs = Math.max(250, Number(options.backoffMs || DEFAULT_BACKOFF_MS));

  if (bullmqRuntime?.queues?.has(queueName)) {
    const queue = bullmqRuntime.queues.get(queueName);

    await queue.add(queueName, payload, {
      attempts,
      backoff: {
        delay: backoffMs,
        type: 'exponential',
      },
      removeOnComplete: 100,
      removeOnFail: 500,
    });

    return {
      enqueued: true,
      mode: 'bullmq',
      queueName,
    };
  }

  if (!inMemoryQueues.has(queueName)) {
    inMemoryQueues.set(queueName, []);
  }

  const queue = inMemoryQueues.get(queueName);
  queue.push(payload);
  logQueue('info', 'inline_enqueued', {
    queueName,
    size: queue.length,
  });

  const result = await executeInlineJob({
    attempts,
    backoffMs,
    payload,
    queueName,
  });

  queue.shift();

  return {
    enqueued: true,
    mode: 'inline',
    queueName,
    result,
  };
}

async function shutdown() {
  if (bullmqRuntime) {
    for (const worker of bullmqRuntime.workers.values()) {
      await worker.close();
    }

    for (const queue of bullmqRuntime.queues.values()) {
      await queue.close();
    }

    await bullmqRuntime.connection.quit();
  }

  bullmqRuntime = null;
  initialized = false;
  logQueue('info', 'shutdown', {});
}

function getStats() {
  const stats = {};
  for (const [name, queue] of inMemoryQueues) {
    const items = Array.isArray(queue) ? queue : [];
    stats[name] = {
      pending: items.filter((i) => i?.status === 'pending' || !i?.status).length,
      processing: items.filter((i) => i?.status === 'processing').length,
      failed: items.filter((i) => i?.status === 'failed').length,
      total: items.length,
      hasHandler: queueHandlers.has(name),
    };
  }

  return {
    mode: bullmqEnabled ? 'bullmq' : 'in-memory',
    initialized,
    queues: stats,
    registeredHandlers: Array.from(queueHandlers.keys()),
  };
}

module.exports = {
  QUEUE_NAMES,
  enqueue,
  getStats,
  initialize,
  registerWorker,
  shutdown,
};
