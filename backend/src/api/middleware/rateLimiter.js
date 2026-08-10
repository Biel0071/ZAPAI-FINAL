const buckets = new Map();

function createRateLimiter({ windowMs = 60_000, max = 120 } = {}) {
  return function rateLimiter(req, res, next) {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const key = `${ip}:${req.path}`;

    const bucket = buckets.get(key) || {
      count: 0,
      expiresAt: now + windowMs,
    };

    if (now > bucket.expiresAt) {
      bucket.count = 0;
      bucket.expiresAt = now + windowMs;
    }

    bucket.count += 1;
    buckets.set(key, bucket);

    if (bucket.count > max) {
      return res.status(429).json({
        error: 'Too many requests. Please retry later.',
      });
    }

    return next();
  };
}

module.exports = {
  createRateLimiter,
};
