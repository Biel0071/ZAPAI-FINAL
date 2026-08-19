const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = path.join(__dirname, '..', 'data', 'quick_replies.json');

async function ensureDataFile() {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });

  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, '[]', 'utf8');
  }
}

async function readQuickReplies() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, 'utf8');

  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQuickReplies(items) {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(items, null, 2), 'utf8');
}

function normalizeCategory(value) {
  return String(value || 'general').trim().toLowerCase();
}

const { analyzeImageWithVision } = require('../src/infrastructure/config/ai');

async function processBase64Items(items, visionMemories = []) {
  if (!Array.isArray(items)) return [];

  const processed = [];
  const uploadDir = path.join(__dirname, '..', 'upload', 'quick-replies');
  await fs.mkdir(uploadDir, { recursive: true });

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;

    const { type, value, filename } = item;

    // Check if value is base64 string
    if (type !== 'text' && typeof value === 'string' && value.startsWith('data:')) {
      const match = value.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const mimeType = match[1];
        const base64Data = match[2];
        const buffer = Buffer.from(base64Data, 'base64');

        if (mimeType.startsWith('image/') && typeof analyzeImageWithVision === 'function') {
           const analysis = await analyzeImageWithVision(base64Data, mimeType).catch(() => null);
           if (analysis) {
             visionMemories.push(`[Análise da imagem ${filename || 'mídia'}]: ${analysis}`);
           }
        }

        // Map mime type to extension
        const mimeMap = {
          'image/png': 'png',
          'image/jpeg': 'jpg',
          'image/gif': 'gif',
          'image/webp': 'webp',
          'video/mp4': 'mp4',
          'audio/mpeg': 'mp3',
          'audio/mp3': 'mp3',
          'audio/ogg': 'ogg',
          'audio/wav': 'wav',
          'audio/webm': 'webm',
          'audio/opus': 'opus',
          'application/pdf': 'pdf',
        };
        const ext = mimeMap[mimeType] || mimeType.split('/')[1] || 'bin';
        const uuid = crypto.randomUUID();
        const baseName = filename ? path.parse(filename).name.replace(/[^a-zA-Z0-9_-]/g, '') : 'media';
        const savedFileName = `${baseName}_${uuid}.${ext}`;
        const filePath = path.join(uploadDir, savedFileName);

        await fs.writeFile(filePath, buffer);

        processed.push({
          type,
          value: `/upload/quick-replies/${savedFileName}`,
          filename: filename || savedFileName,
        });
        continue;
      }
    }

    processed.push({ type, value, filename });
  }

  return processed;
}

async function processBase64Steps(steps, visionMemories = []) {
  if (!Array.isArray(steps)) return [];

  const processed = [];
  const uploadDir = path.join(__dirname, '..', 'upload', 'quick-replies');
  await fs.mkdir(uploadDir, { recursive: true });

  for (const step of steps) {
    if (!step || typeof step !== 'object') continue;

    const { type, value, filename } = step;

    if (type !== 'text' && typeof value === 'string' && value.startsWith('data:')) {
      const match = value.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const mimeType = match[1];
        const base64Data = match[2];
        const buffer = Buffer.from(base64Data, 'base64');

        if (mimeType.startsWith('image/') && typeof analyzeImageWithVision === 'function') {
           const analysis = await analyzeImageWithVision(base64Data, mimeType).catch(() => null);
           if (analysis) {
             visionMemories.push(`[Análise da imagem ${filename || 'mídia'}]: ${analysis}`);
           }
        }

        const mimeMap = {
          'image/png': 'png',
          'image/jpeg': 'jpg',
          'image/gif': 'gif',
          'image/webp': 'webp',
          'video/mp4': 'mp4',
          'audio/mpeg': 'mp3',
          'audio/mp3': 'mp3',
          'audio/ogg': 'ogg',
          'audio/wav': 'wav',
          'audio/webm': 'webm',
          'audio/opus': 'opus',
          'application/pdf': 'pdf',
        };
        const ext = mimeMap[mimeType] || mimeType.split('/')[1] || 'bin';
        const uuid = crypto.randomUUID();
        const baseName = filename ? path.parse(filename).name.replace(/[^a-zA-Z0-9_-]/g, '') : 'media';
        const savedFileName = `${baseName}_${uuid}.${ext}`;
        const filePath = path.join(uploadDir, savedFileName);

        await fs.writeFile(filePath, buffer);

        processed.push({
          ...step,
          value: `/upload/quick-replies/${savedFileName}`,
          filename: filename || savedFileName,
        });
        continue;
      }
    }

    processed.push(step);
  }

  return processed;
}

