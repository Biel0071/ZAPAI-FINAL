const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createHistoryRouter } = require('../src/ai/evolutionary/historyRoutes');

test.after(async () => {
  const databasePath = require.resolve('../src/infrastructure/config/database');
  if (require.cache[databasePath]) await require(databasePath).pool.end();
});

test('editing a store preserves an existing attendant personality', async t => {
  const originalPersonality = 'Atenda com objetividade. Nunca prometa descontos sem aprovação.';
  const agentsByTenant = {
    'tenant-a': [{ key: 'camila-a', name: 'Camila', personality: originalPersonality }],
    'tenant-b': [{ key: 'camila-b', name: 'Camila', personality: 'Instruções privadas de outra empresa.' }],
  };
  const listedTenants = [];
  const updates = [];
  const creations = [];
  let storeExists = true;
  const agentService = {
    async listAgents(tenantId) {
      listedTenants.push(tenantId);
      return agentsByTenant[tenantId];
    },
    async updateAgent(key, payload, tenantId) {
      updates.push({ key, payload, tenantId });
      Object.assign(agentsByTenant[tenantId].find(agent => agent.key === key), payload);
    },
    async createAgent(payload, tenantId) {
      creations.push({ payload, tenantId });
    },
  };
  const db = {
    async query(sql, params) {
      assert.equal(params[0], 'tenant-a');
      assert.equal(params[1], 'store-a');
      if (sql.startsWith('SELECT * FROM ai_stores')) return { rows: storeExists ? [{ id: 'store-a', name: 'Loja atual', knowledge: '' }] : [] };
      assert.match(sql, /^UPDATE ai_stores SET/);
      return { rows: storeExists ? [{ id: 'store-a' }] : [] };
    },
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.authTenantId = 'tenant-a';
    req.auth = { role: 'admin' };
    next();
  });
  app.use('/history', createHistoryRouter({ db, agentService }));
  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  t.after(() => new Promise(resolve => server.close(resolve)));

  const response = await fetch(`http://127.0.0.1:${server.address().port}/history/stores/store-a`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Loja atualizada', attendant_name: 'Camila', attendant_role: 'Consultora' }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
  assert.equal(agentsByTenant['tenant-a'][0].personality, originalPersonality);
  assert.equal(agentsByTenant['tenant-b'][0].personality, 'Instruções privadas de outra empresa.');
  assert.deepEqual(listedTenants, []);
  assert.deepEqual(updates, []);
  assert.deepEqual(creations, []);

  const creationResponse = await fetch(`http://127.0.0.1:${server.address().port}/history/stores/store-a`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Loja atualizada', attendant_name: 'João', attendant_role: 'Consultor' }),
  });

  assert.equal(creationResponse.status, 200);
  assert.deepEqual(listedTenants, []);
  assert.deepEqual(updates, []);
  assert.equal(creations.length, 0);

  storeExists = false;
  const missingStoreResponse = await fetch(`http://127.0.0.1:${server.address().port}/history/stores/store-a`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Loja removida', attendant_name: 'Novo agente' }),
  });

  assert.equal(missingStoreResponse.status, 404);
  assert.deepEqual(await missingStoreResponse.json(), { error: 'Loja não encontrada.' });
  assert.deepEqual(listedTenants, []);
  assert.equal(creations.length, 0);
});
