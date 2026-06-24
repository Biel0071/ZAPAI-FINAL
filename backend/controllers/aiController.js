const {
  enableAI,
  disableAI,
  isAIEnabled,
  setAIEnabled,
} = require('../config/aiToggle');
const { applyPromptImprovement, updateActivePrompt, getPromptHistory, getActivePrompt } = require('../config/promptManager');
const aiLearningEngine = require('../services/aiLearningEngine');
const { analyzeProject } = require('../ai/projectAnalyzer');
const devPipeline = require('../ai/devPipeline');
const { replicatePage } = require('../ai/pageReplicator');
const { generatePages } = require('../ai/pageLoopGenerator');
const { analyzeDoc } = require('../ai/docAnalyzer');
const { answerQuestion } = require('../ai/chatAssistant');
const { curateCodebase } = require('../ai/codeCurator');
const { generateFeature } = require('../ai/featureGenerator');
const { createModule: createModuleFromFeatureEngine } = require('../ai/featureEngine');
const { runAssistantCommand } = require('../ai/devAssistant');
const devCore = require('../ai/devCore');
const { appendErrorLog, readErrorLogs } = require('../ai/errorLogger');
const { analyzeErrorLogs } = require('../ai/errorAnalyzer');
const { selfHealError } = require('../ai/selfHealer');
const { buildSystemArchitectureMap } = require('../core/architectureMap');
const { readRegistry } = require('../core/moduleRegistry');
const { analyzeUIScreens } = require('../ai/uiAnalyzer');
const { generateFeatureRoadmap } = require('../ai/featureRoadmapGenerator');
const { analyzeRuntime } = require('../ai/systemHealthAnalyzer');
const { generateSystemDiagnosticReport } = require('../ai/systemDiagnostics');
const { SUPER_COPILOT_PROMPT } = require('../ai/copilotSuperPrompt');
const {
  generateCompleteModule,
  generateCompletePages,
  runArchitectFullScan,
} = require('../ai/saasArchitectEngine');
const { generateAutoReply } = require('../config/ai');
const aiIntelligenceService = require('../services/aiIntelligenceService');
const { processAI, testAIConnection, testProviderConnection } = require('../services/ai.service');
const aiLogService = require('../services/aiLogService');


function getStore(req) {
  return req.app.locals.store;
}

const FAST_FALLBACK_TIMEOUT_MS = Math.max(Number(process.env.API_FALLBACK_TIMEOUT_MS) || 2500, 500);

