/**
 * Pure serialization / text-normalization helpers.
 * Extracted from whatsappService.legacy.js (Phase 2a).
 */

function safeSerializeInboundMessage(messageData) {
  try {
    return JSON.stringify(
      messageData,
      (_key, value) => {
        if (typeof value === 'bigint') {
          return value.toString();
        }

        if (Buffer.isBuffer(value)) {
          return {
            dataLength: value.length,
            type: 'Buffer',
          };
        }

        return value;
      },
      2
    );
  } catch (error) {
    return `{"error":"failed_to_serialize_inbound_message","message":"${error.message || error}"}`;
  }
}

function isLikelyBase64Payload(value = '') {
  const normalized = String(value || '').trim();

  if (!normalized || normalized.length < 16) {
    return false;
  }

  if (normalized.startsWith('data:')) {
    return true;
  }

  if (/^(https?:)?\/\//i.test(normalized)) {
    return false;
  }

  if (/^[A-Za-z]:\\|^\\\\|^\//.test(normalized)) {
    return false;
  }

  return /^[A-Za-z0-9+/=\r\n]+$/.test(normalized);
}

function normalizeUtf8Text(value = '') {
  if (typeof value === 'string') {
    return value;
  }

  if (Buffer.isBuffer(value)) {
    return value.toString('utf8');
  }

  if (value == null) {
    return '';
  }

  return String(value);
}

module.exports = {
  isLikelyBase64Payload,
  normalizeUtf8Text,
  safeSerializeInboundMessage,
};
