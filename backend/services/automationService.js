const campaignRepository = require('../src/data/repositories/campaignRepository');
const flowRepository = require('../src/data/repositories/flowRepository');

function getCompanyId(store) {
  return store?.activeCompanyId || process.env.DEFAULT_COMPANY_ID || 'default';
}

function normalizeCampaign(payload = {}) {
  const settings = payload.settings || {};
  const selectedContacts = Array.isArray(payload.selectedContacts) ? payload.selectedContacts : [];
  const messages = Array.isArray(payload.messages)
    ? payload.messages
    : payload.message
      ? [{ type: 'text', content: String(payload.message) }]
      : [];

  return {
    id: payload.id || `cmp-${Date.now()}`,
    name: String(payload.name || 'Nova campanha').trim(),
    status: String(payload.status || 'draft').trim(),
    selectedContacts,
    messages: messages.map((item, index) => ({
      id: item.id || `msg-${Date.now()}-${index}`,
      type: String(item.type || 'text').trim(),
      content: String(item.content || '').trim(),
      mediaUrl: item.mediaUrl || item.mediaPath || item.url || null,
      mediaPath: item.mediaPath || item.mediaUrl || item.url || null,
      fileName: item.fileName || item.filename || null,
      mimetype: item.mimetype || null,
      ptt: item.ptt === true,
      delaySeconds: Number(item.delaySeconds || 0),
    })),
    settings: {
      flowId: settings.flowId || payload.flowId || null,
      sessionId: settings.sessionId || payload.sessionId || null,
      intervalSeconds: Number(settings.intervalSeconds ?? payload.intervalSeconds ?? 10),
      pauseEvery: Number(settings.pauseEvery ?? payload.pauseEvery ?? 10),
      pauseSeconds: Number(settings.pauseSeconds ?? payload.pauseSeconds ?? 60),
      typingDelaySeconds: Number(settings.typingDelaySeconds ?? payload.typingDelaySeconds ?? 3),
      startAt: payload.startAt || settings.startAt || settings.scheduledAt || payload.scheduledFor || payload.settings?.scheduledAt || null,
      shuffleEnabled: settings.shuffleEnabled !== undefined ? Boolean(settings.shuffleEnabled) : Boolean(payload.shuffleEnabled ?? true),
      warmupMessages: Number(settings.warmupMessages ?? payload.warmupMessages ?? 5),
      warmupDelayMultiplier: Number(settings.warmupDelayMultiplier ?? payload.warmupDelayMultiplier ?? 3),
      dailyLimit: settings.dailyLimit !== undefined && settings.dailyLimit !== null && settings.dailyLimit !== '' ? Number(settings.dailyLimit) : null,
      hourlyLimit: settings.hourlyLimit !== undefined && settings.hourlyLimit !== null && settings.hourlyLimit !== '' ? Number(settings.hourlyLimit) : null,
      randomDelayMin: settings.randomDelayMin !== undefined ? Number(settings.randomDelayMin) : null,
      randomDelayMax: settings.randomDelayMax !== undefined ? Number(settings.randomDelayMax) : null,
    },
    queue: {
      total: selectedContacts.length,
      processed: Number(payload?.queue?.processed || 0),
      sent: Number(payload.sent || payload?.queue?.sent || 0),
      failed: Number(payload?.queue?.failed || 0),
      paused: Boolean(payload?.queue?.paused || false),
    },
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    startedAt: payload.startedAt || null,
    completedAt: payload.completedAt || null,
    createdAt: payload.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function normalizeFlow(payload = {}) {
  const nodes = Array.isArray(payload.nodes) ? payload.nodes : [];
  const edges = Array.isArray(payload.edges) ? payload.edges : [];
  const rules = Array.isArray(payload.rules) ? payload.rules : [];

  return {
    id: String(payload.id || `flow-${Date.now()}`).trim(),
    name: String(payload.name || payload.id || 'Novo flow').trim(),
    status: String(payload.status || 'active').trim(),
    trigger: String(payload.trigger || '').trim(),
    response: String(payload.response || '').trim(),
    nodes: nodes.map((node, index) => ({
      id: String(node.id || `node-${Date.now()}-${index}`).trim(),
      type: String(node.type || 'message').trim(),
      label: String(node.label || node.type || 'node').trim(),
      position: {
        x: Number(node.position?.x || 0),
        y: Number(node.position?.y || 0),
      },
      config: node.config || {},
    })),
    edges: edges.map((edge, index) => ({
      id: String(edge.id || `edge-${Date.now()}-${index}`).trim(),
      source: String(edge.source || '').trim(),
      target: String(edge.target || '').trim(),
      label: String(edge.label || '').trim(),
    })),
    rules: rules.map((rule, index) => ({
      id: String(rule.id || `rule-${Date.now()}-${index}`).trim(),
      type: String(rule.type || 'keyword').trim(),
      value: String(rule.value || '').trim(),
      active: rule.active !== false,
    })),
    createdAt: payload.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function listCampaigns(store) {
  return campaignRepository.listCampaigns(getCompanyId(store));
}

async function createCampaign(store, payload = {}) {
  const campaign = normalizeCampaign(payload);
  return campaignRepository.createCampaign(campaign, getCompanyId(store));
}

async function updateCampaign(store, id, payload = {}) {
  const current = await campaignRepository.getCampaignById(id, getCompanyId(store));

  if (!current) {
    return null;
  }

  const merged = {
    ...current,
    ...payload,
    id,
    createdAt: current.createdAt,
  };

  return campaignRepository.updateCampaign(id, normalizeCampaign(merged), getCompanyId(store));
}

async function getCampaign(store, id) {
  return campaignRepository.getCampaignById(id, getCompanyId(store));
}

async function startCampaign(store, id) {
  const current = await campaignRepository.getCampaignById(id, getCompanyId(store));
  if (!current) {
    return null;
  }

  const total = Number(current.queue?.total || current.selectedContacts?.length || 0);
  const updated = {
    ...current,
    status: 'completed',
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    queue: {
      ...current.queue,
      total,
      processed: total,
      sent: total,
      failed: Number(current.queue?.failed || 0),
      paused: false,
    },
  };

  return campaignRepository.updateCampaign(id, updated, getCompanyId(store));
}

async function getCampaignStatus(store, id) {
  const campaign = await getCampaign(store, id);
  if (!campaign) {
    return null;
  }

  return {
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    queue: campaign.queue,
    settings: campaign.settings,
    updatedAt: campaign.updatedAt,
  };
}

async function deleteCampaign(store, id) {
  return campaignRepository.deleteCampaign(id, getCompanyId(store));
}

async function listFlows(store) {
  return flowRepository.listFlows(getCompanyId(store));
}

async function createFlow(store, payload = {}) {
  const flow = normalizeFlow(payload);
  return flowRepository.createFlow(flow, getCompanyId(store));
}

async function updateFlow(store, id, payload = {}) {
  const current = await flowRepository.getFlowById(id, getCompanyId(store));

  if (!current) {
    return null;
  }

  const merged = {
    ...current,
    ...payload,
    id,
    createdAt: current.createdAt,
  };

  return flowRepository.updateFlow(id, normalizeFlow(merged), getCompanyId(store));
}

async function deleteFlow(store, id) {
  return flowRepository.deleteFlow(id, getCompanyId(store));
}

module.exports = {
  createCampaign,
  createFlow,
  deleteCampaign,
  deleteFlow,
  getCampaign,
  getCampaignStatus,
  listCampaigns,
  listFlows,
  startCampaign,
  updateCampaign,
  updateFlow,
};
