const fs = require('fs/promises');
const path = require('path');
const { query } = require('../../infrastructure/config/database');
const sessionManager = require('../../../services/sessionManager');
const { readErrorLogs } = require('./errorLogger');
const { analyzeErrorLogs } = require('./errorAnalyzer');

const DEFAULT_BASE_URL = process.env.RUNTIME_ANALYZER_BASE_URL || 'http://localhost:4000';
const DEFAULT_FRONTEND_URL = process.env.RUNTIME_ANALYZER_FRONTEND_URL || 'http://localhost:8080';

const ENDPOINTS_TO_CHECK = [
  '/health',
  '/sessions/status',
  '/chats',
  '/ai/project-status',
  '/ai/architecture-map',
  '/ai/feature-roadmap',
];

const AI_MODULES = [
  { module: 'projectAnalyzer', file: './projectAnalyzer' },
  { module: 'featureEngine', file: './featureEngine' },
  { module: 'devCore', file: './devCore' },
  { module: 'devAssistant', file: './devAssistant' },
  { module: 'selfHealer', file: './selfHealer' },
  { module: 'testRunner', file: '../tests/testRunner' },
  { module: 'errorAnalyzer', file: './errorAnalyzer' },
  { module: 'roadmapGenerator', file: './featureRoadmapGenerator' },
];

async function timeRequest(url, options = {}) {
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    const responseTime = Date.now() - startedAt;

    return {
      ok: response.ok,
      statusCode: response.status,
      responseTime,
    };
  } catch (error) {
    return {
      ok: false,
      statusCode: 0,
      responseTime: Date.now() - startedAt,
      error: error.message || String(error),
    };
  }
}

async function validateApiEndpoints(baseUrl = DEFAULT_BASE_URL) {
  const apiHealth = [];

  for (const endpoint of ENDPOINTS_TO_CHECK) {
    const result = await timeRequest(`${baseUrl}${endpoint}`);
    apiHealth.push({
      endpoint,
      status: result.ok ? 'ok' : 'failed',
      responseTime: `${result.responseTime}ms`,
      statusCode: result.statusCode,
    });
  }

  return apiHealth;
}

function buildWhatsappConnectionSummary() {
  const sessions = sessionManager.listSessions();

  const connected = sessions
    .filter((session) => String(session.status || '').toLowerCase() === 'connected')
    .map((session) => session.sessionId);

  const pendingQr = [];
  const latestQr = sessionManager.getLatestQr();
  if (latestQr) {
    pendingQr.push(sessionManager.DEFAULT_SESSION);
  }

  return {
    sessions,
    connected,
    pendingQr,
  };
}

function checkAiModulesStatus() {
  return AI_MODULES.map((entry) => {
    try {
      const loaded = require(entry.file);
      const isLoaded = Boolean(loaded);
      return {
        module: entry.module,
        status: isLoaded ? 'loaded' : 'missing',
      };
    } catch {
      return {
        module: entry.module,
        status: 'missing',
      };
    }
  });
}

async function analyzeDatabase() {
  try {
    await query('SELECT 1 as ok');
    return {
      status: 'online',
      warning: null,
    };
  } catch (error) {
    return {
      status: 'degraded',
      warning: error.message || 'Database query failed.',
    };
  }
}

async function readAiTestReportErrors() {
  const filePath = path.join(__dirname, '..', 'logs', 'ai_test_report.json');

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const report = JSON.parse(raw);
    const failures = Array.isArray(report.failures) ? report.failures : [];

    return failures.slice(-5).map((item) => ({
      timestamp: report.generatedAt || new Date().toISOString(),
      error: String(item.message || 'Unknown test failure'),
      stack: String(item.test || ''),
    }));
  } catch {
    return [];
  }
}

async function readRecentErrors() {
  const frontendErrors = await readErrorLogs(20);
  const testReportErrors = await readAiTestReportErrors();

  const normalizedFrontend = frontendErrors.map((entry) => ({
    timestamp: entry.timestamp || new Date().toISOString(),
    error: entry.error || 'Unknown frontend error',
    stack: entry.stack || '',
  }));

  const combined = [...normalizedFrontend, ...testReportErrors]
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
    .slice(0, 10);

  return combined;
}

