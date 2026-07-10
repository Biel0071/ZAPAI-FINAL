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

  if (global.whatsappSession?.connected === true) {
    return true;
  }

  // Fallback: check if ANY active session in the registry is connected
  try {
    const { activeSessions } = require('../state/registry');
    if (activeSessions) {
      const anyConnected = Object.values(activeSessions).some(
        (session) => session && (session.status === 'connected' || session.connected === true)
      );
      if (anyConnected) {
        return true;
      }
    }
  } catch (_err) {
    // ignore
  }

  return false;
}

function ensureSocket(sock) {
  if (!sock || !sock.user || !sock.ws || (sock.ws.readyState !== undefined && sock.ws.readyState !== 1)) {
    throw new Error('WhatsApp socket offline');
  }

  if (!isWhatsAppConnected()) {
    throw new Error('WHATSAPP_OFFLINE');
  }
}

const withTimeout = (promise, ms, errorMessage = 'Operation timed out') => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(errorMessage));
    }, ms);
  });
  return Promise.race([
    promise,
    timeoutPromise
  ]).finally(() => {
    clearTimeout(timeoutId);
  });
};

async function sendWithRetry(fn, retries = 3) {
  const totalRetries = Math.max(1, Number(retries) || 3);

  for (let i = 0; i < totalRetries; i += 1) {
    try {
      const promise = fn();
      return await withTimeout(promise, 15000, 'WhatsApp send timeout');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Send message attempt ${i + 1} failed:`, error.message || error);

      if (i === totalRetries - 1) {
        throw error;
      }

      const backoffDelay = Math.min(3000, 500 * Math.pow(2, i));
      await new Promise((resolve) => setTimeout(resolve, backoffDelay));
    }
  }

  return undefined;
}

async function sendMessage(sock, phone, text) {
  ensureSocket(sock);
  const jid = ensureWhatsAppJid(phone);

  try {
    return await sendWithRetry(
      () => sock.sendMessage(jid, { text }),
      3
    );
  } catch (error) {
    console.error(`[WHATSAPP-SEND-ERROR] sendMessage failed JID=${jid}:`, {
      phone,
      text: text?.substring(0, 100),
      errorMessage: error?.message,
      errorCode: error?.code,
      errorStack: error?.stack,
      error,
    });
    throw error;
  }
}

async function sendImage(sock, phone, imagePath, caption = '') {
  ensureSocket(sock);
  const jid = ensureWhatsAppJid(phone);

  try {
    return await sendWithRetry(
      () =>
        sock.sendMessage(jid, {
          image: toMediaPayload(imagePath),
          ...(caption ? { caption } : {}),
        }),
      3
    );
  } catch (error) {
    console.error(`[WHATSAPP-SEND-ERROR] sendImage failed JID=${jid}:`, {
      phone,
      imagePath,
      caption: caption?.substring(0, 100),
      errorMessage: error?.message,
      errorCode: error?.code,
      errorStack: error?.stack,
      error,
    });
    throw error;
  }
}

async function sendVideo(sock, phone, videoPath, caption = '') {
  ensureSocket(sock);
  const jid = ensureWhatsAppJid(phone);

  try {
    return await sendWithRetry(
      () =>
        sock.sendMessage(jid, {
          video: toMediaPayload(videoPath),
          ...(caption ? { caption } : {}),
        }),
      3
    );
  } catch (error) {
    console.error(`[WHATSAPP-SEND-ERROR] sendVideo failed JID=${jid}:`, {
      phone,
      videoPath,
      caption: caption?.substring(0, 100),
      errorMessage: error?.message,
      errorCode: error?.code,
      errorStack: error?.stack,
      error,
    });
    throw error;
  }
}

async function sendAudio(sock, phone, audioPath, ptt = false, mimetype) {
  ensureSocket(sock);
  const jid = ensureWhatsAppJid(phone);

  try {
    return await sendWithRetry(
      () =>
        sock.sendMessage(jid, {
          audio: toMediaPayload(audioPath),
          mimetype: mimetype || (ptt ? 'audio/ogg; codecs=opus' : 'audio/mp4'),
          ptt,
        }),
      3
    );
  } catch (error) {
    console.error(`[WHATSAPP-SEND-ERROR] sendAudio failed JID=${jid}:`, {
      phone,
      audioPath,
      ptt,
      mimetype,
      errorMessage: error?.message,
      errorCode: error?.code,
      errorStack: error?.stack,
      error,
    });
    throw error;
  }
}

async function sendDocument(sock, phone, docPath, fileName, mimetype) {
  ensureSocket(sock);
  const jid = ensureWhatsAppJid(phone);

  try {
    return await sendWithRetry(
      () =>
        sock.sendMessage(jid, {
          document: toMediaPayload(docPath),
          fileName: getDocumentFileName(docPath, fileName),
          ...(mimetype ? { mimetype } : {}),
        }),
      3
    );
  } catch (error) {
    console.error(`[WHATSAPP-SEND-ERROR] sendDocument failed JID=${jid}:`, {
      phone,
      docPath,
      fileName,
      mimetype,
      errorMessage: error?.message,
      errorCode: error?.code,
      errorStack: error?.stack,
      error,
    });
    throw error;
  }
}

async function sendSticker(sock, phone, stickerPath) {
  ensureSocket(sock);
  const jid = ensureWhatsAppJid(phone);

  try {
    return await sendWithRetry(
      () =>
        sock.sendMessage(jid, {
          sticker: toMediaPayload(stickerPath),
        }),
      3
    );
  } catch (error) {
    console.error(`[WHATSAPP-SEND-ERROR] sendSticker failed JID=${jid}:`, {
      phone,
      stickerPath,
      errorMessage: error?.message,
      errorCode: error?.code,
      errorStack: error?.stack,
      error,
    });
    throw error;
  }
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
      return sendAudio(sock, phone, mediaPath, ptt, mimetype);
    case 'document':
      return sendDocument(sock, phone, mediaPath, fileName, mimetype);
    case 'sticker':
      return sendSticker(sock, phone, mediaPath);
    default:
      throw new Error('Unsupported mediaType. Use image, video, audio, document, or sticker.');
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
  sendSticker,
  sendVideo,
  sendWithRetry,
};
