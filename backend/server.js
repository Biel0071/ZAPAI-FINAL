const path = require('path');
const override = true;
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override });
require('dotenv').config({ path: path.join(__dirname, '../.env.production'), override });
require('dotenv').config({ path: path.join(__dirname, '.env.production'), override });
require('dotenv').config({ path: path.join(__dirname, '.env'), override });
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
const { initDatabase, pool } = require('./config/database');
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
const { isAIEnabled } = require('./config/aiToggle');
const { backendLog, errorLog } = require('./services/logger');
const { DEFAULT_SESSION } = whatsappService;
const nodeRegisterService = require('./services/nodeRegister');
const runtimeEngine = require('./services/runtimeEngine');
const diagnosticsEngine = require('./services/diagnosticsEngine');
const sessionRegistry = require('./services/sessionRegistry');
const messageAckPipeline = require('./services/messageAckPipeline');
const workerSupervisor = require('./services/workerSupervisor');
const backpressureController = require('./services/backpressureController');
const correlationTracker = require('./services/correlationTracker');
const socketSafetyGuard = require('./services/socketSafetyGuard');
const aiMemoryEngine = require('./services/aiMemoryEngine');
const websocketGateway = require('./services/websocketGateway');
const campaignDispatchEngine = require('./services/campaignDispatchEngine');
const envValidator = require('./services/envValidator');
const sessionWatchdog = require('./services/sessionWatchdog');
const { createHealthService } = require('./services/healthService');

const eventLoopDelay = monitorEventLoopDelay({ resolution: 20 });
eventLoopDelay.enable();

console.log('Server starting...');
backendLog('info', 'boot:start', { pid: process.pid });

const app = express();
const server = http.createServer(app);

// CORS options used by both Express and Socket.IO
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
    'x-correlation-id',
    'ngrok-skip-browser-warning',
    'X-Requested-With',
  ],
};

