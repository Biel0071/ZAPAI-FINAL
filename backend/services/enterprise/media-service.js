const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');
const sharp = require('sharp');
const { getJson, setJson } = require('./cache-service');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const MEDIA_ROOT = path.join(PROJECT_ROOT, 'media');
const MEDIA_TYPE_DIRECTORY = {
  audio: 'audios',
  document: 'documents',
  image: 'images',
  video: 'videos',
};
const MEDIA_FALLBACK_EXTENSION = {
  audio: '.mp3',
  document: '.bin',
  image: '.jpg',
  video: '.mp4',
};
const mediaMetadataIndex = new Map();

function normalizeTenantId(tenantId = '') {
  const value = String(tenantId || process.env.DEFAULT_COMPANY_ID || 'default')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_');

  return value || 'default';
}

function normalizeMediaType(type = '') {
  const value = String(type || 'document').toLowerCase();

  if (value.includes('image')) return 'image';
  if (value.includes('video')) return 'video';
  if (value.includes('audio')) return 'audio';
  return 'document';
}

function extensionFromMimeType(mimeType = '', mediaType = 'document') {
  const normalized = String(mimeType || '').toLowerCase();

  if (normalized.includes('jpeg') || normalized.includes('jpg')) return '.jpg';
  if (normalized.includes('png')) return '.png';
  if (normalized.includes('webp')) return '.webp';
  if (normalized.includes('gif')) return '.gif';
  if (normalized.includes('mp4')) return '.mp4';
  if (normalized.includes('ogg')) return '.ogg';
  if (normalized.includes('mpeg') || normalized.includes('mp3')) return '.mp3';
  if (normalized.includes('wav')) return '.wav';
  if (normalized.includes('pdf')) return '.pdf';

  return MEDIA_FALLBACK_EXTENSION[mediaType] || '.bin';
}

async function ensureDirectory(targetPath) {
  await fsp.mkdir(targetPath, { recursive: true });
}

async function generateImageThumbnail({ sourcePath, thumbnailPath }) {
  await ensureDirectory(path.dirname(thumbnailPath));
  await sharp(sourcePath)
    .resize(360, 360, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 74 })
    .toFile(thumbnailPath);

  return true;
}

async function generateVideoThumbnail({ sourcePath, thumbnailPath }) {
  await ensureDirectory(path.dirname(thumbnailPath));

  return new Promise((resolve) => {
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-i',
      sourcePath,
      '-ss',
      '00:00:01.000',
      '-vframes',
      '1',
      '-vf',
      'scale=360:-1',
      thumbnailPath,
    ]);

    ffmpeg.once('error', () => resolve(false));
    ffmpeg.once('close', (code) => resolve(code === 0));
  });
}

async function maybeGenerateThumbnail({ absolutePath, mediaId, mediaType, tenantId }) {
  if (!['image', 'video'].includes(mediaType)) {
    return null;
  }

  const thumbnailDirectory = path.join(MEDIA_ROOT, normalizeTenantId(tenantId), 'thumbnails');
  const thumbnailFileName = `${mediaId}.jpg`;
  const thumbnailAbsolutePath = path.join(thumbnailDirectory, thumbnailFileName);

  try {
    if (mediaType === 'image') {
      await generateImageThumbnail({ sourcePath: absolutePath, thumbnailPath: thumbnailAbsolutePath });
      return `/media/${normalizeTenantId(tenantId)}/thumbnails/${thumbnailFileName}`;
    }

    const success = await generateVideoThumbnail({
      sourcePath: absolutePath,
      thumbnailPath: thumbnailAbsolutePath,
    });

    return success ? `/media/${normalizeTenantId(tenantId)}/thumbnails/${thumbnailFileName}` : null;
  } catch (error) {
    console.warn('[MEDIA] Thumbnail generation failed:', error?.message || error);
    return null;
  }
}

function buildMediaMetadata({
  absolutePath,
  mediaId,
  mediaType,
  mimeType,
  size,
  tenantId,
  relativePath,
  thumbnail,
}) {
  return {
    absolutePath,
    id: mediaId,
    mimeType: mimeType || null,
    relativePath,
    size: Number(size || 0),
    tenantId: normalizeTenantId(tenantId),
    thumbnail: thumbnail || null,
    type: mediaType,
    url: relativePath,
  };
}

async function cacheMetadata(metadata) {
  if (!metadata?.id) {
    return;
  }

  mediaMetadataIndex.set(metadata.id, metadata);
  await setJson(`media:${metadata.id}`, metadata);
}

