const test = require('node:test');
const assert = require('node:assert/strict');
function stub(path, exports) { const id = require.resolve(path); require.cache[id] = { id, filename: id, loaded: true, exports }; }
let fileItems = [];
stub('fs/promises', { mkdir: async () => {}, access: async () => {}, readFile: async () => JSON.stringify(fileItems), writeFile: async (_p, text) => { fileItems = JSON.parse(text); }, rename: async () => {} });
stub('../src/infrastructure/config/ai', {});
const dbRows = new Map();
stub('../src/infrastructure/config/database', { async query(sql, params) {
  if (/INSERT INTO quick_replies/.test(sql)) { dbRows.set(params[0], { id: params[0], company_id: params[1], title: params[2], content: params[3], category: params[4], tags: params[5] }); return { rows: [{ id: params[0] }] }; }
  if (/SELECT \* FROM quick_replies/.test(sql)) return { rows: [...dbRows.values()].filter(r => r.company_id === params[0]) };
  return { rows: [] };
} });
stub('../services/enterprise/media-service', { normalizeMediaReference: v => v, canAccessMedia: async () => true, findMediaFile: async () => '/f' });
const service = require('../services/quickReplyService');

test('WhatsApp quick replies import as source=whatsapp with shortcut + text, idempotently', async () => {
  const entries = [{ shortcut: '/ola', message: 'Olá, tudo bem?' }, { shortcut: 'preco', message: 'Custa R$ 10' }, { shortcut: '', message: 'x' }, { shortcut: 'vazio', message: '  ' }];
  const first = await service.importWhatsappQuickReplies('tenant-a', entries);
  assert.deepEqual(first, { created: 2, updated: 0, skipped: 2 });
  const second = await service.importWhatsappQuickReplies('tenant-a', [{ shortcut: 'ola', message: 'Olá, tudo bem? (editado)' }]);
  assert.deepEqual(second, { created: 0, updated: 1, skipped: 0 });
  const list = await service.listQuickReplies({ companyId: 'tenant-a' });
  const ola = list.find(i => i.shortcut === 'ola');
  assert.equal(ola.source, 'whatsapp');
  assert.equal(ola.content, 'Olá, tudo bem? (editado)');
  assert.equal(list.filter(i => i.source === 'whatsapp').length, 2);
});

test('imports are tenant-isolated and system replies keep source=system', async () => {
  await service.importWhatsappQuickReplies('tenant-b', [{ shortcut: 'b', message: 'só da B' }]);
  const a = await service.listQuickReplies({ companyId: 'tenant-a' });
  assert.ok(!a.some(i => i.content === 'só da B'));
  const created = await service.createQuickReply({ companyId: 'tenant-a', title: 'Manual', content: 'texto', category: 'general' });
  assert.equal(created.source, 'system');
  await assert.rejects(service.importWhatsappQuickReplies('', [{ shortcut: 'x', message: 'y' }]));
});
