const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');

const source = fs.readFileSync(require.resolve('../src/ai/agents/services/aiAgentService'), 'utf8');
const copy = value => JSON.parse(JSON.stringify(value));

function fixture({ agents, profiles = [], failProfile = false } = {}) {
  let savedAgents = copy(agents || [
    { key: 'sales', name: 'Vendas', active: true, sessionIds: ['line-a'], storeId: 'store-a' },
    { key: 'support', name: 'Suporte', active: true, sessionIds: [], storeId: null },
  ]);
  let savedProfiles = copy(profiles);
  const stores = [
    { company_id: 'tenant-a', id: 'store-a', name: 'Loja A', knowledge: 'CATALOGO_LOJA_A' },
    { company_id: 'tenant-a', id: 'store-b', name: 'Loja B', knowledge: 'CATALOGO_LOJA_B' },
  ];
  const statements = [];
  const settings = {
    getSetting: async key => ({ key, value: JSON.stringify(savedAgents) }),
    setSetting: async (key, value) => { statements.push({ sql: 'legacy cache persistence', params: [key] }); savedAgents = JSON.parse(value); },
  };
  const runQuery = async (sql, params, transaction) => {
    statements.push({ sql, params });
    if (sql.includes('FROM sessions')) {
      if (sql.includes('COUNT(*)')) return { rows: [{ count: params[0] === 'tenant-a' ? 2 : 0 }] };
      return { rows: params[0] === 'tenant-a' && ['line-a', 'line-b'].includes(params[1]) ? [{ session_id: params[1] }] : [] };
    }
    if (sql.includes('FROM system_settings')) return { rows: [{ value: JSON.stringify(transaction?.agents || savedAgents) }] };
    if (sql.includes('INSERT INTO system_settings')) {
      if (transaction) transaction.agents = JSON.parse(params[1]);
      else savedAgents = JSON.parse(params[1]);
      return { rows: [] };
    }
    if (sql.includes('FROM session_ai_profiles')) return { rows: (transaction?.profiles || savedProfiles).filter(profile => profile.company_id === params[0] && profile.session_id === params[1]) };
    if (sql.includes('FROM ai_stores')) {
      if (sql.includes('JOIN session_ai_profiles')) {
        const profile = savedProfiles.find(item => item.company_id === params[0] && item.session_id === params[1]);
        return { rows: stores.filter(store => store.company_id === params[0] && store.id === profile?.store_id) };
      }
      return { rows: stores.filter(store => store.company_id === params[0] && (params.length === 1 || store.id === params[1])).slice(0, 1) };
    }
    if (sql.includes('INSERT INTO session_ai_profiles')) {
      if (failProfile) throw new Error('profile persistence unavailable');
      const target = transaction?.profiles || savedProfiles;
      const existing = target.find(profile => profile.company_id === params[0] && profile.session_id === params[1]);
      if (!existing) target.push({ company_id: params[0], session_id: params[1], store_id: params[2] });
      else if (!sql.includes('DO NOTHING')) existing.store_id = params[2];
      return { rows: [] };
    }
    if (sql.includes('INSERT INTO ai_agent_versions')) return { rows: [] };
    throw new Error('Unexpected query: ' + sql);
  };
  const pool = {
    query: (sql, params) => runQuery(sql, params),
    async connect() {
      let transaction;
      return {
        async query(sql, params) {
          if (sql === 'BEGIN') { transaction = { agents: copy(savedAgents), profiles: copy(savedProfiles) }; statements.push({ sql }); return { rows: [] }; }
          if (sql === 'COMMIT') { savedAgents = transaction.agents; savedProfiles = transaction.profiles; statements.push({ sql }); return { rows: [] }; }
          if (sql === 'ROLLBACK') { statements.push({ sql }); return { rows: [] }; }
          if (sql.includes('pg_advisory_xact_lock')) { statements.push({ sql, params }); return { rows: [] }; }
          return runQuery(sql, params, transaction);
        },
        release() {},
      };
    },
  };
  const database = { pool, query: (sql, params) => runQuery(sql, params) };
  const memory = { assertSession: async (companyId, sessionId, client = database) => {
    const found = await client.query('SELECT session_id FROM sessions WHERE company_id=$1 AND session_id=$2', [companyId, sessionId]);
    if (!found.rows.length) throw new Error('Conexão não encontrada.');
  } };
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, console,
    process: { env: { DEFAULT_COMPANY_ID: 'default' } },
    require: name => name.endsWith('/systemSettingsRepository') ? settings
      : name.endsWith('/config/database') ? database
      : name.endsWith('/aiMemoryEngine') ? memory
      : name === 'crypto' ? crypto : {},
  }, { filename: 'aiAgentService.js' });
  return {
    service: module.exports, statements,
    agents: () => copy(savedAgents), profiles: () => copy(savedProfiles),
    replaceAgents: value => { savedAgents = copy(value); },
    assign: (agentKey, sessionId = 'line-a', companyId = 'tenant-a') => module.exports.assignAgentToSession({ companyId, sessionId, agentKey }),
  };
}

