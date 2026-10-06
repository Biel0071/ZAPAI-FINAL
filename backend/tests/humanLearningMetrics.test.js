const test = require('node:test');
const assert = require('node:assert/strict');
const { HumanAttendanceLearner } = require('../src/ai/evolutionary/humanAttendanceLearner');
test.after(async () => require('../src/ai/evolutionary/humanAttendanceLearner').pool.end());

test('learning metrics preserve tenant-scoped zero and leave unmeasured quality unavailable', async () => {
  const calls = [];
  const engine = new HumanAttendanceLearner({ query: async (sql, params) => {
    calls.push({ sql, params });
    return { rows: [{ total: '0', total_exp: '0', human_samples: '0', positive_exp: '0' }] };
  } });
  const result = await engine.calculateAgentLevel({ companyId: 'tenant-empty' });
  assert.equal(result.totalHumanMessages, 0);
  assert.equal(result.totalXp, 0);
  assert.equal(result.evolutionScore, 0);
  assert.equal(result.naturalnessScore, null);
  assert.equal(result.successRate, null);
  assert.equal(result.conversionsCount, null);
  assert.ok(calls.every(call => call.params[0] === 'tenant-empty'));
});

test('learning metrics propagate query failure without fabricated progress', async () => {
  const engine = new HumanAttendanceLearner({ query: async () => { throw new Error('offline'); } });
  await assert.rejects(engine.calculateAgentLevel({ companyId: 'tenant-error' }), /offline/);
});

test('learned examples do not claim measured naturalness', async () => {
  const engine = new HumanAttendanceLearner({ query: async () => ({ rows: [{ id: 1, intent_detected: 'general', ai_reply: 'Actual reply' }] }) });
  const [pattern] = await engine.getLearnedPatterns({ companyId: 'tenant-a' });
  assert.equal(pattern.naturalnessRating, null);
});

test('learned examples distinguish query failure from an empty collection', async () => {
  const engine = new HumanAttendanceLearner({ query: async () => { throw new Error('offline'); } });
  await assert.rejects(engine.getLearnedPatterns({ companyId: 'tenant-error' }), /offline/);
});

test('manual learning reads only conversations from the requesting company', async () => {
  const calls = [];
  const engine = new HumanAttendanceLearner({ query: async (sql, params) => {
    calls.push({ sql, params });
    return { rows: [] };
  } });
  await engine.mineAndEvolveFromManualAttendance({ companyId: 'tenant-a', limit: 20 });
  assert.match(calls[0].sql, /c\.company_id = \$2/);
  assert.deepEqual(calls[0].params, [20, 'tenant-a']);
});
