const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = path.join(__dirname, '..', '..', 'data', 'json_db', 'quick_replies.json');
const CATEGORY_SETTINGS_PREFIX = 'inbox_quick_reply_categories';
let writeLock = Promise.resolve();

function requireCompanyId(value) {
  const companyId = String(value || '').trim();
  if (!companyId || companyId === 'all') throw new Error('companyId da empresa é obrigatório.');
  return companyId;
}

async function ensureDataFile() {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });

  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, '[]', 'utf8');
  }
}

async function readQuickReplies(companyId = null) {
  companyId = requireCompanyId(companyId);
  await ensureDataFile();
  let fileItems = [];
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw || '[]');
    fileItems = Array.isArray(parsed) ? parsed : [];
  } catch {
    fileItems = [];
  }

  let dbItems = [];
  try {
    const { query } = require('../src/infrastructure/config/database');
    const sql = 'SELECT * FROM quick_replies WHERE company_id = $1';
    const params = [companyId];
    const res = await query(sql, params);
    
    dbItems = (res.rows || []).map((row) => {
      let parsedContent = row.content;
      let items = [];
      let steps = [];
      let favorite = false;
      let isFlow = false;
      let mediaUrl = null;
      let mediaType = null;
      let aiMemory = null;
      let filename = null;

      try {
        if (typeof row.content === 'string' && row.content.trim().startsWith('{')) {
          const obj = JSON.parse(row.content);
          parsedContent = obj.text || obj.content || row.content;
          items = obj.items || [];
          steps = obj.steps || [];
          favorite = Boolean(obj.favorite);
          isFlow = Boolean(obj.isFlow);
          mediaUrl = obj.mediaUrl || null;
          mediaType = obj.mediaType || null;
          aiMemory = obj.aiMemory || null;
          filename = obj.filename || obj.fileName || null;

          // Se mediaUrl não estiver na raiz, procura nos items
          if (!mediaUrl && Array.isArray(items)) {
            const firstMedia = items.find((i) => i.type && i.type !== 'text');
            if (firstMedia) {
              mediaUrl = firstMedia.value;
              mediaType = firstMedia.type;
              filename = firstMedia.filename || firstMedia.fileName || null;
            }
          }
        }
      } catch (_) {}

      return {
        id: row.id,
        companyId: row.company_id || 'default',
        title: row.title,
        content: parsedContent,
        items: items.length > 0 ? items : [{ type: 'text', value: parsedContent }],
        steps,
        favorite,
        isFlow,
        category: row.category,
        tags: Array.isArray(row.tags) ? row.tags : [],
        mediaUrl,
        mediaType,
        aiMemory,
        filename,
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      };
    });
  } catch (err) {
    if (process.env.NODE_ENV === 'production') throw err;
  }

  // Merge items by id
  const map = new Map();
  for (const item of fileItems) {
    if (item && item.id && String(item.companyId || 'default') === companyId) map.set(item.id, item);
  }
  for (const item of dbItems) {
    if (item && item.id) {
      const existing = map.get(item.id);
      map.set(item.id, { ...existing, ...item });
    }
  }

  const allMerged = Array.from(map.values());
  return allMerged.filter(item => String(item.companyId || 'default') === companyId);
}

