const aiAgentService = require('../../ai/agents/services/aiAgentService');

function toRuntimeAgent(agent) {
  if (!agent) return null;
  return {
    ...agent,
    prompt: agent.personality,
    style: agent.responseStyle,
  };
}

function getAgents(tenantId) {
  return aiAgentService.getAgentsSync(tenantId).map(toRuntimeAgent);
}

function getAgentByName(name, tenantId) {
  return toRuntimeAgent(aiAgentService.findByNameSync(name, tenantId));
}

function pickRandomAgent(tenantId) {
  return toRuntimeAgent(aiAgentService.pickRandomAgentSync(tenantId));
}

module.exports = {
  get AGENTS() {
    return getAgents();
  },
  getAgentByName,
  getAgents,
  pickRandomAgent,
};