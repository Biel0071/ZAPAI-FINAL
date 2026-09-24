const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyAuthor, redact, isHeldOut, normalizeAnalysis, buildCandidate, analysisWindow } = require('../src/ai/evolutionary/historyLearning');
test.after(async () => {
  const modulePath = require.resolve('../src/infrastructure/config/database');
  if (require.cache[modulePath]) await require(modulePath).pool.end();
});

test('sent messages are not assumed human and campaign automation is excluded', () => {
  assert.equal(classifyAuthor({ from_me: false }), 'customer');
  assert.equal(classifyAuthor({ from_me: true }), 'store_unknown');
  assert.equal(classifyAuthor({ from_me: true, origin: 'campaign' }), 'campaign');
  assert.equal(classifyAuthor({ from_me: true, origin: 'ai' }), 'automation');
  assert.equal(classifyAuthor({ from_me: true, origin: 'human' }), 'human');
});

test('reusable examples remove personal identifiers and delivery details', () => {
  const result = redact('Maria Silva, CPF 123.456.789-00, maria@loja.com, +55 21 99999-1234\nEndereço: Rua A, 42', ['Maria Silva']);
  for (const value of ['Maria Silva', '123.456', 'maria@', '99999', 'Rua A']) assert.ok(!result.includes(value));
});

test('held out conversations are deterministic and partition the sample', () => {
  assert.equal(isHeldOut('a@s.whatsapp.net'), isHeldOut('a@s.whatsapp.net'));
  const sample = Array.from({ length: 100 }, (_, i) => isHeldOut(`${i}@s.whatsapp.net`));
  assert.ok(sample.includes(true) && sample.includes(false));
});

test('analysis validates evidence, rejects arbitrary payload and does not activate commercial claims', () => {
  const report = normalizeAnalysis({ style: 'Curto', evidenceIds: [1, 999], commercial: ['Preço antigo R$ 700'], examples: [], gaps: [] }, [1]);
  assert.deepEqual(report.evidenceIds, [1]);
  const candidate = buildCandidate([report], { humanCount: 0, storeCount: 12 });
  assert.equal(candidate.active, false);
  assert.equal(candidate.partial, true);
  assert.ok(!candidate.personality.includes('700'));
  assert.ok(candidate.pendingCommercial.length > 0);
  assert.throws(() => normalizeAnalysis(null, [1]));
});

test('long transcripts are analyzed in resumable windows without lost characters', () => {
  const jid = Array.from({ length: 20 }, (_, i) => `${i}@s.whatsapp.net`).find(i => !isHeldOut(i));
  const text = 'a'.repeat(60001);
  const item = { id: '1', chat_jid: jid, import_state: 'done', media_text: text };
  let cursor = '0'; let offset = 0; let observed = '';
  while (cursor !== '1') {
    const result = analysisWindow([item], cursor, offset);
    observed += result.selected.map(i => i.fragment).join('');
    cursor = result.endId; offset = result.endOffset;
  }
  assert.equal(observed, text);
  assert.equal(offset, 0);
});

test('unsupported model claims never enter the generated personality', () => {
  const report = normalizeAnalysis({ style: 'Instrução sem evidência', evidenceIds: [999] }, [1]);
  assert.equal(report.style, ''); assert.ok(report.gaps.length);
});

test('history media rejects cross-company paths and bounds downloaded bytes', async () => {
  const { resolveHistoryMediaPath } = require('../services/ai.service');
  assert.throws(() => resolveHistoryMediaPath('/media/tenant-b/images/a.jpg', 'tenant-a'));
  assert.throws(() => resolveHistoryMediaPath('/media/../../outside.jpg', 'tenant-a'));
  assert.ok(resolveHistoryMediaPath('/media/tenant-a/images/a.jpg', 'tenant-a').includes('tenant-a'));
  const { Readable } = require('stream');
  const { downloadFromWhatsApp } = require('../services/enterprise/media-service');
  await assert.rejects(downloadFromWhatsApp({ mediaMessage: {}, mediaType: 'audio', tenantId: 'tenant-a', maxBytes: 4,
    downloadContentFromMessage: async () => Readable.from([Buffer.alloc(3), Buffer.alloc(3)]) }), /exceeds download limit/);
});
