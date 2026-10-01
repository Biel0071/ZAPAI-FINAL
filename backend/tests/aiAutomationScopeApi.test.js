const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../src/api/controllers/aiController'), 'utf8');

function fixture() {
  let enabled = false;
  let scope = { mode: 'all', sessionId: null, phones: [] };
  let failRead = false;
  const reads = [], writes = [];
  const toggle = {
    getAIEnabled: async tenant => { reads.push(tenant); return enabled; },
    setAIEnabled: async (value, tenant) => { writes.push({ tenant, enabled: value }); enabled = value; return enabled; },
    getAutomationScope: async tenant => { reads.push(tenant); if (failRead) throw new Error('scope unavailable'); return scope; },
    setAutomationScope: async (value, tenant) => { writes.push({ tenant, scope: value }); scope = value; return scope; },
  };
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, console,
    require: name => name.endsWith('/aiToggle') ? toggle : name.endsWith('/ai.service') ? { getAIIntegrationStatus: async () => ({ aiOn: true }) } : {},
  }, { filename: 'aiController.js' });
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  const req = { authTenantId: 'tenant-a', body: {}, query: { companyId: 'tenant-b' }, app: { locals: { store: {} } } };
  return { controller: module.exports, res, req, writes, reads, setFailRead: () => { failRead = true; } };
}

test('scope-only toggle saves authenticated company without activating global AI or reading query override', async () => {
  const f = fixture(); f.req.body = { companyId: 'tenant-b', automationScope: { mode: 'selected', sessionId: 'main', phones: [] } };
  await f.controller.toggle(f.req, f.res);
  assert.equal(f.res.code, 200); assert.equal(f.res.body.enabled, false);
  assert.equal(f.writes.length, 1); assert.equal(f.writes[0].tenant, 'tenant-a'); assert.ok(f.writes[0].scope);
  assert.ok(f.reads.every(tenant => tenant === 'tenant-a'));
});

test('scope endpoints reject missing authentication and keep global pause possible with unreadable scope', async () => {
  const f = fixture(); f.req.authTenantId = undefined; f.req.body = { automationScope: { mode: 'all' } };
  await f.controller.toggle(f.req, f.res); assert.equal(f.res.code, 401); assert.equal(f.writes.length, 0);
  await f.controller.status(f.req, f.res); assert.equal(f.res.code, 401);
  f.req.authTenantId = 'tenant-a'; f.setFailRead(); f.req.body = { aiEnabled: false };
  await f.controller.toggle(f.req, f.res); assert.equal(f.res.code, 200); assert.equal(f.res.body.enabled, false);
});

test('status surfaces unreadable scope and empty selected list as inactive while preserving actual global state', async () => {
  const f = fixture(); f.req.body = { aiEnabled: true, automationScope: { mode: 'selected', sessionId: 'main', phones: [] } };
  await f.controller.toggle(f.req, f.res);
  await f.controller.status(f.req, f.res); assert.equal(f.res.body.enabled, true); assert.equal(f.res.body.active, false);
  f.setFailRead(); await f.controller.status(f.req, f.res);
  assert.equal(f.res.body.enabled, true); assert.equal(f.res.body.active, false); assert.equal(f.res.body.automationScope, null);
  assert.match(f.res.body.automationScopeError, /bloqueadas/);
});
