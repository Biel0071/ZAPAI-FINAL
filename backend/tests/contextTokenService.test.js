'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const contextTokenService = require('../services/contextTokenService');
const conversationMemoryEngine = require('../services/conversationMemoryEngine');

test('encodes and decodes zctx1 encrypted Brotli token with compact footprint', () => {
  const { token, meta, decoded, compactSummary } = contextTokenService.mergeAndEncodeContextToken({
    companyId: 'tenant-1',
    contactId: '5519999991111@s.whatsapp.net',
    contactName: 'Marcos Silva',
    phone: '5519999991111',
    conversation: {
      lead_intent: 'purchase',
      funnel_stage: 'negotiation',
      tags: ['tijolo', 'cotacao'],
    },
    messages: [
      {
        id: 1,
        from_me: false,
        content: 'Bom dia, me chamo Marcos, quero 3 milheiros de tijolo 8 furos para entrega em Araras',
        effective_at: '2026-09-10T10:00:00.000Z',
      },
      {
        id: 2,
        from_me: true,
        content: 'Bom dia Marcos! Temos a pronta entrega para Araras, R$ 1.150 o milheiro.',
        effective_at: '2026-09-10T10:02:00.000Z',
      },
      {
        id: 3,
        from_me: false,
        content: 'Fechado, vou pagar no pix e quero entrega amanhã cedo.',
        effective_at: '2026-09-10T10:05:00.000Z',
      },
    ],
  });

  assert.ok(token.startsWith('zctx1.'), 'Token must start with zctx1. prefix');
  assert.ok(meta.byteLength < 1024, `Expected compact token < 1KB, got ${meta.byteLength} bytes`);
  assert.equal(decoded.cnt, 3);
  assert.equal(decoded.inCnt, 2);
  assert.equal(decoded.outCnt, 1);
  assert.equal(decoded.commercial.deliveryCity, 'Araras');
  assert.equal(decoded.commercial.quantity, '3 milheiros');
  assert.ok(compactSummary.includes('3 msgs'));

  const decrypted = contextTokenService.decodeContextToken(token, 'tenant-1');
  assert.ok(decrypted, 'Valid companyId must decrypt zctx1 token');
  assert.equal(decrypted.name, 'Marcos');
  assert.equal(decrypted.commercial.deliveryCity, 'Araras');
  assert.ok(Array.isArray(decrypted.highlights) && decrypted.highlights.length > 0);
});

test('enforces cryptographic multi-tenant AAD isolation and rejects tampering', () => {
  const { token } = contextTokenService.mergeAndEncodeContextToken({
    companyId: 'tenant-alpha',
    contactId: '5511988887777@s.whatsapp.net',
    messages: [
      {
        id: 10,
        from_me: false,
        content: 'Orçamento de caixa dagua 5000 litros',
        effective_at: '2026-09-12T12:00:00.000Z',
      },
    ],
  });

  assert.equal(
    contextTokenService.decodeContextToken(token, 'tenant-beta'),
    null,
    'Wrong tenant AAD must fail authentication tag verification cleanly'
  );

  const tampered = `${token.slice(0, -4)}XXXX`;
  assert.equal(contextTokenService.decodeContextToken(tampered, 'tenant-alpha'), null);
});

test('merges consecutive retention cycles cumulatively and formats LLM prompt block', () => {
  const batch1 = contextTokenService.mergeAndEncodeContextToken({
    companyId: 'tenant-1',
    contactId: '5519999992222@s.whatsapp.net',
    messages: [
      {
        id: 1,
        from_me: false,
        content: 'Preciso de uma caixa d agua de 5000 litros com entrega para Leme',
        effective_at: '2026-08-01T09:00:00.000Z',
      },
    ],
  });

  const batch2 = contextTokenService.mergeAndEncodeContextToken({
    existingToken: batch1.token,
    companyId: 'tenant-1',
    contactId: '5519999992222@s.whatsapp.net',
    messages: [
      {
        id: 2,
        from_me: false,
        content: 'Mudei para 10 sacos de cimento no pix urgente',
        effective_at: '2026-09-15T14:30:00.000Z',
      },
    ],
  });

  assert.equal(batch2.decoded.cnt, 2);
  assert.equal(batch2.decoded.from, '2026-08-01T09:00:00.000Z');
  assert.equal(batch2.decoded.to, '2026-09-15T14:30:00.000Z');
  assert.equal(batch2.decoded.commercial.deliveryCity, 'Leme');
  assert.equal(batch2.decoded.commercial.quantity, '10 sacos');

  const promptBlock = conversationMemoryEngine.buildContextualPrompt({
    facts: batch2.decoded.facts,
    commercial: batch2.decoded.commercial,
    pendingQuestions: [],
    contextTokenDecoded: batch2.decoded,
  });

  assert.ok(promptBlock.includes('TOKEN DE CONTEXTO CRIPTOGRAFADO'));
  assert.ok(promptBlock.includes('Leme'));
  assert.ok(promptBlock.includes('10 sacos'));
});

test.after(async () => {
  const { pool } = require('../src/infrastructure/config/database');
  await pool.end();
});
