const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const express = require('express');

function loadEngine() {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('../services/aiVoiceEngine'), 'utf8'), { module, exports: module.exports });
  return module.exports;
}

test('voice profiles require an explicit company instead of sharing default business state', () => {
  const engine = loadEngine();
  for (const companyId of [undefined, null, '', ' ']) {
    assert.throws(() => engine.saveVoiceProfile({ agentId: 'camila', voiceId: 'aurora', companyId }), /Empresa obrigatória/);
    assert.throws(() => engine.getVoiceProfile('camila', companyId), /Empresa obrigatória/);
  }
});

test('the same attendant identity has separate voice profiles for each company', () => {
  const engine = loadEngine();
  engine.saveVoiceProfile({ agentId: 'camila', companyId: 'tenant-a', voiceId: 'aurora', params: { pitch: 1 } });
  engine.saveVoiceProfile({ agentId: 'camila', companyId: 'tenant-b', voiceId: 'luna', params: { pitch: 2 } });
  assert.equal(engine.getVoiceProfile('camila', 'tenant-a').voiceId, 'aurora');
  assert.equal(engine.getVoiceProfile('camila', 'tenant-b').voiceId, 'luna');
  assert.equal(engine.getVoiceProfile('camila', 'tenant-c'), null);
});

test('company and attendant identity separators cannot collide', () => {
  const engine = loadEngine();
  engine.saveVoiceProfile({ agentId: 'camila', companyId: 'tenant:a', voiceId: 'aurora' });
  engine.saveVoiceProfile({ agentId: 'a:camila', companyId: 'tenant', voiceId: 'luna' });
  assert.equal(engine.getVoiceProfile('camila', 'tenant:a').voiceId, 'aurora');
  assert.equal(engine.getVoiceProfile('a:camila', 'tenant').voiceId, 'luna');
});

test('voice profile route rejects missing authentication and ignores body tenant overrides', async t => {
  const engine = loadEngine();
  const module = { exports: {} };
  const controller = new Proxy({}, { get: () => (_req, res) => res.json({}) });
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/api/routes/ai'), 'utf8'), {
    module, exports: module.exports, console,
    require: name => name === 'express' ? express
      : name.endsWith('/aiController') ? controller
      : name.endsWith('/aiVoiceEngine') ? engine : {},
  });
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.authTenantId = req.headers['x-test-tenant']; next(); });
  app.use(module.exports);
  const server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = 'http://127.0.0.1:' + server.address().port + '/ai/voices/profiles';
  const save = (tenant, voiceId) => fetch(url, {
    method: 'POST', headers: { 'content-type': 'application/json', ...(tenant ? { 'x-test-tenant': tenant } : {}) },
    body: JSON.stringify({ agentId: 'camila', voiceId, params: {}, companyId: 'tenant-forged' }),
  });
  const unauthenticated = await save(null, 'unauthenticated');
  assert.equal(unauthenticated.status, 401);
  assert.equal((await save('tenant-a', 'aurora')).status, 200);
  assert.equal((await save('tenant-b', 'luna')).status, 200);
  assert.equal(engine.getVoiceProfile('camila', 'tenant-a').voiceId, 'aurora');
  assert.equal(engine.getVoiceProfile('camila', 'tenant-b').voiceId, 'luna');
  assert.equal(engine.getVoiceProfile('camila', 'tenant-forged'), null);
});