async function runWithFastFallback(work, fallbackValue) {
  let timer = null;

  try {
    return await Promise.race([
      Promise.resolve()
        .then(work)
        .then((value) => ({
          degraded: false,
          fallback: 'none',
          value,
          warning: null,
        })),
      new Promise((resolve) => {
        timer = setTimeout(() => {
          resolve({
            degraded: true,
            fallback: 'timeout',
            value: fallbackValue,
            warning: 'Operation exceeded the fast-path timeout. Returned fallback state.',
          });
        }, FAST_FALLBACK_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    return {
      degraded: true,
      fallback: 'error',
      value: fallbackValue,
      warning: error?.message || String(error),
    };
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

async function enable(req, res) {
  const result = await runWithFastFallback(() => enableAI(), true);
  return res.status(200).json({
    ai: Boolean(result.value),
    degraded: result.degraded,
    fallback: result.fallback,
    warning: result.warning,
  });
}

async function disable(req, res) {
  const result = await runWithFastFallback(() => disableAI(), false);
  return res.status(200).json({
    ai: Boolean(result.value),
    degraded: result.degraded,
    fallback: result.fallback,
    warning: result.warning,
  });
}

async function toggle(req, res) {
  const enabled = req.body?.aiEnabled;

  if (typeof enabled !== 'boolean') {
    return res.status(400).json({
      error: 'The field aiEnabled must be boolean.',
    });
  }

  const result = await runWithFastFallback(() => setAIEnabled(enabled), enabled);
  return res.status(200).json({
    ai: Boolean(result.value),
    degraded: result.degraded,
    fallback: result.fallback,
    warning: result.warning,
  });
}

async function status(req, res) {
  try {
    const aiService = require('../services/ai.service');
    const companyId = req.headers['x-company-id'] || req.headers['x-tenant-id'] || req.auth?.tenantId || 'default';
    const store = req.app.locals.store;
    const integration = await aiService.getAIIntegrationStatus(store, companyId);
    const active = isAIEnabled() && integration.aiOn;
    const isGlobalEnabled = isAIEnabled();
    
    return res.status(200).json({
      ai: isGlobalEnabled,
      enabled: isGlobalEnabled,
      active: active,
      status: isGlobalEnabled ? 'on' : 'off',
      ...integration
    });
  } catch (err) {
    console.error('[aiController] status failed:', err);
    return res.status(500).json({ error: err.message });
  }
}

async function getAiLogs(req, res) {
  try {
    const store = getStore(req);
    const logs = await aiLogService.getLogs(store);
    return res.status(200).json({ logs });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to fetch AI logs.' });
  }
}

async function getAiMetrics(req, res) {
  try {
    const store = getStore(req);
    const metrics = await aiLogService.getMetrics(store);
    return res.status(200).json(metrics);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to fetch AI metrics.' });
  }
}

async function testReply(req, res) {
  try {
    const store = getStore(req);
    const result = await testAIConnection({
      store,
      providerId: req.body?.providerId,
      model: req.body?.model,
      message: req.body?.message,
      prompt: req.body?.prompt,
      agentKey: req.body?.agentKey,
      agentName: req.body?.agentName,
    });

    return res.status(200).json({
      success: Boolean(result.ok),
      result,
      error: result.ok ? null : result.error || 'AI test failed.',
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || 'AI test failed.' });
  }
}

async function testProviders(req, res) {
  try {
    const store = getStore(req);
    const configuredProviders = store?.aiConfig?.advancedAISettings?.providers || [];
    const providerIds = ['openai', 'gemini', 'claude', 'groq'];
    const results = await Promise.all(providerIds.map(async (providerId) => {
      const provider = configuredProviders.find((item) => String(item.id).toLowerCase() === providerId);
      if (!provider) {
        return {
          ok: false,
          provider: providerId,
          status: 'error',
          error: 'Provider nao configurado.',
        };
      }
      return testProviderConnection(provider, {
        message: 'Responda apenas OK.',
        prompt: 'Teste tecnico de conectividade.',
      });
    }));

    return res.status(200).json({ success: true, results });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || 'Provider test failed.' });
  }
}


async function learningDashboard(req, res) {
  return res.status(200).json(aiLearningEngine.buildDashboard(getStore(req)));
}

async function runLearningAnalysis(req, res) {
  const result = await aiLearningEngine.analyzeAndStore(getStore(req));
  return res.status(200).json(result);
}

async function applyLearningSuggestion(req, res) {
  const { id } = req.params;
  const store = getStore(req);
  const suggestion = (store.aiLearningLogs || []).find((log) => log.id === id);

  if (!suggestion) {
    return res.status(404).json({ error: 'Suggestion not found.' });
  }

  const promptVersion = await applyPromptImprovement(
    store,
    suggestion.suggestedImprovement.suggestedPromptImprovement,
    `Applied suggestion ${id}`
  );

  suggestion.status = 'applied';
  suggestion.appliedAt = new Date().toISOString();

  if (typeof store.saveAiState === 'function') {
    await store.saveAiState();
  }

  return res.status(200).json({
    promptVersion,
    suggestion,
  });
}

async function editLearningSuggestion(req, res) {
  const { id } = req.params;
  const { suggestedNewFlow, suggestedPromptImprovement, suggestedResponse } = req.body || {};
  const store = getStore(req);
  const suggestion = (store.aiLearningLogs || []).find((log) => log.id === id);

  if (!suggestion) {
    return res.status(404).json({ error: 'Suggestion not found.' });
  }

  suggestion.suggestedImprovement = {
    ...suggestion.suggestedImprovement,
    ...(suggestedNewFlow ? { suggestedNewFlow } : {}),
    ...(suggestedPromptImprovement ? { suggestedPromptImprovement } : {}),
    ...(suggestedResponse ? { suggestedResponse } : {}),
  };
  suggestion.status = 'edited';

  if (typeof store.saveAiState === 'function') {
    await store.saveAiState();
  }

  return res.status(200).json(suggestion);
}

async function ignoreLearningSuggestion(req, res) {
  const { id } = req.params;
  const store = getStore(req);
  const suggestion = (store.aiLearningLogs || []).find((log) => log.id === id);

  if (!suggestion) {
    return res.status(404).json({ error: 'Suggestion not found.' });
  }

  suggestion.status = 'ignored';

  if (typeof store.saveAiState === 'function') {
    await store.saveAiState();
  }

  return res.status(200).json(suggestion);
}

function getPrompt(req, res) {
  const store = getStore(req);
  const prompt = getActivePrompt(store);
  const versions = getPromptHistory(store);
  return res.status(200).json({ prompt, versions });
}

async function savePrompt(req, res) {
  const { prompt } = req.body || {};

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'The field prompt is required.' });
  }

  const store = getStore(req);

  try {
    const version = await updateActivePrompt(store, prompt.trim(), 'Manual save');
    return res.status(200).json({ success: true, version });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to save prompt.' });
  }
}

async function reply(req, res) {
  try {
    const store = getStore(req);
    const phone = String(req.body?.phone || '').trim();
    const text = String(req.body?.text || req.body?.message || '').trim();
    const name = String(req.body?.name || '').trim() || phone || 'Contato';
    const contextualHistory = Array.isArray(req.body?.history) ? req.body.history : [];

    if (!text) {
      return res.status(400).json({ error: 'The field text is required.' });
    }

    const openAiContext =
      aiIntelligenceService.getOpenAIContextForContact(store, phone) || {
        contactId: phone,
        history: contextualHistory,
        intent: 'information',
        name,
        phone,
        prefersAudio: false,
        sentiment: 'neutral',
        summary: '',
        tags: [],
      };

    const openAiReply = await generateAutoReply(store, {
      context: openAiContext,
      name,
      phone,
      text,
    }).catch(() => null);

    if (openAiReply) {
      return res.status(200).json({
        provider: 'openai',
        reply: openAiReply,
      });
    }

    const aiEngineResponse = await processAI({
      contact: { name, phone },
      history: contextualHistory,
      message: text,
      store,
    });

    if (aiEngineResponse?.reply) {
      return res.status(200).json({
        intent: aiEngineResponse.intent,
        leadScore: aiEngineResponse.leadScore,
        provider: 'ai-engine',
        reply: aiEngineResponse.reply,
        suggestion: aiEngineResponse.suggestion || null,
      });
    }

    return res.status(503).json({
      error: 'No AI provider is currently available.',
      provider: 'fallback',
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'AI reply failed.' });
  }
}

function promptHistory(req, res) {
  return res.status(200).json(getPromptHistory(getStore(req)));
}

async function projectAnalyze(req, res) {
  try {
    const autoCreateMissingPages = req.query?.autoCreateMissingPages !== 'false';
    const analysis = await analyzeProject({ autoCreateMissingPages });
    return res.status(200).json(analysis);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Project analysis failed.' });
  }
}

async function architectureMap(req, res) {
  try {
    const map = await buildSystemArchitectureMap();
    return res.status(200).json(map);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to build architecture map.' });
  }
}

async function uiAnalyze(req, res) {
  try {
    const pageName = String(req.query?.pageName || '').trim();
    const result = await analyzeUIScreens({ pageName });
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'UI analysis failed.' });
  }
}

