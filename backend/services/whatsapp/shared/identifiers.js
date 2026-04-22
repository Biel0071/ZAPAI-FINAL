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

function ensureWhatsAppJid(phone = '') {
  const value = String(phone || '').trim();

  if (!value) {
    return value;
  }

  if (value.includes('@')) {
    return value;
  }

  return `${normalizePhone(value)}@s.whatsapp.net`;
}

module.exports = {
  DEFAULT_SESSION,
  ensureWhatsAppJid,
  getCompanyId,
  normalizePhone,
  normalizeSessionName,
};
