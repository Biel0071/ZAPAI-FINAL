const fs = require('fs/promises');
const path = require('path');

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

function normalizeQuickReply(payload = {}) {
  return {
    id: String(payload.id || `qr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`).trim(),
    title: String(payload.title || '').trim(),
    content: String(payload.content || '').trim(),
    category: normalizeCategory(payload.category),
    tags: Array.isArray(payload.tags) ? payload.tags.map((item) => String(item || '').trim()).filter(Boolean) : [],
    updatedAt: new Date().toISOString(),
    createdAt: payload.createdAt || new Date().toISOString(),
  };
}

function assertPayload(payload = {}) {
  if (!String(payload.title || '').trim()) {
    throw new Error('title is required.');
  }

  if (!String(payload.content || '').trim()) {
    throw new Error('content is required.');
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
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

async function createQuickReply(payload = {}) {
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
