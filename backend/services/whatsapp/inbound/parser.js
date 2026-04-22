/**
 * Pure Baileys message parser. Extracted from whatsappService.legacy.js (Phase 2a).
 */

const { normalizeUtf8Text } = require('../shared/serialization');

function unwrapMessageContent(message = {}) {
  if (!message || typeof message !== 'object') {
    return {};
  }

  if (message.ephemeralMessage?.message) {
    return unwrapMessageContent(message.ephemeralMessage.message);
  }

  if (message.viewOnceMessage?.message) {
    return unwrapMessageContent(message.viewOnceMessage.message);
  }

  if (message.viewOnceMessageV2?.message) {
    return unwrapMessageContent(message.viewOnceMessageV2.message);
  }

  if (message.viewOnceMessageV2Extension?.message) {
    return unwrapMessageContent(message.viewOnceMessageV2Extension.message);
  }

  if (message.editedMessage?.message) {
    return unwrapMessageContent(message.editedMessage.message);
  }

  return message;
}

function extractMessageText(msg = {}) {
  const rawMessage = msg?.message || msg;
  const message = unwrapMessageContent(rawMessage);

  return normalizeUtf8Text(
    message.conversation ||
      message.extendedTextMessage?.text ||
      message.imageMessage?.caption ||
      message.videoMessage?.caption ||
      message.documentMessage?.caption ||
      ''
  );
}

function getMediaDescriptor(message = {}) {
  const normalizedMessage = unwrapMessageContent(message);

  if (normalizedMessage.imageMessage) {
    return { mediaMessage: normalizedMessage.imageMessage, mediaType: 'image' };
  }

  if (normalizedMessage.videoMessage) {
    return { mediaMessage: normalizedMessage.videoMessage, mediaType: 'video' };
  }

  if (normalizedMessage.audioMessage) {
    return { mediaMessage: normalizedMessage.audioMessage, mediaType: 'audio' };
  }

  if (normalizedMessage.documentMessage) {
    return { mediaMessage: normalizedMessage.documentMessage, mediaType: 'document' };
  }

  return { mediaMessage: null, mediaType: null };
}

module.exports = {
  extractMessageText,
  getMediaDescriptor,
  unwrapMessageContent,
};
