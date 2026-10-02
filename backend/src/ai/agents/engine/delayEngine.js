function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getDelayMs(agent = {}) {
  const minMs = Math.max(0, toNumber(agent?.delayProfile?.minMs, 12000));
  const maxMs = Math.max(minMs, toNumber(agent?.delayProfile?.maxMs, 25000));

  if (maxMs === minMs) {
    return minMs;
  }

  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

function getTypingDelayMs(agent = {}, text = '') {
  const minMs = Math.max(0, toNumber(agent?.typingDelayProfile?.minMs, 6000));
  const maxMs = Math.max(minMs, toNumber(agent?.typingDelayProfile?.maxMs, 14000));

  if (maxMs === minMs) {
    return minMs;
  }

  if (text && typeof text === 'string' && text.length > 0) {
    const charDelay = text.length * 40;
    const base = Math.min(Math.max(charDelay, minMs), maxMs);
    const jitter = Math.floor(Math.random() * 2000) - 1000;
    return Math.min(maxMs, Math.max(minMs, base + jitter));
  }

  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

module.exports = {
  getDelayMs,
  getTypingDelayMs,
};

