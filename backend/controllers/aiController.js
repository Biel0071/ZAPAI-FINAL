const {
  enableAI,
  disableAI,
  getAIEnabled,
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
const { getCompanyId } = require('../services/tenantContext');

// DB query helper — used by getAgentEvolution and similar direct-query functions
async function dbQuery(sql, params) {
  try {
    const { query } = require('../config/database');
    if (typeof query === 'function') {
      return query(sql, params);
    }
    const { pool } = require('../config/database');
    if (pool && typeof pool.query === 'function') {
      return pool.query(sql, params);
    }
  } catch { /* ignore */ }
  return { rows: [] };
}


function getStore(req) {
  return req.app.locals.store;
}

async function enable(req, res) {
  const tenantId = getCompanyId(req);
  try {
    const enabled = await enableAI(tenantId);
    return res.status(200).json({ ai: enabled, enabled, tenantId });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to enable AI.', tenantId });
  }
}

async function disable(req, res) {
  const tenantId = getCompanyId(req);
  try {
    const enabled = await disableAI(tenantId);
    return res.status(200).json({ ai: enabled, enabled, tenantId });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to disable AI.', tenantId });
  }
}

async function toggle(req, res) {
  const enabled = req.body?.aiEnabled;
  const tenantId = getCompanyId(req);

  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'The field aiEnabled must be boolean.' });
  }

  try {
    const persisted = await setAIEnabled(enabled, tenantId);
    return res.status(200).json({ ai: persisted, enabled: persisted, tenantId });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to update AI status.', tenantId });
  }
}

async function status(req, res) {
  try {
    const aiService = require('../services/ai.service');
    const tenantId = getCompanyId(req);
    const store = req.app.locals.store;
    const [enabled, integration] = await Promise.all([
      getAIEnabled(tenantId),
      aiService.getAIIntegrationStatus(store, tenantId),
    ]);
    const active = enabled && integration.aiOn;

    return res.status(200).json({
      ...integration,
      ai: enabled,
      enabled,
      active,
      status: enabled ? 'on' : 'off',
      tenantId,
    });
  } catch (error) {
    console.error('[aiController] status failed:', error);
    return res.status(500).json({ error: error.message });
  }
}

async function getAiLogs(req, res) {
  try {
    const store = getStore(req);
    const sessionId = req.query.sessionId || req.query.session_id || null;
    const logs = await aiLogService.getLogs(store, sessionId);
    return res.status(200).json({ logs });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to fetch AI logs.' });
  }
}

async function getAiMetrics(req, res) {
  try {
    const store = getStore(req);
    const sessionId = req.query.sessionId || req.query.session_id || null;
    const metrics = await aiLogService.getMetrics(store, sessionId);
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
      temperature: req.body?.temperature,
      responseStyle: req.body?.responseStyle,
      history: req.body?.history,
      maxWords: req.body?.maxWords,
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

async function refinePrompt(req, res) {
  try {
    const store = getStore(req);
    const { currentPrompt, instruction } = req.body;
    
    if (!instruction) {
      return res.status(400).json({ success: false, error: 'Instruções de refinamento vazias.' });
    }

    const { refineAgentPrompt } = require('../services/ai.service');
    const refined = await refineAgentPrompt({
      store,
      currentPrompt,
      instruction,
      companyId: store?.activeCompanyId || 'default',
    });

    return res.status(200).json({
      success: true,
      refinedPrompt: refined,
    });
  } catch (error) {
    console.error('[AI CONTROLLER] refinePrompt failed:', error.message);
    return res.status(500).json({ success: false, error: error.message || 'Erro ao refinar prompt.' });
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

async function testVoice(req, res) {
  try {
    const { text, voiceId, companyId } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required for voice testing.' });
    }
    if (!voiceId) {
      return res.status(400).json({ error: 'Voice ID is required.' });
    }

    const audioGenerationService = require('../services/audioGenerationService');
    const resolvedCompanyId = companyId || 'default';
    
    // Fetch default settings to get the Elevenlabs api key
    let dbSettings = null;
    try {
      dbSettings = await audioGenerationService.getVoiceSettingsFromDb(resolvedCompanyId);
    } catch (e) {
      console.warn('[VOICE_TEST] Could not load DB voice settings:', e.message);
    }

    const apiKey = dbSettings?.apiKey || process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: 'ElevenLabs API Key not configured. Please configure ElevenLabs integration in provider settings.' });
    }

    const customVoiceSettings = {
      apiKey,
      voiceId,
      model: dbSettings?.model || 'eleven_multilingual_v2',
      stability: dbSettings?.stability ?? 0.5,
      similarityBoost: dbSettings?.similarityBoost ?? 0.75,
      style: dbSettings?.style ?? 0.0,
      useSpeakerBoost: dbSettings?.useSpeakerBoost ?? true,
    };

    const result = await audioGenerationService.generateVoice({
      text,
      companyId: resolvedCompanyId,
      customVoiceSettings,
    });

    res.json({
      success: true,
      url: result.url,
    });
  } catch (err) {
    console.error('[VOICE_TEST_ERROR]', err);
    res.status(500).json({ error: err.message });
  }
}