async function featureRoadmap(req, res) {
  try {
    const roadmap = await generateFeatureRoadmap();
    return res.status(200).json(roadmap);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Feature roadmap generation failed.' });
  }
}

async function architectFullScan(req, res) {
  try {
    const autoCreateMissingPages = req.query?.autoCreateMissingPages === 'true';
    const pageName = String(req.query?.pageName || '').trim();

    const report = await runArchitectFullScan({
      autoCreateMissingPages,
      pageName,
    });

    return res.status(200).json(report);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Architect full scan failed.' });
  }
}

function copilotSuperPrompt(req, res) {
  return res.status(200).json({
    prompt: SUPER_COPILOT_PROMPT,
    suggestedUsage: {
      role: 'AI Software Architect and Senior Fullstack Engineer',
      flow: [
        'Analyze full project',
        'Build project map',
        'Detect issues',
        'Generate roadmap',
        'Generate complete feature modules',
        'Run smoke/API/UI validations',
      ],
    },
  });
}

async function generateFullstackModule(req, res) {
  try {
    const moduleName = String(req.body?.moduleName || req.body?.module || '').trim();

    if (!moduleName) {
      return res.status(400).json({ error: 'moduleName is required.' });
    }

    const runTests = req.body?.runTests !== false;
    const result = await generateCompleteModule({
      moduleName,
      app: req.app,
      runTests,
    });

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Fullstack module generation failed.' });
  }
}

