const crypto = require('crypto');
const fsp = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');
const sharp = require('sharp');
const { getJson, setJson } = require('./cache-service');

const useS3 = process.env.S3_ENABLED === 'true';
let s3Client = null;
if (useS3) {
  try {
    const { S3Client } = require('@aws-sdk/client-s3');
    s3Client = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      },
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    });
    console.log('[MEDIA] S3 storage client initialized successfully');
  } catch (err) {
    console.error('[MEDIA] Failed to initialize S3 client. Make sure "@aws-sdk/client-s3" is installed. Falling back to local storage.', err.message);
  }
}

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const MEDIA_ROOT = path.resolve(process.env.MEDIA_STORAGE_ROOT || path.resolve(PROJECT_ROOT, '..', 'storage', 'media'));
const METADATA_ROOT = path.join(MEDIA_ROOT, '.metadata');
const MEDIA_ACCESS_TTL_SECONDS = 15 * 60;
const MEDIA_ROOTS = {
  media: [MEDIA_ROOT, path.join(PROJECT_ROOT, '..', 'data', 'storage', 'media'), path.join(PROJECT_ROOT, 'media'), path.join(PROJECT_ROOT, 'src', 'api', 'upload')],
  upload: [path.join(PROJECT_ROOT, 'upload'), path.join(PROJECT_ROOT, 'src', 'api', 'upload')],
  uploads: [path.join(PROJECT_ROOT, 'uploads'), path.join(PROJECT_ROOT, '..', 'data', 'uploads'), path.join(PROJECT_ROOT, 'src', 'api', 'uploads')],
};
const MEDIA_TYPE_DIRECTORY = {
  audio: 'audios',
  document: 'documents',
  image: 'images',
  sticker: 'stickers',
  video: 'videos',
};
const MEDIA_FALLBACK_EXTENSION = {
  audio: '.mp3',
  document: '.bin',
  image: '.jpg',
  sticker: '.webp',
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
  if (value.includes('sticker')) return 'sticker';
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
  if (!['image', 'video', 'sticker'].includes(mediaType)) {
    return null;
  }

  const thumbnailDirectory = path.join(MEDIA_ROOT, normalizeTenantId(tenantId), 'thumbnails');
  const thumbnailFileName = `${mediaId}.jpg`;
  const thumbnailAbsolutePath = path.join(thumbnailDirectory, thumbnailFileName);

  try {
    if (mediaType === 'image' || mediaType === 'sticker') {
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
  companyId,
  relativePath,
  thumbnail,
  hash,
  filename,
}) {
  return {
    absolutePath,
    id: mediaId,
    mimeType: mimeType || null,
    relativePath,
    size: Number(size || 0),
    tenantId: normalizeTenantId(tenantId),
    companyId: String(companyId || tenantId),
    thumbnail: thumbnail || null,
    type: mediaType,
    url: relativePath,
    hash: hash || null,
    filename: filename || null,
  };
}

async function cacheMetadata(metadata) {
  if (!metadata?.id) {
    return;
  }

  // The cache is optional; upload ownership must survive a worker restart.
  await ensureDirectory(METADATA_ROOT);
  const metadataPath = path.join(METADATA_ROOT, `${metadata.id}.json`);
  const temporaryPath = `${metadataPath}.${crypto.randomUUID()}.tmp`;
  await fsp.writeFile(temporaryPath, JSON.stringify(metadata), { mode: 0o600 });
  await fsp.rename(temporaryPath, metadataPath);
  mediaMetadataIndex.set(metadata.id, metadata);
  await setJson(`media:${metadata.id}`, metadata);
}

async function getMetadata(mediaId = '') {
  const key = String(mediaId || '').trim();

  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(key)) {
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

  try {
    const metadata = JSON.parse(await fsp.readFile(path.join(METADATA_ROOT, `${key}.json`), 'utf8'));
    if (metadata?.id !== key || !metadata.tenantId) return null;
    mediaMetadataIndex.set(key, metadata);
    return metadata;
  } catch {
    return null;
  }
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

  const hash = crypto.createHash('md5').update(buffer).digest('hex');
  const relativePath = `/media/${normalizedTenantId}/${mediaFolder}/${fileName}`;
  const thumbnail = await maybeGenerateThumbnail({
    absolutePath,
    mediaId,
    mediaType,
    tenantId: normalizedTenantId,
  });

  let finalUrl = relativePath;
  let finalThumbnail = thumbnail;

  if (s3Client) {
    const bucket = process.env.S3_BUCKET;
    try {
      const { PutObjectCommand } = require('@aws-sdk/client-s3');
      
      // Upload main file
      const mainS3Key = `media/${normalizedTenantId}/${mediaFolder}/${fileName}`;
      await s3Client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: mainS3Key,
        Body: buffer,
        ContentType: mimeType || 'application/octet-stream',
      }));

      const s3Domain = process.env.S3_CUSTOM_DOMAIN || `${bucket}.s3.amazonaws.com`;
      const baseS3Url = s3Domain.startsWith('http') ? s3Domain : `https://${s3Domain}`;
      finalUrl = `${baseS3Url}/${mainS3Key}`;

      // Upload thumbnail if present
      if (thumbnail) {
        const thumbFileName = `${mediaId}.jpg`;
        const thumbnailDirectory = path.join(MEDIA_ROOT, normalizedTenantId, 'thumbnails');
        const thumbnailAbsolutePath = path.join(thumbnailDirectory, thumbFileName);
        
        try {
          const thumbBuffer = await fsp.readFile(thumbnailAbsolutePath);
          const thumbS3Key = `media/${normalizedTenantId}/thumbnails/${thumbFileName}`;
          
          await s3Client.send(new PutObjectCommand({
            Bucket: bucket,
            Key: thumbS3Key,
            Body: thumbBuffer,
            ContentType: 'image/jpeg',
          }));
          
          finalThumbnail = `${baseS3Url}/${thumbS3Key}`;
          
          // Keep a durable local copy: delivery is authorized by this server.
        } catch (thumbErr) {
          console.warn('[MEDIA] S3 thumbnail upload failed:', thumbErr.message);
        }
      }
      
      // S3 is a private replica; never return a public bucket URL to the browser.
      finalUrl = relativePath;
      finalThumbnail = thumbnail;
      
    } catch (s3Err) {
      console.error('[MEDIA] S3 upload failed, keeping local file as fallback:', s3Err.message);
      finalUrl = relativePath;
      finalThumbnail = thumbnail;
    }
  }

  const metadata = buildMediaMetadata({
    absolutePath,
    mediaId,
    mediaType,
    mimeType,
    size: buffer.length,
    tenantId: normalizedTenantId,
    companyId: tenantId,
    relativePath: finalUrl,
    thumbnail: finalThumbnail,
    hash,
    filename: fileName,
  });

  await cacheMetadata(metadata);

  return {
    id: metadata.id,
    mimeType: metadata.mimeType,
    size: metadata.size,
    thumbnail: metadata.thumbnail,
    type: metadata.type,
    url: metadata.url,
    hash: metadata.hash,
    filename: metadata.filename,
  };
}

