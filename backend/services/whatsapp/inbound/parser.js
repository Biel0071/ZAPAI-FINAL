/**
 * Pure Baileys message parser. Extracted from whatsappService.legacy.js (Phase 2a).
 */

const { normalizeUtf8Text } = require('../shared/serialization');

function unwrapMessageContent(message = {}) {
  if (!message || typeof message !== 'object') {
    return {};
  }

  const wrapperKeys = [
    'ephemeralMessage',
    'viewOnceMessage',
    'viewOnceMessageV2',
    'viewOnceMessageV2Extension',
    'documentWithCaptionMessage',
    'deviceSentMessage',
    'editedMessage',
    'associatedChildMessage',
    'templateMessage',
    'interactiveMessage',
  ];

  for (const key of wrapperKeys) {
    if (message[key]?.message) {
      return unwrapMessageContent(message[key].message);
    }
  }

  // Edited messages can also arrive inside a protocol envelope. Revoke and
  // other protocol events remain wrapped for the session listener.
  if (message.protocolMessage?.editedMessage) {
    return unwrapMessageContent(message.protocolMessage.editedMessage);
  }

  return message;
}

function extractMessageText(msg = {}) {
  const rawMessage = msg?.message || msg;
  const message = unwrapMessageContent(rawMessage);

  let text = normalizeUtf8Text(
    message.conversation ||
      message.extendedTextMessage?.text ||
      message.imageMessage?.caption ||
      message.videoMessage?.caption ||
      message.documentMessage?.caption ||
      message.interactiveMessage?.body?.text ||
      message.interactiveMessage?.header?.title ||
      message.templateMessage?.hydratedTemplate?.hydratedContentText ||
      message.templateMessage?.hydratedFourRowTemplate?.hydratedContentText ||
      message.templateMessage?.hydratedTemplate?.hydratedTitleText ||
      message.buttonsMessage?.contentText ||
      message.buttonsResponseMessage?.selectedDisplayText ||
      message.listResponseMessage?.title ||
      message.listResponseMessage?.singleSelectReply?.selectedRowId ||
      message.templateButtonReplyMessage?.selectedDisplayText ||
      message.pollCreationMessage?.name ||
      ''
  );

  // Extract Facebook/Instagram Ad Context (Click-to-WhatsApp Ads / Lead Ads)
  const contextInfo =
    message.extendedTextMessage?.contextInfo ||
    message.imageMessage?.contextInfo ||
    message.videoMessage?.contextInfo ||
    message.interactiveMessage?.contextInfo ||
    message.buttonsMessage?.contextInfo ||
    message.contextInfo;

  if (contextInfo?.externalAdReply) {
    const adTitle = String(contextInfo.externalAdReply.title || '').trim();
    const adBody = String(contextInfo.externalAdReply.body || '').trim();
    const adInfo = [adTitle, adBody].filter(Boolean).join(' - ');

    if (!text && adInfo) {
      text = `[Anúncio] ${adInfo}`;
    } else if (text && adInfo && !text.toLowerCase().includes(adTitle.toLowerCase())) {
      text = `${text} (Anúncio: ${adInfo})`;
    }
  }

  return text;
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

  if (normalizedMessage.stickerMessage) {
    return { mediaMessage: normalizedMessage.stickerMessage, mediaType: 'sticker' };
  }

  return { mediaMessage: null, mediaType: null };
}

module.exports = {
  extractMessageText,
  getMediaDescriptor,
  unwrapMessageContent,
};
