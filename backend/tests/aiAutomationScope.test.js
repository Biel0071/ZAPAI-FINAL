const test = require('node:test');
const assert = require('node:assert/strict');

const settings = new Map();
let failRead = false;
const settingsPath = require.resolve('../src/data/repositories/systemSettingsRepository');
require.cache[settingsPath] = { exports: {
  getSetting: async key => { if (failRead) throw new Error('database unavailable'); return settings.has(key) ? { value: settings.get(key) } : null; },
  setSetting: async (key, value) => { settings.set(key, value); return { key, value }; },
} };
const togglePath = require.resolve('../src/infrastructure/config/aiToggle');
let toggle;
const scope = { mode: 'selected', sessionId: 'main', phones: ['+55 (31) 99380-7167'] };
const context = { companyId: 'tenant-a', sessionId: 'main', phone: '5531993807167' };
const ownSession = { assertSession: async (companyId, sessionId) => { assert.equal(companyId, 'tenant-a'); assert.equal(sessionId, 'main'); } };
test.beforeEach(() => { settings.clear(); failRead = false; delete require.cache[togglePath]; toggle = require(togglePath); });

test('scope persists by company and survives module reload without enabling global AI', async () => {
  await toggle.setAutomationScope(scope, 'tenant-a', ownSession);
  assert.equal(await toggle.getAIEnabled('tenant-a'), false);
  delete require.cache[togglePath]; toggle = require(togglePath);
  assert.deepEqual(await toggle.getAutomationScope('tenant-a'), { mode: 'selected', sessionId: 'main', phones: ['5531993807167'] });
  assert.deepEqual(await toggle.getAutomationScope('tenant-b'), { mode: 'all', sessionId: null, phones: [] });
});

test('selected scope allows only the company connection and Brazilian 12/13 digit aliases', async () => {
  await toggle.setAutomationScope(scope, 'tenant-a', ownSession);
  await toggle.setAIEnabled(true, 'tenant-a');
  for (const phone of ['5531993807167', '553193807167', '553193807167@s.whatsapp.net']) {
    assert.equal((await toggle.getAutomationPermission({ ...context, phone })).allowed, true);
  }
  for (const denied of [{ phone: '5531999990001' }, { sessionId: 'material' }, { companyId: 'tenant-b' }, { companyId: undefined }, { sessionId: undefined }, { phone: '123456789012345@lid' }, { phone: '1203632479@g.us' }]) {
    assert.equal((await toggle.getAutomationPermission({ ...context, ...denied }, { query: async () => ({ rows: [] }) })).allowed, false);
  }
});

test('global pause overrides selected scope, including previously queued replies', async () => {
  await toggle.setAutomationScope(scope, 'tenant-a', ownSession);
  assert.deepEqual(await toggle.getAutomationPermission(context), { allowed: false, reason: 'global_ai_off' });
  await toggle.setAIEnabled(true, 'tenant-a');
  assert.equal((await toggle.getAutomationPermission(context)).allowed, true);
  await toggle.setAIEnabled(false, 'tenant-a');
  assert.equal((await toggle.getAutomationPermission(context)).allowed, false);
});

test('empty selected list denies all and unset scope preserves all only with global AI on', async () => {
  await toggle.setAIEnabled(true, 'tenant-a');
  assert.equal((await toggle.getAutomationPermission(context)).allowed, true);
  await toggle.setAutomationScope({ ...scope, phones: [] }, 'tenant-a', ownSession);
  assert.equal((await toggle.getAutomationPermission(context)).allowed, false);
});

test('invalid persisted scopes and read failures deny automation rather than broadening it', async () => {
  await toggle.setAIEnabled(true, 'tenant-a');
  for (const value of ['not-json', '{}', '{"mode":"selected","sessionId":"main"}']) {
    settings.set('ai_automation_scope_v1:tenant-a', value);
    assert.equal((await toggle.getAutomationPermission(context)).allowed, false);
  }
  settings.delete('ai_automation_scope_v1:tenant-a'); failRead = true;
  assert.equal((await toggle.getAutomationPermission(context)).allowed, false);
});

