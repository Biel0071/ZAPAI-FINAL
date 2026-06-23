const camilaAgent = require('../agents/camilaAgent');
const rafaelAgent = require('../agents/rafaelAgent');
const juliaAgent = require('../agents/juliaAgent');
const pedroAgent = require('../agents/pedroAgent');
const { selectRandomActiveAgent } = require('../engine/agentSelector');
const { getDelayMs } = require('../engine/delayEngine');
const { buildPersonalityPrompt } = require('../engine/personalityEngine');
const systemSettingsRepository = require('../../repositories/systemSettingsRepository');

const SETTINGS_KEY = 'ai_agents_config_v1';
const DEFAULT_AGENTS = [camilaAgent, rafaelAgent, juliaAgent, pedroAgent].map((agent) => ({ ...agent }));

let agentsCache = DEFAULT_AGENTS.map((agent) => ({ ...agent }));
let cacheHydrated = false;

function cloneAgents(agents = []) {
  return agents.map((agent) => ({
    ...agent,
    delayProfile: {
      maxMs: Number(agent?.delayProfile?.maxMs) || 5000,
      minMs: Number(agent?.delayProfile?.minMs) || 1000,
    },
    typingDelayProfile: {
      maxMs: Number(agent?.typingDelayProfile?.maxMs) || 3000,
      minMs: Number(agent?.typingDelayProfile?.minMs) || 1000,
    },
  }));
}

function normalizeAgent(agent = {}) {
  const key = String(agent.key || agent.name || `agent-${Date.now()}`)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');

  return {
    active: agent.active !== false,
    delayProfile: {
      maxMs: Math.max(Number(agent?.delayProfile?.maxMs) || 5000, Number(agent?.delayProfile?.minMs) || 1000),
      minMs: Math.max(0, Number(agent?.delayProfile?.minMs) || 1000),
    },
    typingDelayProfile: {
      maxMs: Math.max(Number(agent?.typingDelayProfile?.maxMs) || 3000, Number(agent?.typingDelayProfile?.minMs) || 1000),
      minMs: Math.max(0, Number(agent?.typingDelayProfile?.minMs) || 1000),
    },
    key,
    name: String(agent.name || key).trim(),
    personality: String(agent.personality || agent.prompt || 'Helpful sales attendant.').trim(),
    responseStyle: String(agent.responseStyle || 'short_natural').trim(),
    tone: String(agent.tone || 'professional').trim(),
    objective: String(agent.objective || '').trim(),
    temperature: typeof agent.temperature === 'number' ? agent.temperature : 0.7,
    sector: String(agent.sector || '').trim(),
    avatar: String(agent.avatar || '').trim(),
    hours: String(agent.hours || '').trim(),
    rules: String(agent.rules || '').trim(),
    memory: String(agent.memory || '').trim(),
    company: String(agent.company || '').trim(),
    companyDescription: String(agent.companyDescription || '').trim(),
    products: String(agent.products || '').trim(),
    services: String(agent.services || '').trim(),
    faq: String(agent.faq || '').trim(),
    policies: String(agent.policies || '').trim(),
    escalationPhone: String(agent.escalationPhone || '').trim(),
    escalationWhatsapp: String(agent.escalationWhatsapp || '').trim(),
    escalationActive: Boolean(agent.escalationActive ?? false),
    escalationMode: Number(agent.escalationMode ?? 1),
    escalationTriggers: Array.isArray(agent.escalationTriggers) ? agent.escalationTriggers : [],
  };
}

function getAgentsSync() {
  return cloneAgents(agentsCache);
}

function getActiveAgentsSync() {
  return getAgentsSync().filter((agent) => agent.active !== false);
}

function findByNameSync(name = '') {
  const normalizedName = String(name || '').trim().toLowerCase();
  if (!normalizedName) {
    return null;
  }

  return (
    getAgentsSync().find((agent) => String(agent.name || '').toLowerCase() === normalizedName) ||
    getAgentsSync().find((agent) => String(agent.key || '').toLowerCase() === normalizedName) ||
    null
  );
}

function pickRandomAgentSync() {
  return selectRandomActiveAgent(getActiveAgentsSync()) || getAgentsSync()[0] || null;
}

function getDelayForAgentMs(agent) {
  return getDelayMs(agent || pickRandomAgentSync() || DEFAULT_AGENTS[0]);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

async function persistAgents() {
  try {
    await systemSettingsRepository.setSetting(SETTINGS_KEY, JSON.stringify(agentsCache));
  } catch {
    // Keep in-memory configuration when persistence is unavailable.
  }
}

async function hydrateFromSettings() {
  if (cacheHydrated) {
    return getAgentsSync();
  }

  try {
    const row = await systemSettingsRepository.getSetting(SETTINGS_KEY);

    if (row?.value) {
      const parsed = JSON.parse(row.value);

      if (Array.isArray(parsed) && parsed.length > 0) {
        agentsCache = parsed.map((agent) => normalizeAgent(agent));
      }
    }
  } catch {
    // Fall back to defaults
  } finally {
    cacheHydrated = true;
  }

  return getAgentsSync();
}

async function listAgents() {
  await hydrateFromSettings();
  return getAgentsSync();
}

async function createAgent(payload = {}) {
  await hydrateFromSettings();
  const nextAgent = normalizeAgent(payload);

  const alreadyExists = agentsCache.some((agent) => agent.key === nextAgent.key);
  if (alreadyExists) {
    throw new Error('Agent key already exists.');
  }

  agentsCache.push(nextAgent);
  await persistAgents();
  return nextAgent;
}

async function updateAgent(agentKey, payload = {}) {
  await hydrateFromSettings();
  const normalizedKey = String(agentKey || '').trim().toLowerCase();

  const index = agentsCache.findIndex((agent) => agent.key === normalizedKey);
  if (index < 0) {
    throw new Error('Agent not found.');
  }

  const merged = normalizeAgent({
    ...agentsCache[index],
    ...payload,
    key: normalizedKey,
  });

  agentsCache[index] = merged;
  await persistAgents();
  return merged;
}

async function setAgentActive(agentKey, active) {
  return updateAgent(agentKey, { active: Boolean(active) });
}

async function deleteAgent(agentKey) {
  await hydrateFromSettings();
  const normalizedKey = String(agentKey || '').trim().toLowerCase();
  
  const index = agentsCache.findIndex((agent) => agent.key === normalizedKey);
  if (index < 0) {
    throw new Error('Agent not found.');
  }

  const deleted = agentsCache.splice(index, 1)[0];
  await persistAgents();
  return deleted;
}

async function cloneAgent(agentKey) {
  await hydrateFromSettings();
  const normalizedKey = String(agentKey || '').trim().toLowerCase();

  const original = agentsCache.find((agent) => agent.key === normalizedKey);
  if (!original) {
    throw new Error('Agent not found.');
  }

  const timestamp = Date.now();
  const newName = `${original.name} (Cópia)`;
  const newKey = `${original.key}-copia-${timestamp}`;

  const cloned = normalizeAgent({
    ...original,
    name: newName,
    key: newKey,
    active: false,
  });

  agentsCache.push(cloned);
  await persistAgents();
  return cloned;
}

module.exports = {
  buildPersonalityPrompt,
  createAgent,
  findByNameSync,
  getActiveAgentsSync,
  getAgentsSync,
  getDelayForAgentMs,
  hydrateFromSettings,
  listAgents,
  pickRandomAgentSync,
  setAgentActive,
  updateAgent,
  deleteAgent,
  cloneAgent,
  wait,
};
