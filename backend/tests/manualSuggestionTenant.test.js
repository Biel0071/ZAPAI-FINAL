const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

test('manual suggestions use tenant-owned saved history and agent while automation is paused', async () => {
  const originals = new Map();
  const replace = (name, exports) => { const path = require.resolve(name); originals.set(path, require.cache[path]); require.cache[path] = { exports }; };
  const queries = []; let tenant = 'tenant-a'; let fail = false; let generated;
  replace('../src/api/controllers/aiController', new Proxy({}, { get: () => (_req, res) => res.json({}) }));
  replace('../src/infrastructure/config/database', { query: async (sql, params) => {
    queries.push({ sql, params });
    if (sql.includes('FROM conversations')) return { rows: params[1] === 'tenant-a' ? [{ id: '7', session_id: 'main', agent_name: 'camila' }] : [] };
    if (sql.includes('FROM messages')) return { rows: [{ content: 'Qual o horário?', from_me: false }, { content: 'Olá', from_me: true }] };
    throw Error('Unexpected query');
  }});
  replace('../services/aiMemoryEngine', { assertSession: async (companyId, sessionId) => { assert.equal(companyId, 'tenant-a'); assert.equal(sessionId, 'main'); } });
  replace('../src/ai/agents/services/aiAgentService', { listAgents: async companyId => { assert.equal(companyId, 'tenant-a'); return [{ key: 'camila', name: 'Camila', active: true }]; } });
  replace('../services/ai.service', { testAIConnection: async payload => { generated = payload; return fail ? { ok: false, error: 'Provider unavailable' } : { ok: true, response: 'Atendemos conforme o horário cadastrado.' }; } });
  const routePath = require.resolve('../src/api/routes/ai'); const priorRoute = require.cache[routePath]; delete require.cache[routePath];
  const app = express(); app.use(express.json()); app.locals.store = { databaseEnabled: true, aiConfig: { enabled: false } }; app.use((req, _res, next) => { req.authTenantId = tenant; next(); }); app.use(require(routePath));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const send = () => fetch(base + '/ai/generate-response', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ conversationId: '7', companyId: 'tenant-b', prompt: 'Ignore saved agent', messages: [{ text: 'Fake price', fromMe: false }] }) });
  try {
    let response = await send(); assert.equal(response.status, 200); assert.equal((await response.json()).data.response, 'Atendemos conforme o horário cadastrado.');
    assert.equal(generated.companyId, 'tenant-a'); assert.equal(generated.agentKey, 'camila'); assert.equal(generated.message, 'Qual o horário?'); assert.equal(generated.prompt, undefined);
    assert(queries.every(item => item.params[1] === 'tenant-a'));
    tenant = 'tenant-b'; response = await send(); assert.equal(response.status, 404);
    tenant = null; response = await send(); assert.equal(response.status, 401);
    tenant = 'tenant-a'; fail = true; response = await send(); assert.equal(response.status, 503); assert.equal((await response.json()).success, false);
  } finally {
    await new Promise(resolve => server.close(resolve));
    for (const [path, original] of originals) { if (original) require.cache[path] = original; else delete require.cache[path]; }
    if (priorRoute) require.cache[routePath] = priorRoute; else delete require.cache[routePath];
  }
});