async function transcribe(req, res) {
  try {
    const { mediaUrl } = req.body;
    if (!mediaUrl) {
      return res.status(400).json({ error: 'URL do áudio não informada.' });
    }
    const companyId = req.headers['x-company-id'] || req.headers['x-tenant-id'] || req.auth?.tenantId || req.body.companyId || 'default';
    const { transcribeAudio } = require('../services/ai.service');
    const text = await transcribeAudio({ mediaUrl, companyId });
    return res.json({ text });
  } catch (error) {
    console.error('[Transcription Controller] Error:', error.message);
    return res.status(500).json({ error: error.message || 'Erro durante a transcrição do áudio.' });
  }
}

async function evolveAgent(req, res) {
  try {
    const { agentKey, instruction, apply = false, changes = null, sourceDescription = null } = req.body;
    const store = req.app.locals.store;
    const companyId = req.headers['x-company-id'] || req.headers['x-tenant-id'] || req.auth?.tenantId || 'default';
    
    const agentEvolutionService = require('../services/agentEvolutionService');
    
    if (apply && changes) {
      const updated = await agentEvolutionService.applyAgentChanges(
        agentKey,
        changes,
        sourceDescription || 'Ajuste via Prompt',
        'prompt_refinement',
        companyId
      );
      return res.json({ success: true, agent: updated });
    }
    
    if (!instruction) {
      return res.status(400).json({ error: 'Instrução do prompt é obrigatória.' });
    }
    
    const preview = await agentEvolutionService.refineWholeAgent(
      agentKey,
      instruction,
      store,
      companyId
    );
    
    return res.json({ success: true, preview });
  } catch (err) {
    console.error('[evolveAgent_error]', err);
    res.status(500).json({ error: err.message });
  }
}