async function getMetadata(mediaId = '') {
  const key = String(mediaId || '').trim();

  if (!key) {
    return null;
  }

  if (mediaMetadataIndex.has(key)) {
    return mediaMetadataIndex.get(key) || null;
  }

  const cached = await getJson(`media:${key}`);

  if (cached) {
    mediaMetadataIndex.set(key, cached);
    return cached;
  }

  return null;
}

async function saveBuffer({ buffer, tenantId, type, mimeType, sourceFileName }) {
  const normalizedTenantId = normalizeTenantId(tenantId);
  const mediaType = normalizeMediaType(type);
  const mediaFolder = MEDIA_TYPE_DIRECTORY[mediaType] || MEDIA_TYPE_DIRECTORY.document;
  const mediaId = crypto.randomUUID();
  const extension =
    path.extname(sourceFileName || '') || extensionFromMimeType(mimeType, mediaType);
  const fileName = `${Date.now()}-${mediaId}${extension}`;
  const directory = path.join(MEDIA_ROOT, normalizedTenantId, mediaFolder);

  await ensureDirectory(directory);

  const absolutePath = path.join(directory, fileName);
  await fsp.writeFile(absolutePath, buffer);

  const relativePath = `/media/${normalizedTenantId}/${mediaFolder}/${fileName}`;
  const thumbnail = await maybeGenerateThumbnail({
    absolutePath,
    mediaId,
    mediaType,
    tenantId: normalizedTenantId,
  });

  const metadata = buildMediaMetadata({
    absolutePath,
    mediaId,
    mediaType,
    mimeType,
    size: buffer.length,
    tenantId: normalizedTenantId,
    relativePath,
    thumbnail,
  });

  await cacheMetadata(metadata);

  return {
    id: metadata.id,
    mimeType: metadata.mimeType,
    size: metadata.size,
    thumbnail: metadata.thumbnail,
    type: metadata.type,
    url: metadata.url,
  };
}

async function downloadFromWhatsApp({
  mediaMessage,
  mediaType,
  tenantId,
  downloadMediaMessage,
  downloadContentFromMessage,
}) {
  if (!mediaMessage || !mediaType) {
    return null;
  }

  let buffer = null;

  try {
    buffer = await downloadMediaMessage(
      { message: { [`${mediaType}Message`]: mediaMessage } },
      'buffer',
      {},
      {}
    );
  } catch {
    const stream = await downloadContentFromMessage(mediaMessage, mediaType);
    const chunks = [];

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    buffer = Buffer.concat(chunks);
  }

  const saved = await saveBuffer({
    buffer,
    mimeType: mediaMessage.mimetype || null,
    sourceFileName: mediaMessage.fileName || null,
    tenantId,
    type: mediaType,
  });

  return {
    fileName: path.basename(saved.url || ''),
    filePath: saved.url,
    id: saved.id,
    mimeType: saved.mimeType,
    size: saved.size,
    thumbnail: saved.thumbnail,
    type: saved.type,
    url: saved.url,
  };
}

function parseRangeHeader(rangeHeader, fileSize) {
  if (!rangeHeader || !rangeHeader.startsWith('bytes=')) {
    return null;
  }

  const [startRaw, endRaw] = rangeHeader.replace('bytes=', '').split('-');
  let start = Number(startRaw || 0);
  let end = Number(endRaw || fileSize - 1);

  if (!Number.isFinite(start) || start < 0) {
    start = 0;
  }

  if (!Number.isFinite(end) || end >= fileSize) {
    end = fileSize - 1;
  }

  if (start > end) {
    return null;
  }

  return { end, start };
}

async function streamMediaById({ mediaId, req, res }) {
  const metadata = await getMetadata(mediaId);

  if (!metadata?.absolutePath) {
    res.status(404).json({ error: 'Media not found.' });
    return;
  }

  let stat = null;

  try {
    stat = await fsp.stat(metadata.absolutePath);
  } catch {
    res.status(404).json({ error: 'Media file is unavailable.' });
    return;
  }

  const fileSize = stat.size;
  const range = parseRangeHeader(req.headers?.range, fileSize);
  const mimeType = metadata.mimeType || 'application/octet-stream';

  if (range) {
    res.status(206);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', range.end - range.start + 1);
    res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${fileSize}`);
    res.setHeader('Content-Type', mimeType);
    fs.createReadStream(metadata.absolutePath, { end: range.end, start: range.start }).pipe(res);
    return;
  }

  res.status(200);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Length', fileSize);
  res.setHeader('Content-Type', mimeType);
  fs.createReadStream(metadata.absolutePath).pipe(res);
}

module.exports = {
  downloadFromWhatsApp,
  getMetadata,
  normalizeMediaType,
  normalizeTenantId,
  saveBuffer,
  streamMediaById,
};
