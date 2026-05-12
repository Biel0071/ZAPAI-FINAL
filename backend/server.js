const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('./autoBootstrap')();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const http = require('http');
const { monitorEventLoopDelay } = require('perf_hooks');
const fsSync = require('fs');
const fs = require('fs/promises');
const { Server } = require('socket.io');
const { requestContextMiddleware } = require('./middleware/requestContext');
const { createRequestLogger } = require('./middleware/requestLogger');
const { createRateLimiter } = require('./middleware/rateLimiter');
const { apiEnvelopeMiddleware, normalizeErrorMessage } = require('./middleware/apiEnvelope');
const { createJwtAuthMiddleware } = require('./middleware/jwtAuth');
const { inputSanitizerMiddleware } = require('./middleware/inputSanitizer');

const { businessHours, isBusinessOpen } = require('./config/businessHours');
const { initDatabase } = require('./config/database');
const {
  loadAiIntelligenceState,
  saveAiIntelligenceState,
} = require('./config/aiIntelligenceStorage');
const { ensurePromptHistory } = require('./config/promptManager');
const { loadRuntimeEnv, logRuntimeWarnings } = require('./config/runtimeEnv');
const { loadStoreState, saveStoreState } = require('./config/storage');
const { initializeBugWatcher } = require('./services/bugWatcher');
const { registerRoutes } = require('./routes');
const { tenantContextMiddleware } = require('./services/tenantContext');
const {
  emitToTenantWithAliases,
  joinTenantRoom,
} = require('./services/realtime/tenantRooms');
const messagesController = require('./controllers/messagesController');
const messageStore = require('./store/messageStore');
const conversationRepository = require('./repositories/conversationRepository');
const messageRepository = require('./repositories/messageRepository');
const sessionManager = require('./services/sessionManager');
const systemManager = require('./services/systemManager');
const whatsappService = require('./services/whatsappService');
const outboundQueueService = require('./services/outboundQueueService');
const enterpriseQueueService = require('./services/enterprise/queue-service');
const aiIntelligenceService = require('./services/aiIntelligenceService');
const { processAI } = require('./services/ai.service');
const { backendLog, errorLog } = require('./services/logger');
const { DEFAULT_SESSION } = whatsappService;
const nodeRegisterService = require('./services/nodeRegister');

const eventLoopDelay = monitorEventLoopDelay({ resolution: 20 });
eventLoopDelay.enable();

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

function buildHealthPayload() {
  const session = sessionManager.getSession(DEFAULT_SESSION);
  const databaseOnline = Boolean(app.locals.store.databaseEnabled);
  const databaseError = app.locals.store.databaseError || null;
  const whatsappConnected = String(session?.status || '').toLowerCase() === 'connected';
  const uptimeSec = process.uptime();
  const mem = process.memoryUsage();
  
  // Standardized status: online, offline, degraded
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
    mode: NODE_ROLE,
    isMaster: IS_MASTER,
    features: {
      adminMasterRoutes: ENABLE_ADMIN_MASTER_ROUTES,
      nodeRegistrationServer: ENABLE_NODE_REGISTRATION_SERVER,
      nodeAutoRegisterClient: ENABLE_NODE_AUTO_REGISTER_CLIENT,
    },
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

console.log('Server starting...');
backendLog('info', 'boot:start', { pid: process.pid });

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: validateOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  },
  pingInterval: Math.max(5_000, Number(process.env.SOCKET_PING_INTERVAL_MS || 25_000)),
  pingTimeout: Math.max(5_000, Number(process.env.SOCKET_PING_TIMEOUT_MS || 20_000)),
});
app.set('io', io);

// Socket.io JWT authentication middleware
const { verifyHs256Jwt } = require('./middleware/jwtAuth');
io.use((socket, next) => {
  const token = String(socket.handshake.auth?.token || '').trim();
  const secret = process.env.JWT_SECRET || process.env.AUTH_JWT_SECRET || '';

  if (!secret) {
    return next(new Error('Authentication is not configured.'));
  }

  if (!token) {
    return next(new Error('Authentication token is required.'));
  }

  const verification = verifyHs256Jwt(token, secret);
  if (verification.error || !verification.payload) {
    return next(new Error(verification.error || 'Invalid token.'));
  }

  socket.data.user = verification.payload;
  socket.data.tenantId = verification.payload.tenantId || verification.payload.companyId || 'default';
  socket.data.username = verification.payload.username || verification.payload.sub || 'unknown';
  socket.data.role = verification.payload.role || 'admin';
  next();
});

// Initialize tenant-indexed WhatsApp session state. For backwards compatibility,
// this service also keeps `global.whatsappSession` in sync with the default tenant.
const sessionStateService = require('./services/sessionStateService');
sessionStateService.getWhatsappSession(sessionStateService.DEFAULT_TENANT);

