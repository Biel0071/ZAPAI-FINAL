const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { emitAIResponseProgress } = require('../services/aiResponseProgressService');

const source = fs.readFileSync(require.resolve('../services/automationEngine'), 'utf8');

function fixture(agentsByTenant) {
  const events = [];
  const agentReads = [];
  const integrationReads = [];
  const dependencies = {
    './ai.service': {
      getAIIntegrationStatus: async (store, companyId) => {
        integrationReads.push(companyId);
        return { aiOn: false };
      },
      processAI: async () => { throw new Error('This routing test must not generate a reply.'); },
    },
    '../src/infrastructure/config/aiToggle': { getAutomationPermission: async () => ({ allowed: true }) },
    './sessionManager': { getSession: id => ({ companyId: id.startsWith('b-') ? 'tenant-b' : 'tenant-a', systemConnected: true }) },
    '../src/data/repositories/contactRepository': { isLeadBlocked: async () => false },
    './crm-intelligence': { processIncomingMessage: async () => ({}) },
    '../src/data/repositories/conversationRepository': { getConversationByPhone: async () => null },
    '../src/messaging/inbox/inbox/services/ConversationRuntimeService': { refreshExpiredHumanTakeover: () => ({ runtime: {} }) },
    '../src/infrastructure/config/businessHours': { businessHours: { autoReplyOutsideHours: false }, isBusinessOpen: () => true },
    '../src/ai/agents/services/aiAgentService': {
      listAgents: async companyId => { agentReads.push(companyId); return agentsByTenant[companyId] || []; },
      getActiveAgentsSync: companyId => (agentsByTenant[companyId] || []).filter(agent => agent.active !== false),
    },
    './aiResponseProgressService': { emitAIResponseProgress },
  };
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, console: { log() {}, error() {} },
    require: name => dependencies[name] || {}, process: { env: {} }, Map, Date, Math,
  }, { filename: 'automationEngine.js' });
  const run = ({ sessionId = 'a-sales', companyId = 'tenant-a', agentName } = {}) => module.exports.processMessage({
    payload: { phone: '5511999990001', text: 'Olá', companyId },
    conversation: { id: 'conversation-a', company_id: companyId, agent_name: agentName },
    sessionId,
    store: { io: { to: room => ({ emit: (name, payload) => events.push({ room, name, payload }) }) } },
  });
  return { run, events, agentReads, integrationReads };
}

test('automatic flow never falls back to an agent assigned to another WhatsApp', async () => {
  const f = fixture({ 'tenant-a': [{ key: 'other-line', name: 'Outra Loja', active: true, sessionIds: ['a-other'] }] });
  const result = await f.run();
  assert.equal(result.reason, 'no_store_agent');
  assert.equal(f.integrationReads.length, 0);
  assert.equal(f.events.length, 1);
  assert.equal(f.events[0].payload.status, 'no_agent');
  assert.equal(f.events[0].room, 'tenant:tenant-a');
});

test('a saved conversation attendant cannot override the connection assignment', async () => {
  const f = fixture({ 'tenant-a': [
    { key: 'other-line', name: 'Outra Loja', active: true, sessionIds: ['a-other'] },
    { key: 'sales', name: 'Vendas', active: true, sessionIds: ['a-sales'] },
  ] });
  const result = await f.run({ agentName: 'Outra Loja' });
  assert.equal(result.reason, 'ai_off');
  assert.equal(f.events[0].payload.agentName, 'Vendas');
});

test('legacy unbound agents remain eligible within their company', async () => {
  const f = fixture({ 'tenant-a': [{ key: 'legacy', name: 'Legado', active: true, sessionIds: [] }] });
  const result = await f.run();
  assert.equal(result.reason, 'ai_off');
  assert.equal(f.events[0].payload.agentName, 'Legado');
});

test('routing reads only the message company and ignores paused attendants', async () => {
  const f = fixture({
    'tenant-a': [{ key: 'sales-a', name: 'Empresa A', active: true, sessionIds: ['b-sales'] }],
    'tenant-b': [
      { key: 'paused', name: 'Pausado', active: false, sessionIds: ['b-other'] },
      { key: 'sales-b', name: 'Empresa B', active: true, sessionIds: ['b-sales'] },
    ],
  });
  const result = await f.run({ companyId: 'tenant-b', sessionId: 'b-sales' });
  assert.equal(result.reason, 'ai_off');
  assert.deepEqual(f.agentReads, ['tenant-b']);
  assert.deepEqual(f.integrationReads, ['tenant-b']);
  assert.equal(f.events[0].payload.agentName, 'Empresa B');
  assert.ok(f.events.every(event => event.room === 'tenant:tenant-b'));
});

test('conflicting explicit WhatsApp owners fail closed instead of picking the first or saved conversation name', async () => {
  const f = fixture({ 'tenant-a': [
    { key: 'one', name: 'Primeiro', active: true, sessionIds: ['a-sales'] },
    { key: 'two', name: 'Segundo', active: true, sessionIds: ['a-sales'] },
  ] });
  const result = await f.run({ agentName: 'Segundo' });
  assert.equal(result.reason, 'ambiguous_session_agent');
  assert.equal(f.integrationReads.length, 0);
  assert.equal(f.events[0].payload.status, 'no_agent');
});

test('a paused explicit owner blocks fallback to a legacy global attendant', async () => {
  const f = fixture({ 'tenant-a': [
    { key: 'paused', name: 'Pausado', active: false, sessionIds: ['a-sales'] },
    { key: 'legacy', name: 'Legado', active: true, sessionIds: [] },
  ] });
  const result = await f.run();
  assert.equal(result.reason, 'no_store_agent');
  assert.equal(f.integrationReads.length, 0);
});
