const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require.resolve('../src/api/controllers/sessionsController'), 'utf8');

function fixture() {
  const checks = [];
  const assignments = [];
  const sessionManager = {
    DEFAULT_SESSION: 'main',
    normalizeSessionName: value => String(value),
    getSession: () => ({ status: 'connected', sock: { onWhatsApp: async jid => {
      checks.push(jid);
      return [{ exists: true, jid }];
    } } }),
  };
  const agentService = { assignAgentToSession: async options => {
    assignments.push(options);
    return { success: true, sessionId: options.sessionId };
  } };
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, console,
    require: name => name.endsWith('/sessionManager') ? sessionManager
      : name.endsWith('/aiAgentService') ? agentService : {},
  }, { filename: 'sessionsController.js' });
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  return { controller: module.exports, checks, assignments, res };
}

test('session controller loads and exports independent number-check and attendant endpoints', () => {
  const { controller } = fixture();
  assert.equal(typeof controller.checkNumber, 'function');
  assert.equal(typeof controller.assignAttendant, 'function');
});

test('number check still returns the WhatsApp lookup result', async () => {
  const { controller, checks, res } = fixture();
  await controller.checkNumber({ params: { id: 'line-a', phone: '+55 (11) 99999-0001' } }, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.exists, true);
  assert.deepEqual(checks, ['5511999990001@s.whatsapp.net']);
});

test('attendant endpoint rejects missing authentication and uses the authenticated tenant', async () => {
  const { controller, assignments, res } = fixture();
  const req = { params: { id: 'line-a' }, body: { agentKey: ' camila ', companyId: 'tenant-b' } };
  await controller.assignAttendant(req, res);
  assert.equal(res.code, 401);
  assert.equal(assignments.length, 0);
  await controller.assignAttendant({ ...req, authTenantId: 'tenant-a' }, res);
  assert.equal(res.code, 200);
  assert.equal(assignments[0].companyId, 'tenant-a');
  assert.equal(assignments[0].sessionId, 'line-a');
  assert.equal(assignments[0].agentKey, 'camila');
});
