function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getDelayMs(agent = {}) {
  const minMs = Math.max(0, toNumber(agent?.delayProfile?.minMs, 1000));
  const maxMs = Math.max(minMs, toNumber(agent?.delayProfile?.maxMs, minMs + 1000));

  if (maxMs === minMs) {
    return minMs;
  }

  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

module.exports = {
  getDelayMs,
};
