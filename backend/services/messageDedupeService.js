/**
 * Unified TTL-based message dedupe.
 *
 * Replaces two independent unbounded Sets that previously lived in
 *   - controllers/messagesController.js  (`recentInboundMessageIds`)
 *   - services/whatsappService.legacy.js (`globalInboundMessageIds`)
 *
 * Both caches are now backed by this single service so that a message id
 * seen on one ingestion path is also considered seen on the other,
 * preventing both duplicates and silent drops.
 *
 * Semantics:
 *   markSeen(ns, id) -> true  if we should process this id now (first time).
 *                       false if it was already marked within TTL.
 *
 * Eviction:
 *   - Lazy: expired entries are removed on access.
 *   - Hard cap: when the map exceeds `MAX_ENTRIES`, the oldest 10% is dropped.
 */

const DEFAULT_TTL_MS = Math.max(
  60_000,
  Number(process.env.MESSAGE_DEDUPE_TTL_MS) || 10 * 60_000 // 10 minutes
);
const MAX_ENTRIES = Math.max(
  1_000,
  Number(process.env.MESSAGE_DEDUPE_MAX_ENTRIES) || 50_000
);

const entries = new Map(); // key => expiresAt (ms epoch)

function buildKey(namespace, id) {
  return `${String(namespace || 'default')}::${String(id || '').trim()}`;
}

function evictIfNeeded() {
  if (entries.size <= MAX_ENTRIES) {
    return;
  }

  const targetSize = Math.floor(MAX_ENTRIES * 0.9);
  const removeCount = entries.size - targetSize;
  let removed = 0;

  // Map preserves insertion order; drop the oldest keys.
  for (const key of entries.keys()) {
    if (removed >= removeCount) break;
    entries.delete(key);
    removed += 1;
  }
}

/**
 * Mark an id as seen. Returns true if the caller should process it (first
 * time within TTL), false if it's a duplicate.
 */
function markSeen(namespace, id, ttlMs = DEFAULT_TTL_MS) {
  const rawId = String(id || '').trim();

  if (!rawId) {
    // No id means we can't dedupe; let the caller decide.
    return true;
  }

  const key = buildKey(namespace, rawId);
  const now = Date.now();
  const existing = entries.get(key);

  if (existing && existing > now) {
    return false;
  }

  // Either missing or expired: reinsert at the tail so insertion order
  // reflects recency for eviction purposes.
  if (existing) {
    entries.delete(key);
  }

  entries.set(key, now + Math.max(1_000, Number(ttlMs) || DEFAULT_TTL_MS));
  evictIfNeeded();
  return true;
}

function hasSeen(namespace, id) {
  const rawId = String(id || '').trim();
  if (!rawId) return false;

  const key = buildKey(namespace, rawId);
  const expiresAt = entries.get(key);

  if (!expiresAt) return false;

  if (expiresAt <= Date.now()) {
    entries.delete(key);
    return false;
  }

  return true;
}

function clearNamespace(namespace) {
  const prefix = `${String(namespace || 'default')}::`;
  for (const key of entries.keys()) {
    if (key.startsWith(prefix)) entries.delete(key);
  }
}

function stats() {
  return {
    size: entries.size,
    maxEntries: MAX_ENTRIES,
    ttlMs: DEFAULT_TTL_MS,
  };
}

module.exports = {
  clearNamespace,
  hasSeen,
  markSeen,
  stats,
};