test('invalid scope input, missing tenant, unowned connection and size limits never persist', async () => {
  for (const bad of [{ mode: 'unknown' }, { mode: 'selected', phones: [] }, { ...scope, phones: ['not-a-phone'] }, { ...scope, phones: Array(101).fill('5531993807167') }, { ...scope, phones: ['5'.repeat(9000)] }]) {
    await assert.rejects(toggle.setAutomationScope(bad, 'tenant-a', ownSession));
  }
  await assert.rejects(toggle.setAutomationScope(scope, undefined, ownSession));
  await assert.rejects(toggle.setAutomationScope(scope, 'tenant-a', { assertSession: async () => { throw new Error('Conexão não encontrada.'); } }));
  assert.equal(settings.size, 0);
});

test('scope changes take effect for the next check without stale process cache', async () => {
  await toggle.setAIEnabled(true, 'tenant-a');
  await toggle.setAutomationScope(scope, 'tenant-a', ownSession);
  assert.equal((await toggle.getAutomationPermission(context)).allowed, true);
  settings.set('ai_automation_scope_v1:tenant-a', JSON.stringify({ ...scope, phones: [] }));
  assert.equal((await toggle.getAutomationPermission(context)).allowed, false);
});

test('LID permission ignores global maps and requires a raw phone proven in the exact company connection', async () => {
  await toggle.setAIEnabled(true, 'tenant-a');
  await toggle.setAutomationScope(scope, 'tenant-a', ownSession);
  global.lidToPhoneMap = new Map([['123456789012345', context.phone]]);
  try {
    const lidContext = { ...context, phone: '123456789012345@lid' };
    const noProof = await toggle.getAutomationPermission(lidContext, { query: async (sql, params) => {
      assert.match(sql, /l\.company_id=c\.company_id/); assert.match(sql, /c\.session_id=\$2/);
      assert.deepEqual(params, ['tenant-a', 'main', '123456789012345@lid']); return { rows: [] };
    } });
    assert.equal(noProof.allowed, false);
    const ownProof = await toggle.getAutomationPermission(lidContext, { query: async () => ({ rows: [{ phone: context.phone }] }) });
    assert.equal(ownProof.allowed, true);
    const unresolvedStored = await toggle.getAutomationPermission(lidContext, { query: async () => ({ rows: [{ phone: '123456789012345@lid' }] }) });
    assert.equal(unresolvedStored.allowed, false);
  } finally { delete global.lidToPhoneMap; }
});

test('selected scopes of two globally enabled companies cannot share their selected phone implicitly', async () => {
  await toggle.setAIEnabled(true, 'tenant-a'); await toggle.setAIEnabled(true, 'tenant-b');
  await toggle.setAutomationScope(scope, 'tenant-a', ownSession);
  await toggle.setAutomationScope({ ...scope, phones: ['5531999990001'] }, 'tenant-b', { assertSession: async () => {} });
  assert.equal((await toggle.getAutomationPermission(context)).allowed, true);
  assert.equal((await toggle.getAutomationPermission({ ...context, companyId: 'tenant-b' })).allowed, false);
});

test('text and media transport recheck scope after an outstanding WhatsApp recipient lookup', async () => {
  await toggle.setAIEnabled(true, 'tenant-a');
  const statePath = require.resolve('../services/sessionStateService');
  require.cache[statePath] = { exports: { getWhatsappSession: () => ({ connected: true }) } };
  const senderPath = require.resolve('../services/whatsapp/outbound/senders');
  for (const type of ['text', 'image']) {
    await toggle.setAutomationScope(scope, 'tenant-a', ownSession);
    delete require.cache[senderPath];
    const senders = require(senderPath);
    let releaseLookup;
    let transportCalls = 0;
    let notifyLookup;
    const lookupStarted = new Promise(resolve => { notifyLookup = resolve; });
    const sock = { user: { id: 'own' }, ws: { readyState: 1 },
      onWhatsApp: () => { notifyLookup(); return new Promise(resolve => { releaseLookup = resolve; }); },
      sendMessage: async () => { transportCalls++; return { key: { id: 'must-not-send' } }; },
    };
    const options = { beforeSend: () => toggle.getAutomationPermission(context) };
    const pending = type === 'text' ? senders.sendMessage(sock, context.phone, 'Teste', options)
      : senders.sendMediaMessage(sock, context.phone, 'image', Buffer.from('fixture'), options);
    await lookupStarted;
    await toggle.setAutomationScope({ ...scope, phones: [] }, 'tenant-a', ownSession);
    releaseLookup([{ exists: true, jid: `${context.phone}@s.whatsapp.net` }]);
    await assert.rejects(pending, error => error.code === 'AUTOMATED_REPLY_CANCELLED');
    assert.equal(transportCalls, 0);
  }
});
