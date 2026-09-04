/**
 * AI Memory Engine — Persistent conversational memory with PostgreSQL.
 *
 * Wraps aiConversationMemoryService (in-memory) with:
 * - PostgreSQL persistence for conversation context
 * - Context hydration on startup
 * - Periodic flush to database
 * - Memory search by phone/contact/conversation
 * - AI context building for prompt injection
 * - Analytics aggregation
 *
 * This module does NOT replace aiConversationMemoryService — it adds
 * persistence on top of the existing in-memory implementation.
 */

const db = require('../src/infrastructure/config/database');
const aiConversationMemoryService = require('./aiConversationMemoryService');

const DEFAULT_COMPANY_ID = String(process.env.DEFAULT_COMPANY_ID || 'default').trim();
const FLUSH_BATCH_SIZE = Math.max(1, Number(process.env.AI_MEMORY_FLUSH_BATCH_SIZE) || 20);
const FLUSH_MAX_ENTRIES = Math.max(FLUSH_BATCH_SIZE, Number(process.env.AI_MEMORY_FLUSH_MAX_ENTRIES) || FLUSH_BATCH_SIZE * 5);
const MIN_FLUSH_INTERVAL_MS = Math.max(60_000, Number(process.env.AI_MEMORY_MIN_FLUSH_MS) || 300_000);
let flushInFlight = null;
let lastFlushAt = 0;

// ─── PostgreSQL Persistence ───

async function persistMemoryEntry(entry, companyId = DEFAULT_COMPANY_ID) {
  if (!entry?.contact_id) return;

  try {
    await db.query(
      `INSERT INTO ai_conversation_memory (
        contact_id, company_id, phone, name, intent, sentiment,
        tags, summary, metrics, messages, last_updated, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, NOW(), NOW())
      ON CONFLICT (contact_id, company_id) DO UPDATE SET
        name = EXCLUDED.name,
        intent = EXCLUDED.intent,
        sentiment = EXCLUDED.sentiment,
        tags = EXCLUDED.tags,
        summary = EXCLUDED.summary,
        metrics = EXCLUDED.metrics,
        messages = EXCLUDED.messages,
        last_updated = EXCLUDED.last_updated,
        updated_at = NOW()`,
      [
        entry.contact_id,
        companyId,
        entry.phone || null,
        entry.name || entry.phone || 'Contato',
        entry.intent || 'information',
        entry.sentiment || 'neutral',
        entry.tags || [],
        entry.summary || '',
        JSON.stringify(entry.metrics || {}),
        JSON.stringify((entry.messages || []).slice(-40)),
        entry.last_updated || new Date().toISOString(),
      ]
    );
  } catch (err) {
    if (err?.code !== '42P01') { // table doesn't exist
      console.error(`[AIMemory] Persist failed for ${entry.contact_id}:`, err?.message || err);
    }
  }
}

async function loadMemoryFromPostgres(store, companyId = DEFAULT_COMPANY_ID) {
  try {
    const result = await db.query(
      `SELECT contact_id, phone, name, intent, sentiment, tags, summary, metrics, messages, last_updated
       FROM ai_conversation_memory
       WHERE company_id = $1
       ORDER BY last_updated DESC
       LIMIT 500`,
      [companyId]
    );

    if (!Array.isArray(store.conversationMemory)) {
      store.conversationMemory = [];
    }

    let loaded = 0;
    for (const row of result.rows || []) {
      const existingIndex = store.conversationMemory.findIndex(
        (e) => e?.contact_id === row.contact_id
      );

      const entry = {
        contact_id: row.contact_id,
        phone: row.phone,
        name: row.name,
        intent: row.intent || 'information',
        sentiment: row.sentiment || 'neutral',
        tags: row.tags || [],
        summary: row.summary || '',
        metrics: typeof row.metrics === 'object' ? row.metrics : {},
        messages: Array.isArray(row.messages) ? row.messages : [],
        last_updated: row.last_updated ? new Date(row.last_updated).toISOString() : null,
      };

      if (existingIndex >= 0) {
        // Merge: keep newer data
        const existing = store.conversationMemory[existingIndex];
        if (!existing.last_updated || new Date(entry.last_updated) > new Date(existing.last_updated)) {
          store.conversationMemory[existingIndex] = entry;
        }
      } else {
        store.conversationMemory.push(entry);
        loaded += 1;
      }
    }

    console.log(`[AIMemory] Loaded ${loaded} memory entries from PostgreSQL`);
    return loaded;
  } catch (err) {
    if (err?.code !== '42P01') {
      console.error('[AIMemory] Load from Postgres failed:', err?.message || err);
    }
    return 0;
  }
}

