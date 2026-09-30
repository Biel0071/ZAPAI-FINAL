const test = require('node:test');
const assert = require('node:assert/strict');

function loadService({ providers = {}, agents = {}, knowledge = {}, failKeys = [] } = {}) {
  const originals = new Map();
  const replace = (name, exports) => {
    const path = require.resolve(name);
    originals.set(path, require.cache[path]);
    require.cache[path] = { exports };
  };
  const queries = [];
  const requests = [];
  const sessions = [];
  const knowledgeReads = [];
  const events = [];
  replace('../src/infrastructure/config/database', { query: async (sql, params) => {
    queries.push({ sql, params });
    assert.match(sql, /provider_keys/);
    assert.match(sql, /tenant_id\s*=\s*\$1/);
    const provider = providers[params[0]];
    return { rows: provider && (!params[1] || params[1] === provider.provider) ? [provider] : [] };
  } });
  replace('axios', { post: async (url, data, config) => {
    requests.push({ url, data, config });
    const key = config.headers.Authorization || config.headers['x-api-key'];
    if (failKeys.some(item => key.includes(item))) throw new Error('Provider unavailable');
    return { data: { choices: [{ message: { content: 'Resposta verificada.' } }], usage: { total_tokens: 4 } } };
  } });
  replace('../services/aiLogService', { saveLogEntry: async () => {} });
  replace('../src/infrastructure/config/promptManager', { getActivePrompt: () => '' });
  replace('../src/ai/agents/services/aiAgentService', {
    listAgents: async companyId => agents[companyId] || [],
    getAgentsSync: companyId => agents[companyId] || [],
    getActiveAgentsSync: companyId => agents[companyId] || [],
    withSessionStyle: async agent => agent,
    sessionKnowledge: async (companyId, sessionId) => {
      knowledgeReads.push({ companyId, sessionId });
      return knowledge[`${companyId}:${sessionId}`] || '';
    },
  });
  replace('../services/aiMemoryEngine', {
    assertSession: async (companyId, sessionId) => { sessions.push({ companyId, sessionId }); },
    projectPending: async () => {},
  });
  replace('../services/agentMemoryGraphService', { recallRelevantMemory: async () => ({ prompt: '', memories: [] }), learnFromInteraction: async () => {} });
  replace('../services/aiLocalBrainService', {});
  replace('../services/conversationMemoryEngine', { getConversationMemory: async () => null });
  replace('../services/quickReplyCapability', {});
  replace('../src/ai/evolutionary/orchestrator', { buildEvolutionaryPrompt: async () => null });
  replace('../src/ai/evolutionary/experienceEngine', { recordExperienceEvent: async () => {} });
  replace('../services/sync', { syncEngine: { dispatch: (...args) => { events.push(args); } } });
  const servicePath = require.resolve('../services/ai.service');
  const originalService = require.cache[servicePath];
  delete require.cache[servicePath];
  return {
    service: require(servicePath), queries, requests, sessions, knowledgeReads, events,
    restore() {
      for (const [path, original] of originals) {
        if (original) require.cache[path] = original;
        else delete require.cache[path];
      }
      if (originalService) require.cache[servicePath] = originalService;
      else delete require.cache[servicePath];
    },
  };
}

const globalStore = {
  databaseEnabled: true,
  activeCompanyId: 'tenant-other',
  conversationSummary: 'GLOBAL_MEMORY_SHOULD_NOT_APPEAR',
  quickReplies: [{ id: 'global', text: 'GLOBAL_QUICK_REPLY_SHOULD_NOT_APPEAR' }],
  aiConfig: {
    businessHours: { open: 'GLOBAL_OPEN', close: 'GLOBAL_CLOSE' },
    advancedAISettings: { providers: [{ id: 'openai', active: true, apiKey: 'global-secret', model: 'global-model' }] },
  },
};
const ownAgent = { key: 'camila', name: 'Camila', active: true, personality: 'PERSONALIDADE_SALVA', sessionIds: ['main'] };
const ownProvider = { provider: 'openai', api_key: 'tenant-a-key', model: 'tenant-model', enabled: true };

test('integration status never uses another company global provider when tenant has no provider', async () => {
  const fixture = loadService();
  try {
    const status = await fixture.service.getAIIntegrationStatus(globalStore, 'tenant-a');
    assert.equal(status.aiOn, false);
    assert.equal(status.providerConfigured, false);
    assert.equal(fixture.requests.length, 0);
  } finally { fixture.restore(); }
});

