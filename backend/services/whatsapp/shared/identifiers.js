/**
 * Pure identifier helpers for WhatsApp domain.
 * Extracted from whatsappService.legacy.js (Phase 2a).
 * No side effects; no module-scoped mutable state.
 */

const DEFAULT_SESSION = 'main';

function normalizeSessionName(sessionName = DEFAULT_SESSION) {
  const normalized = String(sessionName || DEFAULT_SESSION)
    .trim()
    .replace(/\s+/g, '_')
    .toLowerCase();

  return normalized || DEFAULT_SESSION;
}

function getCompanyId(companyId) {
  return companyId || process.env.DEFAULT_COMPANY_ID || 'default';
}

function normalizePhone(phone = '') {
  return String(phone || '')
    .trim()
    .replace(/@s\.whatsapp\.net$/i, '')
    .replace(/\s+/g, '');
}

function normalizeWhatsappJid(phone = '') {
  const value = String(phone || '').trim();
  if (!value) {
    throw new Error('JID inválido: número de telefone vazio');
  }

  if (value.endsWith('@g.us')) {
    return value;
  }

  let clean = value;
  if (clean.includes('@')) {
    clean = clean.split('@')[0];
  }

  // Remove + spaces ( ) -
  clean = clean.replace(/[+\s().-]/g, '');

  if (!clean || !/^\d+$/.test(clean)) {
    throw new Error('JID inválido: o número de telefone está vazio ou contém caracteres inválidos');
  }

  return `${clean}@s.whatsapp.net`;
}

function ensureWhatsAppJid(phone = '') {
  return normalizeWhatsappJid(phone);
}

module.exports = {
  DEFAULT_SESSION,
  ensureWhatsAppJid,
  getCompanyId,
  normalizePhone,
  normalizeSessionName,
  normalizeWhatsappJid,
};
