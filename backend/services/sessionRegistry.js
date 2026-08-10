/**
 * Session Registry — Unified session state registry with Redis + PostgreSQL persistence.
 *
 * Provides a single source of truth for all WhatsApp session states.
 * Layers:
 *   1. In-memory Map (fast access, always available)
 *   2. Redis hash (cross-process sharing, survives restarts)
 *   3. PostgreSQL sessions table (durable audit trail)
 *
 * This module does NOT manage Baileys sockets — it only tracks state.
 * sessionManager.legacy.js still owns socket creation/teardown.
 */

const db = require('../src/infrastructure/config/database');

const REDIS_KEY = 'zapflow:sessions';
const DEFAULT_COMPANY_ID = String(process.env.DEFAULT_COMPANY_ID || 'default').trim();

// ─── In-Memory Registry ───
const registry = new Map(); // sessionId → SessionEntry

/**
 * @typedef {Object} SessionEntry
 * @property {string} sessionId
 * @property {string} companyId
 * @property {string} status - connected | disconnected | qr | connecting | error
 * @property {string|null} phone
 * @property {string|null} name
 * @property {boolean} connected
 * @property {string|null} qrCode
 * @property {number} lastHeartbeatAt
 * @property {number} reconnectCount
 * @property {string|null} workerPid
 * @property {string} createdAt
 * @property {string} updatedAt
 */

function createEntry(sessionId, patch = {}) {
  const now = new Date().toISOString();
  return {
    sessionId,
    companyId: patch.companyId || DEFAULT_COMPANY_ID,
    status: patch.status || 'disconnected',
    phone: patch.phone || null,
    name: patch.name || sessionId,
    connected: patch.connected || false,
    qrCode: patch.qrCode || null,
    lastHeartbeatAt: Date.now(),
    reconnectCount: patch.reconnectCount || 0,
    workerPid: patch.workerPid || String(process.pid),
    createdAt: patch.createdAt || now,
    updatedAt: now,
  };
}

// ─── In-Memory Operations ───

function get(sessionId) {
  return registry.get(sessionId) || null;
}

function set(sessionId, patch = {}) {
  const existing = registry.get(sessionId);
  const entry = existing
    ? { ...existing, ...patch, sessionId, updatedAt: new Date().toISOString() }
    : createEntry(sessionId, patch);

  registry.set(sessionId, entry);
  return entry;
}

function remove(sessionId) {
  const existed = registry.has(sessionId);
  registry.delete(sessionId);
  return existed;
}

function list() {
  return Array.from(registry.values());
}

function listConnected() {
  return list().filter((e) => e.connected || e.status === 'connected');
}

function listByCompany(companyId) {
  const normalized = String(companyId || DEFAULT_COMPANY_ID).trim();
  return list().filter((e) => e.companyId === normalized);
}

function setConnected(sessionId, phone = null) {
  return set(sessionId, {
    connected: true,
    status: 'connected',
    phone: phone || get(sessionId)?.phone || null,
    qrCode: null,
    lastHeartbeatAt: Date.now(),
  });
}

function setDisconnected(sessionId, reason = null) {
  const entry = get(sessionId);
  return set(sessionId, {
    connected: false,
    status: 'disconnected',
    qrCode: null,
    reconnectCount: (entry?.reconnectCount || 0) + (reason === 'reconnect' ? 1 : 0),
  });
}

function setQr(sessionId, qrCode) {
  return set(sessionId, {
    status: 'qr',
    connected: false,
    qrCode,
  });
}

function heartbeat(sessionId) {
  const entry = get(sessionId);
  if (!entry) return null;
  entry.lastHeartbeatAt = Date.now();
  entry.updatedAt = new Date().toISOString();
  return entry;
}

function getStats() {
  const all = list();
  return {
    total: all.length,
    connected: all.filter((e) => e.connected).length,
    disconnected: all.filter((e) => !e.connected).length,
    withQr: all.filter((e) => e.status === 'qr').length,
    stale: all.filter((e) => (Date.now() - e.lastHeartbeatAt) > 90_000).length,
  };
}

// ─── Redis Persistence ───

let redisClient = null;

function setRedisClient(client) {
  redisClient = client;
}

async function syncToRedis(sessionId) {
  if (!redisClient) return;
  const entry = get(sessionId);
  if (!entry) return;

  try {
    await redisClient.hset(REDIS_KEY, sessionId, JSON.stringify(entry));
  } catch (err) {
    console.error(`[SessionRegistry] Redis sync failed for ${sessionId}:`, err?.message || err);
  }
}

