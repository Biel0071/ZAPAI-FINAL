const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ExperienceEngine } = require('../src/ai/evolutionary/experienceEngine');

test('feedback without a persisted experience reports failure', async () => {
  const engine = new ExperienceEngine({ query: async () => ({ rows: [], rowCount: 0 }) });
  assert.deepEqual(await engine.recordFeedback({ companyId: 'company-a', conversationId: 'chat-a', rating: 'positive' }), { ok: false, error: 'Nenhuma experiência encontrada para este atendimento.' });
});
test('feedback updates only the requested tenant and returns the persisted event', async () => {
  let params; const engine = new ExperienceEngine({ query: async (_sql, values) => { params = values; return { rows: [{ id: 42 }], rowCount: 1 }; } });
  assert.deepEqual(await engine.recordFeedback({ companyId: 'company-a', conversationId: 'chat-a', rating: 'positive' }), { ok: true, eventId: 42 });
  assert.equal(params[3], 'chat-a'); assert.equal(params[4], 'company-a');
});
test('explicit event feedback confirms the matched event instead of any successful query', async () => {
  const engine = new ExperienceEngine({ query: async () => ({ rows: [], rowCount: 0 }) });
  assert.equal((await engine.recordFeedback({ companyId: 'company-b', eventId: 42, rating: 'negative' })).ok, false);
});
test('feedback validates tenant, target and rating before querying', async () => {
  let queries = 0; const engine = new ExperienceEngine({ query: async () => { queries++; return { rows: [] }; } });
  for (const input of [
    { companyId: '', conversationId: 'chat-a', rating: 'positive' },
    { companyId: 'company-a', rating: 'positive' },
    { companyId: 'company-a', conversationId: 'chat-a', rating: 'unsupported' },
  ]) assert.equal((await engine.recordFeedback(input)).ok, false);
  assert.equal(queries, 0);
});
test('teaching persists the correction in the field consumed by learning and targets the displayed reply', async () => {
  let sql, params;
  const engine = new ExperienceEngine({ query: async (query, values) => { sql = query; params = values; return { rows: [{ id: 42 }] }; } });
  const result = await engine.recordFeedback({ companyId: 'company-a', conversationId: 'chat-a', rating: 'corrected', note: 'Resposta corrigida', aiResponseText: 'Resposta exibida' });
  assert.equal(result.ok, true);
  assert.match(sql, /human_correction_text\s*=\s*CASE/);
  assert.match(sql, /ai_reply\s*=\s*\$7/);
  assert.equal(params[5], 'Resposta corrigida');
  assert.equal(params[6], 'Resposta exibida');
});
