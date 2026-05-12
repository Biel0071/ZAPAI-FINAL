/**
 * Contacts Engine — Incremental sync, dedup, and PostgreSQL persistence.
 *
 * Responsibilities:
 * - Parse Baileys contacts into canonical format
 * - Incremental sync (only update changed contacts)
 * - Avatar URL resolution
 * - Group detection
 * - PostgreSQL persistence via contactRepository
 * - Local cache (in-memory Map for fast lookup)
 * - WebSocket emission for frontend hydration
 */

const db = require('../config/database');

const DEFAULT_COMPANY_ID = String(process.env.DEFAULT_COMPANY_ID || 'default').trim();

// ─── In-Memory Cache ───
const contactCache = new Map(); // phone → ContactEntry

/**
 * @typedef {Object} ContactEntry
 * @property {string} phone
 * @property {string} name
 * @property {string|null} avatar
 * @property {boolean} isGroup
 * @property {string} companyId
 * @property {string} sessionId
 * @property {string} updatedAt
 */

function normalizePhone(rawPhone) {
  return String(rawPhone || '')
    .trim()
    .replace(/@s\.whatsapp\.net$/i, '')
    .replace(/@g\.us$/i, rawPhone || '') // keep group JIDs intact
    .replace(/\s+/g, '');
}

function isGroupJid(jid) {
  return String(jid || '').toLowerCase().includes('@g.us');
}

function buildContactEntry(raw = {}, sessionId = 'default', companyId = DEFAULT_COMPANY_ID) {
  const phone = normalizePhone(raw.id || raw.jid || raw.phone || raw.remoteJid || '');
  const name = String(raw.name || raw.notify || raw.pushName || raw.verifiedName || raw.contactName || phone || 'Contato').trim();

  return {
    phone,
    name: name || phone,
    avatar: raw.imgUrl || raw.profilePicUrl || raw.avatar || null,
    isGroup: isGroupJid(raw.id || raw.jid || raw.phone || ''),
    companyId,
    sessionId,
    updatedAt: new Date().toISOString(),
  };
}

// ─── Cache Operations ───

function getCachedContact(phone) {
  return contactCache.get(normalizePhone(phone)) || null;
}

function getCacheSize() {
  return contactCache.size;
}

function listCachedContacts(options = {}) {
  const all = Array.from(contactCache.values());
  if (options.companyId) {
    return all.filter((c) => c.companyId === options.companyId);
  }
  if (options.sessionId) {
    return all.filter((c) => c.sessionId === options.sessionId);
  }
  return all;
}

function clearCache() {
  contactCache.clear();
}

// ─── Incremental Sync ───

function syncContacts(baileysContacts = {}, sessionId = 'default', companyId = DEFAULT_COMPANY_ID) {
  const entries = typeof baileysContacts === 'object' && !Array.isArray(baileysContacts)
    ? Object.values(baileysContacts)
    : Array.isArray(baileysContacts) ? baileysContacts : [];

  let created = 0;
  let updated = 0;
  let unchanged = 0;

  const results = [];

  for (const raw of entries) {
    if (!raw || typeof raw !== 'object') continue;

    const entry = buildContactEntry(raw, sessionId, companyId);
    if (!entry.phone) continue;

    const existing = contactCache.get(entry.phone);

    if (!existing) {
      contactCache.set(entry.phone, entry);
      results.push(entry);
      created += 1;
      continue;
    }

    // Check if anything meaningful changed
    const nameChanged = existing.name !== entry.name && entry.name !== entry.phone;
    const avatarChanged = existing.avatar !== entry.avatar && entry.avatar;

    if (nameChanged || avatarChanged) {
      const merged = {
        ...existing,
        name: nameChanged ? entry.name : existing.name,
        avatar: avatarChanged ? entry.avatar : existing.avatar,
        updatedAt: entry.updatedAt,
      };
      contactCache.set(entry.phone, merged);
      results.push(merged);
      updated += 1;
    } else {
      unchanged += 1;
    }
  }

  return { created, updated, unchanged, total: contactCache.size, synced: results };
}