test('assignment rejects another company connection before changing any attendant', async () => {
  const f = fixture();
  const original = f.agents();
  await assert.rejects(() => f.assign('support', 'line-foreign'), /Conexão não encontrada/);
  assert.deepEqual(f.agents(), original);
  assert.ok(!f.statements.some(statement => /INSERT INTO system_settings|legacy cache persistence/.test(statement.sql)));
});

test('assignment requires an explicit company instead of using the default tenant', async () => {
  const f = fixture();
  for (const companyId of [null, '', ' ']) {
    await assert.rejects(() => f.assign('sales', 'line-a', companyId), /Empresa obrigatória/);
  }
  assert.equal(f.statements.length, 0);
});

test('assignment rejects an unknown attendant without removing the current one', async () => {
  const f = fixture();
  const original = f.agents();
  await assert.rejects(() => f.assign('missing'), /Atendente não encontrado/);
  assert.deepEqual(f.agents(), original);
});

for (const agentKey of [null, 'support']) {
  test(`losing the last WhatsApp pauses the former attendant (${agentKey ? 'replacement' : 'removal'})`, async () => {
    const f = fixture();
    await f.assign(agentKey);
    const former = f.agents().find(agent => agent.key === 'sales');
    assert.deepEqual(former.sessionIds, []);
    assert.equal(former.active, false);
    assert.equal(former.status, 'paused');
    if (agentKey) {
      const recipient = f.agents().find(agent => agent.key === agentKey);
      assert.equal(recipient.active, true);
      assert.deepEqual(recipient.sessionIds, ['line-a']);
    }
    await f.service.listAgents('tenant-a');
    assert.ok(f.service.getActiveAgentsSync('tenant-a').every(agent => agent.key !== 'sales'));
  });
}

test('removing one link preserves an attendant still assigned to another WhatsApp and untouched legacy attendants', async () => {
  const f = fixture({ agents: [
    { key: 'sales', name: 'Vendas', active: true, status: 'active', sessionIds: ['line-a', 'line-b'] },
    { key: 'legacy', name: 'Legado', active: true, status: 'active', sessionIds: [] },
  ] });
  await f.assign(null);
  const [sales, legacy] = f.agents();
  assert.deepEqual(sales.sessionIds, ['line-b']);
  assert.equal(sales.active, true);
  assert.equal(sales.status, 'active');
  assert.deepEqual(legacy.sessionIds, []);
  assert.equal(legacy.active, true);
  assert.equal(legacy.status, 'active');
});

test('reassigning the same attendant preserves its activation and single WhatsApp link', async () => {
  const f = fixture();
  await f.assign('sales');
  const sales = f.agents().find(agent => agent.key === 'sales');
  assert.equal(sales.active, true);
  assert.deepEqual(sales.sessionIds, ['line-a']);
});

