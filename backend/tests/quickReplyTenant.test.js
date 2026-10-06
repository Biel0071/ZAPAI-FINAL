const test = require('node:test');
const assert = require('node:assert/strict');
function stub(path, exports) { const id = require.resolve(path); require.cache[id] = { id, filename: id, loaded: true, exports }; }
let fileItems = [
  { id: 'file-a', companyId: 'tenant-a', title: 'Loja A', content: 'A', items: [{ type: 'text', value: 'A' }] },
  { id: 'file-b', companyId: 'tenant-b', title: 'Loja B', content: 'B' },
  { id: 'global', title: 'Legado sem empresa', content: 'Privado' },
];
const queries = [];
const settings = new Map();
let settingsUnavailable = false;
stub('fs/promises', { mkdir: async () => {}, access: async () => {}, readFile: async () => JSON.stringify(fileItems), writeFile: async (_path, text) => { fileItems = JSON.parse(text); }, rename: async () => {} });
stub('../src/infrastructure/config/ai', {});
stub('../src/infrastructure/config/database', { async query(sql, params) {
  queries.push({ sql, params });
  if (settingsUnavailable && /system_settings/.test(sql)) throw new Error('settings unavailable');
  if (/system_settings/.test(sql) && /^SELECT/.test(sql.trim())) return { rows: settings.has(params[0]) ? [{ value: settings.get(params[0]) }] : [] };
  if (/system_settings/.test(sql)) {
    const next = { ...(settings.has(params[0]) ? JSON.parse(settings.get(params[0])) : {}), ...JSON.parse(params[1]) };
    settings.set(params[0], JSON.stringify(next));
    return { rows: [{ key: params[0], value: settings.get(params[0]) }] };
  }
  return { rows: /SELECT/.test(sql) ? [{ id: 'db-a', company_id: 'tenant-a', title: 'DB A', content: JSON.stringify({ text: 'A', steps: [{ type: 'text', value: 'A' }] }) }] : [{ id: params[0] }] };
} });
let mediaAllowed = false;
let mediaExists = true;
stub('../services/enterprise/media-service', {
  normalizeMediaReference: value => value,
  canAccessMedia: async (_reference, _company, options) => {
    assert.equal(options.ignoreQuickReplies, true);
    return mediaAllowed;
  },
  findMediaFile: async () => mediaExists ? '/owned/file.jpg' : null,
});
const service = require('../services/quickReplyService');

test('quick replies require a company and read only its records, including file fallback', async () => {
  await assert.rejects(service.listQuickReplies(), /empresa|company/i);
  const items = await service.listQuickReplies({ companyId: 'tenant-a' });
  assert.deepEqual(items.map(item => item.id).sort(), ['db-a', 'file-a']);
  const select = queries.find(call => /SELECT/.test(call.sql));
  assert.match(select.sql, /WHERE company_id = \$1/);
  assert.doesNotMatch(select.sql, /OR company_id/);
  assert.equal(items.find(item => item.id === 'db-a').steps.length, 1);
});

test('updating and deleting another tenant reply does not alter any record', async () => {
  const before = JSON.stringify(fileItems);
  assert.equal(await service.updateQuickReply('file-b', { title: 'Intrusão', content: 'X' }, 'tenant-a'), null);
  assert.equal(await service.removeQuickReply('file-b', 'tenant-a'), false);
  assert.equal(JSON.stringify(fileItems), before);
});

test('tenant writes preserve another company file records and persist owner in SQL', async () => {
  const created = await service.createQuickReply({ title: 'Nova', content: 'Nova', companyId: 'tenant-a' });
  assert.equal(created.companyId, 'tenant-a');
  assert.ok(fileItems.some(item => item.id === 'file-b' && item.companyId === 'tenant-b'));
  const write = queries.find(call => /INSERT/.test(call.sql));
  assert.match(write.sql, /WHERE quick_replies.company_id = EXCLUDED.company_id/);
  assert.equal(write.params[1], 'tenant-a');
});

test('quick reply category appearance merges atomically in company-scoped settings', async () => {
  assert.deepEqual(await service.getQuickReplyCategories('tenant-a'), {});
  await service.saveQuickReplyCategory('tenant-a', 'vendas', { emoji: '💰', color: '#123abc' });
  const saved = await service.saveQuickReplyCategory('tenant-a', 'suporte', { emoji: '🛟', color: '#456def' });
  assert.deepEqual(saved, { vendas: { emoji: '💰', color: '#123abc' }, suporte: { emoji: '🛟', color: '#456def' } });
  assert.deepEqual(await service.getQuickReplyCategories('tenant-a'), saved);
  assert.deepEqual(await service.getQuickReplyCategories('tenant-b'), {});
  const settingWrite = queries.find(call => /INSERT INTO system_settings/.test(call.sql));
  assert.equal(settingWrite.params[0], 'inbox_quick_reply_categories:tenant-a');
  assert.match(settingWrite.sql, /EXCLUDED\.value::jsonb/);
  assert.match(settingWrite.sql, /jsonb_object_keys/);
  assert.doesNotMatch(settingWrite.sql, /jsonb_object_length/);
  await assert.rejects(service.saveQuickReplyCategory('tenant-a', 'x'.repeat(201), { emoji: '📁', color: '#16a34a' }), error => error.status === 400);
  await assert.rejects(service.saveQuickReplyCategory('tenant-a', 'válida', { emoji: '📁', color: 'red' }), error => error.status === 400);
  settingsUnavailable = true;
  await assert.rejects(service.saveQuickReplyCategory('tenant-a', 'falha', { emoji: '📁', color: '#16a34a' }), /settings unavailable/);
  settingsUnavailable = false;
});

test('media cannot be laundered through a saved quick reply or reference a missing file', async () => {
  const before = JSON.stringify(fileItems);
  mediaAllowed = false;
  await assert.rejects(service.createQuickReply({ title: 'Intrusão', companyId: 'tenant-a', items: [{ type: 'image', value: '/upload/private-b.jpg' }] }), error => error.status === 403);
  assert.equal(JSON.stringify(fileItems), before);
  mediaAllowed = true;
  mediaExists = false;
  await assert.rejects(service.createQuickReply({ title: 'Ausente', companyId: 'tenant-a', items: [{ type: 'image', value: '/upload/owned-a.jpg' }] }), error => error.status === 404);
  assert.equal(JSON.stringify(fileItems), before);
  mediaExists = true;
  const saved = await service.createQuickReply({ title: 'Imagem própria', companyId: 'tenant-a', items: [{ type: 'image', value: '/upload/owned-a.jpg' }] });
  assert.equal(saved.companyId, 'tenant-a');
});
