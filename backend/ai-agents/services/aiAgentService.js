const { selectRandomActiveAgent } = require('../engine/agentSelector');
const { getDelayMs } = require('../engine/delayEngine');
const { buildPersonalityPrompt } = require('../engine/personalityEngine');
const systemSettingsRepository = require('../../repositories/systemSettingsRepository');

const DEFAULT_TENANT_ID = String(process.env.DEFAULT_COMPANY_ID || 'default').trim() || 'default';
const SETTINGS_PREFIX = 'ai_agents_config_v2';
const agentsByTenant = new Map();
const hydratedTenants = new Set();

function normalizeTenantId(tenantId) {
  return String(tenantId || DEFAULT_TENANT_ID).trim() || DEFAULT_TENANT_ID;
}

function settingsKey(tenantId) {
  return `${SETTINGS_PREFIX}:${normalizeTenantId(tenantId)}`;
}

function getTenantCache(tenantId) {
  const normalizedTenantId = normalizeTenantId(tenantId);
  if (!agentsByTenant.has(normalizedTenantId)) {
    agentsByTenant.set(normalizedTenantId, []);
  }
  return agentsByTenant.get(normalizedTenantId);
}

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
    personality: String(agent.personality || agent.prompt || 'Atendente da loja.').trim(),
    responseStyle: String(agent.responseStyle || 'short_natural').trim(),
    tone: String(agent.tone || 'professional').trim(),
    objective: String(agent.objective || '').trim(),
    temperature: typeof agent.temperature === 'number'
      ? agent.temperature
      : (isNaN(Number(agent.temperature)) ? 0.7 : Number(agent.temperature)),
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
    voiceEnabled: Boolean(agent.voiceEnabled ?? false),
    voiceRule: String(agent.voiceRule || 'always').trim(),
    voiceId: String(agent.voiceId || '').trim(),
    voiceProvider: String(agent.voiceProvider || 'default').trim(),
    voiceGender: String(agent.voiceGender || 'female').trim(),
    maxWords: typeof agent.maxWords === 'number'
      ? agent.maxWords
      : (isNaN(Number(agent.maxWords)) ? 0 : Number(agent.maxWords)),
  };
}

function getAgentsSync(tenantId = DEFAULT_TENANT_ID) {
  return cloneAgents(getTenantCache(tenantId));
}

function getActiveAgentsSync(tenantId = DEFAULT_TENANT_ID) {
  return getAgentsSync(tenantId).filter((agent) => agent.active !== false);
}

function findByNameSync(name = '', tenantId = DEFAULT_TENANT_ID) {
  const normalizedName = String(name || '').trim().toLowerCase();
  if (!normalizedName) return null;

  return (
    getAgentsSync(tenantId).find((agent) => String(agent.name || '').toLowerCase() === normalizedName) ||
    getAgentsSync(tenantId).find((agent) => String(agent.key || '').toLowerCase() === normalizedName) ||
    null
  );
}

function pickRandomAgentSync(tenantId = DEFAULT_TENANT_ID) {
  return selectRandomActiveAgent(getActiveAgentsSync(tenantId)) || null;
}