async function removeFromRedis(sessionId) {
  if (!redisClient) return;
  try {
    await redisClient.hdel(REDIS_KEY, sessionId);
  } catch (err) {
    console.error(`[SessionRegistry] Redis remove failed for ${sessionId}:`, err?.message || err);
  }
}

async function loadFromRedis() {
  if (!redisClient) return [];
  try {
    const all = await redisClient.hgetall(REDIS_KEY);
    if (!all || typeof all !== 'object') return [];

    const entries = [];
    for (const [sessionId, json] of Object.entries(all)) {
      try {
        const parsed = JSON.parse(json);
        registry.set(sessionId, { ...createEntry(sessionId), ...parsed });
        entries.push(registry.get(sessionId));
      } catch {
        // Skip corrupt entries
      }
    }
    return entries;
  } catch (err) {
    console.error('[SessionRegistry] Redis load failed:', err?.message || err);
    return [];
  }
}

// ─── PostgreSQL Persistence ───

async function ensureSessionColumns() {
  // Add columns that the registry needs but the original migration didn't include
  const alterSql = `
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS connected BOOLEAN DEFAULT FALSE;
    ALTER TABLE sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
  `;
  try {
    await db.query(alterSql);
  } catch (err) {
    if (err?.code !== '42P01') {
      console.error('[SessionRegistry] Column migration failed:', err?.message || err);
    }
  }
}

let columnsEnsured = false;

async function syncToPostgres(sessionId) {
  const entry = get(sessionId);
  if (!entry) return;

  if (!columnsEnsured) {
    await ensureSessionColumns();
    columnsEnsured = true;
  }

  try {
    await db.query(
      `INSERT INTO sessions (session_id, session_name, company_id, phone_number, status, connected, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (session_id) DO UPDATE SET
         phone_number = COALESCE(EXCLUDED.phone_number, sessions.phone_number),
         status = EXCLUDED.status,
         connected = EXCLUDED.connected,
         updated_at = EXCLUDED.updated_at`,
      [
        entry.sessionId,
        entry.name || entry.sessionId,
        entry.companyId,
        entry.phone,
        entry.status,
        entry.connected,
        entry.createdAt,
        entry.updatedAt,
      ]
    );
  } catch (err) {
    // Table might not exist yet — non-fatal
    if (err?.code !== '42P01') {
      console.error(`[SessionRegistry] Postgres sync failed for ${sessionId}:`, err?.message || err);
    }
  }
}

async function loadFromPostgres() {
  if (!columnsEnsured) {
    await ensureSessionColumns();
    columnsEnsured = true;
  }

  try {
    const result = await db.query(
      `SELECT session_id, session_name, company_id, phone_number, status, connected, created_at, updated_at
       FROM sessions
       WHERE session_id IS NOT NULL AND (status IS NULL OR status != 'deleted')
       ORDER BY COALESCE(updated_at, created_at) DESC
       LIMIT 100`
    );

    const entries = [];
    for (const row of result.rows || []) {
      if (!row.session_id) continue;
      const entry = set(row.session_id, {
        companyId: row.company_id,
        name: row.session_name || row.session_id,
        phone: row.phone_number,
        status: row.status || 'disconnected',
        connected: Boolean(row.connected),
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
      });
      entries.push(entry);
    }
    return entries;
  } catch (err) {
    if (err?.code !== '42P01') {
      console.error('[SessionRegistry] Postgres load failed:', err?.message || err);
    }
    return [];
  }
}

// ─── Full Persistence (sync both layers) ───

async function persistSession(sessionId) {
  await Promise.allSettled([
    syncToRedis(sessionId),
    syncToPostgres(sessionId),
  ]);
}

async function removeSession(sessionId) {
  remove(sessionId);
  await Promise.allSettled([
    removeFromRedis(sessionId),
    db.query(
      'DELETE FROM sessions WHERE session_id = $1',
      [sessionId]
    ).catch(() => {}),
  ]);
}

async function hydrate() {
  // Load from PostgreSQL first (durable), then overlay Redis (fresher)
  const pgEntries = await loadFromPostgres();
  const redisEntries = await loadFromRedis();

  console.log(`[SessionRegistry] Hydrated: ${pgEntries.length} from Postgres, ${redisEntries.length} from Redis, ${registry.size} total in memory`);
  return list();
}

module.exports = {
  createEntry,
  get,
  getStats,
  heartbeat,
  hydrate,
  list,
  listByCompany,
  listConnected,
  loadFromPostgres,
  loadFromRedis,
  persistSession,
  remove,
  removeSession,
  set,
  setConnected,
  setDisconnected,
  setQr,
  setRedisClient,
  syncToPostgres,
  syncToRedis,
};
