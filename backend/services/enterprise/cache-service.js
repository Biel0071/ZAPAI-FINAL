const CACHE_TTL_SECONDS = Math.max(60, Number(process.env.MEDIA_CACHE_TTL_SECONDS || 60 * 60));

const memoryCache = new Map();
let redisClient = null;
let redisConnectionAttempted = false;

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function getRedisConfig() {
  const url = String(process.env.REDIS_URL || '').trim();

  if (url) {
    return { url };
  }

  const host = String(process.env.REDIS_HOST || '').trim();
  const port = Number(process.env.REDIS_PORT || 6379);

  if (!host) {
    return null;
  }

  return {
    socket: {
      host,
      port: Number.isFinite(port) ? port : 6379,
    },
  };
}

async function getRedisClient() {
  if (redisClient) {
    return redisClient;
  }

  if (redisConnectionAttempted) {
    return null;
  }

  redisConnectionAttempted = true;

  let createClient = null;

  try {
    ({ createClient } = require('redis'));
  } catch {
    return null;
  }

  const config = getRedisConfig();

  if (!config) {
    return null;
  }

  try {
    const client = createClient(config);

    client.on('error', (error) => {
      console.warn('[CACHE] Redis error:', error?.message || error);
    });

    await client.connect();
    redisClient = client;
    return redisClient;
  } catch (error) {
    console.warn('[CACHE] Redis unavailable, using memory cache:', error?.message || error);
    redisClient = null;
    return null;
  }
}

function setMemory(key, value, ttlSeconds = CACHE_TTL_SECONDS) {
  memoryCache.set(key, {
    expiresAt: nowSeconds() + Math.max(1, Number(ttlSeconds) || CACHE_TTL_SECONDS),
    value,
  });
}

function getMemory(key) {
  const item = memoryCache.get(key);

  if (!item) {
    return null;
  }

  if (item.expiresAt <= nowSeconds()) {
    memoryCache.delete(key);
    return null;
  }

  return item.value;
}

async function setJson(key, value, ttlSeconds = CACHE_TTL_SECONDS) {
  const serialized = JSON.stringify(value || null);
  const redis = await getRedisClient();

  if (redis) {
    try {
      await redis.set(key, serialized, {
        EX: Math.max(1, Number(ttlSeconds) || CACHE_TTL_SECONDS),
      });
      return;
    } catch (error) {
      console.warn('[CACHE] Failed to set Redis key:', error?.message || error);
    }
  }

  setMemory(key, value, ttlSeconds);
}

async function getJson(key) {
  const redis = await getRedisClient();

  if (redis) {
    try {
      const raw = await redis.get(key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.warn('[CACHE] Failed to read Redis key:', error?.message || error);
    }
  }

  return getMemory(key);
}

module.exports = {
  CACHE_TTL_SECONDS,
  getJson,
  getRedisClient,
  setJson,
};
