let createEngine = null;
let engineImportError = null;
let engineModuleLoadAttempted = false;
let hasLoggedUnavailableWarning = false;
let hasLoggedFallbackInfo = false;

let engineInstance = null;

function loadEngineFactory() {
  if (engineModuleLoadAttempted) {
    return createEngine;
  }

  engineModuleLoadAttempted = true;

  try {
    ({ createEngine } = require('ai-engine'));
  } catch (error) {
    createEngine = null;
    engineImportError = error;
  }

  return createEngine;
}

function shouldAllowEngineFallback() {
  if (String(process.env.AI_ENGINE_FALLBACK || '').toLowerCase() === 'true') {
    return true;
  }

  return String(process.env.NODE_ENV || 'development').toLowerCase() !== 'production';
}

function createFallbackEngine() {
  return {
    async generateReply() {
      return '';
    },
    async processEvent(_event = {}) {
      return {
        response: '',
        action: 'ignore',
        metadata: {
          source: 'fallback',
          reason: 'ai-engine-unavailable',
        },
      };
    },
  };
}

function logUnavailableWarning() {
  if (hasLoggedUnavailableWarning) {
    return;
  }

  const reason = engineImportError?.code || engineImportError?.message || 'unknown error';
  console.warn(`[AI] ai-engine unavailable (${reason}). Falling back to safe local engine.`);
  hasLoggedUnavailableWarning = true;
}

function logFallbackInfo() {
  if (hasLoggedFallbackInfo) {
    return;
  }

  console.info('[AI] Fallback AI engine is active. Responses will be no-op until ai-engine is installed.');
  hasLoggedFallbackInfo = true;
}

function getEngineClient({ openaiClient, model } = {}) {
  const engineFactory = loadEngineFactory();

  if (engineInstance) {
    if (!engineFactory) {
      logFallbackInfo();
    }

    return engineInstance;
  }

  if (!engineFactory) {
    logUnavailableWarning();

    if (!shouldAllowEngineFallback()) {
      console.warn('[AI] AI_ENGINE_FALLBACK is disabled for production, but fallback is being forced to keep server healthy.');
    }

    engineInstance = createFallbackEngine();
    logFallbackInfo();
    return engineInstance;
  }

  engineInstance = engineFactory({
    openaiClient: openaiClient || null,
    model: model || process.env.OPENAI_MODEL || 'gpt-4.1-mini',
  });

  return engineInstance;
}

function resetEngineClient() {
  engineInstance = null;
  createEngine = null;
  engineImportError = null;
  engineModuleLoadAttempted = false;
  hasLoggedUnavailableWarning = false;
  hasLoggedFallbackInfo = false;
}

module.exports = {
  getEngineClient,
  resetEngineClient,
};
