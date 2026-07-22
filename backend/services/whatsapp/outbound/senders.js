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
    // service not initialised yet - fall through.
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

// In-memory JID resolution cache to avoid repeated onWhatsApp calls.
// Key = raw digits, Value = { jid, ts }. Entries expire after 5 minutes.
const jidResolveCache = new Map();
const JID_CACHE_TTL_MS = 5 * 60 * 1000;

function getCachedJid(digits) {
  const entry = jidResolveCache.get(digits);
  if (!entry) return null;
  if (Date.now() - entry.ts > JID_CACHE_TTL_MS) {
    jidResolveCache.delete(digits);
    return null;
  }
  return entry.jid;
}

function setCachedJid(digits, jid) {
  // Cap cache size to prevent memory leaks
  if (jidResolveCache.size > 5000) {
    const firstKey = jidResolveCache.keys().next().value;
    jidResolveCache.delete(firstKey);
  }
  jidResolveCache.set(digits, { jid, ts: Date.now() });
}

async function resolveRegisteredJid(sock, jid, options = {}) {
  const requireRegistered = options.requireRegistered !== false;
  if (!jid || !sock || typeof sock.onWhatsApp !== 'function') {
    return jid;
  }

  // A LID is an address already observed from WhatsApp. Reuse it instead of
  // revalidating on every send: USync may transiently return no result and
  // previously turned a valid second message into a false HTTP 422.
  if (jid.endsWith('@lid')) {
    const cleanLid = jid.split('@')[0].split(':')[0];
    const cachedLid = getCachedJid(cleanLid);
    if (cachedLid) return cachedLid;

    const mappedPhone = global.lidToPhoneMap?.get(cleanLid);
    const cleanPhone = mappedPhone
      ? String(mappedPhone).split('@')[0].split(':')[0]
      : null;
    const cachedPhone = cleanPhone ? getCachedJid(cleanPhone) : null;
    if (cachedPhone) {
      setCachedJid(cleanLid, cachedPhone);
      return cachedPhone;
    }

    if (!cleanPhone) {
      setCachedJid(cleanLid, jid);
      return jid;
    }

    try {
      const checkResult = await sock.onWhatsApp(`${cleanPhone}@s.whatsapp.net`);
      const match = Array.isArray(checkResult) ? checkResult.find((entry) => entry?.exists) : null;
      if (!match) {
        console.warn(`[JID-RESOLVE] transient LID confirmation miss for ${jid}; reusing known address`);
        setCachedJid(cleanPhone, jid);
        setCachedJid(cleanLid, jid);
        return jid;
      }

      const authoritativePhoneJid = match.jid
        ? match.jid
        : `${cleanPhone}@s.whatsapp.net`;
      if (match.lid) {
        const lidStr = `${String(match.lid).split('@')[0].split(':')[0]}@lid`;
        global.phoneToLidMap?.set(cleanPhone, lidStr.split('@')[0]);
        global.lidToPhoneMap?.set(lidStr.split('@')[0], cleanPhone);
      }
      setCachedJid(cleanPhone, authoritativePhoneJid);
      setCachedJid(cleanLid, authoritativePhoneJid);
      console.log(`[JID-RESOLVE] confirmed ${cleanPhone} -> ${authoritativePhoneJid}`);
      return authoritativePhoneJid;
    } catch (error) {
      console.warn(`[JID-RESOLVE] LID confirmation failed for ${jid}; reusing known address:`, error?.message || error);
      setCachedJid(cleanPhone, jid);
      setCachedJid(cleanLid, jid);
      return jid;
    }
  }
  if (!jid.endsWith('@s.whatsapp.net')) {
    return jid;
  }

  const clean = jid.split('@')[0];
  if (!clean || !/^\d+$/.test(clean)) {
    return jid;
  }

  const cached = getCachedJid(clean);
  if (cached) {
    return cached;
  }

  const queryCandidate = async (candidateJid, reason) => {
    const checkResult = await sock.onWhatsApp(candidateJid);
    if (Array.isArray(checkResult) && checkResult.length > 0 && checkResult[0].exists) {
      const resolvedJid = checkResult[0].jid || candidateJid;
      if (checkResult[0].lid) {
        const lidStr = `${String(checkResult[0].lid).split('@')[0].split(':')[0]}@lid`;
        global.phoneToLidMap?.set(clean, lidStr.split('@')[0]);
        global.lidToPhoneMap?.set(lidStr.split('@')[0], clean);
      }
      setCachedJid(clean, resolvedJid);
      if (resolvedJid !== jid || reason) {
        console.log(`[JID-RESOLVE] ${reason || 'resolved'} ${clean} -> ${resolvedJid}`);
      }
      return resolvedJid;
    }
    return null;
  };

  try {
    const original = await queryCandidate(jid);
    if (original) return original;

    if (clean.startsWith('55') && clean.length === 13) {
      const ddd = clean.substring(2, 4);
      const number = clean.substring(5);
      const clean12 = `55${ddd}${number}`;
      const resolved = await queryCandidate(`${clean12}@s.whatsapp.net`, 'BR 13-to-12 fallback');
      if (resolved) return resolved;
    }

    if (clean.startsWith('55') && clean.length === 12) {
      const ddd = clean.substring(2, 4);
      const number = clean.substring(4);
      const clean13 = `55${ddd}9${number}`;
      const resolved = await queryCandidate(`${clean13}@s.whatsapp.net`, 'BR 12-to-13 fallback');
      if (resolved) return resolved;
    }
  } catch (err) {
    console.warn(`[JID-RESOLVE] onWhatsApp query failed for ${clean}:`, err.message);
    if (requireRegistered) {
      const error = new Error('Nao foi possivel confirmar este numero no WhatsApp. Reconecte a sessao e tente novamente.');
      error.code = 'WHATSAPP_JID_VERIFY_FAILED';
      error.jid = jid;
      throw error;
    }
  }

  // Do not cache misses: a number may become resolvable after reconnect/history sync.
  if (requireRegistered) {
    const error = new Error('Numero nao encontrado no WhatsApp. Verifique o contato antes de enviar.');
    error.code = 'WHATSAPP_NUMBER_NOT_FOUND';
    error.jid = jid;
    throw error;
  }

  return jid;
}

async function sendMessage(sock, phone, text) {
  ensureSocket(sock);
  let jid = ensureWhatsAppJid(phone);
  jid = await resolveRegisteredJid(sock, jid, { requireRegistered: true });

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
  let jid = ensureWhatsAppJid(phone);
  jid = await resolveRegisteredJid(sock, jid, { requireRegistered: true });

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
  let jid = ensureWhatsAppJid(phone);
  jid = await resolveRegisteredJid(sock, jid, { requireRegistered: true });

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
  let jid = ensureWhatsAppJid(phone);
  jid = await resolveRegisteredJid(sock, jid, { requireRegistered: true });

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
  let jid = ensureWhatsAppJid(phone);
  jid = await resolveRegisteredJid(sock, jid, { requireRegistered: true });

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
  let jid = ensureWhatsAppJid(phone);
  jid = await resolveRegisteredJid(sock, jid, { requireRegistered: true });

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
  resolveRegisteredJid,
  sendAudio,
  sendDocument,
  sendImage,
  sendMediaMessage,
  sendMessage,
  sendSticker,
  sendVideo,
  sendWithRetry,
};
