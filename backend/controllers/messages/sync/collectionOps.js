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
  const byKey = new Map();

  for (const entry of messages || []) {
    if (!entry) {
      continue;
    }

    const idKey = String(entry.id || '').trim();
    const fallbackKey = [
      String(entry.phone || '').trim(),
      String(entry.createdAt || entry.timestamp || '').trim(),
      String(entry.content || entry.text || '').trim(),
      String(entry.mediaType || entry.type || '').trim(),
      String(entry.fromMe ?? ''),
    ].join('|');
    const key = idKey || fallbackKey;

    byKey.set(key, entry);
  }

  return Array.from(byKey.values());
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
