/**
 * Media payload builders for Baileys `sock.sendMessage` calls.
 * Extracted from whatsappService.legacy.js (Phase 2a).
 *
 * Decides whether the given `filePath` should be delivered to Baileys as:
 *   - a Buffer (data: URL or raw base64), or
 *   - a `{ url }` object (file path / URL that Baileys will stream).
 *
 * Pure — no fs / socket / DB I/O.
 */

const path = require('path');
const { isLikelyBase64Payload } = require('../shared/serialization');

function getMediaUrlPayload(filePath) {
  let resolvedPath = String(filePath || '').trim();
  if (resolvedPath.startsWith('/upload/') || resolvedPath.startsWith('upload/')) {
    resolvedPath = path.join(process.cwd(), resolvedPath.replace(/^\//, ''));
  }
  return {
    url: resolvedPath,
  };
}

function toMediaPayload(filePath) {
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
};
