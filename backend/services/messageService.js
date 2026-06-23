const fsp = require('fs/promises');
const path = require('path');
const conversationRepository = require('../repositories/conversationRepository');
const messageRepository = require('../repositories/messageRepository');
const whatsappService = require('./whatsappService');
const MessageAuditService = require('./messageAuditService');

const PROJECT_ROOT = path.join(__dirname, '..');
const UPLOADS_DIRECTORY = path.join(PROJECT_ROOT, 'uploads');
const UPLOAD_DIRECTORY = path.join(PROJECT_ROOT, 'upload');
const MEDIA_TEMP_DIRECTORY = path.resolve(PROJECT_ROOT, '..', 'storage', 'media', 'temp');

function toIsoTimestamp(value) {
  if (!value) {
    return new Date().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const str = String(value).trim();
  if (/^\d+$/.test(str)) {
    const num = Number(str);
    if (num > 1e9 && num < 9e9) {
      return new Date(num * 1000).toISOString();
    }
    if (num >= 1e12 && num < 9e12) {
      return new Date(num).toISOString();
    }
  }

  const parsed = Date.parse(str);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString();
  }

  return new Date().toISOString();
}

function inferIncomingType({ mediaType, text }) {
  if (mediaType) {
    return mediaType;
  }

  if (String(text || '').trim()) {
    return 'text';
  }

  return 'text';
}

async function ensureUploadDirectories() {
  await fsp.mkdir(UPLOADS_DIRECTORY, { recursive: true });
  await fsp.mkdir(UPLOAD_DIRECTORY, { recursive: true });
  await fsp.mkdir(MEDIA_TEMP_DIRECTORY, { recursive: true });
}

function isLikelyRemoteOrDataPath(value = '') {
  const normalized = String(value || '').trim();

  if (!normalized) {
    return false;
  }

  return (
    normalized.startsWith('data:') ||
    /^(https?:)?\/\//i.test(normalized) ||
    normalized.startsWith('/media/')
  );
}

function decodeSafe(value = '') {
  try {
    return decodeURIComponent(String(value || ''));
  } catch {
    return String(value || '');
  }
}

