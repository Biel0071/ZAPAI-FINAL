/**
 * Media URL / MIME helpers. Extracted from whatsappService.legacy.js (Phase 2a).
 *
 * `BASE_URL` is read at call time from `process.env.PUBLIC_URL` so changes to
 * that env var during the process lifetime are picked up. Previously the
 * legacy module captured it once at require-time.
 */

function getBaseUrl() {
  return String(process.env.PUBLIC_URL || 'http://localhost:4025').trim().replace(/\/+$/, '');
}

function buildMediaUrl(mediaPath = '') {
  const rawPath = String(mediaPath || '').trim();

  if (!rawPath) {
    return null;
  }

  if (rawPath.startsWith('http')) {
    return rawPath;
  }

  const normalizedPath = rawPath.replace(/^\/+/, '');
  return `${getBaseUrl()}/${normalizedPath}`;
}

function normalizeRealtimeMediaType(type = '') {
  const normalized = String(type || '').toLowerCase();

  if (normalized === 'document') {
    return 'file';
  }

  return normalized || 'text';
}

function extensionFromMimeType(mimeType = '') {
  const normalizedMimeType = String(mimeType).toLowerCase();

  if (normalizedMimeType.includes('jpeg') || normalizedMimeType.includes('jpg')) {
    return '.jpg';
  }

  if (normalizedMimeType.includes('png')) {
    return '.png';
  }

  if (normalizedMimeType.includes('mp4')) {
    return '.mp4';
  }

  if (normalizedMimeType.includes('mpeg') || normalizedMimeType.includes('mp3')) {
    return '.mp3';
  }

  if (normalizedMimeType.includes('ogg')) {
    return '.ogg';
  }

  if (normalizedMimeType.includes('pdf')) {
    return '.pdf';
  }

  if (normalizedMimeType.includes('msword')) {
    return '.doc';
  }

  if (normalizedMimeType.includes('wordprocessingml')) {
    return '.docx';
  }

  return '.bin';
}

module.exports = {
  buildMediaUrl,
  extensionFromMimeType,
  getBaseUrl,
  normalizeRealtimeMediaType,
};
