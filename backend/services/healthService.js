function formatUptime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

function createHealthService({
  app,
  io,
  eventLoopDelay,
  sessionManager,
  systemManager,
  nodeRole,
  isMaster,
  features,
}) {
  function buildHealthPayload() {
    const liveSessions = sessionManager.listSessions();
    const session =
      liveSessions.find((item) => String(item?.status || '').toLowerCase() === 'connected') ||
      liveSessions[0] ||
      null;
    const databaseOnline = Boolean(app.locals.store.databaseEnabled);
    const databaseError = app.locals.store.databaseError || null;
    const whatsappConnected = String(session?.status || '').toLowerCase() === 'connected';
    const uptimeSec = process.uptime();
    const mem = process.memoryUsage();
    const overallStatus = databaseOnline && whatsappConnected ? 'online' : (databaseOnline ? 'degraded' : 'offline');

    return {
      status: overallStatus,
      backend: true,
      db: databaseOnline,
      server: 'online',
      database: {
        status: databaseOnline ? 'online' : 'offline',
        error: databaseError,
      },
      api: 'online',
      whatsapp: {
        status: whatsappConnected ? 'online' : 'offline',
        sessionStatus: session?.status || 'unknown',
      },
      uptime: formatUptime(uptimeSec),
      uptimeSeconds: Math.floor(uptimeSec),
      memory: {
        rss: Math.round(mem.rss / 1024 / 1024),
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
        unit: 'MB',
      },
      timestamp: new Date().toISOString(),
      service: 'whatsapp-crm-api',
      mode: nodeRole,
      isMaster,
      features,
      runtimeActive: sessionManager.isRuntimeActive(),
      system: systemManager.getSystemStatus(app.locals.store),
    };
  }

  function buildFullHealthPayload() {
    const base = buildHealthPayload();
    const mem = process.memoryUsage();
    const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
    const heapLimitMb = Math.max(1, Number(process.env.HEALTH_MEMORY_LIMIT_MB || 700));
    const eventLoopDelayMs = Math.round(eventLoopDelay.mean / 1e6) || 0;
    const eventLoopDelayLimitMs = Math.max(50, Number(process.env.HEALTH_EVENT_LOOP_DELAY_MS || 250));
    const dbOk = Boolean(base.db);
    const whatsappOk = base.whatsapp?.status === 'online';
    const memoryOk = heapUsedMb < heapLimitMb;
    const eventLoopOk = eventLoopDelayMs < eventLoopDelayLimitMs;
    const status = dbOk && memoryOk && eventLoopOk ? (whatsappOk ? 'ok' : 'degraded') : 'down';

    return {
      success: status !== 'down',
      status,
      services: {
        db: dbOk ? 'ok' : 'down',
        redis: process.env.REDIS_URL ? 'ok' : 'disabled',
        whatsapp: whatsappOk ? 'ok' : 'degraded',
        memory: memoryOk ? 'ok' : 'degraded',
        eventLoop: eventLoopOk ? 'ok' : 'degraded',
      },
      diagnostics: {
        dbError: base.database?.error || null,
        heapUsedMb,
        heapLimitMb,
        eventLoopDelayMs,
        eventLoopDelayLimitMs,
        pid: process.pid,
        uptimeSeconds: base.uptimeSeconds,
        socketConnections: io.engine.clientsCount,
      },
      timestamp: new Date().toISOString(),
    };
  }

  return { buildFullHealthPayload, buildHealthPayload };
}

module.exports = { createHealthService, formatUptime };