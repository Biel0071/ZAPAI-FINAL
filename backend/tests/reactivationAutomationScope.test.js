const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../services/reactivationService'), 'utf8');

async function fixture(pending, allowed = context => context.companyId === 'tenant-a' && context.sessionId === 'main') {
  const items = pending.map(item => ({ status: 'pending_opening', ...item }));
  const generated = [], queued = [], updates = [];
  const query = async (sql, params) => {
    if (sql.includes('CREATE TABLE')) return { rows: [], rowCount: 0 };
    if (sql.startsWith('SELECT *')) return { rows: items.filter(item => item.status === 'pending_opening') };
    if (sql.includes('SET last_message')) {
      if (sql.startsWith('UPDATE')) {
        assert.match(sql, /session_id = \$2/);
        return { rows: [], rowCount: 0 };
      }
      assert.match(sql, /session_id = EXCLUDED\.session_id/);
      const conflict = items.some(item => item.phone === params[0] && item.company_id === params[1] && item.session_id !== params[2]);
      return { rows: conflict ? [] : [{ id: 99 }], rowCount: conflict ? 0 : 1 };
    }
    if (sql.startsWith('UPDATE')) {
      assert.match(sql, /session_id = \$3/); updates.push(params);
      for (const item of items) if (item.phone === params[0] && item.company_id === params[1] && item.session_id === params[2]) item.status = sql.includes("status = 'completed'") ? 'completed' : 'processing';
      return { rows: [], rowCount: 1 };
    }
    return { rows: [] };
  };
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, console, Date, setInterval: () => 0,
    require: name => name.endsWith('/database') ? { query }
      : name.endsWith('/businessHours') ? { isBusinessOpen: () => true, businessHours: { open: '08:00' } }
        : name.endsWith('/aiToggle') ? { getAutomationPermission: async context => ({ allowed: allowed(context) }) }
          : name.endsWith('/ai.service') ? { processAI: async context => { generated.push(context); return { reply: 'Resposta' }; } }
            : name.endsWith('/outboundQueueService') ? { enqueue: async item => { queued.push(item); } } : {},
  }, { filename: 'reactivationService.js' });
  await Promise.resolve();
  return { service: module.exports, items, generated, queued, updates };
}

const phone = '5531993807167';
test('reactivation preserves other company and connection pending rows with the same phone', async () => {
  const f = await fixture([{ id: 1, company_id: 'tenant-a', session_id: 'main', phone }, { id: 2, company_id: 'tenant-a', session_id: 'material', phone }, { id: 3, company_id: 'tenant-b', session_id: 'main', phone }]);
  await f.service.checkAndDispatchReactivationQueue();
  assert.equal(f.generated.length, 1); assert.equal(f.queued.length, 1);
  assert.equal(f.queued[0].companyId, 'tenant-a'); assert.equal(f.queued[0].sessionId, 'main'); assert.equal(f.queued[0].metadata.ai_response, true);
  assert.equal(f.items[0].status, 'completed'); assert.equal(f.items[1].status, 'pending_opening'); assert.equal(f.items[2].status, 'pending_opening');
  assert.ok(f.updates.every(params => params[1] === 'tenant-a' && params[2] === 'main'));
});

test('a conflicting pending connection is refused without replacing it or falling back to memory', async () => {
  const f = await fixture([{ id: 1, company_id: 'tenant-a', session_id: 'main', phone }], context => context.sessionId === 'material');
  const result = await f.service.enqueueOutofHoursContact({ phone, companyId: 'tenant-a', sessionId: 'material', text: 'Teste' });
  assert.equal(result.reason, 'reactivation_session_conflict');
  await f.service.checkAndDispatchReactivationQueue();
  assert.equal(f.generated.length, 0); assert.equal(f.queued.length, 0); assert.equal(f.items[0].status, 'pending_opening');
});

test('global/scope denial stops reactivation before generation and leaves pending state intact', async () => {
  const f = await fixture([{ id: 1, company_id: 'tenant-a', session_id: 'main', phone }], () => false);
  await f.service.checkAndDispatchReactivationQueue();
  assert.equal(f.generated.length, 0); assert.equal(f.queued.length, 0); assert.equal(f.updates.length, 0);
});
