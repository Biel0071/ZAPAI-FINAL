/**
 * Message collection operations: sorting / dedupe / API normalization.
 * Extracted from controllers/messagesController.js (Phase 2a).
 */

const { formatApiMessage } = require('../shared');

function sortMessagesAsc(messages = []) {
  return [...messages].sort(
    (a, b) =>
      new Date(a?.createdAt || a?.timestamp || 0) - new Date(b?.createdAt || b?.timestamp || 0)
  );
}

function dedupeMessages(messages = []) {
  const result = [];

  for (const entry of messages || []) {
    if (!entry) continue;

    const id = String(entry.id || '').trim();
    const waId = String(entry.whatsappMessageId || entry.externalMessageId || '').trim();

    const existingIdx = result.findIndex((m) => {
      const mId = String(m.id || '').trim();
      const mWaId = String(m.whatsappMessageId || m.externalMessageId || '').trim();

      if (id && mId && id === mId) return true;
      if (waId && mWaId && waId === mWaId) return true;
      if (waId && mId && waId === mId) return true;
      if (id && mWaId && id === mWaId) return true;

      const mContent = String(m.content || m.text || '').trim();
      const entryContent = String(entry.content || entry.text || '').trim();
      const timeDiff = Math.abs(
        new Date(m.createdAt || m.timestamp || 0).getTime() -
        new Date(entry.createdAt || entry.timestamp || 0).getTime()
      );

      if (
        mContent &&
        mContent === entryContent &&
        Boolean(m.fromMe) === Boolean(entry.fromMe) &&
        (Number.isNaN(timeDiff) || timeDiff < 5000)
      ) {
        return true;
      }
      return false;
    });

    if (existingIdx === -1) {
      result.push(entry);
    } else {
      if (String(result[existingIdx].id || '').startsWith('temp-') && !id.startsWith('temp-')) {
        result[existingIdx] = entry;
      }
    }
  }

  return result;
}

function normalizeMessagesForApi(messages = []) {
  const normalized = (messages || [])
    .map((entry) => formatApiMessage(entry))
    .filter(Boolean);

  return sortMessagesAsc(dedupeMessages(normalized));
}

module.exports = {
  dedupeMessages,
  normalizeMessagesForApi,
  sortMessagesAsc,
};
