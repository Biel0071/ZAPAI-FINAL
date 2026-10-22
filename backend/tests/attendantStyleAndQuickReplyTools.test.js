const test = require('node:test');
const assert = require('node:assert/strict');
const { buildHumanStylePrompt } = require('../services/attendantStyleGuide');
const { formatCapabilitiesForPrompt } = require('../services/quickReplyCapability');

test('style guide covers human flow and never embeds prices', () => {
  const p = buildHumanStylePrompt();
  assert.match(p, /Me confirma se está correto/);
  assert.match(p, /RESPOSTAS RÁPIDAS SÃO SUAS FERRAMENTAS/);
  assert.doesNotMatch(p, /R\$\s?\d/);
});

test('capability prompt lists every quick reply with step count and text preview', () => {
  const qrs = Array.from({ length: 30 }, (_, i) => ({
    id: `qr-${i}`, title: `Item ${i}`, category: 'GERAL',
    items: i === 0
      ? [{ type: 'text', value: 'Texto oficial da loja' }, { type: 'image', value: '/upload/x.jpg' }]
      : [{ type: 'text', value: `msg ${i}` }],
  }));
  const out = formatCapabilitiesForPrompt(qrs);
  assert.ok(out.includes('qr-29'));
  assert.match(out, /Item 0" \(ID: qr-0\).*\[2 etapas\]/);
  assert.match(out, /"Texto oficial da loja"/);
});