test('assignment keeps concurrent configuration edits instead of overwriting them with cached agents', async () => {
  const f = fixture();
  await f.service.listAgents('tenant-a');
  const edited = f.agents();
  edited[1].name = 'Suporte revisado';
  f.replaceAgents(edited);
  const result = await f.assign('support');
  assert.equal(result.success, true);
  assert.equal(result.assignedAgent.name, 'Suporte revisado');
  assert.deepEqual(f.agents()[0].sessionIds, []);
  assert.deepEqual(f.agents()[1].sessionIds, ['line-a']);
  assert.ok(f.statements.some(statement => statement.sql.includes('pg_advisory_xact_lock')));
});

test('changing or removing attendants preserves the store explicitly chosen for the WhatsApp', async () => {
  const profile = { company_id: 'tenant-a', session_id: 'line-a', store_id: 'store-b' };
  const f = fixture({ profiles: [profile] });
  await f.assign('sales');
  assert.deepEqual(f.profiles(), [profile]);
  await f.assign('support');
  assert.deepEqual(f.profiles(), [profile]);
  await f.assign(null);
  assert.deepEqual(f.profiles(), [profile]);
  assert.ok(f.agents().every(agent => !agent.sessionIds.includes('line-a')));
});

test('assignment preserves an explicitly cleared store and initializes only a missing profile', async () => {
  const empty = { company_id: 'tenant-a', session_id: 'line-a', store_id: null };
  const f = fixture({ profiles: [empty] });
  await f.assign('sales');
  assert.deepEqual(f.profiles(), [empty]);
  await f.assign('sales', 'line-b');
  assert.equal(f.profiles().find(profile => profile.session_id === 'line-b').store_id, 'store-a');
});

test('a profile persistence failure rolls back the attendant reassignment', async () => {
  const f = fixture({ failProfile: true });
  const original = f.agents();
  await assert.rejects(() => f.assign('sales', 'line-b'), /profile persistence unavailable/);
  assert.deepEqual(f.agents(), original);
  assert.deepEqual(f.profiles(), []);
  assert.ok(f.statements.some(statement => statement.sql === 'ROLLBACK'));
});

test('a copied attendant starts paused without any WhatsApp assignment', async () => {
  const f = fixture();
  const copied = await f.service.cloneAgent('sales', 'tenant-a');
  assert.equal(copied.active, false);
  assert.equal(copied.sessionIds.length, 0);
  assert.equal(copied.storeId, 'store-a');
  assert.deepEqual(f.agents()[0].sessionIds, ['line-a']);
});

test('an unassigned WhatsApp does not inherit the first store knowledge', async () => {
  const f = fixture();
  await f.service.listAgents('tenant-a');
  assert.equal(await f.service.sessionKnowledge('tenant-a', 'line-b'), '');
});

test('an explicitly cleared WhatsApp store does not inherit the attendant old store', async () => {
  const f = fixture({ profiles: [{ company_id: 'tenant-a', session_id: 'line-a', store_id: null }] });
  await f.service.listAgents('tenant-a');
  assert.equal(await f.service.sessionKnowledge('tenant-a', 'line-a'), '');
});

test('WhatsApp store knowledge takes precedence, with an explicit attendant link only for legacy profiles', async () => {
  const f = fixture({ profiles: [{ company_id: 'tenant-a', session_id: 'line-a', store_id: 'store-b' }] });
  await f.service.listAgents('tenant-a');
  const knowledge = await f.service.sessionKnowledge('tenant-a', 'line-a');
  assert.match(knowledge, /CATALOGO_LOJA_B/);
  assert.doesNotMatch(knowledge, /CATALOGO_LOJA_A/);
  const legacy = fixture();
  await legacy.service.listAgents('tenant-a');
  assert.match(await legacy.service.sessionKnowledge('tenant-a', 'line-a'), /CATALOGO_LOJA_A/);
  assert.equal(await legacy.service.sessionKnowledge('tenant-b', 'line-a'), '');
});