async function downloadFromWhatsApp({
  mediaMessage,
  mediaType,
  tenantId,
  downloadMediaMessage,
  downloadContentFromMessage,
  maxBytes,
}) {
  if (!mediaMessage || !mediaType) {
    return null;
  }

  let buffer = null;

  if (maxBytes) {
    const stream = await downloadContentFromMessage(mediaMessage, mediaType, { options: { timeout: 60000 } });
    const chunks = [];
    let size = 0;
    const deadline = setTimeout(() => stream.destroy(new Error('History media download timed out')), 60000);
    try {
      for await (const chunk of stream) {
        size += chunk.length;
        if (size > maxBytes) { stream.destroy(); throw new Error('History media exceeds download limit'); }
        chunks.push(chunk);
      }
      buffer = Buffer.concat(chunks);
    } finally { clearTimeout(deadline); }
  } else {
    try {
      buffer = await downloadMediaMessage(
        { message: { [`${mediaType}Message`]: mediaMessage } },
        'buffer',
        {},
        {}
      );
      console.log(`[MEDIA-SVC] downloadMediaMessage OK for ${mediaType}, size=${buffer?.length || 0}`);
    } catch (primaryErr) {
      console.warn(`[MEDIA-SVC] downloadMediaMessage failed for ${mediaType}:`, primaryErr?.message || primaryErr);
      try {
        const stream = await downloadContentFromMessage(mediaMessage, mediaType);
        const chunks = [];

        for await (const chunk of stream) {
          chunks.push(chunk);
        }

        buffer = Buffer.concat(chunks);
        console.log(`[MEDIA-SVC] downloadContentFromMessage OK for ${mediaType}, size=${buffer?.length || 0}`);
      } catch (fallbackErr) {
        console.error(`[MEDIA-SVC] Both download methods failed for ${mediaType}:`, fallbackErr?.message || fallbackErr);
        return null;
      }
    }
  }

  if (!buffer || buffer.length === 0) {
    console.warn(`[MEDIA-SVC] Empty buffer for ${mediaType}, skipping save`);
    return null;
  }

  const saved = await saveBuffer({
    buffer,
    mimeType: mediaMessage.mimetype || null,
    sourceFileName: mediaMessage.fileName || null,
    tenantId,
    type: mediaType,
  });

  console.log(`[MEDIA-SVC] Saved ${mediaType}: ${saved.url}`);

  return {
    fileName: path.basename(saved.url || ''),
    filePath: saved.url,
    id: saved.id,
    mimeType: saved.mimeType,
    size: saved.size,
    thumbnail: saved.thumbnail,
    type: saved.type,
    url: saved.url,
    hash: saved.hash,
  };
}

