const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const express = require('express');
const crypto = require('node:crypto');
const { rateLimit } = require('express-rate-limit');

function loadRouter(file, dependencies) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve(file), 'utf8'), {
    module, exports: module.exports, console,
    require: name => name === 'express' ? express : name === 'crypto' ? crypto
      : name === 'express-rate-limit' ? { rateLimit } : dependencies[name] || {},
  }, { filename: file });
  return module.exports;
}

async function serve(t, router) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.authTenantId = 'tenant-a'; req.auth = { role: 'admin' }; next(); });
  app.use(router);
  const server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  return 'http://127.0.0.1:' + server.address().port;
}

test('store creation returns the saved identity without referencing an undefined update result', async t => {
  const inserts = [];
  const db = { query: async (sql, params) => {
    assert.match(sql, /^INSERT INTO ai_stores/);
    assert.equal(params[0], 'tenant-a');
    inserts.push(params);
    return { rows: [] };
  } };
  const { createHistoryRouter } = loadRouter('../src/ai/evolutionary/historyRoutes', {
    '../../../services/whatsapp/historySync': { historySync: { repository: {} } },
    '../../infrastructure/config/database': { pool: db },
    './historyLearning': { GUARDRAILS: '' },
  });
  const base = await serve(t, createHistoryRouter({ db, repository: {}, agentService: {} }));
  const response = await fetch(base + '/stores', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Loja do WhatsApp', knowledge: 'Informações oficiais', companyId: 'tenant-b' }) });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.id, inserts[0][1]);
  assert.equal(inserts.length, 1);
});

test('a single attendant belongs only to its assigned store', async t => {
  const stores = [{ id: 'store-a', name: 'Loja A' }, { id: 'store-b', name: 'Loja B' }];
  const agent = { key: 'sales', name: 'Vendas', storeId: 'store-a', sessionIds: ['line-a'] };
  const db = { query: async (sql, params) => {
    assert.equal(params[0], 'tenant-a');
    if (sql.includes('FROM ai_stores')) return { rows: stores };
    if (sql.includes('FROM sessions')) return { rows: [{ id: 1, session_id: 'line-a', store_id: 'store-a', status: 'connected' }] };
    throw new Error('Unexpected query');
  } };
  const router = loadRouter('../src/api/routes/stores', {
    '../../infrastructure/config/database': db,
    '../../ai/agents/services/aiAgentService': { listAgents: async companyId => { assert.equal(companyId, 'tenant-a'); return [agent]; } },
  });
  const base = await serve(t, router);
  const response = await fetch(base);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.stores[0].attendantsCount, 1);
  assert.equal(body.stores[0].numbers[0].attendant.key, 'sales');
  assert.equal(body.stores[1].attendantsCount, 0);
  assert.deepEqual(body.stores[1].attendants, []);
});

