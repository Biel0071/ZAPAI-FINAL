const test = require('node:test');
const assert = require('node:assert/strict');

test('AI evolution overview does not invent rates with no agent activity', async () => {
  const databasePath = require.resolve('../src/infrastructure/config/database');
  const controllerPath = require.resolve('../src/api/controllers/aiConfigController');
  const originalDatabase = require.cache[databasePath];
  const originalController = require.cache[controllerPath];
  require.cache[databasePath] = {
    exports: {
      query: async (sql) => {
        if (sql.includes('FROM conversations') && sql.includes('GROUP BY agent_name')) return { rows: [] };
        if (sql.includes('FROM agent_memory_nodes') && sql.includes('node_type IN')) return { rows: [] };
        if (sql.includes('FROM ai_stores')) return { rows: [] };
        return { rows: [{}] };
      },
    },
  };
  delete require.cache[controllerPath];
  const controller = require('../src/api/controllers/aiConfigController');
  const agentService = require('../src/ai/agents/services/aiAgentService');
  const originalGetAgentsSync = agentService.getAgentsSync;
  let registered = [];
  agentService.getAgentsSync = () => registered;

  const readOverview = async () => {
    let statusCode = 200;
    let payload;
    await controller.getAIEvolution(
      { tenantId: 'tenant-empty', app: { locals: { store: { databaseEnabled: true } } } },
      {
        status(code) { statusCode = code; return this; },
        json(value) { payload = value; return this; },
      },
    );
    assert.equal(statusCode, 200);
    assert.equal(payload.success, true);
    return payload;
  };

  try {
    const empty = await readOverview();
    assert.deepEqual(empty.evolution, []);
    assert.deepEqual(empty.data.stats, empty.stats);
    assert.equal(empty.stats.totalQuestionsAnswered, 0);
    assert.equal(empty.stats.estimatedSatisfaction, null);
    assert.equal(empty.stats.resolutionRate, null);
    assert.equal(empty.stats.responseTimeReduction, null);
    assert.equal(empty.stats.efficiencyRate, null);
    assert.equal(empty.stats.averageResponseTimeSec, null);
    assert.equal(empty.stats.agentMaturityScore, null);

    registered = [{ key: 'new-agent', name: 'Novo agente' }];
    const inactive = await readOverview();
    assert.equal(inactive.evolution.length, 1);
    assert.equal(inactive.evolution[0].conversations_analyzed, 0);
    assert.equal(inactive.evolution[0].accuracy_rate, null);
    assert.equal(inactive.stats.estimatedSatisfaction, null);
    assert.equal(inactive.stats.efficiencyRate, null);
  } finally {
    agentService.getAgentsSync = originalGetAgentsSync;
    delete require.cache[controllerPath];
    if (originalController) require.cache[controllerPath] = originalController;
    if (originalDatabase) require.cache[databasePath] = originalDatabase;
    else delete require.cache[databasePath];
  }
});

test('AI evolution overview scopes media counts and FAQ questions to the authenticated tenant', async () => {
  const databasePath = require.resolve('../src/infrastructure/config/database');
  const controllerPath = require.resolve('../src/api/controllers/aiConfigController');
  const originalDatabase = require.cache[databasePath];
  const originalController = require.cache[controllerPath];
  const calls = [];
  require.cache[databasePath] = {
    exports: {
      query: async (sql, params) => {
        calls.push({ sql, params });
        if (sql.includes('GROUP BY agent_name')) {
          return { rows: [{
            agent_key: 'Agent A', conversations_analyzed: '1', clients_served: '1',
            conversions: '0', objections: '0', human_interventions: '0',
          }] };
        }
        if (sql.includes('AS media_used')) {
          return { rows: [{ total_outbound: 1, media_used: 1 }] };
        }
        if (sql.includes('SELECT content AS question')) {
          return { rows: [{ question: 'Pergunta do tenant A', count: 1 }] };
        }
        if (sql.includes('FROM agent_memory_nodes') && sql.includes('node_type IN')) return { rows: [] };
        if (sql.includes('FROM ai_stores')) return { rows: [] };
        return { rows: [{}] };
      },
    },
  };
  delete require.cache[controllerPath];

  try {
    const controller = require('../src/api/controllers/aiConfigController');
    let payload;
    await controller.getAIEvolution(
      {
        authTenantId: 'tenant-a',
        tenantId: 'tenant-b',
        app: { locals: { store: { databaseEnabled: true } } },
      },
      {
        status() { return this; },
        json(value) { payload = value; return this; },
      },
    );

    assert.equal(payload.success, true);
    assert.equal(payload.evolution[0].media_used, 1);
    assert.deepEqual(payload.evolution[0].faq_data.top_questions, [
      { question: 'Pergunta do tenant A', count: 1 },
    ]);
    const mediaRead = calls.find((call) => call.sql.includes('AS media_used'));
    const faqRead = calls.find((call) => call.sql.includes('SELECT content AS question'));
    assert.ok(mediaRead);
    assert.ok(faqRead);
    assert.match(mediaRead.sql, /FROM messages\s+WHERE company_id = \$1\s+AND from_me = TRUE\s+ORDER BY id DESC\s+LIMIT 2000/);
    assert.match(faqRead.sql, /FROM messages\s+WHERE company_id = \$1\s+AND from_me = FALSE/);
    assert.ok(calls.every((call) => call.params?.[0] === 'tenant-a'));
  } finally {
    delete require.cache[controllerPath];
    if (originalController) require.cache[controllerPath] = originalController;
    if (originalDatabase) require.cache[databasePath] = originalDatabase;
    else delete require.cache[databasePath];
  }
});
