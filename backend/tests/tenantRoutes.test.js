const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const db = require('../src/infrastructure/config/database');
const campaignEngine = require('../services/campaignDispatchEngine');
test.after(async () => { await db.pool.end(); });

test('lead temperature is scoped to the authenticated company', async () => {
  const originalQuery = db.query;
  const calls = [];
  db.query = async (sql, params) => {
    calls.push({ sql, params });
    return { rows: [{ lead_temperature: 'warm', lead_intent: 'sale', lead_confidence: 0.8 }], rowCount: 1 };
  };
  const routerPath = require.resolve('../src/api/routes/leads');
  delete require.cache[routerPath];
  const router = require(routerPath);
  const app = express();
  app.use(express.json(), (req, _res, next) => { req.authTenantId = 'company-a'; next(); }, router);
  const server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(`${base}/api/leads/temperature`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ conversationId: 'conv-1', temperature: 'warm' }) })).status, 200);
    assert.equal((await fetch(`${base}/api/leads/temperature/conv-1`)).status, 200);
    assert.equal(calls.length, 2);
    for (const call of calls) {
      assert.match(call.sql, /company_id/);
      assert.ok(call.params.includes('company-a'));
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
    db.query = originalQuery;
    delete require.cache[routerPath];
  }
});

test('campaign routes pass the authenticated company to active-state operations', async () => {
  const original = { listActive: campaignEngine.listActive, pauseCampaign: campaignEngine.pauseCampaign };
  const seen = [];
  campaignEngine.listActive = companyId => { seen.push(['list', companyId]); return []; };
  campaignEngine.pauseCampaign = (id, companyId) => { seen.push(['pause', id, companyId]); return { id, status: 'paused' }; };
  const routerPath = require.resolve('../src/api/routes/campaignDispatch');
  delete require.cache[routerPath];
  const router = require(routerPath);
  const app = express();
  app.use((req, _res, next) => { req.authTenantId = 'company-b'; next(); });
  app.use('/api', router);
  const server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(`${base}/api/campaigns/active`)).status, 200);
    assert.equal((await fetch(`${base}/api/campaigns/camp-1/pause`, { method: 'POST' })).status, 200);
    assert.deepEqual(seen, [['list', 'company-b'], ['pause', 'camp-1', 'company-b']]);
  } finally {
    await new Promise(resolve => server.close(resolve));
    Object.assign(campaignEngine, original);
    delete require.cache[routerPath];
  }
});