// ─── PostgreSQL Persistence ───

async function persistContactsBatch(contacts = []) {
  if (!contacts.length) return { persisted: 0 };

  const batchSize = 50;
  let persisted = 0;

  for (let i = 0; i < contacts.length; i += batchSize) {
    const batch = contacts.slice(i, i + batchSize);

    const values = [];
    const params = [];
    let paramIndex = 1;

    for (const contact of batch) {
      values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, NOW(), NOW())`);
      params.push(
        contact.phone,
        contact.companyId || DEFAULT_COMPANY_ID,
        contact.name,
        contact.avatar || null,
        contact.isGroup || false
      );
      paramIndex += 5;
    }

    try {
      await db.query(
        `INSERT INTO contacts (phone, company_id, name, avatar_url, is_group, created_at, updated_at)
         VALUES ${values.join(', ')}
         ON CONFLICT (phone, company_id) DO UPDATE SET
           name = EXCLUDED.name,
           avatar_url = COALESCE(EXCLUDED.avatar_url, contacts.avatar_url),
           is_group = EXCLUDED.is_group,
           updated_at = NOW()`,
        params
      );
      persisted += batch.length;
    } catch (err) {
      if (err?.code !== '42P01') { // table doesn't exist
        console.error('[ContactsEngine] Batch persist failed:', err?.message || err);
      }
    }
  }

  return { persisted };
}

async function loadContactsFromPostgres(companyId = DEFAULT_COMPANY_ID) {
  try {
    const result = await db.query(
      `SELECT phone, name, avatar_url, is_group, company_id, updated_at
       FROM contacts
       WHERE company_id = $1
       ORDER BY updated_at DESC
       LIMIT 5000`,
      [companyId]
    );

    for (const row of result.rows || []) {
      const phone = normalizePhone(row.phone);
      if (!phone) continue;

      if (!contactCache.has(phone)) {
        contactCache.set(phone, {
          phone,
          name: row.name || phone,
          avatar: row.avatar_url || null,
          isGroup: Boolean(row.is_group),
          companyId: row.company_id,
          sessionId: 'restored',
          updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
        });
      }
    }

    return contactCache.size;
  } catch (err) {
    if (err?.code !== '42P01') {
      console.error('[ContactsEngine] Postgres load failed:', err?.message || err);
    }
    return 0;
  }
}

// ─── WebSocket Emission ───

function emitContactsLoaded(io, contacts = null) {
  const socketServer = io || global.io;
  if (!socketServer) return;

  const payload = contacts || listCachedContacts();

  socketServer.emit('contacts_loaded', {
    contacts: payload.map((c) => ({
      phone: c.phone,
      name: c.name,
      avatar: c.avatar,
      isGroup: c.isGroup,
    })),
    total: payload.length,
  });
}

// ─── Full Sync Pipeline ───

async function fullSync(baileysContacts, sessionId, companyId, io) {
  // 1. Sync to memory cache
  const syncResult = syncContacts(baileysContacts, sessionId, companyId);

  // 2. Persist changed contacts to PostgreSQL
  if (syncResult.synced.length > 0) {
    await persistContactsBatch(syncResult.synced).catch((err) => {
      console.error('[ContactsEngine] Persist failed:', err?.message || err);
    });
  }

  // 3. Emit to frontend
  if (io) {
    emitContactsLoaded(io);
  }

  console.log(
    `[ContactsEngine] Sync complete: +${syncResult.created} new, ~${syncResult.updated} updated, =${syncResult.unchanged} unchanged, total=${syncResult.total}`
  );

  return syncResult;
}

module.exports = {
  buildContactEntry,
  clearCache,
  emitContactsLoaded,
  fullSync,
  getCacheSize,
  getCachedContact,
  listCachedContacts,
  loadContactsFromPostgres,
  normalizePhone,
  persistContactsBatch,
  syncContacts,
};