function getDelayForAgentMs(agent, tenantId = DEFAULT_TENANT_ID) {
  return getDelayMs(agent || pickRandomAgentSync(tenantId) || {
    delayProfile: { minMs: 1000, maxMs: 3000 },
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

async function persistAgents(tenantId) {
  const normalizedTenantId = normalizeTenantId(tenantId);
  await systemSettingsRepository.setSetting(
    settingsKey(normalizedTenantId),
    JSON.stringify(getTenantCache(normalizedTenantId)),
  );
}

async function hydrateFromSettings(tenantId = DEFAULT_TENANT_ID) {
  const normalizedTenantId = normalizeTenantId(tenantId);
  if (hydratedTenants.has(normalizedTenantId)) return getAgentsSync(normalizedTenantId);

  try {
    const row = await systemSettingsRepository.getSetting(settingsKey(normalizedTenantId));
    const parsed = row?.value ? JSON.parse(row.value) : [];
    agentsByTenant.set(
      normalizedTenantId,
      Array.isArray(parsed) ? parsed.map((agent) => normalizeAgent(agent)) : [],
    );
  } catch (error) {
    agentsByTenant.set(normalizedTenantId, []);
    console.warn(`[AI AGENT SERVICE][tenant=${normalizedTenantId}] failed to hydrate agents:`, error.message || error);
  } finally {
    hydratedTenants.add(normalizedTenantId);
  }

  return getAgentsSync(normalizedTenantId);
}

async function listAgents(tenantId = DEFAULT_TENANT_ID) {
  await hydrateFromSettings(tenantId);
  return getAgentsSync(tenantId);
}

async function createAgent(payload = {}, tenantId = DEFAULT_TENANT_ID) {
  const normalizedTenantId = normalizeTenantId(tenantId);
  await hydrateFromSettings(normalizedTenantId);
  const agents = getTenantCache(normalizedTenantId);
  const nextAgent = normalizeAgent(payload);

  if (agents.some((agent) => agent.key === nextAgent.key)) {
    throw new Error('Agent key already exists for this store.');
  }

  agents.push(nextAgent);
  await persistAgents(normalizedTenantId);
  return nextAgent;
}

async function updateAgent(agentKey, payload = {}, tenantId = DEFAULT_TENANT_ID) {
  const normalizedTenantId = normalizeTenantId(tenantId);
  await hydrateFromSettings(normalizedTenantId);
  const agents = getTenantCache(normalizedTenantId);
  const normalizedKey = String(agentKey || '').trim().toLowerCase();
  const index = agents.findIndex((agent) => agent.key === normalizedKey);

  if (index < 0) throw new Error('Agent not found for this store.');

  const merged = normalizeAgent({ ...agents[index], ...payload, key: normalizedKey });
  agents[index] = merged;
  await persistAgents(normalizedTenantId);
  return merged;
}

async function setAgentActive(agentKey, active, tenantId = DEFAULT_TENANT_ID) {
  return updateAgent(agentKey, { active: Boolean(active) }, tenantId);
}

async function deleteAgent(agentKey, tenantId = DEFAULT_TENANT_ID) {
  const normalizedTenantId = normalizeTenantId(tenantId);
  await hydrateFromSettings(normalizedTenantId);
  const agents = getTenantCache(normalizedTenantId);
  const normalizedKey = String(agentKey || '').trim().toLowerCase();
  const index = agents.findIndex((agent) => agent.key === normalizedKey);

  if (index < 0) throw new Error('Agent not found for this store.');

  const deleted = agents.splice(index, 1)[0];
  await persistAgents(normalizedTenantId);
  return deleted;
}

async function cloneAgent(agentKey, tenantId = DEFAULT_TENANT_ID) {
  const normalizedTenantId = normalizeTenantId(tenantId);
  await hydrateFromSettings(normalizedTenantId);
  const agents = getTenantCache(normalizedTenantId);
  const normalizedKey = String(agentKey || '').trim().toLowerCase();
  const original = agents.find((agent) => agent.key === normalizedKey);

  if (!original) throw new Error('Agent not found for this store.');

  const timestamp = Date.now();
  const cloned = normalizeAgent({
    ...original,
    name: `${original.name} (Cópia)`,
    key: `${original.key}-copia-${timestamp}`,
    active: false,
  });

  agents.push(cloned);
  await persistAgents(normalizedTenantId);
  return cloned;
}

function resetCache(tenantId) {
  if (tenantId) {
    const normalizedTenantId = normalizeTenantId(tenantId);
    hydratedTenants.delete(normalizedTenantId);
    agentsByTenant.delete(normalizedTenantId);
    return;
  }
  hydratedTenants.clear();
  agentsByTenant.clear();
}

module.exports = {
  buildPersonalityPrompt,
  cloneAgent,
  createAgent,
  deleteAgent,
  findByNameSync,
  getActiveAgentsSync,
  getAgentsSync,
  getDelayForAgentMs,
  hydrateFromSettings,
  listAgents,
  pickRandomAgentSync,
  resetCache,
  setAgentActive,
  updateAgent,
  wait,
};