test('a new attendant may be configured paused before a WhatsApp is assigned', async () => {
  const f = fixture();
  const created = await f.service.createAgent({ key: 'draft', name: 'Em preparo', active: false, sessionIds: [] }, 'tenant-a');
  assert.equal(created.active, false);
  assert.equal(created.status, 'paused');
  assert.equal(created.sessionIds.length, 0);
  assert.equal(f.agents().find(agent => agent.key === 'draft').active, false);
  assert.ok(!f.statements.some(statement => statement.sql.includes('FROM sessions')));
});

test('new active or implicitly active attendants still require a WhatsApp assignment', async () => {
  for (const active of [true, undefined]) {
    const f = fixture();
    await assert.rejects(() => f.service.createAgent({ key: 'draft', active, sessionIds: [] }, 'tenant-a'), /Selecione pelo menos um WhatsApp/);
    assert.ok(!f.agents().some(agent => agent.key === 'draft'));
  }
});

test('paused creation still validates every supplied WhatsApp belongs to the company', async () => {
  const f = fixture();
  await assert.rejects(() => f.service.createAgent({ key: 'draft', active: false, sessionIds: ['line-foreign'] }, 'tenant-a'), /Conexão não encontrada/);
  assert.ok(!f.agents().some(agent => agent.key === 'draft'));
});

test('a new attendant with a valid WhatsApp retains normal creation behavior', async () => {
  const f = fixture();
  const created = await f.service.createAgent({ key: 'new-sales', active: true, sessionIds: ['line-b'] }, 'tenant-a');
  assert.equal(created.active, true);
  assert.equal(created.sessionIds[0], 'line-b');
  assert.ok(f.statements.some(statement => statement.sql.includes('FROM sessions') && statement.params[0] === 'tenant-a' && statement.params[1] === 'line-b'));
});

test('switching to a paused attendant preserves its activation, instructions, memory and existing session profile', async () => {
  const profile = { company_id: 'tenant-a', session_id: 'line-a', store_id: 'store-b', segment: 'Moda', service_type: 'Consultivo', evolution_mode: 'paused' };
  const f = fixture({ profiles: [profile], agents: [
    { key: 'sales', active: true, sessionIds: ['line-a'] },
    { key: 'support', active: false, status: 'paused', sessionIds: [], memory: 'Memória original', personality: 'Instruções revisadas' },
  ] });
  const result = await f.assign('support');
  assert.equal(result.assignedAgent.active, false);
  assert.equal(result.assignedAgent.status, 'paused');
  assert.equal(result.assignedAgent.memory, 'Memória original');
  assert.equal(result.assignedAgent.personality, 'Instruções revisadas');
  assert.deepEqual(f.profiles(), [profile]);
  assert.ok(!f.statements.some(s => /UPDATE sessions|ai_conversation_memory|session_ai_profiles.*UPDATE|DELETE/i.test(s.sql)));
});

for (const key of ['support', null]) {
  test(`legacy WhatsApp store is preserved when ${key ? 'switching' : 'removing'} its attendant before a profile exists`, async () => {
    const f = fixture({ agents: [
      { key: 'sales', active: true, sessionIds: ['line-a'], storeId: 'store-a', segment: 'Original' },
      { key: 'support', active: false, sessionIds: [], storeId: 'store-b' },
    ] });
    await f.assign(key);
    assert.equal(f.profiles().find(profile => profile.session_id === 'line-a')?.store_id, 'store-a');
    await f.service.listAgents('tenant-a');
    assert.match(await f.service.sessionKnowledge('tenant-a', 'line-a'), /CATALOGO_LOJA_A/);
  });
}

test('creating an attendant explicitly replaces previous ownership without changing WhatsApp commercial context', async () => {
  const f = fixture();
  const created = await f.service.createAgent({ key: 'new-owner', active: false, sessionIds: ['line-a'], storeId: 'store-b' }, 'tenant-a');
  assert.equal(created.active, false);
  assert.deepEqual(f.agents().filter(agent => agent.sessionIds.includes('line-a')).map(agent => agent.key), ['new-owner']);
  assert.equal(f.profiles().find(profile => profile.session_id === 'line-a').store_id, 'store-a');
});