async function getAgentLearning(req, res) {
  try {
    const { key } = req.params;
    const companyId = req.headers['x-company-id'] || req.headers['x-tenant-id'] || req.auth?.tenantId || 'default';
    const agentLearningRepo = require('../repositories/agentLearningRepository');
    
    const pending = await agentLearningRepo.getPendingEvents(key, companyId, 50);
    const stats = await agentLearningRepo.getEventStats(key, companyId);
    
    res.json({ success: true, pending, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function answerLearningEvent(req, res) {
  try {
    const { id } = req.params;
    const { answer } = req.body;
    if (!answer) {
      return res.status(400).json({ error: 'A resposta é obrigatória.' });
    }
    const agentLearningRepo = require('../repositories/agentLearningRepository');
    const updated = await agentLearningRepo.answerEvent(id, answer);
    res.json({ success: true, event: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function applyLearningAnswer(req, res) {
  try {
    const { id } = req.params;
    const store = req.app.locals.store;
    const companyId = req.headers['x-company-id'] || req.headers['x-tenant-id'] || req.auth?.tenantId || 'default';
    
    const agentEvolutionService = require('../services/agentEvolutionService');
    const result = await agentEvolutionService.learnFromAnswer(id, req.body.answer || '', store, companyId);
    
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[applyLearningAnswer_error]', err);
    res.status(500).json({ error: err.message });
  }
}

async function ignoreLearningEvent(req, res) {
  try {
    const { id } = req.params;
    const agentLearningRepo = require('../repositories/agentLearningRepository');
    const updated = await agentLearningRepo.ignoreEvent(id);
    res.json({ success: true, event: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getAgentEvolution(req, res) {
  try {
    const { key } = req.params;
    const companyId = req.headers['x-company-id'] || req.headers['x-tenant-id'] || req.auth?.tenantId || 'default';
    const agentLearningRepo = require('../repositories/agentLearningRepository');
    const agentMemoryGraphService = require('../services/agentMemoryGraphService');
    
    await agentMemoryGraphService.bootstrapAgentMemoryGraph({ agentKey: key, agentName: key, companyId }).catch(() => {});

    const [history, stats, appliedEvents, graphSnapshot] = await Promise.all([
      agentLearningRepo.getEvolutionHistory(key, companyId, 30),
      agentLearningRepo.getEventStats(key, companyId),
      agentLearningRepo.getRecentAppliedEvents(key, companyId, 12),
      agentMemoryGraphService.getGraphSnapshot(key, companyId).catch(() => ({
        nodes: [],
        edges: [],
        stats: { episodes: 0, concepts: 0, contacts: 0 },
      })),
    ]);

    const fieldCounts = new Map();
    for (const log of history) {
      let fields = log.fields_changed || {};
      if (typeof fields === 'string') {
        try { fields = JSON.parse(fields); } catch { fields = {}; }
      }
      for (const field of Object.keys(fields || {})) {
        fieldCounts.set(field, (fieldCounts.get(field) || 0) + 1);
      }
    }
    for (const event of appliedEvents) {
      const field = event.applied_to_field || 'memory';
      fieldCounts.set(field, (fieldCounts.get(field) || 0) + 1);
    }

    const appliedCount = Number(stats.applied || 0);
    const pendingCount = Number(stats.pending || 0);
    const learnedConcepts = Number(graphSnapshot.stats?.concepts || 0);

    // Query real qualified conversations (at least 3 messages exchanged in real customer service back-and-forth)
    const qualifiedRes = await dbQuery(`
      SELECT COUNT(*)::int AS count FROM (
        SELECT conv.id
        FROM conversations conv
        JOIN messages m ON m.conversation_id = conv.id
        WHERE conv.company_id = $1 AND (LOWER(COALESCE(conv.agent_name, $2)) = LOWER($2))
        GROUP BY conv.id
        HAVING COUNT(m.id) >= 3
      ) qualified_convs
    `, [companyId, key]).catch(() => ({ rows: [{ count: 0 }] }));

    const dbQualifiedCount = Number(qualifiedRes.rows[0]?.count || 0);
    const episodeCount = Number(graphSnapshot.stats?.episodes || 0);
    const qualifiedConversations = Math.max(dbQualifiedCount, episodeCount);

    // Exact Level Tier Rules (Nível 1 a 10) with resetting level goals & doubled progression
    const LEVEL_TIERS = [
      { level: 1, title: 'Iniciante', min: 0, cumTarget: 10, targetNew: 10 },
      { level: 2, title: 'Intermediário', min: 10, cumTarget: 40, targetNew: 30 },
      { level: 3, title: 'Avançado', min: 40, cumTarget: 140, targetNew: 100 },
      { level: 4, title: 'Especialista', min: 140, cumTarget: 340, targetNew: 200 },
      { level: 5, title: 'Mestre IA', min: 340, cumTarget: 740, targetNew: 400 },
      { level: 6, title: 'Guardião IA', min: 740, cumTarget: 1540, targetNew: 800 },
      { level: 7, title: 'Estrategista IA', min: 1540, cumTarget: 3140, targetNew: 1600 },
      { level: 8, title: 'Arquiteto IA', min: 3140, cumTarget: 6340, targetNew: 3200 },
      { level: 9, title: 'Oráculo IA', min: 6340, cumTarget: 12740, targetNew: 6400 },
      { level: 10, title: 'Sábio Supremo', min: 12740, cumTarget: 25540, targetNew: 12800 },
    ];

    let matchedTier = LEVEL_TIERS[0];
    for (const tier of LEVEL_TIERS) {
      if (qualifiedConversations >= tier.min) {
        matchedTier = tier;
      }
    }

    const currentInLevel = Math.max(0, qualifiedConversations - matchedTier.min);
    const targetInLevel = matchedTier.targetNew;
    const percentageInLevel = Math.min(100, Math.round((currentInLevel / Math.max(1, targetInLevel)) * 100));

    const level = `Nível ${matchedTier.level} (${matchedTier.title})`;
    const currentGoalProgress = currentInLevel;
    const targetGoal = targetInLevel;

    const answerPoints = Math.round(Math.min(qualifiedConversations / 100, 1) * 40);
    const refinementPoints = Math.round(Math.min((history.length + appliedCount) / 20, 1) * 30);
    const coveragePoints = Math.round(Math.min((fieldCounts.size + learnedConcepts) / 20, 1) * 20);
    const hasLearningActivity = qualifiedConversations > 0 || appliedCount > 0 || history.length > 0;
    const queuePoints = hasLearningActivity ? (pendingCount === 0 ? 10 : Math.max(0, 10 - pendingCount)) : 0;
    const score = Math.min(100, Math.max(5, answerPoints + refinementPoints + coveragePoints + queuePoints));

    const rootId = `agent:${key}`;
    const nodes = [{ id: rootId, type: 'agent', label: key, weight: Math.max(1, history.length) }];
    const edges = [];
    const fieldNames = [...fieldCounts.keys()].slice(0, 8);
    for (const field of fieldNames) {
      const fieldId = `field:${field}`;
      nodes.push({ id: fieldId, type: 'field', label: field, weight: fieldCounts.get(field) });
      edges.push({ source: rootId, target: fieldId, relation: 'aprendeu' });
    }
    for (const event of appliedEvents.slice(0, 8)) {
      const field = event.applied_to_field || 'memory';
      const fieldId = `field:${field}`;
      if (!nodes.some((node) => node.id === fieldId)) {
        nodes.push({ id: fieldId, type: 'field', label: field, weight: 1 });
        edges.push({ source: rootId, target: fieldId, relation: 'aprendeu' });
      }
      const lessonId = `lesson:${event.id}`;
      const lessonLabel = String(event.customer_question || 'Resposta ensinada').slice(0, 72);
      nodes.push({ id: lessonId, type: 'lesson', label: lessonLabel, weight: 1 });
      edges.push({ source: fieldId, target: lessonId, relation: 'responde' });
    }

    if (graphSnapshot.nodes.length > 0) {
      for (const snapshotNode of graphSnapshot.nodes) {
        if (!nodes.some((n) => n.id === snapshotNode.id)) {
          nodes.push(snapshotNode);
        }
      }
      for (const snapshotEdge of graphSnapshot.edges) {
        if (!edges.some((e) => e.source === snapshotEdge.source && e.target === snapshotEdge.target && e.relation === snapshotEdge.relation)) {
          edges.push(snapshotEdge);
        }
      }
      for (const node of graphSnapshot.nodes.filter((item) => ['contact', 'concept'].includes(item.type)).slice(0, 12)) {
        if (!edges.some((e) => e.source === rootId && e.target === node.id)) {
          edges.push({ source: rootId, target: node.id, relation: node.type === 'contact' ? 'atendeu' : 'aprendeu' });
        }
      }
    }

    res.json({
      success: true,
      history,
      stats: { ...stats, qualifiedConversations },
      evolution: {
        score,
        level,
        goal: {
          current: currentGoalProgress,
          target: targetGoal,
          percentage: percentageInLevel,
        },
        components: { answers: answerPoints, refinements: refinementPoints, coverage: coveragePoints, queue: queuePoints },
      },
      memoryGraph: { nodes, edges },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function detectAgentGaps(req, res) {
  try {
    const { key } = req.params;
    const companyId = req.headers['x-company-id'] || req.headers['x-tenant-id'] || req.auth?.tenantId || 'default';
    const agentEvolutionService = require('../services/agentEvolutionService');
    
    const createdCount = await agentEvolutionService.detectUnansweredQuestions(key, companyId);
    res.json({ success: true, createdCount });
  } catch (err) {
    console.error('[detectAgentGaps_error]', err);
    res.status(500).json({ error: err.message });
  }
}

async function analyzeUploadedMedia(req, res) {
  try {
    const { fileName, fileType, agentName, companyDesc } = req.body;
    const store = req.app.locals.store;
    const { processAI } = require('../services/ai.service');

    const promptText = `Você é um analista técnico de mídias e documentos comerciais. Analise o arquivo "${fileName || 'documento'}" (${fileType || 'arquivo'}) da empresa "${companyDesc || 'Loja'}".
Gerar duas descrições estruturadas em formato JSON:
1. "descricao_ia": Instrução técnica detalhada e regras claras para que um atendente robô de IA saiba exatamente QUANDO e POR QUE enviar este arquivo aos clientes no WhatsApp (ex: quando o cliente pedir tabela de preços, catálogo ou documento oficial).
2. "descricao_humana": Resumo amigável, direto e legível para um operador humano entender o conteúdo do arquivo.

Responda ESTRITAMENTE em formato JSON exato no formato:
{
  "descricao_ia": "...",
  "descricao_humana": "..."
}`;

    const aiRes = await processAI({
      contact: { name: 'Sistema', phone: '00000' },
      history: [],
      message: promptText,
      store,
      agentName: agentName || 'Atendente',
    });

    let resultJson = {
      descricao_ia: `Envie esta mídia (${fileName}) quando o cliente solicitar documentação oficial ou informações sobre ${fileName}.`,
      descricao_humana: `Arquivo ${fileName} cadastrado para envio automático pela IA.`,
    };

    if (aiRes && aiRes.reply) {
      try {
        const clean = aiRes.reply.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(clean);
        if (parsed.descricao_ia) resultJson.descricao_ia = parsed.descricao_ia;
        if (parsed.descricao_humana) resultJson.descricao_humana = parsed.descricao_humana;
      } catch (err) {
        console.warn('[ANALYZE_MEDIA_JSON_PARSE_FALLBACK]', err.message);
      }
    }

    return res.json({ success: true, ...resultJson });
  } catch (error) {
    console.error('[ANALYZE_MEDIA_ERROR]', error);
    return res.status(500).json({ error: error.message });
  }
}

async function generateFollowUpPrompt(req, res) {
  try {
    const { agentName, sector, objective, company, products } = req.body;
    const store = req.app.locals.store;
    const { processAI } = require('../services/ai.service');

    const promptText = `Crie um prompt completo de geração de mensagens de follow-up altamente otimizado para vendas e conversão no WhatsApp.
Dados do atendente:
- Nome: ${agentName || 'Atendente'}
- Setor: ${sector || 'Comercial'}
- Objetivo: ${objective || 'Vender e retomar contatos'}
- Empresa: ${company || 'Loja'}
- Produtos/Serviços: ${products || 'Geral'}

O prompt deve instruir a IA a analisar o histórico da conversa e criar 3 mensagens sequenciais de follow-up amigáveis, sem serem invasivas, com ofertas ou perguntas relevantes para reaquecer o cliente.
Retorne APENAS o texto do prompt formatado e pronto para uso no sistema.`;

    const aiRes = await processAI({
      contact: { name: 'Sistema', phone: '00000' },
      history: [],
      message: promptText,
      store,
      agentName: agentName || 'Atendente',
    });

    const generatedPrompt = aiRes?.reply || `Você é um assistente especializado em criar mensagens de follow-up personalizadas para conversas de WhatsApp, com foco em conversão de vendas para ${company || 'a empresa'}.\n\nSua função é analisar a conversa fornecida e gerar 3 mensagens de follow-up sequenciais, amigáveis e estratégicas.`;

    return res.json({ success: true, prompt: generatedPrompt });
  } catch (error) {
    console.error('[GENERATE_FOLLOWUP_PROMPT_ERROR]', error);
    return res.status(500).json({ error: error.message });
  }
}

async function getExecutiveInsights(req, res) {
  try {
    const aiExecutiveInsightService = require('../services/aiExecutiveInsightService');
    const companyId = req.query?.companyId || req.headers?.['x-company-id'] || 'default';
    const insight = await aiExecutiveInsightService.getLatestInsight(companyId);
    return res.status(200).json({ success: true, data: insight });
  } catch (error) {
    console.error('[AI_CTRL] Error getting executive insights:', error);
    return res.status(500).json({ success: false, error: error.message || 'Erro ao gerar insights de IA' });
  }
}

module.exports = {
  evolveAgent,
  getAgentLearning,
  answerLearningEvent,
  applyLearningAnswer,
  ignoreLearningEvent,
  getAgentEvolution,
  detectAgentGaps,
  transcribe,
  testVoice,
  architectFullScan,
  assistantChat,
  applyLearningSuggestion,
  architectureMap,
  copilotSuperPrompt,
  systemHealth,
  systemDiagnostics,
  systemStatus,
  uiAnalyze,
  getExecutiveInsights,
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
  refinePrompt,
  analyzeUploadedMedia,
  generateFollowUpPrompt,
};