function buildWarnings(params = {}) {
  const warnings = [];

  if (params.frontendStatus !== 'online') {
    warnings.push('Frontend is unreachable.');
  }

  if (params.backendStatus !== 'online') {
    warnings.push('Backend health endpoint is not healthy.');
  }

  if (params.databaseStatus !== 'online') {
    warnings.push('Database connection is degraded.');
  }

  if ((params.whatsappSummary.connected || []).length === 0) {
    warnings.push('No connected WhatsApp session detected.');
  }

  if ((params.whatsappSummary.pendingQr || []).length > 0) {
    warnings.push('There are WhatsApp sessions pending QR scan.');
  }

  const failedEndpoints = (params.apiHealth || []).filter((entry) => entry.status !== 'ok');
  if (failedEndpoints.length > 0) {
    warnings.push(`Failed API endpoints: ${failedEndpoints.map((entry) => entry.endpoint).join(', ')}`);
  }

  const missingModules = (params.aiModulesStatus || []).filter((item) => item.status !== 'loaded');
  if (missingModules.length > 0) {
    warnings.push(`Missing AI modules: ${missingModules.map((item) => item.module).join(', ')}`);
  }

  return warnings;
}

async function attemptAutoRecovery(context = {}) {
  const steps = [];
  const failures = [];

  try {
    const { runAllTests } = require('../../../tests/testRunner');
    const report = await runAllTests({ app: context.app, autoFix: true });
    steps.push({ action: 'runAllTests:autoFix', status: report?.failures?.length ? 'issues-found' : 'ok' });

    if (Array.isArray(report?.failures) && report.failures.length > 0) {
      const { selfHealError } = require('./selfHealer');
      const seedFailure = report.failures[0] || {};
      const healing = await selfHealError(
        {
          error: seedFailure.message || 'runtime failure',
          page: 'systemHealthAnalyzer',
          stack: seedFailure.test || '',
          timestamp: new Date().toISOString(),
        },
        { app: context.app }
      );

      steps.push({
        action: 'selfHealError',
        status: Array.isArray(healing?.fixesApplied) && healing.fixesApplied.length > 0 ? 'applied' : 'no-changes',
        fixesApplied: healing?.fixesApplied || [],
      });

      const rerun = await runAllTests({ app: context.app, autoFix: false });
      steps.push({ action: 'runAllTests:rerun', status: rerun?.failures?.length ? 'failed' : 'ok' });
      if (Array.isArray(rerun?.failures)) {
        failures.push(...rerun.failures);
      }
    }
  } catch (error) {
    steps.push({ action: 'autoRecovery', status: 'error', message: error.message || String(error) });
  }

  return {
    steps,
    failures,
  };
}

async function analyzeRuntime(options = {}) {
  const baseUrl = options.baseUrl || DEFAULT_BASE_URL;
  const frontendUrl = options.frontendUrl || DEFAULT_FRONTEND_URL;

  const [backendProbe, frontendProbe, apiHealth, database, errors] = await Promise.all([
    timeRequest(`${baseUrl}/health`),
    timeRequest(frontendUrl),
    validateApiEndpoints(baseUrl),
    analyzeDatabase(),
    readRecentErrors(),
  ]);

  const whatsappSummary = buildWhatsappConnectionSummary();
  const aiModulesStatus = checkAiModulesStatus();

  const backendStatus = backendProbe.ok ? 'online' : 'offline';
  const frontendStatus = frontendProbe.ok ? 'online' : 'offline';
  const whatsappStatus = whatsappSummary.connected.length > 0 ? 'connected' : whatsappSummary.pendingQr.length > 0 ? 'pending_qr' : 'disconnected';

  const missingAiModules = aiModulesStatus.filter((item) => item.status !== 'loaded');
  const aiStatus = missingAiModules.length === 0 ? 'loaded' : 'partial';

  const warnings = buildWarnings({
    frontendStatus,
    backendStatus,
    databaseStatus: database.status,
    whatsappSummary,
    apiHealth,
    aiModulesStatus,
  });

  const errorSummary = analyzeErrorLogs(errors);

  let recovery = null;
  const failureDetected =
    backendStatus !== 'online' ||
    frontendStatus !== 'online' ||
    apiHealth.some((entry) => entry.status !== 'ok') ||
    errors.length > 0;

  if (options.autoRecover !== false && failureDetected) {
    recovery = await attemptAutoRecovery({ app: options.app });
  }

  return {
    backendStatus,
    frontendStatus,
    whatsappStatus,
    whatsappConnection: whatsappSummary,
    aiModulesStatus: aiStatus,
    aiModules: aiModulesStatus,
    databaseStatus: database.status,
    apiHealth,
    errors,
    warnings,
    errorSummary,
    recovery,
  };
}

module.exports = {
  analyzeRuntime,
  validateApiEndpoints,
  buildWhatsappConnectionSummary,
  checkAiModulesStatus,
};
