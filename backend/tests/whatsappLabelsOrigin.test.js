const test = require('node:test');
const assert = require('node:assert/strict');
const { handleLabelEdit, handleLabelAssociation, mapQuickReplyAction } = require('../services/whatsapp/labelsSync');
const { shouldMarkWhatsappDevice } = require('../services/whatsapp/outbound/originPolicy');

const ctx = (io) => ({ companyId: 'tenant-a', sessionId: 'main', io });
function makeDeps({ labelRows = [], conv = { id: 5, whatsappLabels: [] }, updateRows = [{ id: 5 }] } = {}) {
  const calls = [];
  return {
    calls,
    deps: {
      query: async (sql, params) => {
        calls.push({ sql, params });
        if (/FROM whatsapp_labels/.test(sql)) return { rows: labelRows };
        if (/UPDATE conversations SET whatsapp_labels = array_(append|remove)/.test(sql)) return { rows: updateRows };
        return { rows: [] };
      },
      conversationRepository: {
        getConversationByPhone: async () => conv,
        getConversationById: async () => ({ ...conv, whatsappLabels: ['updated'] }),
        invalidateConversationCache: () => calls.push({ invalidated: true }),
      },
    },
  };
}
const io = () => { const events = []; return { events, emit: (n, p) => events.push([n, p]) }; };

test('Baileys event shape: add (outer type) + label_jid (association.type) mirrors the label', async () => {
  const { deps, calls } = makeDeps({ labelRows: [{ name: 'Cliente VIP', deleted: false }] });
  const sock = io();
  const res = await handleLabelAssociation({ type: 'add', association: { type: 'label_jid', chatId: '5511999999999@s.whatsapp.net', labelId: '3' } }, ctx(sock), deps);
  assert.deepEqual(res.whatsappLabels, ['updated']);
  const update = calls.find((c) => /array_append/.test(c.sql || ''));
  assert.deepEqual(update.params, ['Cliente VIP', 5, 'tenant-a']);
  assert.ok(calls.some((c) => c.invalidated));
  assert.deepEqual(sock.events.map((e) => e[0]), ['conversation:update', 'conversation_updated']);
});

