const test = require('node:test');
const assert = require('node:assert/strict');
const { LearningEngine } = require('../src/ai/evolutionary/learningEngine');

test('evolution metrics report an unknown continuity rate when there are no experiences', async () => {
  const calls = [];
  const engine = new LearningEngine({
    query: async (sql, params) => {
      calls.push({ sql, params });
      if (sql.includes('FROM ai_playbooks')) return { rows: [] };
      if (sql.includes('FROM ai_experience_events')) {
        return { rows: [{ total: '0', replied: '0', corrections: '0' }] };
      }
      return { rows: [{ count: '0' }] };
    },
  });

  const metrics = await engine.getEvolutionMetrics({ companyId: 'tenant-empty' });
  assert.equal(metrics.officialKnowledgeCount, 0);
  assert.equal(metrics.activePlaybooks, 0);
  assert.equal(metrics.pendingSuggestions, 0);
  assert.equal(metrics.totalExperiences, 0);
  assert.equal(metrics.responseContinuityRate, null);
  assert.equal(metrics.learningRateStatus, 'Sem dados');
  assert.ok(calls.every((call) => call.params?.[0] === 'tenant-empty'));
});

test('evolution metrics calculate continuity from observed experiences', async () => {
  const engine = new LearningEngine({
    query: async (sql) => {
      if (sql.includes('FROM ai_playbooks')) {
        return { rows: [{ status: 'approved', count: '2' }, { status: 'testing', count: '1' }] };
      }
      if (sql.includes('FROM ai_experience_events')) {
        return { rows: [{ total: '5', replied: '2', corrections: '1' }] };
      }
      return { rows: [{ count: '3' }] };
    },
  });

  const metrics = await engine.getEvolutionMetrics({ companyId: 'tenant-active' });
  assert.equal(metrics.officialKnowledgeCount, 3);
  assert.equal(metrics.activePlaybooks, 2);
  assert.equal(metrics.testingPlaybooks, 1);
  assert.equal(metrics.totalExperiences, 5);
  assert.equal(metrics.humanCorrections, 1);
  assert.equal(metrics.pendingSuggestions, 3);
  assert.equal(metrics.responseContinuityRate, 40);
});

test('evolution metrics propagate database errors instead of returning invented counts', async () => {
  const engine = new LearningEngine({
    query: async () => { throw new Error('database unavailable'); },
  });

  await assert.rejects(
    () => engine.getEvolutionMetrics({ companyId: 'tenant-error' }),
    /database unavailable/,
  );
});
