const aiIntelligenceService = require('../services/aiIntelligenceService');

function getStore(req) {
  return req.app.locals.store;
}

async function getPanel(req, res) {
  const store = getStore(req);
  const shouldWarmup = req.query?.warmup === 'true';

  try {
    if (shouldWarmup && !store.aiIntelligence?.lastAnalyzedAt) {
      const panel = await aiIntelligenceService.runFullAnalysis({
        app: req.app,
        store,
        generateDocs: false,
      });
      return res.status(200).json(panel);
    }

    return res.status(200).json(aiIntelligenceService.buildPanelData(store));
  } catch (error) {
    return res.status(200).json({
      degraded: true,
      error: error.message || 'Failed to load AI intelligence panel.',
      ...aiIntelligenceService.buildPanelData(store),
    });
  }
}

async function analyze(req, res) {
  try {
    const generateDocs = req.body?.generateDocs !== false;
    const panel = await aiIntelligenceService.runFullAnalysis({
      app: req.app,
      store: getStore(req),
      generateDocs,
    });

    return res.status(200).json(panel);
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'AI intelligence analysis failed.',
    });
  }
}

function listMemory(req, res) {
  return res.status(200).json(aiIntelligenceService.listConversationMemory(getStore(req)));
}

function getMemory(req, res) {
  const memory = aiIntelligenceService.getConversationMemory(getStore(req), req.params.contactId);

  if (!memory) {
    return res.status(404).json({
      error: 'Conversation memory not found.',
    });
  }

  return res.status(200).json(memory);
}

function listImprovements(req, res) {
  return res.status(200).json(aiIntelligenceService.buildPanelData(getStore(req)).improvements || []);
}

async function approveImprovement(req, res) {
  const improvement = await aiIntelligenceService.updateImprovementStatus(
    getStore(req),
    req.params.id,
    'approved'
  );

  if (!improvement) {
    return res.status(404).json({
      error: 'Improvement not found.',
    });
  }

  return res.status(200).json(improvement);
}

async function markImprovementApplied(req, res) {
  const improvement = await aiIntelligenceService.updateImprovementStatus(
    getStore(req),
    req.params.id,
    'applied'
  );

  if (!improvement) {
    return res.status(404).json({
      error: 'Improvement not found.',
    });
  }

  return res.status(200).json(improvement);
}

async function ignoreImprovement(req, res) {
  const improvement = await aiIntelligenceService.updateImprovementStatus(
    getStore(req),
    req.params.id,
    'ignored'
  );

  if (!improvement) {
    return res.status(404).json({
      error: 'Improvement not found.',
    });
  }

  return res.status(200).json(improvement);
}

async function refreshDocs(req, res) {
  try {
    const panel = await aiIntelligenceService.runFullAnalysis({
      app: req.app,
      store: getStore(req),
      generateDocs: true,
    });

    return res.status(200).json({
      docs: panel.docs,
      generatedAt: panel.generatedAt,
      success: true,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Failed to refresh AI intelligence docs.',
    });
  }
}

module.exports = {
  analyze,
  approveImprovement,
  getMemory,
  getPanel,
  ignoreImprovement,
  listImprovements,
  listMemory,
  markImprovementApplied,
  refreshDocs,
};
