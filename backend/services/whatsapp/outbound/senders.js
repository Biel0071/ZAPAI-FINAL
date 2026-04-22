/**
 * Baileys outbound senders.
 * Extracted from whatsappService.legacy.js (Phase 2b-2).
 *
 * Strategy: accept `sock` as a parameter, check connection via the
 * tenant-indexed `sessionStateService` (which is kept in lock-step with
 * the legacy `isWhatsAppConnected` flag and `global.whatsappSession`),
 * and delegate media payload construction to `whatsapp/media/payload`.
 *
 * No module-scoped mutable state.
 */

const sessionStateService = require('../../sessionStateService');
const { ensureWhatsAppJid } = require('../shared/identifiers');
const {
  getDocumentFileName,
  toMediaPayload,
} = require('../media/payload');

function isWhatsAppConnected() {
  // Phase 2c: sessionStateService is the authoritative source. The listener
  // in `connection/stableSession.js` calls `setWhatsappSession` on open/close,
  // which also keeps `global.whatsappSession` in sync as a defensive alias
  // for any external consumer that might still read it directly.
  try {
    const state = sessionStateService.getWhatsappSession();
    if (state?.connected === true) {
      return true;
    }
  } catch (_error) {
    // service not initialised yet — fall through.
  }

  return global.whatsappSession?.connected === true;
}

function ensureSocket(sock) {
  if (!sock) {
    throw new Error('Baileys socket is not initialized yet.');
  }

  if (!isWhatsAppConnected()) {
    throw new Error('WHATSAPP_OFFLINE');
  }
}

async function sendWithRetry(fn, retries = 3) {
  const totalRetries = Math.max(1, Number(retries) || 3);

  for (let i = 0; i < totalRetries; i += 1) {
    try {
      return await fn();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('retry', i);

      if (i === totalRetries - 1) {
        throw error;
      }
    }
  }

  return undefined;
}

async function sendMessage(sock, phone, text) {
  ensureSocket(sock);

  return sendWithRetry(
    () => sock.sendMessage(ensureWhatsAppJid(phone), { text }),
    3
  );
}

async function sendImage(sock, phone, imagePath, caption = '') {
  ensureSocket(sock);

  return sendWithRetry(
    () =>
      sock.sendMessage(ensureWhatsAppJid(phone), {
        image: toMediaPayload(imagePath),
        ...(caption ? { caption } : {}),
      }),
    3
  );
}

async function sendVideo(sock, phone, videoPath, caption = '') {
  ensureSocket(sock);

  return sendWithRetry(
    () =>
      sock.sendMessage(ensureWhatsAppJid(phone), {
        video: toMediaPayload(videoPath),
        ...(caption ? { caption } : {}),
      }),
    3
  );
}

async function sendAudio(sock, phone, audioPath, ptt = false) {
  ensureSocket(sock);

  return sendWithRetry(
    () =>
      sock.sendMessage(ensureWhatsAppJid(phone), {
        audio: toMediaPayload(audioPath),
        ptt,
      }),
    3
  );
}

async function sendDocument(sock, phone, docPath, fileName, mimetype) {
  ensureSocket(sock);

  return sendWithRetry(
    () =>
      sock.sendMessage(ensureWhatsAppJid(phone), {
        document: toMediaPayload(docPath),
        fileName: getDocumentFileName(docPath, fileName),
        ...(mimetype ? { mimetype } : {}),
      }),
    3
  );
}

async function sendMediaMessage(
  sock,
  phone,
  mediaType,
  mediaPath,
  { caption = '', fileName, mimetype, ptt = false } = {}
) {
  switch (mediaType) {
    case 'image':
      return sendImage(sock, phone, mediaPath, caption);
    case 'video':
      return sendVideo(sock, phone, mediaPath, caption);
    case 'audio':
      return sendAudio(sock, phone, mediaPath, ptt);
    case 'document':
      return sendDocument(sock, phone, mediaPath, fileName, mimetype);
    default:
      throw new Error('Unsupported mediaType. Use image, video, audio, or document.');
  }
}

module.exports = {
  ensureSocket,
  isWhatsAppConnected,
  sendAudio,
  sendDocument,
  sendImage,
  sendMediaMessage,
  sendMessage,
  sendVideo,
  sendWithRetry,
};