async function flushMemoryToPostgres(store, companyId = DEFAULT_COMPANY_ID) {
  if (!Array.isArray(store?.conversationMemory)) return 0;
  if (store?.databaseEnabled === false) return 0;

  const now = Date.now();
  if (flushInFlight) {
    return flushInFlight;
  }

  if ((now - lastFlushAt) < MIN_FLUSH_INTERVAL_MS) {
    return 0;
  }

  flushInFlight = (async () => {
    let flushed = 0;
    const entries = store.conversationMemory.slice(0, FLUSH_MAX_ENTRIES);

    for (let i = 0; i < entries.length; i += FLUSH_BATCH_SIZE) {
      const batch = entries.slice(i, i + FLUSH_BATCH_SIZE);
      for (const entry of batch) {
        if (entry?.contact_id) {
          await persistMemoryEntry(entry, companyId);
          flushed += 1;
        }
      }
    }

    lastFlushAt = Date.now();
    return flushed;
  })().finally(() => {
    flushInFlight = null;
  });

  return flushInFlight;
}

async function forceFlushMemoryToPostgres(store, companyId = DEFAULT_COMPANY_ID) {
  if (!Array.isArray(store?.conversationMemory)) return 0;
  if (store?.databaseEnabled === false) return 0;

  console.log('[AIMemory] Force flushing memory to PostgreSQL before shutdown...');
  let flushed = 0;
  const entries = store.conversationMemory;

  for (let i = 0; i < entries.length; i += FLUSH_BATCH_SIZE) {
    const batch = entries.slice(i, i + FLUSH_BATCH_SIZE);
    for (const entry of batch) {
      if (entry?.contact_id) {
        await persistMemoryEntry(entry, companyId);
        flushed += 1;
      }
    }
  }

  console.log(`[AIMemory] Successfully force flushed ${flushed} entries.`);
  return flushed;
}

// ─── Ensure Database Table ───

async function ensureMemoryTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS ai_conversation_memory (
        id SERIAL PRIMARY KEY,
        contact_id VARCHAR(255) NOT NULL,
        company_id VARCHAR(100) NOT NULL DEFAULT 'default',
        phone VARCHAR(50),
        name VARCHAR(255),
        intent VARCHAR(100) DEFAULT 'information',
        sentiment VARCHAR(50) DEFAULT 'neutral',
        tags TEXT[] DEFAULT '{}',
        summary TEXT DEFAULT '',
        metrics JSONB DEFAULT '{}',
        messages JSONB DEFAULT '[]',
        last_updated TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(contact_id, company_id)
      )
    `);
    console.log('[AIMemory] Table ai_conversation_memory ensured');
  } catch (err) {
    console.error('[AIMemory] Table creation failed:', err?.message || err);
  }
}

// ─── Memory Search ───

function searchMemory(store, query = '') {
  if (!Array.isArray(store?.conversationMemory)) return [];

  const normalized = String(query).toLowerCase().trim();
  if (!normalized) {
    return store.conversationMemory;
  }
  return store.conversationMemory.filter((entry) => {
    if (!entry) return false;
    return (
      String(entry.phone || '').includes(normalized) ||
      String(entry.name || '').toLowerCase().includes(normalized) ||
      String(entry.contact_id || '').includes(normalized) ||
      (entry.tags || []).some((tag) => String(tag).toLowerCase().includes(normalized))
    );
  });
}

// ─── Analytics ───

function getMemoryAnalytics(store) {
  const entries = Array.isArray(store?.conversationMemory) ? store.conversationMemory : [];

  const sentiments = { positive: 0, negative: 0, neutral: 0 };
  const intents = {};
  const tagCounts = {};
  let totalMessages = 0;
  let totalAudioRequests = 0;

  for (const entry of entries) {
    sentiments[entry.sentiment || 'neutral'] = (sentiments[entry.sentiment || 'neutral'] || 0) + 1;
    intents[entry.intent || 'information'] = (intents[entry.intent || 'information'] || 0) + 1;
    totalMessages += entry.metrics?.totalMessages || 0;
    totalAudioRequests += entry.metrics?.audioRequests || 0;

    for (const tag of entry.tags || []) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  return {
    totalContacts: entries.length,
    totalMessages,
    totalAudioRequests,
    sentiments,
    intents,
    topTags: Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([tag, count]) => ({ tag, count })),
  };
}

// ─── Public API ───

module.exports = {
  // Persistence
  ensureMemoryTable,
  flushMemoryToPostgres,
  forceFlushMemoryToPostgres,
  loadMemoryFromPostgres,
  persistMemoryEntry,

  // Search & Analytics
  getMemoryAnalytics,
  searchMemory,

  // Re-export aiConversationMemoryService for convenience
  buildOpenAIContext: aiConversationMemoryService.buildOpenAIContext,
  findMemoryByContact: aiConversationMemoryService.findMemoryByContact,
  updateConversationMemory: aiConversationMemoryService.updateConversationMemory,
};