const runtimeEnv = loadRuntimeEnv();
const PORT = process.env.PORT || runtimeEnv.port || 4025;
const NODE_ENV = runtimeEnv.nodeEnv;
const IS_PRODUCTION = runtimeEnv.isProduction;
const IS_DEVELOPMENT = NODE_ENV === 'development';
const RUN_MIGRATIONS_ON_BOOT = runtimeEnv.runMigrationsOnBoot;
const NODE_ROLE = runtimeEnv.nodeRole;
const IS_MASTER = runtimeEnv.isMaster;
const ENABLE_ADMIN_MASTER_ROUTES = runtimeEnv.enableAdminMasterRoutes;
const ENABLE_NODE_REGISTRATION_SERVER = runtimeEnv.enableNodeRegistrationServer;
const ENABLE_NODE_AUTO_REGISTER_CLIENT = runtimeEnv.enableNodeAutoRegisterClient;
const FRONTEND_URL = runtimeEnv.frontendUrl;
const ENV_ALLOWED_ORIGINS = runtimeEnv.allowedOriginsFromEnv || process.env.ALLOWED_ORIGINS?.split(',') || [];
const BASE_ALLOWED_ORIGINS = [
  'https://swift-wa-assist.lovable.app',
  'https://*.lovable.app',
  'http://localhost:8080',
  'http://localhost:5173',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:5173',
  'http://209.50.229.68',
  'http://209.50.229.68:4025',
  'http://209.50.229.68:80',
  'https://209.50.229.68',
  ...(FRONTEND_URL ? [FRONTEND_URL] : []),
  ...ENV_ALLOWED_ORIGINS,
];
let PUBLIC_API_URL = `http://localhost:${PORT}`;
let heartbeatTimer = null;

console.log(`[SERVER] Bootstrapping on port ${PORT}`);

logRuntimeWarnings(runtimeEnv);

function getAllowedOrigins() {
  return [...BASE_ALLOWED_ORIGINS];
}

function isOriginAllowed(origin) {
  // Allow requests with no origin (same-origin, mobile apps, curl, etc.)
  if (!origin) {
    return true;
  }

  // In development, allow all origins
  if (!IS_PRODUCTION) {
    return true;
  }

  // In production, check against allowed origins
  const allowedOrigins = new Set(getAllowedOrigins());
  const isAllowed = allowedOrigins.has(origin);
  const wildcardAllowed = Array.from(allowedOrigins).some((allowedOrigin) => {
    if (!allowedOrigin.includes('*.')) {
      return false;
    }

    try {
      const parsedOrigin = new URL(origin);
      const parsedAllowed = new URL(allowedOrigin.replace('*.', 'wildcard.'));
      const suffix = parsedAllowed.hostname.replace(/^wildcard\./, '.');
      return parsedOrigin.protocol === parsedAllowed.protocol && parsedOrigin.hostname.endsWith(suffix);
    } catch {
      return false;
    }
  });

  if (!isAllowed && !wildcardAllowed) {
    console.warn(`[CORS] Origin blocked: ${origin}. Allowed origins:`, Array.from(allowedOrigins));
  }

  return isAllowed || wildcardAllowed;
}

function validateOrigin(origin, callback) {
  return callback(null, isOriginAllowed(origin));
}

function corsBlockMiddleware(req, res, next) {
  if (!isOriginAllowed(req.headers?.origin)) {
    return res.status(403).json({
      error: 'CORS origin is not allowed.',
    });
  }

  return next();
}

function devOnlyRoute(req, res, next) {
  if (NODE_ENV === 'development') {
    return next();
  }

  return res.status(404).json({
    error: 'Route not found.',
  });
}

function buildTransientMessage(payload, sessionId) {
  return {
    from: 'client',
    id: `transient-${Date.now()}`,
    mediaPath: payload.mediaPath || null,
    mediaType: payload.mediaType || null,
    phone: payload.phone,
    sessionId,
    text: payload.text || '',
    timestamp: new Date().toISOString(),
    type: payload.mediaType || 'text',
  };
}

function shouldSendAbsenceReply(store, conversationKey) {
  if (!store?.absenceState || !conversationKey) {
    return true;
  }
  const state = store.absenceState[conversationKey];

  if (!state) {
    return true;
  }

  return state.sent !== true && state.pending !== true;
}

function markAbsenceReplyState(store, conversationKey, nextState = {}) {
  if (!store || !conversationKey) {
    return;
  }

  if (!store.absenceState || typeof store.absenceState !== 'object') {
    store.absenceState = {};
  }

  store.absenceState[conversationKey] = {
    pending: Boolean(nextState.pending),
    sent: Boolean(nextState.sent),
    sentAt: nextState.sentAt || null,
    updatedAt: new Date().toISOString(),
  };
}

async function waitMs(delay = 0) {
  if (!delay || delay <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, delay));
}

function mapLeadTemperature(score = 0) {
  if (score >= 0.75) {
    return 'hot';
  }

  if (score >= 0.4) {
    return 'warm';
  }

  return 'cold';
}

function toSafeSessionStatus(session) {
  if (!session || typeof session !== 'object') {
    return null;
  }

  return {
    lastError: session.lastError || null,
    name: session.displayName || session.sessionName || session.sessionId || null,
    phone: session.phone || null,
    retryCount: Number(session.retryCount || 0),
    sessionId: session.sessionId || null,
    sessionName: session.sessionName || session.displayName || session.sessionId || null,
    status: session.status || 'unknown',
    systemConnected:
      typeof session.systemConnected === 'boolean' ? session.systemConnected : null,
  };
}