function extractUploadTokenPath(value = '') {
  const normalized = decodeSafe(String(value || '').trim())
    .replace(/^['"]+|['"]+$/g, '')
    .trim();

  if (!normalized) {
    return '';
  }

  if (/^uploads?:/i.test(normalized)) {
    return normalized.replace(/^uploads?:/i, '').replace(/^[/\\]+/, '');
  }

  if (/^uploads?[/\\]/i.test(normalized)) {
    return normalized.replace(/^uploads?[/\\]/i, '').replace(/^[/\\]+/, '');
  }

  return normalized;
}

function toSystemPathFromPublicPath(value = '') {
  const normalized = decodeSafe(String(value || '').trim())
    .replace(/^['"]+|['"]+$/g, '')
    .trim();

  if (!normalized) {
    return '';
  }

  if (normalized.startsWith('/uploads/')) {
    return path.join(UPLOADS_DIRECTORY, normalized.replace(/^\/uploads\//, ''));
  }

  if (normalized.startsWith('/upload/')) {
    return path.join(UPLOAD_DIRECTORY, normalized.replace(/^\/upload\//, ''));
  }

  if (normalized.startsWith('/media/')) {
    return path.resolve(PROJECT_ROOT, '..', 'storage', 'media', normalized.replace(/^\/media\//, ''));
  }

  return normalized;
}

async function pathExists(targetPath) {
  try {
    await fsp.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Allow-list of absolute roots that media paths may reference on disk.
 * Any absolute path pointing outside these roots is rejected to prevent
 * arbitrary Local File Inclusion via the `mediaPath` body field.
 */
const ALLOWED_MEDIA_ROOTS = [
  UPLOADS_DIRECTORY,
  UPLOAD_DIRECTORY,
  path.join(PROJECT_ROOT, 'media'),
  path.resolve(PROJECT_ROOT, '..', 'storage', 'media'),
];

function isPathInsideRoot(absolutePath, rootPath) {
  if (!absolutePath || !rootPath) return false;
  const normalizedAbs = path.resolve(absolutePath);
  const normalizedRoot = path.resolve(rootPath);
  const rel = path.relative(normalizedRoot, normalizedAbs);
  return Boolean(rel) && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function isWithinAllowedMediaRoot(absolutePath) {
  return ALLOWED_MEDIA_ROOTS.some((root) => isPathInsideRoot(absolutePath, root));
}

function assertMediaPathWithinAllowedRoots(resolvedPath) {
  const value = String(resolvedPath || '').trim();

  if (!value) {
    return;
  }

  if (isLikelyRemoteOrDataPath(value)) {
    return;
  }

  if (!path.isAbsolute(value)) {
    // Relative paths will be resolved later against allowed roots.
    return;
  }

  if (isWithinAllowedMediaRoot(value)) {
    return;
  }

  const allowUnsafe =
    String(process.env.NODE_ENV || 'development').toLowerCase() !== 'production' &&
    String(process.env.ALLOW_UNSAFE_MEDIA_PATHS || '').toLowerCase() === 'true';

  if (allowUnsafe) {
    console.warn(
      `[MEDIA] Unsafe absolute mediaPath allowed via ALLOW_UNSAFE_MEDIA_PATHS: ${value}`
    );
    return;
  }

  const error = new Error('Media path is not allowed.');
  error.code = 'MEDIA_PATH_FORBIDDEN';
  throw error;
}

async function resolveOutboundMediaPath(inputPath = '') {
  const original = decodeSafe(String(inputPath || '').trim());
  const normalized = toSystemPathFromPublicPath(extractUploadTokenPath(original));

  if (!normalized || isLikelyRemoteOrDataPath(normalized)) {
    return normalized;
  }

  if (path.isAbsolute(normalized)) {
    return normalized;
  }

  const candidates = [
    path.resolve(PROJECT_ROOT, normalized),
    path.resolve(PROJECT_ROOT, 'upload', normalized),
    path.resolve(PROJECT_ROOT, 'uploads', normalized),
    path.resolve(PROJECT_ROOT, 'media', normalized),
    path.resolve(PROJECT_ROOT, '..', 'storage', 'media', normalized),
    path.resolve(PROJECT_ROOT, 'upload', path.basename(normalized)),
    path.resolve(PROJECT_ROOT, 'uploads', path.basename(normalized)),
    path.resolve(PROJECT_ROOT, 'media', path.basename(normalized)),
    path.resolve(PROJECT_ROOT, '..', 'storage', 'media', path.basename(normalized)),
  ];

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  // If caller used upload token/public uploads path, normalize to uploads absolute path for consistent errors.
  if (/^uploads?:/i.test(original) || /^\/?uploads?[/\\]/i.test(original)) {
    return path.resolve(UPLOADS_DIRECTORY, path.basename(normalized || original));
  }

  return normalized;
}

async function assertLocalMediaPathExists(inputPath = '') {
  const original = decodeSafe(String(inputPath || '').trim());

  // Reject absolute paths outside allow-listed roots BEFORE touching the FS.
  assertMediaPathWithinAllowedRoots(original);

  const resolved = await resolveOutboundMediaPath(inputPath);
  const normalized = String(resolved || '').trim();

  if (!normalized) {
    return resolved;
  }

  if (isLikelyRemoteOrDataPath(normalized)) {
    return resolved;
  }

  // Re-check the resolved absolute path to close any path-traversal window
  // introduced by resolveOutboundMediaPath candidate matching.
  assertMediaPathWithinAllowedRoots(normalized);

  const enforceExists =
    /^uploads?:/i.test(original) ||
    /^\/?uploads?[/\\]/i.test(original) ||
    normalized.startsWith(UPLOADS_DIRECTORY);

  if (!enforceExists) {
    return resolved;
  }

  const exists = await pathExists(normalized);
  if (!exists) {
    const error = new Error(`Media file not found: ${normalized}`);
    error.code = 'MEDIA_FILE_NOT_FOUND';
    throw error;
  }

  return resolved;
}

function toPublicMediaPath(resolvedPath = '') {
  const rawValue = decodeSafe(String(resolvedPath || '').trim());
  const extractedUploadTokenPath = extractUploadTokenPath(rawValue);

  if (/^uploads:/i.test(rawValue) || /^\/?uploads[/\\]/i.test(rawValue)) {
    return `/uploads/${path.basename(extractedUploadTokenPath)}`;
  }
  if (/^upload:/i.test(rawValue) || /^\/?upload[/\\]/i.test(rawValue)) {
    return `/upload/${path.basename(extractedUploadTokenPath)}`;
  }

  const normalized = toSystemPathFromPublicPath(extractedUploadTokenPath);

  if (!normalized || isLikelyRemoteOrDataPath(normalized)) {
    return normalized;
  }

  // Windows drive letter and slash normalization
  let cleanPath = normalized.replace(/\\/g, '/');
  if (/^[a-zA-Z]:/i.test(cleanPath)) {
    cleanPath = cleanPath.replace(/^[a-zA-Z]:/i, '');
  }
  const lowerClean = cleanPath.toLowerCase();

  if (lowerClean.startsWith('/uploads/') || lowerClean.startsWith('uploads/')) {
    return `/uploads/${path.basename(cleanPath)}`;
  }
  if (lowerClean.startsWith('/upload/') || lowerClean.startsWith('upload/')) {
    return `/upload/${path.basename(cleanPath)}`;
  }
  if (lowerClean.startsWith('/media/') || lowerClean.startsWith('media/')) {
    return lowerClean.startsWith('/') ? cleanPath : '/' + cleanPath;
  }

  const lowerNormalized = normalized.toLowerCase().replace(/\\/g, '/');
  const lowerUploadsPrefix = UPLOADS_DIRECTORY.toLowerCase().replace(/\\/g, '/') + '/';
  const lowerUploadPrefix = UPLOAD_DIRECTORY.toLowerCase().replace(/\\/g, '/') + '/';
  const lowerMediaPrefix = path.join(PROJECT_ROOT, 'media').toLowerCase().replace(/\\/g, '/') + '/';
  const lowerStorageMediaPrefix = path.resolve(PROJECT_ROOT, '..', 'storage', 'media').toLowerCase().replace(/\\/g, '/') + '/';

  if (lowerNormalized.startsWith(lowerUploadsPrefix)) {
    return `/uploads/${path.basename(normalized)}`;
  }
  if (lowerNormalized.startsWith(lowerUploadPrefix)) {
    return `/upload/${path.basename(normalized)}`;
  }

  if (lowerNormalized.startsWith(lowerMediaPrefix)) {
    const relative = normalized.replace(/\\/g, '/').slice(lowerMediaPrefix.length);
    return `/media/${relative}`;
  }

  if (lowerNormalized.startsWith(lowerStorageMediaPrefix)) {
    const relative = normalized.replace(/\\/g, '/').slice(lowerStorageMediaPrefix.length);
    return `/media/${relative}`;
  }

  return normalized ? String(normalized).replace(/\\/g, '/') : normalized;
}

function safeSocketEmit(ioLike, eventName, payload, aliases = []) {
  const io = ioLike || global.io;

  if (!io) {
    return;
  }

  try {
    io.emit(eventName, payload);

    for (const alias of aliases) {
      io.emit(alias, payload);
    }
  } catch (error) {
    console.error(`[SOCKET] Failed to emit ${eventName}:`, error.message || error);
  }
}

async function persistIncomingMessage(payload = {}) {
  const phone = whatsappService.normalizePhone(payload.phone || '');
  const companyId = payload.companyId || process.env.DEFAULT_COMPANY_ID || 'default';
  const sessionId = payload.sessionId || 'main';

  // Log conversation upsert key details
  const rawJid = payload.phone || '';
  const rawLid = rawJid.includes('@lid') ? rawJid : '';
  console.log(`[CONVERSATION-UPSERT-KEY] INBOUND Message - Raw JID: "${rawJid}", Raw LID: "${rawLid}", Normalized Canonical Phone Key: "${phone}"`);

  // If number is a raw unresolved LID, queue it instead of creating thread
  const { isRawLid } = require('./whatsapp/shared/identifiers');
  if (isRawLid(phone)) {
    const lidMapper = require('./whatsapp/shared/lidMapper');
    await lidMapper.savePendingMessage(phone, companyId, sessionId, payload);
    console.log(`[LID-RECONCILE] Message from unresolved LID ${phone} saved to pending queue.`);
    return {
      conversation: null,
      message: null,
      queued: true,
      isNewConversation: false,
    };
  }

  const normalizedTimestamp = toIsoTimestamp(payload.timestamp);
  const normalizedMediaPath = toPublicMediaPath(payload.mediaPath || null);
  const messageType = inferIncomingType({
    mediaType: payload.mediaType,
    text: payload.text,
  });
  const preview = typeof payload.text === 'string' && payload.text !== ''
    ? payload.text
    : `[${messageType}]`;

  if (!phone) {
    throw new Error('Incoming message missing phone.');
  }

  let conversation = null;
  if (payload.conversationId) {
    conversation = await conversationRepository.getConversationById(payload.conversationId).catch(() => null);
  }
  if (!conversation) {
    conversation = await conversationRepository.findOrCreateConversationByPhone({
      companyId,
      contactName: payload.name || phone,
      lastMessage: preview,
      lastMessageType: messageType,
      phone,
      sessionId,
    });
  }

  const savedMessage = await messageRepository.create({
    companyId,
    content: preview,
    conversationId: conversation.id,
    createdAt: normalizedTimestamp,
    direction: 'incoming',
    fileName: payload.fileName || null,
    fromMe: false,
    mediaPath: normalizedMediaPath,
    mimeType: payload.mimeType || null,
    messageType,
    phone,
    sessionId,
    size: payload.size || null,
    status: payload.status || 'received',
    timestamp: normalizedTimestamp,
  });

  // Log STORED_DATABASE step
  try {
    await MessageAuditService.logStep({
      messageId: savedMessage?.id || null,
      conversationId: conversation?.id || null,
      phone: phone,
      step: 'STORED_DATABASE',
      status: 'success',
      details: {
        messageType,
        mediaPath: normalizedMediaPath,
      }
    });
  } catch (err) {
    console.error('[MESSAGE AUDIT] Failed to log STORED_DATABASE:', err);
  }

  const unreadCount = (Number(conversation.unreadCount) || 0) + 1;
  let updatedConversation = null;

  if (typeof conversationRepository.updateConversationState === 'function') {
    updatedConversation = await conversationRepository.updateConversationState(conversation.id, {
      lastMessage: preview,
      lastMessageType: messageType,
      session_id: sessionId,
      unreadCount,
      updatedAt: normalizedTimestamp,
    });
  } else if (typeof conversationRepository.updateConversationAfterMessage === 'function') {
    updatedConversation = await conversationRepository.updateConversationAfterMessage(
      conversation.id,
      preview,
      messageType
    );
  }

  // Log CONVERSATION_UPDATED step
  try {
    await MessageAuditService.logStep({
      messageId: savedMessage?.id || null,
      conversationId: conversation?.id || null,
      phone: phone,
      step: 'CONVERSATION_UPDATED',
      status: 'success',
      details: {
        unreadCount,
        lastMessage: preview
      }
    });
  } catch (err) {
    console.error('[MESSAGE AUDIT] Failed to log CONVERSATION_UPDATED:', err);
  }

  return {
    conversation: updatedConversation || {
      ...conversation,
      lastMessage: preview,
      lastMessageType: messageType,
      unreadCount,
      updatedAt: normalizedTimestamp,
    },
    isNewConversation: !conversation.lastMessage,
    message: {
      ...savedMessage,
      direction: 'incoming',
      fileName: payload.fileName || savedMessage?.fileName || null,
      mimeType: payload.mimeType || savedMessage?.mimeType || null,
      size: payload.size || savedMessage?.size || null,
      status: savedMessage?.status || 'received',
      timestamp: savedMessage?.timestamp || normalizedTimestamp,
      type: savedMessage?.type || messageType,
    },
  };
}

module.exports = {
  ALLOWED_MEDIA_ROOTS,
  assertLocalMediaPathExists,
  assertMediaPathWithinAllowedRoots,
  ensureUploadDirectories,
  isWithinAllowedMediaRoot,
  MEDIA_TEMP_DIRECTORY,
  persistIncomingMessage,
  resolveOutboundMediaPath,
  safeSocketEmit,
  toPublicMediaPath,
  UPLOAD_DIRECTORY,
  UPLOADS_DIRECTORY,
};