async function streamMediaById({ mediaId, req, res }) {
  const metadata = await getMetadata(mediaId);
  if (!metadata || String(metadata.companyId || metadata.tenantId) !== String(req.authTenantId || '')) {
    res.status(404).json({ error: 'Media not found.' });
    return;
  }

  await sendProtectedFile(normalizeMediaReference(metadata.relativePath || metadata.url), req, res);
}

function mediaAccessError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function normalizeMediaReference(input) {
  let value = String(input || '').trim().replace(/\\/g, '/');
  if (!value || value.length > 4096 || /[\u0000-\u001f]/.test(value) || /^(?:data|file|javascript|blob):/i.test(value)) {
    throw mediaAccessError('Invalid media reference.');
  }
  // Validate before URL parsing: URL() silently collapses literal dot segments.
  for (let attempt = 0; attempt < 4; attempt++) {
    const clean = value.split(/[?#]/, 1)[0];
    if (clean.split('/').some(segment => segment === '..' || segment === '.' || segment.startsWith('.'))) {
      throw mediaAccessError('Invalid media path.');
    }
    let decoded;
    try { decoded = decodeURIComponent(value); } catch { throw mediaAccessError('Invalid media encoding.'); }
    if (decoded === value) break;
    value = decoded.replace(/\\/g, '/');
  }
  if (/%(?:2e|2f|5c|25)/i.test(value)) throw mediaAccessError('Invalid media encoding.');
  value = value.split(/[?#]/, 1)[0];
  const match = value.match(/\/(?:api\/)?(media|upload|uploads)\/(.+)$/i) || value.match(/^(media|upload|uploads)\/(.+)$/i);
  if (!match) throw mediaAccessError('Unsupported media path.');
  const segments = match[2].split('/');
  if (segments.some(segment => !segment || segment.startsWith('.') || segment.includes(':'))) {
    throw mediaAccessError('Invalid media path.');
  }
  return `/${match[1].toLowerCase()}/${segments.join('/')}`;
}

function mediaSigningSecret() {
  const secret = process.env.MEDIA_URL_SECRET || process.env.JWT_SECRET || process.env.AUTH_JWT_SECRET;
  if (!secret) throw mediaAccessError('Media signing is not configured.', 503);
  return secret;
}

function createMediaAccess(reference, tenantId, { now = Math.floor(Date.now() / 1000), ttlSeconds = MEDIA_ACCESS_TTL_SECONDS } = {}) {
  const mediaPath = normalizeMediaReference(reference);
  if (!tenantId) throw mediaAccessError('Authentication is required.', 401);
  const expires = now + Math.min(MEDIA_ACCESS_TTL_SECONDS, Math.max(1, ttlSeconds));
  const payload = Buffer.from(JSON.stringify({ v: 1, p: mediaPath, t: String(tenantId), e: expires })).toString('base64url');
  const signature = crypto.createHmac('sha256', mediaSigningSecret()).update(`media-access:${payload}`).digest('base64url');
  return { url: `${mediaPath.split('/').map(encodeURIComponent).join('/')}?access=${payload}.${signature}`, expiresAt: expires * 1000 };
}

function verifyMediaAccess(access, reference, { now = Math.floor(Date.now() / 1000) } = {}) {
  const [payload, signature, extra] = String(access || '').split('.');
  if (!payload || !signature || extra || payload.length > 8192) throw mediaAccessError('Media access is required.', 401);
  const expected = crypto.createHmac('sha256', mediaSigningSecret()).update(`media-access:${payload}`).digest('base64url');
  if (expected.length !== signature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    throw mediaAccessError('Invalid media access.', 401);
  }
  let claims;
  try { claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { throw mediaAccessError('Invalid media access.', 401); }
  if (claims.v !== 1 || !claims.t || !Number.isInteger(claims.e) || claims.e <= now || claims.e > now + MEDIA_ACCESS_TTL_SECONDS || claims.p !== normalizeMediaReference(reference)) {
    throw mediaAccessError('Media access expired or does not match the file.', 401);
  }
  return { tenantId: claims.t, expiresAt: claims.e * 1000 };
}

function matchesMediaReference(reference, value) {
  try { return normalizeMediaReference(value) === reference; } catch { return false; }
}

async function canAccessMedia(reference, tenantId, dependencies = {}) {
  if (!tenantId) return false;
  const mediaPath = normalizeMediaReference(reference);
  const parts = mediaPath.split('/');
  if (parts[1] === 'upload' && parts[2] === 'quick-replies' && parts.length >= 5) {
    const companyFolder = crypto.createHash('sha256').update(String(tenantId)).digest('hex').slice(0, 24);
    return parts[3] === companyFolder;
  }
  const legacyFolders = ['temp', 'images', 'videos', 'audios', 'documents', 'stickers', 'thumbnails'];
  if (parts[1] === 'media' && parts.length >= 5 && !legacyFolders.includes(parts[2])) {
    // Files saved by the canonical service are partitioned by verified company.
    return parts[2] === String(tenantId) && String(tenantId) === normalizeTenantId(tenantId);
  }
  const query = dependencies.query || require('../../src/infrastructure/config/database').query;
  const fileName = path.posix.basename(mediaPath).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = `(^|[/\\\\])${fileName}([?#].*)?$`;
  for (const [table, columns] of [['messages', ['media_path', 'media_url']], ['whatsapp_history_items', ['media_path']]]) {
    try {
      const result = await query(`SELECT ${columns.join(', ')} FROM ${table} WHERE company_id = $1 AND (${columns.map(column => `${column} ~ $2`).join(' OR ')}) LIMIT 200`, [String(tenantId), pattern]);
      if (result.rows.some(row => columns.some(column => matchesMediaReference(mediaPath, row[column])))) return true;
    } catch (error) {
      // Older installations may predate the history table. Other failures fail closed.
      if (!['42P01', '42703'].includes(error.code)) throw error;
    }
  }
  if (dependencies.ignoreQuickReplies) return false;
  const quickReplies = dependencies.quickReplies || (companyId => require('../quickReplyService').listQuickReplies({ companyId }));
  const replies = await quickReplies(String(tenantId));
  return replies.some(reply => String(reply.companyId || reply.company_id || '') === String(tenantId) && [reply.mediaUrl, reply.fileUrl, ...(reply.items || []).flatMap(item => [item.value, item.mediaUrl, item.fileUrl]), ...(reply.steps || []).flatMap(step => [step.value, step.mediaUrl, step.fileUrl])].some(value => matchesMediaReference(mediaPath, value)));
}

async function findMediaFile(reference) {
  const mediaPath = normalizeMediaReference(reference);
  const [, prefix, ...parts] = mediaPath.split('/');
  for (const root of MEDIA_ROOTS[prefix] || []) {
    const candidate = path.resolve(root, ...parts);
    const relative = path.relative(root, candidate);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) continue;
    try {
      const realRoot = await fsp.realpath(root);
      const realFile = await fsp.realpath(candidate);
      const realRelative = path.relative(realRoot, realFile);
      if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) continue;
      if ((await fsp.stat(realFile)).isFile()) return realFile;
    } catch { /* Continue through the legacy roots. */ }
  }
  if (s3Client && prefix === 'media' && parts.length >= 3 && !['temp', 'images', 'videos', 'audios', 'documents'].includes(parts[0])) {
    // Restore historical private S3 files to durable local storage after authorization.
    try {
      const { GetObjectCommand } = require('@aws-sdk/client-s3');
      const object = await s3Client.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: mediaPath.slice(1) }));
      const maximum = 100 * 1024 * 1024;
      if (Number(object.ContentLength || 0) > maximum) throw new Error('Media exceeds storage limit');
      const chunks = [];
      let bytes = 0;
      for await (const chunk of object.Body) { bytes += chunk.length; if (bytes > maximum) throw new Error('Media exceeds storage limit'); chunks.push(chunk); }
      const target = path.join(MEDIA_ROOT, ...parts);
      await ensureDirectory(path.dirname(target));
      await fsp.writeFile(target, Buffer.concat(chunks), { flag: 'wx' });
      return target;
    } catch { /* Missing files remain unavailable; no public fallback. */ }
  }
  return null;
}