const io = new Server(server, {
  cors: corsOptions,
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
const { buildHealthPayload, buildFullHealthPayload } = createHealthService({
  app,
  io,
  eventLoopDelay,
  sessionManager,
  systemManager,
  nodeRole: NODE_ROLE,
  isMaster: IS_MASTER,
  features: {
    adminMasterRoutes: ENABLE_ADMIN_MASTER_ROUTES,
    nodeRegistrationServer: ENABLE_NODE_REGISTRATION_SERVER,
    nodeAutoRegisterClient: ENABLE_NODE_AUTO_REGISTER_CLIENT,
  },
});
const FRONTEND_URL = runtimeEnv.frontendUrl;
// APP_PUBLIC_URL is the single-source-of-truth for production URL.
// Set it in .env.production to your VPS IP or domain.
const APP_PUBLIC_URL = runtimeEnv.appPublicUrl || String(process.env.APP_PUBLIC_URL || '').trim();
const ENV_ALLOWED_ORIGINS = [...runtimeEnv.allowedOriginsFromEnv];
const BASE_ALLOWED_ORIGINS = [
  // Development origins — always allowed in non-production
  ...(!IS_PRODUCTION ? [
    'http://localhost:8080',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
  ] : []),
  // Production: sourced from env vars only (no hardcoded IPs/domains)
  ...(APP_PUBLIC_URL ? [APP_PUBLIC_URL] : []),
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
  if (req.path === '/health' || req.path === '/api/health' || req.path === '/api') {
    return next();
  }

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
  const sessions = typeof sessionManager.listSessions === 'function' ? sessionManager.listSessions() : [];
  const session = sessions.find((candidate) => String(candidate?.status || '').toLowerCase() === 'connected')
    || sessionManager.getSession(DEFAULT_SESSION)
    || sessions[0];
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

const DEFAULT_PAYLOAD_LIMIT = process.env.DEFAULT_PAYLOAD_LIMIT || '2mb';
const MEDIA_PAYLOAD_LIMIT = process.env.MEDIA_PAYLOAD_LIMIT || '150mb';
const mediaPayloadPaths = [
  '/send-media',
  '/api/send-media',
  '/receive-message',
  '/api/receive-message',
  '/media/upload',
  '/api/quick-replies',
];

app.use(mediaPayloadPaths, express.json({ limit: MEDIA_PAYLOAD_LIMIT }));
app.use(mediaPayloadPaths, express.urlencoded({ extended: true, limit: MEDIA_PAYLOAD_LIMIT }));
app.use(express.json({ limit: DEFAULT_PAYLOAD_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: DEFAULT_PAYLOAD_LIMIT }));

// CORS: validated via isOriginAllowed (allow-list in production, permissive in dev).
// The `cors` package handles preflight (OPTIONS) responses automatically.
// (corsOptions is defined above and shared with Socket.IO)

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
app.use(correlationTracker.correlationMiddleware());
app.use(requestContextMiddleware);
app.use(tenantContextMiddleware);
app.use(apiEnvelopeMiddleware);
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
  publicPrefixes: [
    '/auth/',
    '/api/auth/',
    '/api/node/',
    '/api/master/',
    '/api/system/',
    '/api/cluster/metrics/',
    '/system/',
    '/uploads/',
    '/media/',
    '/upload/'
  ],
  protectedPrefixes: ['/api/admin/', '/admin/'],
});

// Auth enforcement is now centralized in createJwtAuthMiddleware.
// Dev bypass requires explicit ALLOW_DEV_AUTH_BYPASS=true (NODE_ENV != production).
const authMiddleware = requireJwtAuth;

// Dynamic CORS middleware for static files to restrict to allowed origins
function corsForStatic(req, res, next) {
  const origin = req.headers.origin;
  if (origin && isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else if (!origin) {
    // direct navigation
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'null');
  }
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, x-tenant-id');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
}

app.use('/media', corsForStatic, express.static(path.join(__dirname, '..', 'storage', 'media')));
app.use('/media', corsForStatic, express.static(path.join(__dirname, 'media')));
app.use('/upload', corsForStatic, express.static(path.join(__dirname, 'upload')));
app.use('/uploads', corsForStatic, express.static(path.join(__dirname, 'uploads')));
app.use('/uploads', corsForStatic, express.static(path.join(process.cwd(), 'uploads')));
app.use('/uploads', corsForStatic, express.static(path.join(__dirname, '..', 'uploads')));
app.use('/diagnostics', devOnlyRoute);
app.use('/receive-message', devOnlyRoute);
app.use('/api/receive-message', devOnlyRoute);
app.use('/system/runtime/debug', devOnlyRoute);
app.use('/system/ai-diagnostics', devOnlyRoute);

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
  saveAiState: async () => {
    await saveStoreState({
      aiLearningLogs: app.locals.store.aiLearningLogs,
      promptHistory: app.locals.store.promptHistory,
      aiConfig: app.locals.store.aiConfig,
    });
    if (app.locals.store.databaseEnabled) {
      try {
        const systemSettingsRepository = require('./repositories/systemSettingsRepository');
        await systemSettingsRepository.setSetting('ai_config', JSON.stringify(app.locals.store.aiConfig || {}));
      } catch (err) {
        console.warn('[AI] failed to save ai_config to db:', err.message);
      }
    }
  },
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

  socket.on('archive_chat', async (chatId) => {
    try {
      console.log(`[SERVER] Received archive_chat for ${chatId}`);
      const chatOperations = require('./services/whatsapp/chat/operations');
      const conversationRepository = require('./repositories/conversationRepository');

      // Update DB
      await conversationRepository.updateConversationState(chatId, { status: 'archived' }).catch(() => {});

      const conv = await conversationRepository.getConversationById(chatId);
      if (conv) {
        const jid = conv.phone.includes('@') ? conv.phone : `${conv.phone}@s.whatsapp.net`;

        // Update Memory store using real WhatsApp JID
        chatOperations.archiveChat(jid);

        // Send command to Baileys socket using real WhatsApp JID
        const session = chatOperations.findSessionForChat(jid);
        if (session && session.sock) {
          const chat = chatOperations.getOrCreateChat(jid);
          const lastMsg = chat?.messages?.[chat.messages.length - 1];
          const lastMessages = lastMsg ? [{
            key: {
              id: lastMsg.id,
              remoteJid: jid,
              fromMe: lastMsg.fromMe
            },
            messageTimestamp: typeof lastMsg.createdAt === 'string' ? Math.floor(new Date(lastMsg.createdAt).getTime() / 1000) : Math.floor(Date.now() / 1000)
          }] : [];

          await session.sock.chatModify({ archive: true, lastMessages }, jid).catch((err) => {
            console.warn(`[WHATSAPP_ARCHIVE] Failed to archive in Baileys for ${jid}:`, err.message);
          });
        }
      } else {
        // Fallback to chatId if conversation is not found in DB
        chatOperations.archiveChat(chatId);
      }

      // Notify other frontend clients
      socket.broadcast.emit('chat_archived', { chatId });
    } catch (err) {
      console.error('[SERVER] archive_chat error:', err);
    }
  });

  socket.on('unarchive_chat', async (chatId) => {
    try {
      console.log(`[SERVER] Received unarchive_chat for ${chatId}`);
      const chatOperations = require('./services/whatsapp/chat/operations');
      const conversationRepository = require('./repositories/conversationRepository');
      const { ensureRealtimeStore } = require('./services/whatsapp/realtime/chatState');
      const { emitChatUpdated, emitChatsLoaded } = require('./services/whatsapp/realtime/events');
      const { emitRealtimeMetrics } = require('./services/whatsapp/realtime/metrics');

      // Update DB
      await conversationRepository.updateConversationState(chatId, { status: 'active' }).catch(() => {});

      const conv = await conversationRepository.getConversationById(chatId);
      const targetId = conv ? (conv.phone.includes('@') ? conv.phone : `${conv.phone}@s.whatsapp.net`) : chatId;

      // Update Memory store
      const session = chatOperations.findSessionForChat(targetId);
      const store = session ? ensureRealtimeStore(session) : null;
      const targetChat = store?.chats?.[targetId];
      if (targetChat) {
        targetChat.archived = false;
        targetChat.updatedAt = Date.now();
        emitChatUpdated(session?.io || io, targetChat);
        emitChatsLoaded(session?.io || io, store);
        emitRealtimeMetrics(session?.io || io, store);
      }
      const chat = chatOperations.getOrCreateChat(targetId);
      if (chat) {
        chat.archived = false;
      }

      // Send command to Baileys socket
      if (session && session.sock) {
        const lastMsg = chat?.messages?.[chat.messages.length - 1];
        const lastMessages = lastMsg ? [{
          key: {
            id: lastMsg.id,
            remoteJid: targetId,
            fromMe: lastMsg.fromMe
          },
          messageTimestamp: typeof lastMsg.createdAt === 'string' ? Math.floor(new Date(lastMsg.createdAt).getTime() / 1000) : Math.floor(Date.now() / 1000)
        }] : [];

        await session.sock.chatModify({ archive: false, lastMessages }, targetId).catch((err) => {
          console.warn(`[WHATSAPP_ARCHIVE] Failed to unarchive in Baileys for ${targetId}:`, err.message);
        });
      }

      // Notify other frontend clients
      socket.broadcast.emit('chat_unarchived', { chatId });
    } catch (err) {
      console.error('[SERVER] unarchive_chat error:', err);
    }
  });

  socket.on('add_tag', async (payload = {}) => {
    try {
      const chatId = payload.chatId;
      const tagsToAdd = payload.tag ? [payload.tag] : (payload.tags || []);
      if (!chatId || tagsToAdd.length === 0) return;

      console.log(`[SERVER] Received add_tag for ${chatId}:`, tagsToAdd);
      const chatOperations = require('./services/whatsapp/chat/operations');
      const conversationRepository = require('./repositories/conversationRepository');

      // Update DB
      const conv = await conversationRepository.getConversationById(chatId);
      if (conv) {
        let currentTags = Array.isArray(conv.tags) ? conv.tags : [];
        let changed = false;
        for (const t of tagsToAdd) {
          if (t && !currentTags.includes(t)) {
            currentTags.push(t);
            changed = true;
          }
        }
        if (changed) {
          await conversationRepository.updateConversationState(chatId, { tags: currentTags }).catch(() => {});
        }

        // Update Memory store & Baileys labels
        const jid = conv.phone.includes('@') ? conv.phone : `${conv.phone}@s.whatsapp.net`;
        const session = chatOperations.findSessionForChat(jid);
        for (const t of tagsToAdd) {
          chatOperations.addTag(jid, t);

          // WhatsApp Business Labels wrapper
          if (session && session.sock && typeof session.sock.chatModify === 'function') {
            await session.sock.chatModify({ addLabel: { labelId: t } }, jid).catch((err) => {
              console.log(`[WHATSAPP_LABELS] addLabel skipped/failed for tag "${t}":`, err.message);
            });
          }
        }
      }

      socket.broadcast.emit('tag_added', { chatId, tags: tagsToAdd });
    } catch (err) {
      console.error('[SERVER] add_tag error:', err);
    }
  });

  socket.on('remove_tag', async (payload = {}) => {
    try {
      const { chatId, tag } = payload;
      if (!chatId || !tag) return;

      console.log(`[SERVER] Received remove_tag for ${chatId}: ${tag}`);
      const chatOperations = require('./services/whatsapp/chat/operations');
      const conversationRepository = require('./repositories/conversationRepository');

      // Update DB
      const conv = await conversationRepository.getConversationById(chatId);
      if (conv) {
        if (Array.isArray(conv.tags) && conv.tags.includes(tag)) {
          const nextTags = conv.tags.filter(t => t !== tag);
          await conversationRepository.updateConversationState(chatId, { tags: nextTags }).catch(() => {});
        }

        // Update Memory store & Baileys labels
        const jid = conv.phone.includes('@') ? conv.phone : `${conv.phone}@s.whatsapp.net`;
        chatOperations.removeTag(jid, tag);
        const session = chatOperations.findSessionForChat(jid);
        if (session && session.sock && typeof session.sock.chatModify === 'function') {
          await session.sock.chatModify({ removeLabel: { labelId: tag } }, jid).catch((err) => {
            console.log(`[WHATSAPP_LABELS] removeLabel skipped/failed for tag "${tag}":`, err.message);
          });
        }
      }

      socket.broadcast.emit('tag_removed', { chatId, tag });
    } catch (err) {
      console.error('[SERVER] remove_tag error:', err);
    }
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

const handleHealthCheck = (_req, res) => {
  try {
    const base = buildHealthPayload();
    const liveSessions = sessionManager.listSessions();
    const connectedSessions = liveSessions.filter(
      (item) => String(item?.status || '').toLowerCase() === 'connected'
    );
    const session = connectedSessions[0] || liveSessions[0] || null;
    const sessionsTotal = liveSessions.length;
    const sessionsConnected = connectedSessions.length;

    const envelope = {
      ...base,
      success: true,
      status: base.status || 'online',
      data: {
        system: {
          sessions: {
            total: sessionsTotal,
            connected: sessionsConnected,
          },
          websocket: {
            status: 'online',
          },
          database: {
            status: 'online',
          },
          whatsapp: {
            status: session?.status || 'disconnected',
            name: session?.sessionId || null,
          },
        },
      },
    };

    return res.status(200).json(envelope);
  } catch (err) {
    console.error('[HEALTH] Error building payload:', err);
    return res.status(200).json({ success: true, status: 'degraded' });
  }
};

app.get('/health', handleHealthCheck);
app.get('/api/health', handleHealthCheck);

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

// ─── Phase 4: RuntimeEngine + DiagnosticsEngine endpoints ───

app.get('/api/diagnostics/full', async (_req, res) => {
  try {
    const diagnostics = await diagnosticsEngine.runFullDiagnostics(app.locals.store);
    return sendSafeJson(res, { success: true, data: diagnostics });
  } catch (error) {
    return sendSafeJson(res, { success: false, error: error?.message || 'Diagnostics failed' }, 500);
  }
});

app.get('/api/runtime/summary', (_req, res) => {
  try {
    const summary = runtimeEngine.getRuntimeSummary();
    return sendSafeJson(res, { success: true, data: summary });
  } catch (error) {
    return sendSafeJson(res, { success: false, error: error?.message || 'Runtime summary failed' }, 500);
  }
});

app.get('/api/runtime/diagnostics', (_req, res) => {
  try {
    const diagnostics = runtimeEngine.getDiagnostics();
    return sendSafeJson(res, { success: true, data: diagnostics || {} });
  } catch (error) {
    return sendSafeJson(res, { success: false, error: error?.message || 'Runtime diagnostics failed' }, 500);
  }
});

app.get('/api/sessions/registry', (_req, res) => {
  try {
    const stats = sessionRegistry.getStats();
    const sessions = sessionRegistry.list();
    return sendSafeJson(res, {
      success: true,
      data: {
        stats,
        sessions: sessions.map((s) => ({
          sessionId: s.sessionId,
          status: s.status,
          connected: s.connected,
          phone: s.phone,
          name: s.name,
          reconnectCount: s.reconnectCount,
          lastHeartbeatAt: s.lastHeartbeatAt,
          updatedAt: s.updatedAt,
        })),
      },
    });
  } catch (error) {
    return sendSafeJson(res, { success: false, error: error?.message || 'Registry failed' }, 500);
  }
});


// ─── Phase 5: Production Hardening endpoints ───

app.get('/api/ack/stats', (_req, res) => {
  try {
    return sendSafeJson(res, { success: true, data: messageAckPipeline.getStats() });
  } catch (error) {
    return sendSafeJson(res, { success: false, error: error?.message || 'ACK stats failed' }, 500);
  }
});

app.get('/api/ack/pending', (req, res) => {
  try {
    const sessionId = req.query.sessionId || null;
    return sendSafeJson(res, { success: true, data: messageAckPipeline.getPendingMessages(sessionId) });
  } catch (error) {
    return sendSafeJson(res, { success: false, error: error?.message || 'ACK pending failed' }, 500);
  }
});

app.get('/api/ack/failed', (req, res) => {
  try {
    const sessionId = req.query.sessionId || null;
    return sendSafeJson(res, { success: true, data: messageAckPipeline.getFailedMessages(sessionId) });
  } catch (error) {
    return sendSafeJson(res, { success: false, error: error?.message || 'ACK failed list failed' }, 500);
  }
});

app.post('/api/ack/reconcile', (_req, res) => {
  try {
    const result = messageAckPipeline.reconcilePendingMessages(io);
    return sendSafeJson(res, { success: true, data: result });
  } catch (error) {
    return sendSafeJson(res, { success: false, error: error?.message || 'Reconciliation failed' }, 500);
  }
});

app.get('/api/workers/status', (_req, res) => {
  try {
    return sendSafeJson(res, { success: true, data: workerSupervisor.getSummary() });
  } catch (error) {
    return sendSafeJson(res, { success: false, error: error?.message || 'Worker status failed' }, 500);
  }
});

app.get('/api/backpressure/status', (_req, res) => {
  try {
    return sendSafeJson(res, { success: true, data: backpressureController.getStatus() });
  } catch (error) {
    return sendSafeJson(res, { success: false, error: error?.message || 'Backpressure status failed' }, 500);
  }
});

app.get('/api/safety/audit', (_req, res) => {
  try {
    const audit = socketSafetyGuard.runFullAudit(io);
    return sendSafeJson(res, { success: true, data: audit });
  } catch (error) {
    return sendSafeJson(res, { success: false, error: error?.message || 'Safety audit failed' }, 500);
  }
});

app.get('/api/traces/stats', (_req, res) => {
  try {
    return sendSafeJson(res, { success: true, data: correlationTracker.getStats() });
  } catch (error) {
    return sendSafeJson(res, { success: false, error: error?.message || 'Trace stats failed' }, 500);
  }
});

// ─── Phase 6: Enterprise Stabilization endpoints ───

app.get('/api/ai/memory/search', (req, res) => {
  try {
    const query = req.query.q || req.query.query || '';
    const results = aiMemoryEngine.searchMemory(app.locals.store, query);
    return sendSafeJson(res, { success: true, data: results.slice(0, 50) });
  } catch (error) {
    return sendSafeJson(res, { success: false, error: error?.message || 'Memory search failed' }, 500);
  }
});

app.get('/api/ai/memory/analytics', (_req, res) => {
  try {
    return sendSafeJson(res, { success: true, data: aiMemoryEngine.getMemoryAnalytics(app.locals.store) });
  } catch (error) {
    return sendSafeJson(res, { success: false, error: error?.message || 'Memory analytics failed' }, 500);
  }
});

app.post('/api/ai/memory/flush', async (_req, res) => {
  try {
    const flushed = await aiMemoryEngine.flushMemoryToPostgres(app.locals.store);
    return sendSafeJson(res, { success: true, data: { flushed } });
  } catch (error) {
    return sendSafeJson(res, { success: false, error: error?.message || 'Memory flush failed' }, 500);
  }
});

app.get('/api/websocket/metrics', (_req, res) => {
  try {
    return sendSafeJson(res, { success: true, data: websocketGateway.getMetrics() });
  } catch (error) {
    return sendSafeJson(res, { success: false, error: error?.message || 'WS metrics failed' }, 500);
  }
});

app.get('/api/websocket/status', (_req, res) => {
  try {
    return sendSafeJson(res, {
      success: true,
      data: {
        connected: websocketGateway.isConnected(),
        sockets: websocketGateway.getConnectedSockets(),
        metrics: websocketGateway.getMetrics(),
      },
    });
  } catch (error) {
    return sendSafeJson(res, { success: false, error: error?.message || 'WS status failed' }, 500);
  }
});

app.get('/api/env/validate', (_req, res) => {
  try {
    return sendSafeJson(res, { success: true, data: envValidator.validateEnvironment() });
  } catch (error) {
    return sendSafeJson(res, { success: false, error: error?.message || 'Env validation failed' }, 500);
  }
});

app.get('/api/watchdog/status', (_req, res) => {
  try {
    return sendSafeJson(res, { success: true, data: sessionWatchdog.getWatchdogDiagnostics() });
  } catch (error) {
    return sendSafeJson(res, { success: false, error: error?.message || 'Watchdog failed' }, 500);
  }
});

app.post('/api/watchdog/audit', (_req, res) => {
  try {
    const io = app.locals?.io || global.io;
    const audit = sessionWatchdog.auditSessions();
    const cleaned = sessionWatchdog.cleanupZombieSessions(audit, io);
    return sendSafeJson(res, { success: true, data: { ...audit, cleaned } });
  } catch (error) {
    return sendSafeJson(res, { success: false, error: error?.message || 'Audit failed' }, 500);
  }
});

app.get('/api/queues/diagnostics', (_req, res) => {
  try {
    const outboundQueue = require('./services/outboundQueueService');
    const enterpriseQueue = require('./services/enterprise/queue-service');

    return sendSafeJson(res, {
      success: true,
      data: {
        outbound: {
          pending: outboundQueue.listPending?.() || [],
          deadLetter: outboundQueue.listDeadLetter?.() || [],
        },
        enterprise: {
          stats: enterpriseQueue.getStats?.() || {},
        },
      },
    });
  } catch (error) {
    return sendSafeJson(res, { success: false, error: error?.message || 'Queue diagnostics failed' }, 500);
  }
});

// ─── Consolidated Production Status ───
app.get('/api/production/status', (_req, res) => {
  try {
    const uptime = process.uptime();
    const mem = process.memoryUsage();

    const data = {
      status: 'operational',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: {
        seconds: Math.round(uptime),
        human: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.round(uptime % 60)}s`,
      },
      memory: {
        heapUsedMB: Math.round(mem.heapUsed / 1048576),
        heapTotalMB: Math.round(mem.heapTotal / 1048576),
        rssMB: Math.round(mem.rss / 1048576),
        externalMB: Math.round((mem.external || 0) / 1048576),
      },
      services: {
        backend: 'healthy',
        websocket: websocketGateway.isConnected() ? 'connected' : 'disconnected',
        websocketClients: websocketGateway.getConnectedSockets(),
      },
      workers: (() => {
        try { return workerSupervisor.getSummary(); } catch { return 'unavailable'; }
      })(),
      sessions: (() => {
        try { return sessionWatchdog.auditSessions(); } catch { return 'unavailable'; }
      })(),
      queues: (() => {
        try {
          const eq = require('./services/enterprise/queue-service');
          return eq.getStats();
        } catch { return 'unavailable'; }
      })(),
      timestamp: new Date().toISOString(),
    };

    return sendSafeJson(res, { success: true, data });
  } catch (error) {
    return sendSafeJson(res, { success: false, error: error?.message || 'Status failed' }, 500);
  }
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
  const isGroup = remoteJid.endsWith('@g.us');

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
      const { formatApiMessage } = require('./controllers/messages/shared');

      io?.emit('message:new', {
        phone: incoming.phone,
        conversationId: result.message.conversationId,
        sessionId: result.message.sessionId || sessionId || null,
        message: formatApiMessage(result.message),
      });

      const MessageAuditService = require('./services/messageAuditService');
      try {
        await MessageAuditService.logStep({
          messageId: result.message.id || null,
          conversationId: result.message.conversationId || null,
          phone: incoming.phone,
          step: 'INBOX_UPDATED',
          status: 'success',
          details: {
            phone: incoming.phone,
            sessionId: result.message.sessionId || sessionId || null
          }
        });
      } catch (err) {
        console.error('[MESSAGE AUDIT] Failed to log INBOX_UPDATED:', err);
      }

      console.log('[INBOX] realtime event emitted');
    }
  } catch (error) {
    console.error('[CRM] Failed to persist incoming message:', error.message || error);

    return {
      conversation: null,
      message: buildTransientMessage(payload, sessionId),
    };
  }

  const automationEngine = require('./services/automationEngine');
  if (!isGroup) {
    try {
      result.automationResult = await automationEngine.processMessage({
        payload: messagePayload,
        conversation: result?.conversation || { phone: payload.phone, company_id: payload.companyId },
        store: app.locals.store,
        sock,
        sessionId
      });
      result.automationHandled = true;
    } catch (err) {
      console.error('[AutomationEngine] Pipeline execution failed:', err);
      result.automationHandled = false;
    }
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

  const { consolidateLidConversations } = require('./services/whatsapp/persistence/conversationMerger');
  consolidateLidConversations(session.companyId || 'default').catch(err => {
    console.error('[CONSOLIDATION] Failed to consolidate LID conversations on session connect:', err);
  });
}

async function bootstrap() {
  const envResult = envValidator.validateEnvironment();
  if (!envResult.valid) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[SERVER] Critical: Environment validation failed in production. Aborting boot process.');
      process.exit(1);
    } else {
      console.warn('[SERVER] Warning: Environment validation failed in development. Booting will continue, but expect instability.');
    }
  }

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

    const lidMapper = require('./services/whatsapp/shared/lidMapper');
    await lidMapper.init();

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

  // Set initial AI configuration
  app.locals.store.aiConfig = persistedState.aiConfig || {};

  // If database is enabled, initialize AI toggle and try to fetch config from db
  if (app.locals.store.databaseEnabled) {
    try {
      const { initAIToggle } = require('./config/aiToggle');
      await initAIToggle();
      console.log('[AI] Initialized toggle status to:', isAIEnabled());

      const systemSettingsRepository = require('./repositories/systemSettingsRepository');
      const dbAiConfig = await systemSettingsRepository.getSetting('ai_config');
      if (dbAiConfig && dbAiConfig.value) {
        try {
          app.locals.store.aiConfig = {
            ...app.locals.store.aiConfig,
            ...JSON.parse(dbAiConfig.value),
          };
          console.log('[AI] Config loaded from PostgreSQL successfully');
        } catch (e) {
          console.warn('[AI] Failed to parse db ai_config:', e.message);
        }
      }
    } catch (err) {
      console.warn('[AI] Failed during boot configuration lookup:', err.message);
    }
  }

  // Apply business hours from loaded config
  const aiConfig = app.locals.store.aiConfig;
  if (aiConfig && aiConfig.businessHours) {
    businessHours.open = aiConfig.businessHours.open || businessHours.open;
    businessHours.close = aiConfig.businessHours.close || businessHours.close;
    businessHours.timezone = aiConfig.businessHours.timezone || businessHours.timezone;
    businessHours.autoReplyOutsideHours = aiConfig.businessHours.autoReplyOutsideHours !== undefined ? aiConfig.businessHours.autoReplyOutsideHours : businessHours.autoReplyOutsideHours;
    businessHours.absenceMessage = aiConfig.businessHours.absenceMessage || businessHours.absenceMessage;
    console.log('[AI] Applied loaded business hours:', businessHours.open, '-', businessHours.close);
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
  if (process.env.ENABLE_QUEUE_LEGACY !== 'false') {
    await outboundQueueService.initializeOutboundQueue({ store: app.locals.store });
  } else {
    console.log('[SERVER] Legacy outbound queue is disabled by ENABLE_QUEUE_LEGACY flag.');
  }
  await enterpriseQueueService.initialize();

  server.listen(PORT, '0.0.0.0', async () => {
    console.log(`[SERVER] Started on port ${PORT}`);
    console.log(`[SERVER] Host: 0.0.0.0`);
    console.log(`[SERVER] Environment: ${NODE_ENV}`);
    console.log(`[SERVER] API running`);

    if (typeof process.send === 'function') {
      process.send('ready');
    }

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

      // Start RuntimeEngine workers (heartbeat, cleanup, metrics, diagnostics)
      if (process.env.ENABLE_RUNTIME_ENGINE !== 'false') {
        runtimeEngine.startRuntimeEngine(app.locals.store);
      } else {
        console.log('[SERVER] Runtime Engine is disabled by ENABLE_RUNTIME_ENGINE flag.');
      }

      // Hydrate SessionRegistry from persistent storage
      sessionRegistry.hydrate().catch((err) => {
        console.error('[SERVER] SessionRegistry hydration failed:', err?.message || err);
      });

      // Phase 5: Start WorkerSupervisor managed workers
      workerSupervisor.registerWorker('backpressure_cleanup', () => {
        backpressureController.cleanupSessionRates();
      }, 60_000);
      workerSupervisor.registerWorker('ack_reconciliation', () => {
        messageAckPipeline.reconcilePendingMessages(io);
      }, 120_000);
      workerSupervisor.registerWorker('stale_worker_check', () => {
        workerSupervisor.checkStaleWorkers();
      }, 60_000);
      workerSupervisor.startAll();

      // Phase 5: Start SocketSafety periodic audit
      if (process.env.ENABLE_SOCKET_GUARD !== 'false') {
        socketSafetyGuard.startAuditWorker(io);
      } else {
        console.log('[SERVER] Socket Safety Guard is disabled by ENABLE_SOCKET_GUARD flag.');
      }

      // Phase 6: WebSocket Gateway initialization
      websocketGateway.init(io);

      // Phase 6: AI Memory table + hydration
      aiMemoryEngine.ensureMemoryTable().then(() => {
        return aiMemoryEngine.loadMemoryFromPostgres(app.locals.store);
      }).catch((err) => {
        console.error('[SERVER] AI Memory hydration failed:', err?.message || err);
      });

      // Phase 6: Register AI memory flush worker
      workerSupervisor.registerWorker('ai_memory_flush', async () => {
        await aiMemoryEngine.flushMemoryToPostgres(app.locals.store);
      }, Math.max(300_000, Number(process.env.AI_MEMORY_FLUSH_MS) || 900_000), { runImmediately: false });
      workerSupervisor.startWorker('ai_memory_flush');

      // Phase 7: Session Watchdog worker
      if (process.env.ENABLE_SESSION_WATCHDOG !== 'false') {
        workerSupervisor.registerWorker('session_watchdog', () => {
          const audit = sessionWatchdog.auditSessions();
          if (audit.zombies.length > 0 || audit.stuck.length > 0 || audit.stale.length > 0) {
            console.warn(`[WATCHDOG] Issues found: ${audit.zombies.length} zombies, ${audit.stuck.length} stuck, ${audit.stale.length} stale`);
            sessionWatchdog.cleanupZombieSessions(audit, io);
            sessionWatchdog.restartStuckSessions(audit, async (id) => {
              return sessionManager.startSession(id, { allowInactive: true });
            }, io);
          }
        }, Math.max(60_000, Number(process.env.SESSION_WATCHDOG_MS) || 180_000));
        workerSupervisor.startWorker('session_watchdog');
      } else {
        console.log('[SERVER] Session Watchdog is disabled by ENABLE_SESSION_WATCHDOG flag.');
      }

      // Connection Recovery service
      const connectionRecoveryService = require('./services/connectionRecoveryService');
      workerSupervisor.registerWorker('connection_recovery', async () => {
        await connectionRecoveryService.checkAndRecoverSessions();
      }, 25_000, { runImmediately: false });
      workerSupervisor.startWorker('connection_recovery');

      // Phase 8: Retention worker — daily message cleanup
      // Groups: messages > 24h | Individuals: messages > 60 days
      // PRESERVES: AI memory, leads, analytics, tags, conversation metadata
      workerSupervisor.registerWorker('message_retention', async () => {
        try {
          const retentionService = require('./services/retentionService');
          const report = await retentionService.runRetention();
          if (!report.skipped) {
            console.log(`[SERVER] Retention complete: groups=${report.groups?.deleted ?? 0} individual=${report.individual?.deleted ?? 0}`);
          }
        } catch (err) {
          console.error('[SERVER] Retention worker error:', err?.message || err);
        }
      }, 24 * 60 * 60 * 1000, { runImmediately: false }); // Every 24 hours
      workerSupervisor.startWorker('message_retention');

      // Signal PM2 that the process is fully ready (wait_ready: true)
      // This tells PM2 it can safely route traffic and manage restarts
      if (typeof process.send === 'function' && process.env.PM2_READY_SIGNAL === 'true') {
        process.send('ready');
        console.log('[SERVER] PM2 ready signal sent');
      }
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
      websocketGateway.shutdown();
      campaignDispatchEngine.stopAll();
      workerSupervisor.stopAll();
      socketSafetyGuard.stopAuditWorker();
      socketSafetyGuard.clearAllTimers();
      runtimeEngine.stopRuntimeEngine();
      io.close();
      await outboundQueueService.shutdownOutboundQueue();
      await enterpriseQueueService.shutdown();
      await systemManager.shutdownSystem(app.locals.store);
      await pool.end().catch((err) => console.error('[SERVER] DB pool end error:', err?.message || err));
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
