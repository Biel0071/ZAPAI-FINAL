'use strict';

const KEY_TYPES = ['cpf', 'cnpj', 'phone', 'email', 'evp'];
const EVP_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toAscii(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 .,\-/]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePixKey(type, rawKey) {
  const key = String(rawKey || '').trim();
  const digits = key.replace(/\D/g, '');
  switch (type) {
    case 'cpf':
      if (digits.length !== 11) throw new Error('CPF deve ter 11 dígitos.');
      return digits;
    case 'cnpj':
      if (digits.length !== 14) throw new Error('CNPJ deve ter 14 dígitos.');
      return digits;
    case 'phone': {
      const national = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits;
      if (national.length < 10 || national.length > 11) throw new Error('Telefone deve ter DDD + número.');
      return `+55${national}`;
    }
    case 'email':
      if (!EMAIL_PATTERN.test(key) || key.length > 77) throw new Error('E-mail inválido.');
      return key.toLowerCase();
    case 'evp':
      if (!EVP_PATTERN.test(key.toLowerCase())) throw new Error('Chave aleatória inválida.');
      return key.toLowerCase();
    default:
      throw new Error(`Tipo de chave PIX inválido. Use: ${KEY_TYPES.join(', ')}.`);
  }
}

function field(id, value) {
  const text = String(value);
  if (text.length > 99) throw new Error(`Campo PIX ${id} excede 99 caracteres.`);
  return `${id}${String(text.length).padStart(2, '0')}${text}`;
}

function crc16(payload) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function buildPixPayload({ key, keyType, merchantName, merchantCity, amount, txid, description }) {
  const pixKey = normalizePixKey(keyType, key);
  const name = toAscii(merchantName).slice(0, 25);
  const city = toAscii(merchantCity).slice(0, 15);
  if (!name) throw new Error('Nome do favorecido é obrigatório.');
  if (!city) throw new Error('Cidade do favorecido é obrigatória.');

  const info = toAscii(description).slice(0, 40);
  const account = field('00', 'br.gov.bcb.pix') + field('01', pixKey) + (info ? field('02', info) : '');
  const numericAmount = Number(amount);
  const reference = String(txid || '***').replace(/[^A-Za-z0-9*]/g, '').slice(0, 25) || '***';

  const body = [
    field('00', '01'),
    field('26', account),
    field('52', '0000'),
    field('53', '986'),
    Number.isFinite(numericAmount) && numericAmount > 0 ? field('54', numericAmount.toFixed(2)) : '',
    field('58', 'BR'),
    field('59', name),
    field('60', city),
    field('62', field('05', reference)),
    '6304',
  ].join('');

  return body + crc16(body);
}

module.exports = { KEY_TYPES, normalizePixKey, buildPixPayload, crc16 };