function normalizeQuickReply(payload = {}) {
  let items = [];
  if (Array.isArray(payload.items)) {
    items = payload.items.map((item) => ({
      type: String(item.type || 'text').trim().toLowerCase(),
      value: String(item.value || '').trim(),
      filename: item.filename ? String(item.filename).trim() : undefined,
      delayMs: item.delayMs !== undefined ? Number(item.delayMs) : 0,
      typingMs: item.typingMs !== undefined ? Number(item.typingMs) : 1500,
      caption: item.caption ? String(item.caption).trim() : undefined,
    }));
  } else {
    items = [{
      type: 'text',
      value: String(payload.content || '').trim(),
      delayMs: 0,
      typingMs: 1500,
    }];
  }

  return {
    id: String(payload.id || `qr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`).trim(),
    title: String(payload.title || '').trim(),
    content: items.filter(i => i.type === 'text').map(i => i.value).join('\n') || String(payload.content || '').trim(),
    items,
    category: normalizeCategory(payload.category),
    tags: Array.isArray(payload.tags) ? payload.tags.map((item) => String(item || '').trim()).filter(Boolean) : [],
    favorite: Boolean(payload.favorite),
    isFlow: Boolean(payload.isFlow),
    aiMemory: payload.aiMemory ? String(payload.aiMemory).trim() : undefined,
    steps: Array.isArray(payload.steps) ? payload.steps.map((step) => ({
      id: step.id || `step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: String(step.type || 'text').trim().toLowerCase(),
      value: String(step.value || '').trim(),
      filename: step.filename ? String(step.filename).trim() : undefined,
      delayMs: Number(step.delayMs || 0),
      typingMs: step.typingMs !== undefined ? Number(step.typingMs) : 1500,
      caption: step.caption ? String(step.caption).trim() : undefined,
      actions: step.actions ? {
        addTags: Array.isArray(step.actions.addTags) ? step.actions.addTags.map(t => String(t || '').trim()).filter(Boolean) : undefined,
        archiveContact: step.actions.archiveContact !== undefined ? Boolean(step.actions.archiveContact) : undefined
      } : undefined
    })) : [],
    updatedAt: new Date().toISOString(),
    createdAt: payload.createdAt || new Date().toISOString(),
  };
}

function assertPayload(payload = {}) {
  if (!String(payload.title || '').trim()) {
    throw new Error('title is required.');
  }

  const hasContent = String(payload.content || '').trim();
  const hasItems = Array.isArray(payload.items) && payload.items.length > 0;
  const hasSteps = Array.isArray(payload.steps) && payload.steps.length > 0;
  if (!hasContent && !hasItems && !hasSteps) {
    throw new Error('content, items or steps is required.');
  }
}

async function listQuickReplies(filters = {}) {
  const all = await readQuickReplies();
  const category = filters.category ? normalizeCategory(filters.category) : null;
  const term = String(filters.search || '').trim().toLowerCase();

  return all
    .filter((item) => (category ? item.category === category : true))
    .filter((item) => {
      if (!term) {
        return true;
      }

      const haystack = [item.title, item.content, item.category, ...(item.tags || [])].join(' ').toLowerCase();
      return haystack.includes(term);
    })
    .sort((a, b) => {
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;
      return String(b.updatedAt).localeCompare(String(a.updatedAt));
    });
}

async function createQuickReply(payload = {}) {
  const visionMemories = [];
  if (payload.items) {
    payload.items = await processBase64Items(payload.items, visionMemories);
  }
  if (payload.steps) {
    payload.steps = await processBase64Steps(payload.steps, visionMemories);
  }
  if (visionMemories.length > 0) {
    payload.aiMemory = visionMemories.join('\n\n');
  }
  assertPayload(payload);
  const all = await readQuickReplies();
  const next = normalizeQuickReply(payload);
  all.unshift(next);
  await writeQuickReplies(all);
  return next;
}

async function updateQuickReply(id, payload = {}) {
  const all = await readQuickReplies();
  const index = all.findIndex((item) => item.id === id);

  if (index < 0) {
    return null;
  }

  const visionMemories = [];
  if (payload.items) {
    payload.items = await processBase64Items(payload.items, visionMemories);
  }
  if (payload.steps) {
    payload.steps = await processBase64Steps(payload.steps, visionMemories);
  }
  if (visionMemories.length > 0) {
    payload.aiMemory = visionMemories.join('\n\n');
  }

  const merged = {
    ...all[index],
    ...payload,
    id,
    createdAt: all[index].createdAt,
  };

  assertPayload(merged);
  all[index] = normalizeQuickReply(merged);
  await writeQuickReplies(all);
  return all[index];
}

async function removeQuickReply(id) {
  const all = await readQuickReplies();
  const next = all.filter((item) => item.id !== id);

  if (next.length === all.length) {
    return false;
  }

  await writeQuickReplies(next);
  return true;
}

module.exports = {
  createQuickReply,
  listQuickReplies,
  removeQuickReply,
  updateQuickReply,
};