async function sendProtectedFile(reference, req, res) {
  const absolutePath = await findMediaFile(reference);
  if (!absolutePath) return res.status(404).json({ error: 'Media file is unavailable.' });
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (/\.(html?|svg|xml|js)$/i.test(absolutePath)) res.setHeader('Content-Disposition', 'attachment');
  return res.sendFile(absolutePath, { cacheControl: false, dotfiles: 'deny' }, error => {
    if (error && !res.headersSent) res.status(error.status || 500).json({ error: 'Media delivery failed.' });
  });
}

async function deliverProtectedMedia(req, res, next) {
  // The metadata/upload API is handled by the authenticated media router.
  if (/^\/(?:api\/)?media\/(?:upload|access|[^/]+\/(?:metadata|stream))\/?$/.test(req.originalUrl.split('?', 1)[0])) return next();
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  if (!['GET', 'HEAD'].includes(req.method)) return res.sendStatus(405);
  try {
    const reference = normalizeMediaReference(req.originalUrl);
    verifyMediaAccess(req.query?.access, reference);
    return await sendProtectedFile(reference, req, res);
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'Media delivery failed.' });
  }
}

module.exports = {
  downloadFromWhatsApp,
  canAccessMedia,
  createMediaAccess,
  deliverProtectedMedia,
  findMediaFile,
  getMetadata,
  normalizeMediaReference,
  normalizeMediaType,
  normalizeTenantId,
  saveBuffer,
  streamMediaById,
  verifyMediaAccess,
};