test('provider readiness cache is isolated by tenant and refreshed after credential change', async () => {
  const providers = { 'tenant-a': { ...ownProvider }, 'tenant-b': { ...ownProvider, api_key: 'tenant-b-key' } };
  const fixture = loadService({ providers, failKeys: ['tenant-b-key'] });
  try {
    assert.equal((await fixture.service.getAIIntegrationStatus(globalStore, 'tenant-a')).aiOn, true);
    assert.equal((await fixture.service.getAIIntegrationStatus(globalStore, 'tenant-b')).aiOn, false);
    assert.equal(fixture.requests.length, 2);
    fixture.requests.length = 0;
    providers['tenant-b'].api_key = 'tenant-b-valid';
    assert.equal((await fixture.service.getAIIntegrationStatus(globalStore, 'tenant-b')).aiOn, true);
    assert.equal(fixture.requests.length, 1);
  } finally { fixture.restore(); }
});

test('manual test uses saved tenant agent and official connection knowledge without global examples', async () => {
  const fixture = loadService({ providers: { 'tenant-a': ownProvider }, agents: { 'tenant-a': [ownAgent] }, knowledge: { 'tenant-a:main': '\nPRECO_OFICIAL_TENANT_A: R$ 19,00' } });
  try {
    const result = await fixture.service.testAIConnection({ store: globalStore, companyId: 'tenant-a', sessionId: 'main', agentKey: 'camila', message: 'Qual o preço?' });
    assert.equal(result.ok, true);
    assert.match(result.fullPrompt, /PERSONALIDADE_SALVA/);
    assert.match(result.fullPrompt, /PRECO_OFICIAL_TENANT_A: R\$ 19,00/);
    assert.doesNotMatch(result.fullPrompt, /GLOBAL_|2\.490|2490|5%|10x|Produto Exemplo|Catálogo de Produtos/);
    assert.deepEqual(fixture.knowledgeReads, [{ companyId: 'tenant-a', sessionId: 'main' }]);
    assert.deepEqual(fixture.sessions, [{ companyId: 'tenant-a', sessionId: 'main' }]);
    assert.equal(fixture.requests[0].config.headers.Authorization, 'Bearer tenant-a-key');
    assert.equal(fixture.requests[0].data.model, 'tenant-model');
    assert.equal(fixture.events[0][1].tenantId, 'tenant-a');
    assert.equal(fixture.events[0][1].provider, 'openai');
    assert.doesNotMatch(JSON.stringify(fixture.events), /tenant-a-key|global-secret/);
  } finally { fixture.restore(); }
});

test('automatic response uses official knowledge from the verified company and connection', async () => {
  const fixture = loadService({ providers: { 'tenant-a': ownProvider }, agents: { 'tenant-a': [ownAgent] }, knowledge: { 'tenant-a:main': '\nHORARIO_OFICIAL_TENANT_A: 08h às 17h' } });
  try {
    const result = await fixture.service.processAI({ store: globalStore, companyId: 'tenant-a', agentName: 'camila', contact: { phone: '5511999999999', sessionId: 'main', conversationId: 1 }, history: [], message: 'Qual o horário?' });
    assert.equal(result.reply, 'Resposta verificada.');
    const prompt = fixture.requests.at(-1).data.messages[0].content;
    assert.match(prompt, /HORARIO_OFICIAL_TENANT_A/);
    assert.match(prompt, /PERSONALIDADE_SALVA/);
    assert.doesNotMatch(prompt, /GLOBAL_|2\.490|2490|5%|10x/);
    assert.deepEqual(fixture.knowledgeReads, [{ companyId: 'tenant-a', sessionId: 'main' }]);
    assert.equal(fixture.requests.at(-1).config.headers.Authorization, 'Bearer tenant-a-key');
  } finally { fixture.restore(); }
});

test('prompt refinement rejects global credentials when the tenant provider is missing', async () => {
  const fixture = loadService();
  try {
    await assert.rejects(() => fixture.service.refineAgentPrompt({ store: globalStore, companyId: 'tenant-a', currentPrompt: 'Prestativo', instruction: 'Seja curto' }), /Nenhum provedor/);
    assert.equal(fixture.requests.length, 0);
  } finally { fixture.restore(); }
});

test('prompt refinement sends through the selected tenant provider', async () => {
  const fixture = loadService({ providers: { 'tenant-a': ownProvider } });
  try {
    const result = await fixture.service.refineAgentPrompt({ store: globalStore, companyId: 'tenant-a', currentPrompt: 'Prestativo', instruction: 'Seja curto' });
    assert.equal(result, 'Resposta verificada.');
    assert.equal(fixture.requests[0].config.headers.Authorization, 'Bearer tenant-a-key');
    assert.equal(fixture.requests[0].data.model, 'tenant-model');
  } finally { fixture.restore(); }
});
