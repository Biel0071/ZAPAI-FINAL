/**
 * Pure time helpers. Extracted from whatsappService.legacy.js (Phase 2a).
 */

function toUnixMillis(value) {
  const numeric = Number(value || 0);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return Date.now();
  }

  // Treat seconds as ms when below the year-2001 millisecond threshold.
  return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
}

function toRealtimeTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === 'string') {
    const parsed = Date.parse(value);

    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return Date.now();
}

function isToday(timestamp) {
  const date = new Date(toUnixMillis(timestamp));
  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function getMessageTimestamp() {
  return new Date().toISOString();
}

module.exports = {
  getMessageTimestamp,
  isToday,
  toRealtimeTimestamp,
  toUnixMillis,
};
