/**
 * Debug / logging helpers for inbound Baileys messages.
 * Extracted from whatsappService.legacy.js (Phase 2a).
 */

const { normalizePhone } = require('../shared/identifiers');
const { extractMessageText } = require('./parser');

function normalizeInboundPhone(remoteJid = '') {
  if (!remoteJid) {
    return null;
  }

  return String(remoteJid).replace(/@s\.whatsapp\.net$/i, '');
}

function buildInboundDebugPayload(messageData = {}) {
  const phone = normalizePhone(messageData.key?.remoteJid || '');
  const text = extractMessageText(messageData.message || {}) || '[media]';
  const timestamp = messageData.messageTimestamp
    ? Number(messageData.messageTimestamp) * 1000
    : Date.now();

  return {
    from: phone,
    id: messageData.key?.id || null,
    phone,
    text,
    timestamp,
  };
}

module.exports = {
  buildInboundDebugPayload,
  normalizeInboundPhone,
};
