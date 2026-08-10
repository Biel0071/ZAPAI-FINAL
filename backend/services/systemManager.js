const { isAIEnabled } = require('../src/infrastructure/config/aiToggle');
const aiLearningEngine = require('./aiLearningEngine');
const { startCampaignRuntime } = require('./campaignRuntime');
const metricsTracker = require('./metricsTracker');
const sessionManager = require('./sessionManager');
const sessionRecoveryService = require('./sessionRecoveryService');

function getConnectedSessionsCount() {
  return sessionManager
    .listSessions()
    .filter((session) => session?.status === 'connected').length;
}

function getSocketStatus(store) {
  return store?.io || global.io ? 'connected' : 'disconnected';
}

function getDatabaseStatus(store) {
  return store?.databaseEnabled ? 'connected' : 'disconnected';
}

function getAiEngineStatus(store) {
  try {
    return isAIEnabled(store?.activeCompanyId || process.env.DEFAULT_COMPANY_ID || 'default') ? 'healthy' : 'disabled';
  } catch (_error) {
    return 'error';
  }
}

const systemState = {
  activationPromise: null,
  active: false,
  lastError: null,
  startedAt: null,
  status: 'inactive',
};

function emitSystemStatus(store) {
  const payload = buildSystemStatus(store);
  const io = store?.io || global.io;

  if (io) {
    io.emit('system_status_changed', payload);
  }

  if (store) {
    store.system = payload;
  }
}

function buildSystemStatus(store) {
  const sessions = sessionManager.listSessions();
  const connectedSessions = getConnectedSessionsCount();
  const metrics = metricsTracker.getMetrics(store);

  return {
    aiEngine: getAiEngineStatus(store),
    campaignQueue: store?.campaignJob ? 'running' : 'stopped',
    database: getDatabaseStatus(store),
    metrics,
    microtaskRunner: 'running',
    sessions: {
      connected: connectedSessions,
      total: sessions.length,
    },
    socket: getSocketStatus(store),
    whatsapp: {
      connected: connectedSessions > 0,
    },
  };
}

async function getStatus(store) {
  return buildSystemStatus(store);
}

function getSystemStatus(store) {
  return buildSystemStatus(store);
}

function startBackgroundServices(store) {
  if (process.env.ENABLE_AI_LEARNING !== 'false') {
    if (!store.learningJob) {
      store.learningJob = aiLearningEngine.startDailyAnalysis(store);
    }

    // Warm up AI learning dashboard cache asynchronously at startup
    aiLearningEngine.analyzeAndStore(store).catch((err) => {
      console.error('[STARTUP] Initial AI Learning analysis failed:', err.message);
    });
  } else {
    console.log('[STARTUP] AI Learning Engine is disabled by ENABLE_AI_LEARNING flag.');
  }

  if (!store.campaignJob) {
    store.campaignJob = startCampaignRuntime(store);
  }

  if (process.env.ENABLE_METRICS_TRACKER !== 'false') {
    if (!store.metricsJob) {
      store.metricsJob = metricsTracker.startMetricsTracking(store);
    }
  } else {
    console.log('[STARTUP] Metrics Tracker is disabled by ENABLE_METRICS_TRACKER flag.');
  }
}

function stopBackgroundServices(store) {
  store?.learningJob?.stop?.();
  store?.campaignJob?.stop?.();
  store?.metricsJob?.stop?.();

  if (store) {
    store.learningJob = null;
    store.campaignJob = null;
    store.metricsJob = null;
  }
}

async function startSystem(store) {
  if (systemState.active) {
    return {
      restoredSessions: sessionManager.listSessions(),
      ...(await getStatus(store)),
    };
  }

  if (systemState.activationPromise) {
    return systemState.activationPromise;
  }

  systemState.status = 'starting';
  systemState.lastError = null;
  emitSystemStatus(store);

  systemState.activationPromise = (async () => {
    try {
      sessionManager.setRuntimeActive(true);
      const restoredSessions = await sessionManager.restoreSessions();
      // Auto-reconnect valid sessions via session recovery service
      await sessionRecoveryService.recoverSessions().catch(err =>
        console.error('[STARTUP] sessionRecoveryService error:', err.message)
      );
      // Reconcile: clean ghost sessions, stuck-connecting, orphan registry entries
      await sessionManager.reconcileSessions().catch(err =>
        console.error('[STARTUP] reconcileSessions error:', err.message)
      );
      startBackgroundServices(store);

      systemState.active = true;
      systemState.startedAt = new Date().toISOString();
      systemState.status = 'active';
      systemState.lastError = null;
      emitSystemStatus(store);

      return {
        restoredSessions,
        ...(await getStatus(store)),
      };
    } catch (error) {
      stopBackgroundServices(store);
      sessionManager.setRuntimeActive(false);
      systemState.active = false;
      systemState.status = 'inactive';
      systemState.lastError = error.message || String(error);
      emitSystemStatus(store);
      throw error;
    } finally {
      systemState.activationPromise = null;
    }
  })();

  return systemState.activationPromise;
}

async function shutdownSystem(store) {
  stopBackgroundServices(store);
  sessionManager.setRuntimeActive(false);
  await sessionManager.stopAllSessions();
  systemState.active = false;
  systemState.startedAt = null;
  systemState.status = 'inactive';
  emitSystemStatus(store);
}

module.exports = {
  getStatus,
  getSystemStatus,
  shutdownSystem,
  startSystem,
};