test('remove only touches whatsapp_labels and only when present', async () => {
  const { deps, calls } = makeDeps({ labelRows: [{ name: 'Pago' }], conv: { id: 5, whatsappLabels: ['Pago'] } });
  await handleLabelAssociation({ type: 'remove', association: { type: 'label_jid', chatId: 'x@s.whatsapp.net', labelId: '1' } }, ctx(io()), deps);
  assert.ok(calls.some((c) => /array_remove\(whatsapp_labels/.test(c.sql || '')));
  assert.ok(!calls.some((c) => /\btags\b\s*=/.test(c.sql || '')), 'system tags column must never be written');
  const idle = makeDeps({ labelRows: [{ name: 'Pago' }], conv: { id: 5, whatsappLabels: [] } });
  await handleLabelAssociation({ type: 'remove', association: { type: 'label_jid', chatId: 'x@s.whatsapp.net', labelId: '1' } }, ctx(io()), idle.deps);
  assert.ok(!idle.calls.some((c) => /UPDATE conversations/.test(c.sql || '')));
});

test('ignores message labels, bad payloads, unknown conversations and deleted labels', async () => {
  const base = { type: 'add', association: { type: 'label_message', chatId: 'x', labelId: '1', messageId: 'm' } };
  assert.equal(await handleLabelAssociation(base, ctx(io()), makeDeps().deps), null);
  assert.equal(await handleLabelAssociation({ type: 'weird', association: { type: 'label_jid', chatId: 'x', labelId: '1' } }, ctx(io()), makeDeps().deps), null);
  assert.equal(await handleLabelAssociation({ type: 'add', association: { type: 'label_jid', chatId: '', labelId: '1' } }, ctx(io()), makeDeps().deps), null);
  const noConv = makeDeps({ conv: null });
  assert.equal(await handleLabelAssociation({ type: 'add', association: { type: 'label_jid', chatId: 'x', labelId: '1' } }, ctx(io()), noConv.deps), null);
  const deleted = makeDeps({ labelRows: [{ name: 'Velha', deleted: true }] });
  assert.equal(await handleLabelAssociation({ type: 'add', association: { type: 'label_jid', chatId: 'x', labelId: '1' } }, ctx(io()), deleted.deps), null);
});

test('association arriving before its label name uses a placeholder that labels.edit later renames', async () => {
  const early = makeDeps({ labelRows: [] });
  await handleLabelAssociation({ type: 'add', association: { type: 'label_jid', chatId: 'x', labelId: '9' } }, ctx(io()), early.deps);
  assert.equal(early.calls.find((c) => /array_append/.test(c.sql || '')).params[0], 'Etiqueta 9');
  const edit = makeDeps({ labelRows: [] });
  await handleLabelEdit({ id: '9', name: 'Orçamento', color: 2 }, ctx(io()), edit.deps);
  const rename = edit.calls.find((c) => /array_replace/.test(c.sql || ''));
  assert.deepEqual(rename.params, ['Etiqueta 9', 'Orçamento', 'tenant-a', 'main']);
});

test('deleted labels are removed from every conversation mirror', async () => {
  const { deps, calls } = makeDeps({ labelRows: [{ name: 'Velha' }] });
  await handleLabelEdit({ id: '4', name: 'Velha', color: 0, deleted: true }, ctx(io()), deps);
  assert.ok(calls.some((c) => /array_remove\(whatsapp_labels/.test(c.sql || '') && c.params[0] === 'Velha'));
});

test('AI/system tag writes cannot touch whatsapp_labels (separate column)', async () => {
  const executed = [];
  const dbPath = require.resolve('../src/infrastructure/config/database');
  const prev = require.cache[dbPath];
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { query: async (sql, params) => { executed.push({ sql, params }); return { rows: [{ id: 5, company_id: 'tenant-a', tags: ['x'], whatsapp_labels: ['WA'] }] }; } } };
  delete require.cache[require.resolve('../src/data/repositories/conversationRepository')];
  const repo = require('../src/data/repositories/conversationRepository');
  const updated = await repo.updateConversationState(5, { tags: ['funil'] }, 'tenant-a');
  const update = executed.find((q) => /UPDATE conversations/.test(q.sql));
  assert.ok(update, 'update executed');
  assert.ok(!/whatsapp_labels/.test(update.sql), 'tags update must not mention whatsapp_labels');
  assert.deepEqual(updated.whatsappLabels, ['WA']);
  delete require.cache[require.resolve('../src/data/repositories/conversationRepository')];
  if (prev) require.cache[dbPath] = prev; else delete require.cache[dbPath];
});

test('quick_reply app-state action maps shortcut + text and rejects empty ones', () => {
  assert.deepEqual(mapQuickReplyAction({ shortcut: '/ola', message: ' Olá! ', keywords: ['oi'] }), { shortcut: 'ola', message: 'Olá!', keywords: ['oi'] });
  assert.equal(mapQuickReplyAction({ shortcut: '', message: 'x' }), null);
  assert.equal(mapQuickReplyAction({ shortcut: 'a', message: '  ' }), null);
});

test('origin policy: system, restart (unknown age) and history never become blue', () => {
  const now = Date.now();
  const sec = (msAgo) => Math.floor((now - msAgo) / 1000);
  assert.equal(shouldMarkWhatsappDevice({ isSystemSent: false, messageTimestampSec: sec(5000), now }), true);
  assert.equal(shouldMarkWhatsappDevice({ isSystemSent: true, messageTimestampSec: sec(5000), now }), false);
  assert.equal(shouldMarkWhatsappDevice({ isSystemSent: false, messageTimestampSec: sec(3600e3), now }), false);
  assert.equal(shouldMarkWhatsappDevice({ isSystemSent: false, messageTimestampSec: undefined, now }), false);
  assert.equal(shouldMarkWhatsappDevice({ isSystemSent: false, messageTimestampSec: { toNumber: () => sec(1000) }, now }), true);
});

test('markOrigin only upgrades unknown rows to whatsapp_device', async () => {
  const dbPath = require.resolve('../src/infrastructure/config/database');
  const prev = require.cache[dbPath];
  const seen = [];
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { query: async (sql, params) => { seen.push({ sql, params }); return { rows: params[0] === 1 ? [{ id: 1 }] : [] }; } } };
  delete require.cache[require.resolve('../src/data/repositories/messageRepository')];
  const repo = require('../src/data/repositories/messageRepository');
  assert.equal(await repo.markOrigin(1, 'whatsapp_device'), true);
  assert.match(seen[0].sql, /message_origin = 'unknown'/);
  assert.equal(await repo.markOrigin(2, 'whatsapp_device'), false);
  assert.equal(await repo.markOrigin(1, 'human'), false);
  assert.equal(await repo.markOrigin(null, 'whatsapp_device'), false);
  assert.equal(seen.length, 2);
  delete require.cache[require.resolve('../src/data/repositories/messageRepository')];
  if (prev) require.cache[dbPath] = prev; else delete require.cache[dbPath];
});