function safeJson(payload) {
  const seen = new WeakSet();

  return JSON.stringify(payload, (_key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }

      seen.add(value);
    }

    return value;
  });
}

function sendSafeJson(res, payload, status = 200) {
  return res.status(status).type('application/json').send(safeJson(payload));
}

function buildSessionStatusPayload() {
  const session = sessionManager.getSession(DEFAULT_SESSION);
  const sessionStatus = String(session?.status || '').toLowerCase();
  // Phase 2c: tenant-indexed state service replaces legacy global.whatsappSession.
  const tenantState = sessionStateService.getWhatsappSession();
  const normalizedStatus = (() => {
    if (sessionStatus === 'connected') {
      return 'CONNECTED';
    }

    if (sessionStatus === 'qr_ready' || sessionStatus === 'qr') {
      return 'QR';
    }

    if (sessionStatus === 'connecting' || sessionStatus === 'creating') {
      return 'CONNECTING';
    }

    return tenantState?.status || 'DISCONNECTED';
  })();

  return {
    connected: sessionStatus === 'connected' || Boolean(tenantState?.connected),
    phone: session?.phone || null,
    sessionId: session?.sessionId || DEFAULT_SESSION,
    status: normalizedStatus,
    timestamp: Date.now(),
  };
}

const DEFAULT_PAYLOAD_LIMIT = process.env.DEFAULT_PAYLOAD_LIMIT || '1mb';
const MEDIA_PAYLOAD_LIMIT = process.env.MEDIA_PAYLOAD_LIMIT || '25mb';
const mediaPayloadPaths = ['/send-media', '/api/send-media', '/receive-message', '/api/receive-message'];

app.use(mediaPayloadPaths, express.json({ limit: MEDIA_PAYLOAD_LIMIT }));
app.use(mediaPayloadPaths, express.urlencoded({ extended: true, limit: MEDIA_PAYLOAD_LIMIT }));
app.use(express.json({ limit: DEFAULT_PAYLOAD_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: DEFAULT_PAYLOAD_LIMIT }));

// CORS: validated via isOriginAllowed (allow-list in production, permissive in dev).
// The `cors` package handles preflight (OPTIONS) responses automatically.
const corsOptions = {
  origin: validateOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-tenant-id',
    'x-company-id',
    'x-session-id',
    'x-request-id',
  ],
};

app.use(helmet({
  contentSecurityPolicy: false, // Disabled for Socket.IO and API flexibility
  crossOriginEmbedderPolicy: false, // Allow loading from different origins
}));
app.use(compression());

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ------------------------------------------------------------------
// Request timeout guard.
// Default: 30 s. Long-running paths (media uploads / server-sent
// events / websocket upgrade) are exempted. Configurable via
// REQUEST_TIMEOUT_MS; set to 0 to disable entirely.
// ------------------------------------------------------------------
const REQUEST_TIMEOUT_MS = Math.max(0, Number(process.env.REQUEST_TIMEOUT_MS || 30_000));
const TIMEOUT_EXEMPT_PREFIXES = [
  '/send-media',
  '/api/send-media',
  '/upload',
  '/uploads',
  '/media',
  '/socket.io',
];

app.use((req, res, next) => {
  if (!REQUEST_TIMEOUT_MS) {
    return next();
  }
  const currentPath = String(req.path || '');
  if (TIMEOUT_EXEMPT_PREFIXES.some((prefix) => currentPath.startsWith(prefix))) {
    return next();
  }
  req.setTimeout(REQUEST_TIMEOUT_MS, () => {
    if (res.headersSent) {
      return;
    }
    try {
      res.status(504).json({
        error: 'Request timeout',
        timeoutMs: REQUEST_TIMEOUT_MS,
      });
    } catch {
      // best-effort; if response is already streaming just destroy it
      try {
        req.destroy();
      } catch {
        /* noop */
      }
    }
  });
  return next();
});

app.use(createRequestLogger());

