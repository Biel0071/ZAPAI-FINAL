'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPixPayload, normalizePixKey, crc16 } = require('../services/payments/pixBrCode');

test('crc16 CCITT-FALSE matches reference vector', () => {
  assert.equal(crc16('123456789'), '29B1');
});

test('builds the BACEN manual static example byte-for-byte', () => {
  const payload = buildPixPayload({
    keyType: 'evp',
    key: '123e4567-e12b-12d1-a456-426655440000',
    merchantName: 'Fulano de Tal',
    merchantCity: 'BRASILIA',
  });
  assert.equal(
    payload,
    '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D'
  );
});

test('includes amount and txid and keeps CRC valid', () => {
  const payload = buildPixPayload({
    keyType: 'phone',
    key: '(31) 99999-0000',
    merchantName: 'Loja São João',
    merchantCity: 'Belo Horizonte',
    amount: 150,
    txid: 'pay_123-abc',
  });
  assert.ok(payload.includes('0114+5531999990000'));
  assert.ok(payload.includes('5406150.00'));
  assert.ok(payload.includes('5913Loja Sao Joao'));
  assert.ok(payload.includes('0509pay123abc'));
  assert.equal(payload.slice(-4), crc16(payload.slice(0, -4)));
});

test('rejects invalid keys and missing merchant data', () => {
  assert.throws(() => normalizePixKey('cpf', '123'), /CPF/);
  assert.throws(() => normalizePixKey('email', 'nope'), /E-mail/);
  assert.throws(() => normalizePixKey('foo', 'x'), /Tipo de chave/);
  assert.throws(() => buildPixPayload({ keyType: 'cnpj', key: '12.345.678/0001-90', merchantName: '', merchantCity: 'BH' }), /favorecido/);
});