async function writeQuickReplies(items, companyId, removedId = null) {
  companyId = requireCompanyId(companyId);
  await ensureDataFile();

  try {
    const { query } = require('../src/infrastructure/config/database');
    for (const item of items) {
      if (!item?.id || item.companyId !== companyId) continue;
      const contentPayload = JSON.stringify({
        text: item.content || '',
        items: item.items || [],
        steps: item.steps || [],
        mediaUrl: item.mediaUrl || null,
        mediaType: item.mediaType || null,
        aiMemory: item.aiMemory || null,
        filename: item.filename || null,
        favorite: Boolean(item.favorite),
        isFlow: Boolean(item.isFlow),
      });

      const saved = await query(
        `INSERT INTO quick_replies (id, company_id, title, content, category, tags, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           content = EXCLUDED.content,
           category = EXCLUDED.category,
           tags = EXCLUDED.tags,
           updated_at = NOW()
         WHERE quick_replies.company_id = EXCLUDED.company_id
         RETURNING id`,
        [
          item.id,
          item.companyId || 'default',
          item.title,
          contentPayload,
          item.category || 'general',
          item.tags || [],
        ]
      );
      if (!saved.rows?.length) throw Object.assign(new Error('Resposta rápida pertence a outra empresa.'), { status: 403 });
    }
    if (removedId) await query('DELETE FROM quick_replies WHERE id = $1 AND company_id = $2', [removedId, companyId]);
  } catch (dbErr) {
    if (process.env.NODE_ENV === 'production' || /outra empresa/.test(dbErr.message)) throw dbErr;
    console.warn('[QuickReplyService] Database unavailable; preserving tenant file storage.');
  }
  const existing = JSON.parse(await fs.readFile(DATA_FILE, 'utf8') || '[]');
  const others = Array.isArray(existing) ? existing.filter(item => String(item?.companyId || 'default') !== companyId) : [];
  const next = [...others, ...items.filter(item => String(item.companyId || 'default') === companyId)];
  const temporary = `${DATA_FILE}.${process.pid}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(next, null, 2), 'utf8');
  await fs.rename(temporary, DATA_FILE);
}

function serializeWrite(work) {
  const next = writeLock.then(work, work);
  writeLock = next.catch(() => {});
  return next;
}

function normalizeCategory(value) {
  return String(value || 'general').trim().toLowerCase();
}

function categorySettingsKey(companyId) {
  return `${CATEGORY_SETTINGS_PREFIX}:${requireCompanyId(companyId)}`;
}

async function getQuickReplyCategories(companyId) {
  const key = categorySettingsKey(companyId);
  const { query } = require('../src/infrastructure/config/database');
  const result = await query('SELECT value FROM system_settings WHERE key = $1 LIMIT 1', [key]);
  const value = result.rows?.[0]?.value;
  if (!value) return {};
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function saveQuickReplyCategory(companyId, name, metadata = {}) {
  const key = categorySettingsKey(companyId);
  const category = normalizeCategory(name);
  if (!category || category.length > 200) throw Object.assign(new Error('Nome de categoria inválido.'), { status: 400 });
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw Object.assign(new Error('A aparência da categoria é inválida.'), { status: 400 });
  const emoji = String(metadata.emoji || '📁').trim();
  const color = String(metadata.color || '');
  if (emoji.length > 8 || !/^#[0-9a-f]{6}$/i.test(color)) throw Object.assign(new Error('A aparência da categoria é inválida.'), { status: 400 });
  const patch = JSON.stringify({ [category]: { emoji: emoji || '📁', color } });
  const { query } = require('../src/infrastructure/config/database');
  const result = await query(`INSERT INTO system_settings (key, value, updated_at)
    VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE
    SET value = (COALESCE(NULLIF(system_settings.value, '')::jsonb, '{}'::jsonb) || EXCLUDED.value::jsonb)::text,
        updated_at = NOW()
    WHERE system_settings.value IS NULL
       OR system_settings.value = ''
       OR COALESCE(NULLIF(system_settings.value, '')::jsonb, '{}'::jsonb) ? $3
       OR (SELECT COUNT(*) FROM jsonb_object_keys(COALESCE(NULLIF(system_settings.value, '')::jsonb, '{}'::jsonb))) < 200
    RETURNING value`, [key, patch, category]);
  if (!result.rows?.length) throw Object.assign(new Error('Limite de 200 categorias atingido.'), { status: 400 });
  const value = result.rows[0].value;
  return typeof value === 'string' ? JSON.parse(value) : value;
}

const { analyzeImageWithVision } = require('../src/infrastructure/config/ai');

async function processBase64Items(items, visionMemories = [], companyId) {
  if (!Array.isArray(items)) return [];

  const processed = [];
  const companyFolder = crypto.createHash('sha256').update(requireCompanyId(companyId)).digest('hex').slice(0, 24);
  const uploadDir = path.join(__dirname, '..', 'upload', 'quick-replies', companyFolder);
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
          ...item,
          type,
          value: `/upload/quick-replies/${companyFolder}/${savedFileName}`,
          filename: filename || savedFileName,
        });
        continue;
      }
    }

    processed.push(item);
  }

  return processed;
}

async function processBase64Steps(steps, visionMemories = [], companyId) {
  if (!Array.isArray(steps)) return [];

  const processed = [];
  const companyFolder = crypto.createHash('sha256').update(requireCompanyId(companyId)).digest('hex').slice(0, 24);
  const uploadDir = path.join(__dirname, '..', 'upload', 'quick-replies', companyFolder);
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
          value: `/upload/quick-replies/${companyFolder}/${savedFileName}`,
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
    mediaUrl: payload.mediaUrl ? String(payload.mediaUrl).trim() : undefined,
    mediaType: payload.mediaType ? String(payload.mediaType).trim().toLowerCase() : undefined,
    filename: payload.filename ? String(payload.filename).trim() : undefined,
    companyId: requireCompanyId(payload.companyId),
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
    throw Object.assign(new Error('Informe o título da resposta rápida.'), { status: 400 });
  }

  const hasContent = String(payload.content || '').trim();
  const hasItems = Array.isArray(payload.items) && payload.items.length > 0;
  const hasSteps = Array.isArray(payload.steps) && payload.steps.length > 0;
  if (!hasContent && !hasItems && !hasSteps) {
    throw Object.assign(new Error('Inclua um texto, arquivo ou etapa na resposta rápida.'), { status: 400 });
  }
}

async function listQuickReplies(filters = {}) {
  const all = await readQuickReplies(filters.companyId);
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

async function assertOwnedMedia(payload, companyId) {
  const media = require('./enterprise/media-service');
  const tenantFolder = crypto.createHash('sha256').update(companyId).digest('hex').slice(0, 24);
  const refs = [payload.mediaUrl, payload.fileUrl, ...(payload.items || []).filter(item => item.type !== 'text').map(item => item.value), ...(payload.steps || []).filter(item => item.type !== 'text').map(item => item.value)].filter(Boolean);
  for (const reference of refs) {
    const normalized = media.normalizeMediaReference(reference);
    const ownUpload = normalized.startsWith('/upload/quick-replies/' + tenantFolder + '/');
    if (!ownUpload && !await media.canAccessMedia(normalized, companyId, { ignoreQuickReplies: true })) throw Object.assign(new Error('Arquivo não pertence à empresa autenticada.'), { status: 403 });
    if (!await media.findMediaFile(normalized)) throw Object.assign(new Error('Arquivo não encontrado. Envie o arquivo antes de salvar a resposta.'), { status: 404 });
  }
}

async function createQuickReply(payload = {}) {
  const companyId = requireCompanyId(payload.companyId);
  return serializeWrite(async () => {
  const visionMemories = [];
  if (payload.items) {
    payload.items = await processBase64Items(payload.items, visionMemories, companyId);
  }
  if (payload.steps) {
    payload.steps = await processBase64Steps(payload.steps, visionMemories, companyId);
  }
  if (visionMemories.length > 0) {
    payload.aiMemory = visionMemories.join('\n\n');
  }
  assertPayload(payload);
  await assertOwnedMedia(payload, companyId);
  const all = await readQuickReplies(companyId);
  const next = normalizeQuickReply(payload);
  if (all.some(item => item.id === next.id)) throw Object.assign(new Error('Resposta rápida já cadastrada.'), { status: 409 });
  all.unshift(next);
  await writeQuickReplies(all, companyId);
  return next;
  });
}

async function updateQuickReply(id, payload = {}, companyId) {
  companyId = requireCompanyId(companyId);
  return serializeWrite(async () => {
  const all = await readQuickReplies(companyId);
  const index = all.findIndex((item) => item.id === id);

  if (index < 0) {
    return null;
  }

  const visionMemories = [];
  if (payload.items) {
    payload.items = await processBase64Items(payload.items, visionMemories, companyId);
  }
  if (payload.steps) {
    payload.steps = await processBase64Steps(payload.steps, visionMemories, companyId);
  }
  if (visionMemories.length > 0) {
    payload.aiMemory = visionMemories.join('\n\n');
  }

  const merged = {
    ...all[index],
    ...payload,
    id,
    companyId,
    createdAt: all[index].createdAt,
  };

  assertPayload(merged);
  await assertOwnedMedia(merged, companyId);
  all[index] = normalizeQuickReply(merged);
  await writeQuickReplies(all, companyId);
  return all[index];
  });
}

async function removeQuickReply(id, companyId) {
  companyId = requireCompanyId(companyId);
  return serializeWrite(async () => {
  const all = await readQuickReplies(companyId);
  const next = all.filter((item) => item.id !== id);

  if (next.length === all.length) {
    return false;
  }

  await writeQuickReplies(next, companyId, id);
  return true;
  });
}

module.exports = {
  createQuickReply,
  saveQuickReply: createQuickReply,
  listQuickReplies,
  removeQuickReply,
  updateQuickReply,
  getQuickReplyCategories,
  saveQuickReplyCategory,
};
