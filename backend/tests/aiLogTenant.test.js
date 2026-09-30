const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');

test('AI logs and metrics isolate canonical conversations and reject unowned fallback records', async () => {
  const dbPath = require.resolve('../src/infrastructure/config/database');
  const priorDb = require.cache[dbPath];
  const servicePath = require.resolve('../services/aiLogService');
  const priorService = require.cache[servicePath];
  const fsOriginals = {};
  let stored = JSON.stringify([
    { companyId: 'tenant-a', sessionId: 'main', conversationId: '7', timestamp: new Date().toISOString(), totalTokens: 5, promptTokens: 2, completionTokens: 3 },
    { companyId: 'tenant-b', sessionId: 'main', conversationId: '8', timestamp: new Date().toISOString(), totalTokens: 9999 },
    { sessionId: 'main', conversationId: 'unknown', timestamp: new Date().toISOString(), totalTokens: 9999 },
    { companyId: 'tenant-a', sessionId: 'other', conversationId: '9', timestamp: new Date().toISOString(), totalTokens: 9999 },
  ]);
  for (const name of ['access', 'mkdir', 'readFile', 'writeFile', 'rename']) fsOriginals[name] = fs[name];
  fs.access = async () => {};
  fs.mkdir = async () => {};
  fs.readFile = async () => stored;
  fs.writeFile = async (_path, content) => { stored = content; };
  fs.rename = async () => {};
  let unavailable = true;
  const queries = [];
  require.cache[dbPath] = { exports: { query: async (sql, params) => {
    queries.push({ sql, params });
    if (unavailable) throw Error('test unavailable');
    if (sql.includes('FROM conversations')) return { rows: [{ id: '7', session_id: 'main' }] };
    if (sql.includes('INSERT INTO ai_logs')) return { rows: [] };
    assert(sql.includes('JOIN conversations'));
    assert(sql.includes('c.company_id = $1'));
    assert.deepEqual(params, ['tenant-a', 'main']);
    if (sql.includes('GROUP BY')) return { rows: [{ conversation_id: '7', total: 7 }] };
    if (sql.includes('COUNT(*)')) return { rows: [{ total: 7, prompt: 3, completion: 4, count: 1 }] };
    return { rows: [{ conversationId: '7' }] };
  } } };
  delete require.cache[servicePath];
  const service = require(servicePath);
  try {
    const store = { databaseEnabled: true, activeCompanyId: 'tenant-b' };
    const fallbackLogs = await service.getLogs(store, 'main', 'tenant-a');
    assert.equal(fallbackLogs.length, 1);
    assert.equal(fallbackLogs[0].conversationId, '7');
    const fallbackMetrics = await service.getMetrics(store, 'main', 'tenant-a');
    assert.equal(fallbackMetrics.tokensToday, 5);
    assert.equal(fallbackMetrics.messagesToday, 1);
    assert.deepEqual(fallbackMetrics.tokensPerConversation, { 7: 5 });
    assert.equal(fallbackMetrics.avgLatencyMs, null);
    await assert.rejects(() => service.getLogs(store, 'main'), /company|tenant|empresa/i);
    await assert.rejects(() => service.getMetrics(store, 'main'), /company|tenant|empresa/i);
    await assert.rejects(() => service.saveLogEntry({ conversationId: '7' }, store), /company|tenant|empresa/i);
    unavailable = false;
    await service.saveLogEntry({ companyId: 'tenant-a', conversationId: '5531993807167', sessionId: 'main', totalTokens: 2 }, store);
    const inserted = queries.find(item => item.sql.includes('INSERT INTO ai_logs'));
    assert.equal(inserted.params[0], '7');
    const saved = JSON.parse(stored)[0];
    assert.equal(saved.companyId, 'tenant-a');
    assert.equal(saved.conversationId, '7');
    const logs = await service.getLogs(store, 'main', 'tenant-a');
    assert.deepEqual(logs, [{ conversationId: '7' }]);
    const metrics = await service.getMetrics(store, 'main', 'tenant-a');
    assert.equal(metrics.tokensToday, 7);
    assert.equal(metrics.avgLatencyMs, null);
    assert.equal(metrics.socketLatencyMs, null);
    assert.equal(metrics.model, null);
    assert.equal(metrics.provider, null);
  } finally {
    for (const [name, original] of Object.entries(fsOriginals)) fs[name] = original;
    if (priorDb) require.cache[dbPath] = priorDb; else delete require.cache[dbPath];
    if (priorService) require.cache[servicePath] = priorService; else delete require.cache[servicePath];
  }
});