test('updating supplied connection assignments cleans conflicting owners and preserves target activation', async () => {
  const f = fixture({ agents: [
    { key: 'sales', active: true, sessionIds: ['line-a'], storeId: 'store-a' },
    { key: 'support', active: false, status: 'paused', sessionIds: [], storeId: 'store-b' },
    { key: 'duplicate', active: true, sessionIds: ['line-a', 'line-b'] },
  ] });
  const updated = await f.service.updateAgent('support', { sessionIds: ['line-a'] }, 'tenant-a');
  assert.equal(updated.active, false);
  assert.deepEqual(f.agents().filter(agent => agent.sessionIds.includes('line-a')).map(agent => agent.key), ['support']);
  assert.deepEqual(f.agents().find(agent => agent.key === 'duplicate').sessionIds, ['line-b']);
  assert.equal(f.agents().find(agent => agent.key === 'duplicate').active, true);
  assert.equal(f.profiles()[0].store_id, 'store-a');
});

test('removing a connection through a profile edit preserves its legacy store and remaining ownership', async () => {
  const f = fixture({ agents: [{ key: 'sales', active: true, sessionIds: ['line-a', 'line-b'], storeId: 'store-a' }] });
  const edited = await f.service.updateAgent('sales', { sessionIds: ['line-b'] }, 'tenant-a');
  assert.deepEqual(Array.from(edited.sessionIds), ['line-b']);
  assert.equal(edited.active, true);
  assert.equal(f.profiles().find(profile => profile.session_id === 'line-a')?.store_id, 'store-a');
});

test('deleting an attendant preserves the commercial profile of every linked WhatsApp', async () => {
  const f = fixture();
  await f.service.deleteAgent('sales', 'tenant-a');
  assert.ok(!f.agents().some(agent => agent.key === 'sales'));
  assert.equal(f.profiles().find(profile => profile.session_id === 'line-a')?.store_id, 'store-a');
});

test('conflicting legacy stores are never chosen by list order and a switch materializes an empty commercial profile', async () => {
  for (const reverse of [false, true]) {
    const conflicting = [
      { key: 'one', active: true, sessionIds: ['line-a'], storeId: 'store-a' },
      { key: 'two', active: true, sessionIds: ['line-a'], storeId: 'store-b' },
    ];
    const f = fixture({ agents: [...(reverse ? conflicting.reverse() : conflicting), { key: 'target', active: false, sessionIds: [], storeId: 'store-a' }] });
    await f.service.listAgents('tenant-a');
    assert.equal(await f.service.sessionKnowledge('tenant-a', 'line-a'), '');
    await f.assign('target');
    assert.equal(f.profiles().find(profile => profile.session_id === 'line-a')?.store_id, null);
    await f.service.listAgents('tenant-a');
    assert.equal(await f.service.sessionKnowledge('tenant-a', 'line-a'), '');
    assert.deepEqual(f.agents().filter(agent => agent.sessionIds.includes('line-a')).map(agent => agent.key), ['target']);
  }
});

test('a shared unique legacy store remains authoritative even if several old attendants overlap', async () => {
  const f = fixture({ agents: [
    { key: 'one', active: true, sessionIds: ['line-a'], storeId: 'store-a' },
    { key: 'two', active: true, sessionIds: ['line-a'], storeId: 'store-a' },
    { key: 'target', active: false, sessionIds: [], storeId: 'store-b' },
  ] });
  await f.assign('target');
  assert.equal(f.profiles()[0].store_id, 'store-a');
});

test('a WhatsApp whose previous attendant has no store does not inherit the replacement old store', async () => {
  const f = fixture({ agents: [
    { key: 'previous', active: true, sessionIds: ['line-a'], storeId: null },
    { key: 'target', active: false, sessionIds: [], storeId: 'store-b' },
  ] });
  await f.assign('target');
  assert.equal(f.profiles()[0]?.store_id, null);
  await f.service.listAgents('tenant-a');
  assert.equal(await f.service.sessionKnowledge('tenant-a', 'line-a'), '');
});