async function generateFullPages(req, res) {
  try {
    const pageNames = Array.isArray(req.body?.pageNames) ? req.body.pageNames : [];
    const templatePage = String(req.body?.templatePage || 'Inbox').trim() || 'Inbox';
    const runTests = req.body?.runTests === true;

    if (pageNames.length === 0) {
      return res.status(400).json({ error: 'pageNames must be a non-empty array.' });
    }

    const result = await generateCompletePages({
      app: req.app,
      pageNames,
      runTests,
      templatePage,
    });

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Full page generation failed.' });
  }
}

async function systemHealth(req, res) {
  try {
    const autoRecover = req.query?.autoRecover !== 'false';
    const result = await analyzeRuntime({ app: req.app, autoRecover });
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'System health analysis failed.' });
  }
}

async function systemDiagnostics(req, res) {
  try {
    const autoRecover = req.query?.autoRecover !== 'false';
    const report = await generateSystemDiagnosticReport({ app: req.app, autoRecover });
    return res.status(200).json(report);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'System diagnostics failed.' });
  }
}

async function systemStatus(req, res) {
  try {
    const autoRecover = req.query?.autoRecover !== 'false';
    const runtime = await analyzeRuntime({ app: req.app, autoRecover });
    const backendStatus = runtime.backendStatus || 'offline';
    const frontendStatus = runtime.frontendStatus || 'offline';
    const whatsappConnection = runtime.whatsappStatus || 'disconnected';
    const aiModules = runtime.aiModulesStatus || 'unknown';
    const warnings = runtime.warnings || [];
    const errors = runtime.errors || [];

    return res.status(200).json({
      system: backendStatus === 'online' && frontendStatus === 'online' ? 'online' : 'degraded',
      frontend: frontendStatus,
      backend: backendStatus,
      whatsapp: whatsappConnection,
      aiModules,
      warnings,
      errors,
      lastErrors: errors,
      backendStatus,
      frontendStatus,
      whatsappConnection,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'System status failed.' });
  }
}

async function systemRegistry(req, res) {
  try {
    const registry = await readRegistry();
    return res.status(200).json(registry);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to load system registry.' });
  }
}

async function projectStatus(req, res) {
  try {
    const autoCreateRun = await analyzeProject({ autoCreateMissingPages: true });
    const latest = await analyzeProject({ autoCreateMissingPages: false });
    const { pipeline } = await devPipeline.refreshPipeline({ autoCreateMissingPages: false });

    return res.status(200).json({
      pagesCreated: (autoCreateRun.autoCreatedPages || []).length,
      pagesMissing: latest.missingPages,
      apisMissing: latest.missingApis,
      unusedFiles: latest.unusedFiles || [],
      pipelineTasks: pipeline,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to build project status.' });
  }
}

async function pipelineRefresh(req, res) {
  try {
    const autoCreateMissingPages = req.query?.autoCreateMissingPages === 'true';
    const result = await devPipeline.refreshPipeline({ autoCreateMissingPages });
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to refresh pipeline.' });
  }
}

function pipelineList(req, res) {
  return res.status(200).json({ pipeline: devPipeline.listPipeline() });
}

async function replicateProjectPage(req, res) {
  try {
    const { templatePage, newPageName } = req.body || {};
    if (!templatePage || !newPageName) {
      return res.status(400).json({ error: 'templatePage and newPageName are required.' });
    }

    const result = await replicatePage(templatePage, newPageName);
    await devPipeline.refreshPipeline({ autoCreateMissingPages: false });
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to replicate page.' });
  }
}

async function generateProjectPages(req, res) {
  try {
    const { pageNames, templatePage } = req.body || {};
    if (!Array.isArray(pageNames) || pageNames.length === 0) {
      return res.status(400).json({ error: 'pageNames must be a non-empty array.' });
    }

    const results = await generatePages(pageNames, { templatePage: templatePage || 'Inbox' });
    await devPipeline.refreshPipeline({ autoCreateMissingPages: false });
    return res.status(200).json({ results });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to generate pages.' });
  }
}

async function analyzeProjectDoc(req, res) {
  try {
    const { filePath } = req.body || {};
    if (!filePath) {
      return res.status(400).json({ error: 'filePath is required.' });
    }

    const result = await analyzeDoc(filePath);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to analyze DOCX.' });
  }
}

async function assistantChat(req, res) {
  try {
    const { question } = req.body || {};
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'question is required.' });
    }

    const result = await answerQuestion(question);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Assistant failed to answer.' });
  }
}