app.use(inputSanitizerMiddleware);
app.use(requestContextMiddleware);
app.use(tenantContextMiddleware);
app.use(apiEnvelopeMiddleware);
app.use('/media', express.static(path.join(__dirname, 'media')));
app.use('/upload', express.static(path.join(__dirname, 'upload')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/diagnostics', devOnlyRoute);
app.use('/receive-message', devOnlyRoute);
app.use('/api/receive-message', devOnlyRoute);
app.use('/system/runtime/debug', devOnlyRoute);
app.use('/system/ai-diagnostics', devOnlyRoute);

const requireJwtAuth = createJwtAuthMiddleware({
  // Exact-match public endpoints (healthcheck, login, liveness probes).
  publicPaths: [
    '/health',
    '/api',
    '/api/health',
    '/api/test',
    '/diagnostics',
    '/api/diagnostics',
    '/auth/login',
    '/status-whatsapp',
    '/session-status',
    '/api/session-status',
  ],
  // Prefix-match (covers mounted sub-routes like /auth/refresh).
  // NOTE: /api/ and /system/ are public because the frontend has no login UI
  // yet. When a login page is added, remove these and send Bearer tokens.
  publicPrefixes: ['/auth/', '/api/', '/system/'],
  protectedPrefixes: ['/api/admin/', '/admin/'],
});

// Auth enforcement is now centralized in createJwtAuthMiddleware.
// Dev bypass requires explicit ALLOW_DEV_AUTH_BYPASS=true (NODE_ENV != production).
const authMiddleware = requireJwtAuth;

app.locals.store = {
  aiIntelligence: null,
  conversations: [],
  databaseEnabled: false,
  databaseError: null,
  io: app.get("io"),
  messages: [],
  metricsJob: null,
  metricsSnapshot: null,
  publicUrl: PUBLIC_API_URL,
  saveState: async () => Promise.resolve(),
  saveAiState: async () =>
    saveStoreState({
      aiLearningLogs: app.locals.store.aiLearningLogs,
      promptHistory: app.locals.store.promptHistory,
    }),
  saveAiIntelligenceState: async () =>
    aiIntelligenceService.ensureState(app.locals.store) &&
    saveAiIntelligenceState(app.locals.store.aiIntelligence),
  aiLearningLogs: [],
  campaignJob: null,
  campaignSnapshot: null,
  learningJob: null,
  promptHistory: [],
  system: {
    active: false,
    inboxEnabled: false,
    listenersActive: false,
    startedAt: null,
    status: 'inactive',
  },
  sessionManager,
  absenceState: {},
  sock: null,
};

io.on('connection', (socket) => {
  const tenantId = joinTenantRoom(socket);
  console.log(`[SERVER] WebSocket client connected (tenant=${tenantId}, id=${socket.id})`);

  socket.on('typing:start', (payload = {}) => {
    const target = payload?.tenantId || payload?.companyId || socket.data?.tenantId || tenantId;
    emitToTenantWithAliases(io, target, 'typing:start', payload, ['typing_start']);
  });

  socket.on('typing:stop', (payload = {}) => {
    const target = payload?.tenantId || payload?.companyId || socket.data?.tenantId || tenantId;
    emitToTenantWithAliases(io, target, 'typing:stop', payload, ['typing_stop']);
  });

  socket.on('disconnect', (reason) => {
    console.log(`[SERVER] WebSocket client disconnected (tenant=${tenantId}, id=${socket.id}, reason=${reason})`);
  });
});

const writeHeavyRateLimiter = createRateLimiter({
  max: 120,
  windowMs: 60_000,
});

// Tight bucket around /auth/* endpoints to slow down brute-force login attempts.
// Overridable via AUTH_RATE_LIMIT_MAX / AUTH_RATE_LIMIT_WINDOW_MS.
const authRateLimiter = createRateLimiter({
  max: Math.max(1, Number(process.env.AUTH_RATE_LIMIT_MAX || 20)),
  windowMs: Math.max(1_000, Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 60_000)),
});

registerRoutes(app, {
  requireJwtAuth: authMiddleware,
  writeHeavyRateLimiter,
  authRateLimiter,
  enableAdminMasterRoutes: ENABLE_ADMIN_MASTER_ROUTES,
  enableNodeRegistrationServer: ENABLE_NODE_REGISTRATION_SERVER,
});

app.get('/api', (_req, res) => {
  return res.status(200).json({
    service: 'whatsapp-crm-api',
    status: 'ok',
  });
});

app.get('/api/health', (_req, res) => {
  return res.status(200).json({ ...buildHealthPayload(), success: true, status: 'ok' });
});

// Metrics endpoint
app.get('/api/metrics', (_req, res) => {
  try {
    const startTime = process.uptime();
    
    const uptimeHours = Math.floor(startTime / 3600);
    const uptimeMinutes = Math.floor((startTime % 3600) / 60);
    const uptimeSeconds = Math.floor(startTime % 60);
    
    const memoryUsage = process.memoryUsage();
    const memoryUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const memoryTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    
    res.json({
      uptime: {
        seconds: Math.floor(startTime),
        formatted: `${uptimeHours}h ${uptimeMinutes}m ${uptimeSeconds}s`,
      },
      memory: {
        used: memoryUsedMB,
        total: memoryTotalMB,
        percentage: Math.round((memoryUsedMB / memoryTotalMB) * 100),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Metrics] Error:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

app.get('/api/session-status', (_req, res) => {
  return res.status(200).json(buildSessionStatusPayload());
});

app.get('/session-status', (_req, res) => {
  return res.status(200).json(buildSessionStatusPayload());
});

app.get('/api/diagnostics', (_req, res) => {
  const defaultSession = sessionManager.getSession(DEFAULT_SESSION);

  return sendSafeJson(res, {
    success: true,
    data: {
      aiEngineStatus: false,
      databaseStatus: app.locals.store.databaseEnabled,
      runtimeActive: sessionManager.isRuntimeActive(),
      socketConnections: io.engine.clientsCount,
      systemStatus: app.locals.store.system?.status || 'unknown',
      whatsappStatus: toSafeSessionStatus(defaultSession),
    },
  });
});

app.get('/health', (_req, res) => {
  try {
    const payload = buildHealthPayload();
    return res.status(200).json({
      ...payload,
      success: true,
      status: 'ok',
      service: 'zapai-backend',
      uptime: payload.uptimeSeconds
    });
  } catch (err) {
    // Health must ALWAYS return 200 for Docker healthcheck — even during startup
    return res.status(200).json({
      status: 'ok',
      success: true,
      service: 'zapai-backend',
      booting: true,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  }
});

app.get('/ready', (_req, res) => {
  const payload = buildHealthPayload();
  const isReady = payload.status === 'online' || payload.status === 'degraded';
  return res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ok' : 'down',
    message: isReady ? 'Service is ready' : 'Service is not ready',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/ready', (_req, res) => {
  const payload = buildHealthPayload();
  const isReady = payload.status === 'online' || payload.status === 'degraded';
  return res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ok' : 'down',
    message: isReady ? 'Service is ready' : 'Service is not ready',
    timestamp: new Date().toISOString()
  });
});

app.get('/health/full', (_req, res) => {
  const payload = buildFullHealthPayload();
  return res.status(payload.status === 'down' ? 503 : 200).json(payload);
});

app.get('/api/health/full', (_req, res) => {
  const payload = buildFullHealthPayload();
  return res.status(payload.status === 'down' ? 503 : 200).json(payload);
});

app.get('/api/system/full-status', (_req, res) => {
  const payload = buildFullHealthPayload();
  const session = sessionManager.getSession(whatsappService.DEFAULT_SESSION);
  const queueSize = app.locals.store?.messages?.length || 0;
  
  return res.status(200).json({
    status: payload.status,
    uptime: payload.diagnostics.uptimeSeconds,
    memory: {
      usedMb: payload.diagnostics.heapUsedMb,
      limitMb: payload.diagnostics.heapLimitMb
    },
    cpu: {
      eventLoopDelayMs: payload.diagnostics.eventLoopDelayMs
    },
    services: {
      postgres: payload.services.db,
      redis: payload.services.redis || 'ok',
      websocket: {
        status: 'ok',
        connections: payload.diagnostics.socketConnections
      }
    },
    whatsapp: {
      status: payload.services.whatsapp,
      sessionStatus: session?.status || 'unknown'
    },
    queue: {
      pendingMessages: queueSize
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/diagnostics', (_req, res) => {
  const defaultSession = sessionManager.getSession(DEFAULT_SESSION);

  return sendSafeJson(res, {
    success: true,
    data: {
      aiEngineStatus: false,
      databaseStatus: app.locals.store.databaseEnabled,
      runtimeActive: sessionManager.isRuntimeActive(),
      socketConnections: io.engine.clientsCount,
      systemStatus: app.locals.store.system?.status || 'unknown',
      whatsappStatus: toSafeSessionStatus(defaultSession),
    },
  });
});

app.get('/api/test', (_req, res) => {
  return res.status(200).json({
    message: 'API funcionando',
    success: true,
  });
});

// Public WhatsApp healthcheck endpoint. Returns the current Baileys session
// status, phone, QR state and reconnect counters. Intentionally left out of
// the JWT auth wall (see publicPaths above) so external monitors / the
// frontend boot screen can probe liveness before authenticating.
function normalizeWhatsappStatus(rawStatus) {
  const value = String(rawStatus || 'disconnected').toLowerCase();
  if (value === 'connected') return 'connected';
  if (value === 'qr_ready' || value === 'qr') return 'qr';
  if (value === 'connecting' || value === 'creating') return 'connecting';
  return 'disconnected';
}

function buildSessionStatusEntry(session) {
  const raw = String(session?.status || 'disconnected').toLowerCase();
  const normalizedStatus = normalizeWhatsappStatus(raw);
  return {
    sessionId: session?.sessionId || null,
    sessionName: session?.sessionName || session?.displayName || session?.sessionId || null,
    connected: raw === 'connected',
    status: normalizedStatus,
    phone: session?.phone || null,
    qrReady: normalizedStatus === 'qr',
    qrGeneratedAt: session?.qrGeneratedAt || null,
    lastError: session?.lastError || null,
    reconnectAttempts: Number(session?.reconnectRequestCount || 0),
  };
}

app.get('/status-whatsapp', (_req, res) => {
  // Default session (backwards-compatible top-level fields)
  const session = sessionManager.getSession(DEFAULT_SESSION);
  const primary = buildSessionStatusEntry(session || { sessionId: DEFAULT_SESSION });

  // Enumerate every live session in the manager so multi-session
  // deployments can be observed via a single probe.
  const liveSessionsMeta = sessionManager.listSessions();
  const sessions = liveSessionsMeta.map((meta) => {
    const liveSession = sessionManager.getSession(meta.sessionId) || meta;
    return buildSessionStatusEntry(liveSession);
  });

  return res.status(200).json({
    ...primary,
    sessionId: primary.sessionId || DEFAULT_SESSION,
    sessionName: primary.sessionName || DEFAULT_SESSION,
    sessions,
    runtimeActive: sessionManager.isRuntimeActive(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use((req, res) => {
  res.status(404).type('application/json').json({
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.use((err, req, res, _next) => {
  // Map common body-parser / express failures to proper 4xx before falling
  // back to 500. Keeps 5xx reserved for actual server-side issues.
  let statusCode = Number(err?.status || err?.statusCode) || 0;

  if (!statusCode) {
    if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
      statusCode = 400;
    } else if (err?.type === 'entity.too.large') {
      statusCode = 413;
    } else {
      statusCode = 500;
    }
  }

  const normalizedStatus = statusCode >= 400 && statusCode <= 599 ? statusCode : 500;
  const isServerError = normalizedStatus >= 500;

  if (isServerError) {
    // eslint-disable-next-line no-console
    console.error('GLOBAL ERROR:', err);
    try {
      errorLog(err, {
        scope: 'global_error_handler',
        statusCode: normalizedStatus,
        method: req?.method,
        path: req?.originalUrl,
        requestId: req?.requestId || null,
      });
    } catch {
      // logger should never block the response
    }
  } else {
    // eslint-disable-next-line no-console
    console.warn(
      `[CLIENT_ERROR] ${normalizedStatus} ${req?.method || ''} ${req?.originalUrl || ''} :`,
      err?.message || err
    );
  }

  if (res.headersSent) {
    return;
  }

  return res.status(normalizedStatus).json({
    error: normalizeErrorMessage(err),
  });
});

async function legacyIncomingMessageFlow({ incomingMessage, sessionId, sock }) {
  if (incomingMessage?.key?.fromMe) {
    return null;
  }

  const remoteJid = incomingMessage?.key?.remoteJid || '';

  if (remoteJid.endsWith('@g.us')) {
    return;
  }

  const payload = await messagesController.extractIncomingMessage(incomingMessage);

  if (!payload || !payload.phone || (!payload.text && !payload.mediaType)) {
    return;
  }

  if (!app.locals.store.databaseEnabled) {
    const normalizedPhone = (payload.phone || '').replace(/@s\.whatsapp\.net$/i, '').trim();
    const memEntry = messageStore.addMessage(normalizedPhone, {
      content: payload.text || '',
      createdAt: new Date().toISOString(),
      fromMe: false,
      mediaPath: payload.mediaPath || null,
      mediaType: payload.mediaType || null,
      name: payload.name || normalizedPhone,
      sessionId,
      conversationId: `chat-${normalizedPhone}`,
      status: 'received',
    });

    io?.emit('message:new', {
      conversationId: memEntry?.conversationId || `chat-${normalizedPhone}`,
      message: memEntry,
    });
    io?.emit('new_message', {
      chatId: `${normalizedPhone}@s.whatsapp.net`,
      message: {
        content: payload.text || '',
        conversationId: memEntry?.conversationId || `chat-${normalizedPhone}`,
        createdAt: memEntry?.createdAt || new Date().toISOString(),
        fromMe: false,
        id: memEntry?.id,
        timestamp: memEntry?.createdAt || new Date().toISOString(),
        type: memEntry?.mediaType || 'text',
        url: null,
      },
    });

    void aiIntelligenceService
      .captureMessageEvent(app.locals.store, {
        conversationId: memEntry?.conversationId || `chat-${normalizedPhone}`,
        direction: 'incoming',
        mediaType: payload.mediaType || null,
        messageId: memEntry?.id,
        name: payload.name || normalizedPhone,
        phone: normalizedPhone,
        source: 'whatsapp-fallback',
        text: payload.text || '',
        timestamp: memEntry?.createdAt || new Date().toISOString(),
      })
      .catch((error) => {
        console.error('[AI INTELLIGENCE] Failed to capture fallback inbound message:', error.message || error);
      });

    console.log(`[INBOX] inbound message stored in memory: ${normalizedPhone}`);
    return {
      conversation: { id: memEntry?.conversationId || `chat-${normalizedPhone}`, phone: normalizedPhone },
      message: memEntry || buildTransientMessage(payload, sessionId),
    };
  }

  const messagePayload = {
    ...payload,
    sessionId,
  };

  const incoming = {
    message:
      incomingMessage?.message?.conversation ||
      incomingMessage?.message?.extendedTextMessage?.text ||
      '',
    phone: remoteJid.replace('@s.whatsapp.net', ''),
    text: payload.text,
  };

  let result = null;

  try {
    result = await messagesController.registerIncomingMessage(
      app.locals.store,
      messagePayload
    );

    if (result?.message) {
      console.log(`MESSAGE SAVED: ${incoming.phone}`);
    } else if (result?.conversation?.id) {
      const messageData = {
        phone: incoming.phone,
        content: incoming.text || incoming.message,
        fromMe: false,
        createdAt: new Date(),
        conversationId: result.conversation.id,
      };

      try {
        result = {
          ...result,
          message: await messageRepository.create(messageData),
        };
        console.log(`MESSAGE SAVED: ${incoming.phone}`);
      } catch (err) {
        console.error('MESSAGE SAVE ERROR:', err);
      }
    }

    if (result?.message) {
      const io = app.get('io');

      io?.emit('message:new', {
        phone: incoming.phone,
        conversationId: result.message.conversationId,
        message: result.message,
      });

      console.log('[INBOX] realtime event emitted');
    }
  } catch (error) {
    console.error('[CRM] Failed to persist incoming message:', error.message || error);

    return {
      conversation: null,
      message: buildTransientMessage(payload, sessionId),
    };
  }

  if (!isBusinessOpen()) {
    const conversationKey = String(result?.conversation?.id || payload.phone || '');
    const shouldReply = shouldSendAbsenceReply(app.locals.store, conversationKey);

    if (shouldReply) {
      markAbsenceReplyState(app.locals.store, conversationKey, { pending: true, sent: false });
      await waitMs(10_000);
      await whatsappService.sendMessage(sock, payload.phone, businessHours.absenceMessage);
      await messagesController.registerOutgoingMessage(app.locals.store, {
        companyId: payload.companyId,
        name: result.agent?.name || payload.name,
        phone: payload.phone,
        sessionId,
        source: 'system',
        systemTag: 'absence',
        text: businessHours.absenceMessage,
      });
      markAbsenceReplyState(app.locals.store, conversationKey, {
        pending: false,
        sent: true,
        sentAt: new Date().toISOString(),
      });
    }

    return result;
  }

  const conversation = result?.conversation || null;
  const incomingText = payload?.text || '';
  const conversationId = conversation?.id || null;
  const aiEnabled = Boolean(conversation?.aiEnabled);

  if (!aiEnabled || !incomingText || !conversationId) {
    return result;
  }

  const history = await messageRepository
    .getMessagesByConversation(conversationId)
    .then((messages) =>
      messages.slice(-20).map((message) => ({
        content: message.content || message.text || '',
        role: message.fromMe ? 'assistant' : 'user',
        timestamp: message.createdAt || message.timestamp || new Date().toISOString(),
      }))
    )
    .catch(() => []);

  const ai = await processAI({
    contact: {
      name: conversation?.name || payload?.name || payload.phone,
      phone: payload.phone,
    },
    history,
    message: incomingText,
  });

  if (!ai) {
    return result;
  }

  await conversationRepository.updateConversationState(conversationId, {
    lead_confidence: ai.leadScore,
    lead_intent: ai.intent,
    lead_temperature: mapLeadTemperature(ai.leadScore),
    next_action: ai.suggestion || conversation?.next_action || 'educate',
  });

  if (ai.reply) {
    await whatsappService.sendMessage(sock, payload.phone, ai.reply);
    await messagesController.registerOutgoingMessage(app.locals.store, {
      companyId: payload.companyId,
      name: conversation?.name || payload?.name,
      phone: payload.phone,
      sessionId,
      source: 'ai',
      text: ai.reply,
    });
  }

  return result;
}

async function handleIncomingMessage({ incomingMessage, sessionId, sock }) {
  return legacyIncomingMessageFlow({ incomingMessage, sessionId, sock });
}

function handleSessionConnected(session) {
  if (session.sessionId === DEFAULT_SESSION) {
    app.locals.store.sock = session.sock;
  }

  console.log(`[WHATSAPP] session ${session.sessionId} connected`);
}

async function bootstrap() {
  const uploadDir = path.join(__dirname, 'upload');
  const uploadsDir = path.join(__dirname, 'uploads');

  if (!fsSync.existsSync(uploadDir)) {
    fsSync.mkdirSync(uploadDir, { recursive: true });
  }

  if (!fsSync.existsSync(uploadsDir)) {
    fsSync.mkdirSync(uploadsDir, { recursive: true });
  }

  await fs.mkdir(uploadDir, { recursive: true });
  await fs.mkdir(path.join(__dirname, 'uploads'), { recursive: true });
  const persistedState = await loadStoreState();
  const persistedAiIntelligence = await loadAiIntelligenceState();

  try {
    const dbInitResult = await initDatabase({
      runMigrations: RUN_MIGRATIONS_ON_BOOT,
    });
    app.locals.store.databaseEnabled = true;
    app.locals.store.databaseError = null;
    console.log('[DB] PostgreSQL connected');

    if (dbInitResult?.mode === 'migration-runner') {
      console.log(`[DB] Migrations executed on boot: ${dbInitResult.executed?.length || 0}`);
    } else {
      console.log('[DB] Boot migration runner is disabled. Use scripts/run-migrations.js for explicit execution.');
    }

    app.locals.store.conversations = await conversationRepository.listConversations(
      process.env.DEFAULT_COMPANY_ID || 'default',
      50,
      { useCache: false }
    );
    const recentMessages = await messageRepository.listRecentMessages(
      2000,
      process.env.DEFAULT_COMPANY_ID || 'default'
    );
    app.locals.store.messages = Array.isArray(recentMessages) ? recentMessages.slice(-500) : [];
  } catch (error) {
    app.locals.store.databaseEnabled = false;
    app.locals.store.databaseError = error?.message || String(error);
    app.locals.store.conversations = [];
    app.locals.store.messages = [];
    console.warn('[DB] PostgreSQL unavailable. Running in degraded mode:', error?.code || error?.message || error);
  }

  app.locals.store.aiLearningLogs = persistedState.aiLearningLogs || [];
  app.locals.store.promptHistory = persistedState.promptHistory || [];
  app.locals.store.aiIntelligence = persistedAiIntelligence;
  ensurePromptHistory(app.locals.store);
  await app.locals.store.saveAiState();
  await app.locals.store.saveAiIntelligenceState();

  sessionManager.configureSessionManager({
    io,
    onIncomingMessage: handleIncomingMessage,
    onSessionConnected: handleSessionConnected,
  });

  sessionManager.setRuntimeActive(false);
  app.locals.store.learningJob = null;
  await outboundQueueService.initializeOutboundQueue({ store: app.locals.store });
  await enterpriseQueueService.initialize();

  server.listen(PORT, '0.0.0.0', async () => {
    console.log(`[SERVER] Started on port ${PORT}`);
    console.log(`[SERVER] Host: 0.0.0.0`);
    console.log(`[SERVER] Environment: ${NODE_ENV}`);
    console.log(`[SERVER] API running`);
    
    // Register node in master admin
    await nodeRegisterService.registerNode();

    if (!heartbeatTimer) {
      heartbeatTimer = setInterval(() => {
        console.log('Server alive:', new Date().toISOString());
      }, 60_000);

      heartbeatTimer.unref?.();
    }

    PUBLIC_API_URL =
      String(process.env.MASTER_API_URL || process.env.PUBLIC_API_URL || '').trim() ||
      `http://localhost:${PORT}`;
    app.locals.store.publicUrl = PUBLIC_API_URL;

    console.log('[SERVER] Public API URL:');
    console.log(PUBLIC_API_URL);

    try {
      const bootStatus = await systemManager.startSystem(app.locals.store);
      const restored = Array.isArray(bootStatus?.restoredSessions) ? bootStatus.restoredSessions.length : 0;
      console.log(`[SERVER] Session lifecycle initialized. Restored sessions: ${restored}`);
    } catch (error) {
      console.error('[SERVER] Failed to auto-restore sessions at startup:', error.message || error);
    }

  });
}

server.on('error', (error) => {
  if (error?.code === 'EADDRINUSE') {
    console.error(`[SERVER] Port ${PORT} is already in use. Set PORT to another value or stop the running instance.`);
    process.exit(1);
  }

  console.error('[SERVER] HTTP server failed:', error?.stack || error?.message || error);
  process.exit(1);
});

bootstrap().catch((error) => {
  console.error('[SERVER] Bootstrap failed:', error?.stack || error?.message || error);
  process.exit(1);
});

async function shutdownGracefully(signal) {
  console.log(`[SERVER] Shutting down gracefully (${signal})...`);
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  server.close(async () => {
    try {
      io.close();
      await outboundQueueService.shutdownOutboundQueue();
      await enterpriseQueueService.shutdown();
      await systemManager.shutdownSystem(app.locals.store);
      process.exit(0);
    } catch (error) {
      console.error('[SERVER] Graceful shutdown failed:', error?.stack || error?.message || error);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.warn('[SERVER] Graceful shutdown timeout. Forcing exit.');
    process.exit(1);
  }, Math.max(5_000, Number(process.env.GRACEFUL_SHUTDOWN_TIMEOUT_MS || 15_000))).unref();
}

process.on('SIGINT', () => shutdownGracefully('SIGINT'));
process.on('SIGTERM', () => shutdownGracefully('SIGTERM'));

// Bugfix#5: after an uncaught exception the Node process is in an
// undefined state. The previous handlers only logged and let the process
// keep running, risking data corruption. We now exit(1) so the supervisor
// (PM2, systemd, Docker, k8s) can restart the process cleanly.
// Default: exit in production, log-only in other envs. Override with
// CRASH_EXIT_ON_UNHANDLED=true|false.
const CRASH_EXIT_CONFIGURED = String(process.env.CRASH_EXIT_ON_UNHANDLED || '').trim().toLowerCase();
const CRASH_EXIT_DEFAULT = IS_PRODUCTION;
const shouldExitOnCrash =
  CRASH_EXIT_CONFIGURED === 'true'
    ? true
    : CRASH_EXIT_CONFIGURED === 'false'
      ? false
      : CRASH_EXIT_DEFAULT;

let alreadyExitingFromCrash = false;

function scheduleCrashExit(reason) {
  if (alreadyExitingFromCrash) {
    return;
  }
  alreadyExitingFromCrash = true;

  console.error(`[CRASH] Exiting due to ${reason}. Supervisor should restart the process.`);

  // Short grace period so logs flush and inflight responses can settle.
  setTimeout(() => process.exit(1), 500).unref();
}

process.on('uncaughtException', (error) => {
  console.error('CRASH:', error?.stack || error);
  try {
    errorLog(error, { scope: 'uncaughtException', pid: process.pid });
  } catch {
    // swallow: logger failures must not block the crash handler
  }
  if (shouldExitOnCrash) {
    scheduleCrashExit('uncaughtException');
  }
});

process.on('unhandledRejection', (reason) => {
  console.error('PROMISE ERROR:', reason?.stack || reason);
  try {
    errorLog(reason instanceof Error ? reason : new Error(String(reason)), {
      scope: 'unhandledRejection',
      pid: process.pid,
    });
  } catch {
    // swallow: logger failures must not block the crash handler
  }
  if (shouldExitOnCrash) {
    scheduleCrashExit('unhandledRejection');
  }
});

module.exports = app;


