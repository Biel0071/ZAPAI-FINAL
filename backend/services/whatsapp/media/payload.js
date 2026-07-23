/**
 * Media payload builders for Baileys `sock.sendMessage` calls.
 * Decides whether the given `filePath` should be delivered to Baileys as:
 *   - a Buffer (data: URL, raw base64, or resolved local file on disk), or
 *   - a `{ url }` object (file path / URL that Baileys will stream).
 */

const fs = require('fs');
const path = require('path');
const { isLikelyBase64Payload } = require('../shared/serialization');

function resolveLocalMediaDiskPath(filePath) {
  const normalized = String(filePath || '').trim();
  if (!normalized || Buffer.isBuffer(filePath)) return null;
  if (normalized.startsWith('data:') || /^https?:\/\//i.test(normalized)) return null;

  // 1. Direct path check if absolute or relative from CWD
  if (fs.existsSync(normalized)) {
    try {
      if (fs.statSync(normalized).isFile()) {
        return path.resolve(normalized);
      }
    } catch {
      // fall through
    }
  }

  const cleanPath = normalized.replace(/^['"]+|['"]+$/g, '').replace(/\\/g, '/');

  // 2. Candidate paths search across system media roots
  const candidates = [
    path.resolve(process.cwd(), cleanPath.replace(/^\//, '')),
    path.resolve(process.cwd(), 'backend', cleanPath.replace(/^\//, '')),
    path.resolve(process.cwd(), 'storage', 'media', 'temp', path.basename(cleanPath)),
    path.resolve(process.cwd(), 'storage', 'media', cleanPath.replace(/^\/?(media|storage\/media)\//, '')),
    path.resolve(process.cwd(), 'uploads', path.basename(cleanPath)),
    path.resolve(process.cwd(), 'upload', path.basename(cleanPath)),
    path.resolve(__dirname, '..', '..', '..', 'storage', 'media', 'temp', path.basename(cleanPath)),
    path.resolve(__dirname, '..', '..', '..', 'uploads', path.basename(cleanPath)),
    path.resolve(__dirname, '..', '..', '..', 'upload', path.basename(cleanPath)),
  ];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    } catch {
      // continue searching candidates
    }
  }

  return null;
}

function getMediaUrlPayload(filePath) {
  let resolvedPath = String(filePath || '').trim();

  const diskPath = resolveLocalMediaDiskPath(resolvedPath);
  if (diskPath) {
    try {
      return fs.readFileSync(diskPath);
    } catch (err) {
      console.warn('[MEDIA_PAYLOAD] Failed to read disk file, falling back to url object:', err.message);
      return { url: diskPath };
    }
  }

  if (resolvedPath.startsWith('/upload/') || resolvedPath.startsWith('upload/')) {
    resolvedPath = path.join(process.cwd(), resolvedPath.replace(/^\//, ''));
  }

  return {
    url: resolvedPath,
  };
}

function toMediaPayload(filePath) {
  if (Buffer.isBuffer(filePath)) {
    return filePath;
  }

  const normalized = String(filePath || '').trim();

  if (!normalized) {
    return getMediaUrlPayload(filePath);
  }

  if (normalized.startsWith('data:')) {
    const [, base64Content = ''] = normalized.split(',', 2);
    return Buffer.from(base64Content, 'base64');
  }

  if (isLikelyBase64Payload(normalized)) {
    return Buffer.from(normalized.replace(/\s+/g, ''), 'base64');
  }

  return getMediaUrlPayload(filePath);
}

function getDocumentFileName(docPath, fileName) {
  return fileName || path.basename(docPath || '') || `document-${Date.now()}`;
}

module.exports = {
  getDocumentFileName,
  getMediaUrlPayload,
  toMediaPayload,
  resolveLocalMediaDiskPath,
};
