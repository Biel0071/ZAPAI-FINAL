const conversationsRouter = require('./conversations');
const messagesRouter = require('./messages');
const sessionsRouter = require('./sessions');
const systemRouter = require('./system');
const metricsRouter = require('./metrics');
const contactsRouter = require('./contacts');
const analyticsRouter = require('./analytics');
const automationRouter = require('./automation');
const leadsRouter = require('./leads');
const quickRepliesRouter = require('./quickReplies');
const integrationsRouter = require('./integrations');
const aiRouter = require('./ai');
const aiIntelligenceRouter = require('./aiIntelligence');
const aiConfigRouter = require('./aiConfig');
const authRouter = require('./auth');
const mediaRouter = require('./media');
const adminMasterRouter = require('./adminMaster');
const nodeRouter = require('./nodeMaster');
const clusterRouter = require('./cluster');
const campaignDispatchRouter = require('./campaignDispatch');

// ── NEW: Frontend-compatibility routers ──────────────────────────────────────
const logsRouter = require('./logs');
const whatsappRouter = require('./whatsapp');
const adminUsersRouter = require('./adminUsers');

function registerRoutes(app, options = {}) {
  const requireJwtAuth = options.requireJwtAuth;
  const writeHeavyRateLimiter = options.writeHeavyRateLimiter;
  const authRateLimiter = options.authRateLimiter;
  const enableAdminMasterRoutes = options.enableAdminMasterRoutes !== false;
  const enableNodeRegistrationServer = options.enableNodeRegistrationServer !== false;

  app.use('/system', systemRouter);
  // Brute-force protection: applied before the auth router so /auth/login
  // and /api/auth/login are rate-limited even when called unauthenticated.
  if (authRateLimiter) {
    app.use('/auth', authRateLimiter);
    app.use('/api/auth', authRateLimiter);
  }
  app.use('/', authRouter);
  app.use('/api', authRouter);
  app.use(requireJwtAuth);

  // System routes
  app.use('/api/system', systemRouter);
  if (enableAdminMasterRoutes) {
    app.use('/api/admin', adminMasterRouter);
    app.use('/api', adminMasterRouter);
  }
  app.use('/metrics', metricsRouter);

  if (writeHeavyRateLimiter) {
    app.use('/send-message', writeHeavyRateLimiter);
    app.use('/api/send-message', writeHeavyRateLimiter);
    app.use('/send-media', writeHeavyRateLimiter);
    app.use('/api/send-media', writeHeavyRateLimiter);
    app.use('/api/integrations', writeHeavyRateLimiter);
  }

  app.use('/', messagesRouter);
  app.use('/api', messagesRouter);
  app.use('/', conversationsRouter);
  app.use('/api', conversationsRouter);
  app.use('/', sessionsRouter);
  app.use('/api', sessionsRouter);

  app.use('/', leadsRouter);
  app.use('/', contactsRouter);
  app.use('/api', contactsRouter);         // ← contacts under /api prefix
  app.use('/', analyticsRouter);
  app.use('/api', analyticsRouter);        // ← analytics under /api prefix
  app.use('/', automationRouter);
  app.use('/', quickRepliesRouter);
  app.use('/', integrationsRouter);
  app.use('/', aiRouter);
  app.use('/api', aiRouter);
  app.use('/', aiIntelligenceRouter);
  app.use('/api', aiIntelligenceRouter);
  app.use('/', aiConfigRouter);
  app.use('/api', aiConfigRouter);
  app.use('/', mediaRouter);
  app.use('/api', mediaRouter);
  if (enableNodeRegistrationServer) {
    app.use('/api', nodeRouter);
    app.use('/api/cluster', clusterRouter);
  }

  // Campaign dispatch engine
  app.use('/api', campaignDispatchRouter);

  // ── NEW: Frontend-compatibility endpoints ────────────────────────────────

  // /api/logs — system log read/export/clear
  app.use('/api', logsRouter);

  // /api/whatsapp/sessions — aliases for sessionsController
  app.use('/api/whatsapp', whatsappRouter);

  // /api/admin/users — user CRUD with standardized envelope
  app.use('/api/admin', adminUsersRouter);
}

module.exports = {
  registerRoutes,
};
