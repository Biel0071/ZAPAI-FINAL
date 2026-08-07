const CACHE_TTL_MS = 120000; // 120s
const MAX_ENTRIES = 512;

class LRUHistoryCache {
  constructor() {
    this.cache = new Map();
  }

  get(conversationId) {
    const entry = this.cache.get(conversationId);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(conversationId);
      return null;
    }

    // Touch LRU
    this.cache.delete(conversationId);
    this.cache.set(conversationId, entry);

    return entry.value.slice(); // Return shallow copy
  }

  set(conversationId, history) {
    this.cache.set(conversationId, {
      value: history,
      expiresAt: Date.now() + CACHE_TTL_MS
    });

    if (this.cache.size > MAX_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
  }

  invalidate(conversationId) {
    this.cache.delete(conversationId);
  }
  
  append(conversationId, newMessages) {
      const history = this.get(conversationId);
      if (history) {
          const updatedHistory = [...history, ...newMessages].slice(-20); // Keep last 20
          this.set(conversationId, updatedHistory);
      }
  }
}

const historyCache = new LRUHistoryCache();
module.exports = historyCache;
