const test = require('node:test');
const assert = require('node:assert/strict');

const settingsRepository = require('../src/data/repositories/systemSettingsRepository');
const originalGet = settingsRepository.getSetting;
const originalSet = settingsRepository.setSetting;

function installMemorySettings() {
  const values = new Map();
  settingsRepository.getSetting = async (key) => values.has(key) ? { key, value: values.get(key) } : null;
  settingsRepository.setSetting = async (key, value) => {
    values.set(key, String(value));
    return { key, value: String(value) };
  };
  return values;
}

test.after(() => {
  settingsRepository.getSetting = originalGet;
  settingsRepository.setSetting = originalSet;
});

test('AI toggle is persisted and isolated per store', async () => {
  const values = installMemorySettings();
  delete require.cache[require.resolve('../config/aiToggle')];
  const toggle = require('../src/infrastructure/config/aiToggle');

  assert.equal(await toggle.getAIEnabled('store-a'), false);
  assert.equal(await toggle.getAIEnabled('store-b'), false);
  assert.equal(await toggle.setAIEnabled(true, 'store-a'), true);
  assert.equal(toggle.isAIEnabled('store-a'), true);
  assert.equal(toggle.isAIEnabled('store-b'), false);
  assert.equal(values.get('ai_enabled_v2:store-a'), 'true');

  settingsRepository.setSetting = async () => { throw new Error('persistence unavailable'); };
  await assert.rejects(() => toggle.setAIEnabled(true, 'store-b'), /persistence unavailable/);
  assert.equal(toggle.isAIEnabled('store-b'), false);
});

test('stores start without system agents and cannot see each other agents', async () => {
  installMemorySettings();
  delete require.cache[require.resolve('../ai-agents/services/aiAgentService')];
  const agents = require('../src/ai/agents/services/aiAgentService');

  assert.deepEqual(await agents.listAgents('store-a'), []);
  assert.deepEqual(await agents.listAgents('store-b'), []);

  await agents.createAgent({ name: 'Atendente da Loja A', key: 'vendas' }, 'store-a');
  assert.equal((await agents.listAgents('store-a')).length, 1);
  assert.deepEqual(await agents.listAgents('store-b'), []);
  assert.equal(agents.findByNameSync('Atendente da Loja A', 'store-b'), null);
});
test('analytics summaries are isolated by store', () => {
  const analyticsService = require('../services/analyticsService');
  const store = {
    conversations: [
      { id: 'conversation-a', companyId: 'store-a', status: 'open' },
      { id: 'conversation-b', companyId: 'store-b', status: 'open' },
    ],
    messages: [
      { conversationId: 'conversation-a', companyId: 'store-a', fromMe: true },
      { conversationId: 'conversation-b', companyId: 'store-b', fromMe: true },
    ],
    sessionManager: {
      listSessions: () => [
        { id: 'session-a', companyId: 'store-a' },
        { id: 'session-b', companyId: 'store-b' },
      ],
    },
  };

  const storeA = analyticsService.buildAnalyticsSummary(store, null, 'store-a');
  const storeB = analyticsService.buildAnalyticsSummary(store, null, 'store-b');

  assert.equal(storeA.metrics.leads, 1);
  assert.equal(storeA.metrics.messages, 1);
  assert.equal(storeA.metrics.sessions, 1);
  assert.equal(storeB.metrics.leads, 1);
  assert.equal(storeB.metrics.messages, 1);
  assert.equal(storeB.metrics.sessions, 1);
});