test('editing commercial fields preserves omitted store metadata and never changes attendant instructions', async t => {
  let update;
  const db = { query: async (sql, params) => {
    assert.equal(params[0], 'tenant-a');
    if (sql.startsWith('SELECT * FROM ai_stores')) return { rows: [{ name: 'Original', knowledge: 'Base', segment: 'Moda', phone: '5511', website: 'https://loja.test', business_hours: 'Seg 9-18', policies: 'Trocas', catalog_summary: 'Produtos', theme_color: '#abc', address: 'Rua A', attendant_name: 'Ana', attendant_role: 'Suporte', attendant_config: { avatar: 'custom' }, settings: { preserved: true } }] };
    if (sql.startsWith('UPDATE ai_stores')) { update = params; return { rows: [{ id: 'store-a' }] }; }
    throw new Error('Unexpected query');
  } };
  const { createHistoryRouter } = loadRouter('../src/ai/evolutionary/historyRoutes', {
    '../../../services/whatsapp/historySync': { historySync: { repository: {} } }, '../../infrastructure/config/database': { pool: db }, './historyLearning': { GUARDRAILS: '' },
  });
  const base = await serve(t, createHistoryRouter({ db, repository: {}, agentService: { listAgents: async () => { throw new Error('Commercial save must not mutate agents'); } } }));
  const response = await fetch(base + '/stores/store-a', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Revisada', address: 'Rua B' }) });
  assert.equal(response.status, 200);
  assert.equal(update[3], 'Base');
  assert.equal(update[5], '5511');
  assert.equal(update[10], '#abc');
  assert.equal(update[11], 'Rua B');
  assert.deepEqual(JSON.parse(update[14]), { avatar: 'custom' });
  assert.deepEqual(JSON.parse(update[15]), { preserved: true });
});

test('commercial write failure is reported without silently downgrading the saved fields', async t => {
  let writes = 0;
  const db = { query: async (sql) => {
    if (sql.startsWith('SELECT * FROM ai_stores')) return { rows: [{ name: 'Original' }] };
    writes++; throw new Error('write unavailable');
  } };
  const { createHistoryRouter } = loadRouter('../src/ai/evolutionary/historyRoutes', {
    '../../../services/whatsapp/historySync': { historySync: { repository: {} } }, '../../infrastructure/config/database': { pool: db }, './historyLearning': { GUARDRAILS: '' },
  });
  const base = await serve(t, createHistoryRouter({ db, repository: {}, agentService: {} }));
  const response = await fetch(base + '/stores/store-a', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Revisada' }) });
  assert.equal(response.status, 503);
  assert.equal(writes, 1);
});

test('changing only the WhatsApp store preserves its segment, service and paused evolution', async t => {
  let write;
  const db = { query: async (sql, params) => {
    assert.equal(params[0], 'tenant-a');
    if (sql.startsWith('SELECT * FROM session_ai_profiles')) return { rows: [{ store_id: 'store-old', segment: 'Moda', service_type: 'Consultivo', evolution_mode: 'paused' }] };
    if (sql.startsWith('SELECT id FROM ai_stores')) return { rows: [{ id: 'store-new' }] };
    if (sql.startsWith('INSERT INTO session_ai_profiles')) { write = params; return { rows: [] }; }
    throw new Error('Unexpected query: ' + sql);
  } };
  const repository = { owner: async () => 'tenant-a', ensure: async () => {} };
  const { createHistoryRouter } = loadRouter('../src/ai/evolutionary/historyRoutes', {
    '../../../services/whatsapp/historySync': { historySync: { repository } }, '../../infrastructure/config/database': { pool: db }, './historyLearning': { GUARDRAILS: '' },
  });
  const base = await serve(t, createHistoryRouter({ db, repository, agentService: {} }));
  const response = await fetch(base + '/line-a/profile', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ storeId: 'store-new' }) });
  assert.equal(response.status, 200);
  assert.deepEqual(Array.from(write).slice(0, 6), ['tenant-a', 'line-a', 'store-new', 'Moda', 'Consultivo', 'paused']);
});

test('a foreign WhatsApp or store cannot be linked through the profile API', async t => {
  let writes = 0;
  const db = { query: async (sql, params) => {
    assert.equal(params[0], 'tenant-a');
    if (sql.startsWith('SELECT * FROM session_ai_profiles')) return { rows: [] };
    if (sql.startsWith('SELECT id FROM ai_stores')) return { rows: [] };
    writes++; return { rows: [] };
  } };
  const repository = { owner: async session => session === 'line-a' ? 'tenant-a' : 'tenant-b', ensure: async () => {} };
  const { createHistoryRouter } = loadRouter('../src/ai/evolutionary/historyRoutes', {
    '../../../services/whatsapp/historySync': { historySync: { repository } }, '../../infrastructure/config/database': { pool: db }, './historyLearning': { GUARDRAILS: '' },
  });
  const base = await serve(t, createHistoryRouter({ db, repository, agentService: {} }));
  for (const session of ['line-a', 'foreign']) {
    const response = await fetch(base + '/' + session + '/profile', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ storeId: 'foreign-store', companyId: 'tenant-b' }) });
    assert.equal(response.status, 404);
  }
  assert.equal(writes, 0);
});

test('legacy history link uses exclusive canonical assignment and preserves a paused target', async t => {
  let received;
  const repository = { owner: async () => 'tenant-a', ensure: async () => {} };
  const agent = { key: 'paused', active: false, status: 'paused' };
  const agentService = { listAgents: async () => [agent], assignAgentToSession: async payload => { received = payload; return { assignedAgent: agent }; } };
  const { createHistoryRouter } = loadRouter('../src/ai/evolutionary/historyRoutes', {
    '../../../services/whatsapp/historySync': { historySync: { repository } }, '../../infrastructure/config/database': { pool: {} }, './historyLearning': { GUARDRAILS: '' },
  });
  const base = await serve(t, createHistoryRouter({ db: {}, repository, agentService }));
  const response = await fetch(base + '/line-a/agents/paused/link', { method: 'POST' });
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(JSON.stringify(received)), { companyId: 'tenant-a', agentKey: 'paused', sessionId: 'line-a' });
  assert.equal((await response.json()).agent.active, false);
});
