type CacheRecord<T> = {
  value: T;
  expiresAt: number;
};

const memoryCache = new Map<string, CacheRecord<unknown>>();

export function getCache<T>(key: string): T | null {
  const record = memoryCache.get(key);
  if (!record) return null;

  if (Date.now() > record.expiresAt) {
    memoryCache.delete(key);
    return null;
  }

  return record.value as T;
}

export function setCache<T>(key: string, value: T, ttlMs: number): void {
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

export function invalidateCache(key: string): void {
  for (const cachedKey of memoryCache.keys()) {
    if (cachedKey === key || cachedKey.startsWith(`${key}:`)) {
      memoryCache.delete(cachedKey);
    }
  }
}
