const aiConfigService = require('../services/aiConfigService');
const aiAgentService = require('../ai-agents/services/aiAgentService');

function getStore(req) {
  return req.app.locals.store;
}

function getBusinessHours(req, res) {
  return res.status(200).json(aiConfigService.getBusinessHoursSettings());
}

function saveBusinessHours(req, res) {
  try {
    const settings = aiConfigService.saveBusinessHoursSettings(req.body || {});
    return res.status(200).json({ success: true, ...settings });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to save business hours.' });
  }
}

function getAbsenceMessage(req, res) {
  return res.status(200).json(aiConfigService.getAbsenceMessageSettings());
}

function saveAbsenceMessage(req, res) {
  try {
    const settings = aiConfigService.saveAbsenceMessageSettings(req.body || {});
    return res.status(200).json({ success: true, ...settings });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to save absence message.' });
  }
}

function getMemory(req, res) {
  return res.status(200).json(aiConfigService.getMemorySettings(getStore(req)));
}

function saveMemory(req, res) {
  try {
    const settings = aiConfigService.saveMemorySettings(getStore(req), req.body || {});
    return res.status(200).json({ success: true, ...settings });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to save memory settings.' });
  }
}

function getAdvancedAI(req, res) {
  return res.status(200).json(aiConfigService.getAdvancedAISettings(getStore(req)));
}

function saveAdvancedAI(req, res) {
  try {
    const settings = aiConfigService.saveAdvancedAISettings(getStore(req), req.body || {});
    return res.status(200).json({ success: true, ...settings });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to save advanced AI settings.' });
  }
}

function getQueue(req, res) {
  return res.status(200).json(aiConfigService.getQueueSettings(getStore(req)));
}

function processQueue(req, res) {
  try {
    const result = aiConfigService.processQueue(getStore(req), req.body || {});
    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to process queue.' });
  }
}

function improve(req, res) {
  try {
    const result = aiConfigService.improveAIResponse(req.body || {});
    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to improve AI response.' });
  }
}

async function getAIAgents(_req, res) {
  try {
    const agents = await aiAgentService.listAgents();
    return res.status(200).json({ agents, success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to load AI agents.' });
  }
}

async function createAIAgent(req, res) {
  try {
    const payload = req.body || {};

    if (!payload?.name) {
      return res.status(400).json({ error: 'name is required.' });
    }

    const agent = await aiAgentService.createAgent(payload);
    return res.status(201).json({ agent, success: true });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to create AI agent.' });
  }
}

async function updateAIAgent(req, res) {
  try {
    const agent = await aiAgentService.updateAgent(req.params?.key, req.body || {});
    return res.status(200).json({ agent, success: true });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to update AI agent.' });
  }
}

async function toggleAIAgent(req, res) {
  try {
    if (typeof req.body?.active !== 'boolean') {
      return res.status(400).json({ error: 'active must be boolean.' });
    }

    const agent = await aiAgentService.setAgentActive(req.params?.key, req.body.active);
    return res.status(200).json({ agent, success: true });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to toggle AI agent.' });
  }
}

module.exports = {
  createAIAgent,
  getAbsenceMessage,
  getAIAgents,
  getAdvancedAI,
  getBusinessHours,
  getMemory,
  getQueue,
  improve,
  processQueue,
  saveAbsenceMessage,
  saveAdvancedAI,
  saveBusinessHours,
  saveMemory,
  toggleAIAgent,
  updateAIAgent,
};
