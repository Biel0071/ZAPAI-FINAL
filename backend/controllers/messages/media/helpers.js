/**
 * Media helpers for the message controller.
 * Extracted from controllers/messagesController.js (Phase 2a).
 */

const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const messageService = require('../../../services/messageService');

const MEDIA_TEMP_PUBLIC_PREFIX = '/media/temp';

function inferMediaType(mediaPath = '') {
  const normalizedPath = String(mediaPath || '').toLowerCase();

  if (!normalizedPath) {
    return null;
  }

  if (/\.(png|jpg|jpeg|gif|webp)$/i.test(normalizedPath)) {
    return 'image';
  }

  if (/\.(mp4|mov|avi|mkv|webm)$/i.test(normalizedPath)) {
    return 'video';
  }

  if (/\.(mp3|wav|ogg|aac|m4a)$/i.test(normalizedPath)) {
    return 'audio';
  }

  return 'document';
}

function isBase64MediaInput(value = '') {
  const normalized = String(value || '').trim();

  if (!normalized || normalized.length < 32) {
    return false;
  }

  if (normalized.startsWith('data:')) {
    return true;
  }

  if (/^(https?:)?\/\//i.test(normalized)) {
    return false;
  }

  if (/^[A-Za-z]:\\|^\\\\|^\//.test(normalized)) {
    return false;
  }

  return /^[A-Za-z0-9+/=\r\n]+$/.test(normalized);
}

function extensionFromMimeType(mimetype = '', mediaType = 'document') {
  const normalizedMimeType = String(mimetype || '').toLowerCase();

  if (normalizedMimeType.includes('jpeg') || normalizedMimeType.includes('jpg')) {
    return '.jpg';
  }

  if (normalizedMimeType.includes('png')) {
    return '.png';
  }

  if (normalizedMimeType.includes('webp')) {
    return '.webp';
  }

  if (normalizedMimeType.includes('gif')) {
    return '.gif';
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

  if (normalizedMimeType.includes('wav')) {
    return '.wav';
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

  switch (mediaType) {
    case 'image':
      return '.jpg';
    case 'video':
      return '.mp4';
    case 'audio':
      return '.mp3';
    default:
      return '.bin';
  }
}

async function saveBase64MediaToTempFile(base64Data, { mediaType, mimetype } = {}) {
  const normalized = String(base64Data || '').trim();

  if (!isBase64MediaInput(normalized)) {
    return null;
  }

  await fs.mkdir(messageService.MEDIA_TEMP_DIRECTORY, { recursive: true });

  const [, payload = normalized] = normalized.startsWith('data:') ? normalized.split(',', 2) : [null, normalized];
  const buffer = Buffer.from(String(payload || '').replace(/\s+/g, ''), 'base64');
  const extension = extensionFromMimeType(mimetype || '', mediaType || 'document');
  const fileName = `${randomUUID()}${extension}`;
  const absolutePath = path.join(messageService.MEDIA_TEMP_DIRECTORY, fileName);

  await fs.writeFile(absolutePath, buffer);

  return {
    absolutePath,
    fileName,
    publicPath: `${MEDIA_TEMP_PUBLIC_PREFIX}/${fileName}`,
  };
}

module.exports = {
  MEDIA_TEMP_PUBLIC_PREFIX,
  extensionFromMimeType,
  inferMediaType,
  isBase64MediaInput,
  saveBase64MediaToTempFile,
};