async function codeCuration(req, res) {
  try {
    const result = await curateCodebase({ autoCreateMissingPages: false });
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Code curation failed.' });
  }
}

async function runAITests(req, res) {
  try {
    const { runAllTests } = require('../tests/testRunner');
    const report = await runAllTests({
      app: req.app,
      autoFix: req.body?.autoFix !== false,
    });

    return res.status(200).json(report);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to execute AI test runner.' });
  }
}

async function logFrontendError(req, res) {
  try {
    const { error, page, stack, timestamp } = req.body || {};

    if (!error) {
      return res.status(400).json({ error: 'error field is required.' });
    }

    const entry = await appendErrorLog({
      error,
      page,
      stack,
      timestamp,
    });

    const selfHealing = await selfHealError(entry, { app: req.app });

    return res.status(200).json({
      success: true,
      logged: entry,
      analysis: selfHealing.analysis,
      fixesApplied: selfHealing.fixesApplied,
      testReport: selfHealing.testReport,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to log frontend error.' });
  }
}

async function getFrontendErrorLogs(req, res) {
  try {
    const limit = Number(req.query?.limit) || 30;
    const errors = await readErrorLogs(limit);
    const analysis = analyzeErrorLogs(errors);

    return res.status(200).json({
      errors,
      analysis,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to read frontend error logs.' });
  }
}

async function createFeature(req, res) {
  try {
    const feature = String(req.body?.feature || '').trim();

    if (!feature) {
      return res.status(400).json({ error: 'feature is required.' });
    }

    const result = await generateFeature(feature);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to generate feature.' });
  }
}

async function createModule(req, res) {
  try {
    const moduleName = String(req.body?.moduleName || req.body?.module || '').trim();

    if (!moduleName) {
      return res.status(400).json({ error: 'moduleName is required.' });
    }

    const result = await createModuleFromFeatureEngine(moduleName);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to generate module.' });
  }
}

async function runDevCoreTask(req, res) {
  try {
    const task = String(req.body?.task || '').trim();
    const payload = req.body?.payload || {};

    if (!task) {
      return res.status(400).json({ error: 'task is required.' });
    }

    const result = await devCore.runTask(task, payload);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Dev Core task failed.' });
  }
}

async function fixSystemIssues(req, res) {
  try {
    const fixedImports = await devCore.fixBrokenImports();
    const analysis = await devCore.analyzeProjectCore();

    return res.status(200).json({
      fixedImports,
      analysis,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to fix system issues.' });
  }
}

async function assistantCommand(req, res) {
  try {
    const command = String(req.body?.command || '').trim();
    if (!command) {
      return res.status(400).json({ error: 'command is required.' });
    }

    const result = await runAssistantCommand(command, {
      source: 'api',
      userId: req.body?.userId,
    });
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Assistant command failed.' });
  }
}

module.exports = {
  architectFullScan,
  assistantChat,
  applyLearningSuggestion,
  architectureMap,
  copilotSuperPrompt,
  systemHealth,
  systemDiagnostics,
  systemStatus,
  uiAnalyze,
  featureRoadmap,
  analyzeProjectDoc,
  codeCuration,
  createModule,
  createFeature,
  disable,
  editLearningSuggestion,
  enable,
  generateProjectPages,
  getFrontendErrorLogs,
  getPrompt,
  systemRegistry,
  ignoreLearningSuggestion,
  learningDashboard,
  logFrontendError,
  assistantCommand,
  runDevCoreTask,
  fixSystemIssues,
  generateFullPages,
  generateFullstackModule,
  pipelineList,
  pipelineRefresh,
  projectAnalyze,
  projectStatus,
  promptHistory,
  reply,
  replicateProjectPage,
  runAITests,
  runLearningAnalysis,
  savePrompt,
  status,
  toggle,
  getAiLogs,
  getAiMetrics,
  testReply,
  testProviders,
};
