/**
 * Fast Micro-Cache Middleware — Sub-millisecond In-Memory Response Caching
 * Accelerates GET API responses for static/read-heavy endpoints.
 */

const cacheStore = new Map();
const DEFAULT_TTL_MS = 3000;

function fastCacheMiddleware(ttlMs = DEFAULT_TTL_MS) {
  return (req, res, next) => {
    if (req.method !== 'GET') {
      return next();
    }

    const key = `${req.originalUrl || req.url}:${req.headers['x-tenant-id'] || 'default'}`;
    const cached = cacheStore.get(key);

    if (cached && cached.expiresAt > Date.now()) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).send(cached.body);
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      try {
        const jsonString = JSON.stringify(body);
        cacheStore.set(key, {
          body: jsonString,
          expiresAt: Date.now() + ttlMs,
        });

        // Limit store size to 200 entries to prevent memory growth
        if (cacheStore.size > 200) {
          const oldestKey = cacheStore.keys().next().value;
          if (oldestKey) cacheStore.delete(oldestKey);
        }
      } catch (_) {}

      res.setHeader('X-Cache', 'MISS');
      return originalJson(body);
    };

    next();
  };
}

function invalidateFastCache(keyPrefix) {
  for (const k of cacheStore.keys()) {
    if (!keyPrefix || k.startsWith(keyPrefix)) {
      cacheStore.delete(k);
    }
  }
}

module.exports = {
  fastCacheMiddleware,
  invalidateFastCache,
};
