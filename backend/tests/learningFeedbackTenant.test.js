const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

test('learning feedback validates authenticated tenant, conversation and agent before recording', async () => {
  const originals = new Map();
  const replace = (name, exports) => {
    const resolved = require.resolve(name);
    originals.set(resolved, require.cache[resolved]);
    require.cache[resolved] = { exports };
  };
  let tenant = 'tenant-a';
  let databaseFailure = false;
  const writes = [];
  replace('../src/api/controllers/aiConfigController', new Proxy({}, { get: () => (_req, res) => res.json({}) }));
  replace('../src/infrastructure/config/database', { query: async (sql, params) => {
    if (databaseFailure) throw Error('private database details');
    if (sql.includes('FROM conversations')) {
      assert.equal(params[1], tenant);
      return { rows: params[0] === '7' && tenant === 'tenant-a'
        ? [{ id: '7', session_id: 'main', agent_name: 'Camila', phone: '5531993807167', name: 'Contato homologação' }]
        : [] };
    }
    if (sql.includes('INSERT INTO agent_learning_events')) {
      writes.push(params);
      return { rows: [{ id: 12, status: 'pending' }] };
    }
    throw Error('Unexpected SQL');
  }});
  replace('../src/ai/agents/services/aiAgentService', { listAgents: async companyId => {
    assert.equal(companyId, 'tenant-a');
    return [{ key: 'camila', name: 'Camila' }, { key: 'rafael', name: 'Rafael' }];
  }});
  const routePath = require.resolve('../src/api/routes/aiConfig');
  const priorRoute = require.cache[routePath];
  delete require.cache[routePath];
  const app = express();
  app.use(express.json());
  app.locals.store = { databaseEnabled: true, activeCompanyId: 'tenant-global' };
  app.use((req, _res, next) => { req.authTenantId = tenant; next(); });
  app.use(require(routePath));
  const server = await new Promise(resolve => { const started = app.listen(0, '127.0.0.1', () => resolve(started)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const send = (patch = {}) => fetch(base + '/ai/learning/feedback', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ conversationId: '7', agentKey: 'camila', customerQuestion: 'Qual o horário?', aiResponse: 'Não informado.', humanAnswer: 'O horário está no cadastro.', companyId: 'tenant-b', contactPhone: 'fake', contactName: 'fake', ...patch }),
  });
  try {
    let response = await send();
    assert.equal(response.status, 200);
    assert.equal((await response.json()).eventId, 12);
    assert.deepEqual(writes[0], ['camila', 'tenant-a', 'human_edit_feedback', 'Qual o horário?', 'Não informado.', 'O horário está no cadastro.', '5531993807167', 'Contato homologação', '7']);
    response = await send({ agentKey: undefined });
    assert.equal(response.status, 200);
    response = await send({ conversationId: 'other-tenant' });
    assert.equal(response.status, 404);
    response = await send({ agentKey: 'foreign-agent' });
    assert.equal(response.status, 404);
    response = await send({ agentKey: 'rafael' });
    assert.equal(response.status, 409);
    response = await send({ humanAnswer: ' ' });
    assert.equal(response.status, 400);
    tenant = 'tenant-b';
    response = await send();
    assert.equal(response.status, 404);
    tenant = null;
    response = await send();
    assert.equal(response.status, 401);
    tenant = 'tenant-a';
    databaseFailure = true;
    response = await send();
    assert.equal(response.status, 503);
    assert(!JSON.stringify(await response.json()).includes('private database details'));
    assert.equal(writes.length, 2);
    response = await fetch(base + '/config/ai/deploy-vps', { method: 'POST' });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).success, false);
  } finally {
    await new Promise(resolve => server.close(resolve));
    for (const [resolved, original] of originals) {
      if (original) require.cache[resolved] = original;
      else delete require.cache[resolved];
    }
    if (priorRoute) require.cache[routePath] = priorRoute;
    else delete require.cache[routePath];
  }
});
