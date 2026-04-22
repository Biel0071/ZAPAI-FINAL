const aiAgentService = require('../ai-agents/services/aiAgentService');

const AGENTS = aiAgentService.getAgentsSync().map((agent) => ({
  ...agent,
  prompt: agent.personality,
  style: agent.responseStyle,
}));

function getAgentByName(name) {
  const selected =
    aiAgentService.findByNameSync(name) ||
    aiAgentService.pickRandomAgentSync() || {
      key: 'camila',
      name: 'Camila',
      personality: 'Friendly sales assistant focused on lead conversion.',
      responseStyle: 'short_natural',
    };
  return {
    ...selected,
    prompt: selected?.personality,
    style: selected?.responseStyle,
  };
}

function pickRandomAgent() {
  const selected = aiAgentService.pickRandomAgentSync() || {
    key: 'camila',
    name: 'Camila',
    personality: 'Friendly sales assistant focused on lead conversion.',
    responseStyle: 'short_natural',
  };
  return {
    ...selected,
    prompt: selected?.personality,
    style: selected?.responseStyle,
  };
}

module.exports = {
  AGENTS,
  getAgentByName,
  pickRandomAgent,
};