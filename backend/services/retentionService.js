'use strict';

/**
 * ZAPAI — Retention Service
 *
 * Implementa limpeza automática de mensagens antigas com preservação
 * de contexto IA, leads, analytics, tags e insights.
 *
 * Política:
 *   - Grupos (@g.us): mensagens > 24 horas
 *   - Individuais: mensagens > 60 dias
 *
 * NUNCA remove:
 *   - ai_memory_short, ai_memory_long, ai_context
 *   - leads / contacts
 *   - analytics
 *   - conversation metadata (tags, summary, lead_temperature, etc.)
 *   - conversas em si (só as mensagens antigas)
 *
 * Uso:
 *   const retentionService = require('./retentionService');
 *   await retentionService.runRetention();
 */

const { query } = require('../src/infrastructure/config/database');
const aiCompressionService = require('./aiCompressionService');

// ─── Config ───────────────────────────────────────────────────────────────────
const GROUP_MESSAGE_RETENTION_HOURS  = Number(process.env.GROUP_MSG_RETENTION_HOURS  || 24);
const INDIVIDUAL_MESSAGE_RETENTION_DAYS = Number(process.env.INDIVIDUAL_MSG_RETENTION_DAYS || 60);
const RETENTION_BATCH_SIZE = Number(process.env.RETENTION_BATCH_SIZE || 500);

let lastRunAt = null;
let isRunning = false;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function tableExists(tableName) {
  const r = await query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`,
    [tableName]
  );
  return r.rows.length > 0;
}

async function columnExists(tableName, columnName) {
  const r = await query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2 LIMIT 1`,
    [tableName, columnName]
  );
  return r.rows.length > 0;
}

// ─── Group message cleanup ────────────────────────────────────────────────────

async function cleanGroupMessages() {
  const hasTable = await tableExists('messages');
  if (!hasTable) {
    return { skipped: true, reason: 'messages table does not exist' };
  }

  const hasChatId = await columnExists('messages', 'chat_id');
  const hasCreatedAt = await columnExists('messages', 'created_at');

  if (!hasChatId || !hasCreatedAt) {
    return { skipped: true, reason: 'messages table missing chat_id or created_at column' };
  }

  const cutoff = new Date(Date.now() - GROUP_MESSAGE_RETENTION_HOURS * 60 * 60 * 1000).toISOString();

  let totalDeleted = 0;
  let batch;

  // Delete in batches to avoid long-running transactions
  do {
    const result = await query(
      `DELETE FROM messages
       WHERE id IN (
         SELECT id FROM messages
         WHERE chat_id LIKE '%@g.us'
           AND created_at < $1
         LIMIT $2
       )`,
      [cutoff, RETENTION_BATCH_SIZE]
    );
    batch = result.rowCount || 0;
    totalDeleted += batch;
  } while (batch >= RETENTION_BATCH_SIZE);

  return {
    deleted: totalDeleted,
    cutoff,
    policy: `groups > ${GROUP_MESSAGE_RETENTION_HOURS}h`,
  };
}

// ─── Individual message cleanup ────────────────────────────────────────────────

async function cleanIndividualMessages(store) {
  const hasTable = await tableExists('messages');
  if (!hasTable) {
    return { skipped: true, reason: 'messages table does not exist' };
  }

  const hasChatId = await columnExists('messages', 'chat_id');
  const hasCreatedAt = await columnExists('messages', 'created_at');

  if (!hasChatId || !hasCreatedAt) {
    return { skipped: true, reason: 'messages table missing required columns' };
  }

  const cutoff = new Date(Date.now() - INDIVIDUAL_MESSAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  let totalDeleted = 0;
  let batch;

  do {
    // 1. Antes de deletar, buscamos os chats que estão nesse lote para compressão
    const toDeleteRes = await query(
      `SELECT id, chat_id, content, from_me, created_at, company_id
       FROM messages
       WHERE chat_id NOT LIKE '%@g.us'
         AND created_at < $1
       ORDER BY chat_id, created_at ASC
       LIMIT $2`,
      [cutoff, RETENTION_BATCH_SIZE]
    );

    const msgsToDelete = toDeleteRes.rows || [];
    if (msgsToDelete.length === 0) break;

    // Agrupa mensagens por chat_id para compressão
    const grouped = {};
    for (const msg of msgsToDelete) {
      if (!grouped[msg.chat_id]) grouped[msg.chat_id] = { companyId: msg.company_id, messages: [] };
      grouped[msg.chat_id].messages.push(msg);
    }

    // Chama o serviço de compressão para cada chat (em background/await)
    for (const chatId of Object.keys(grouped)) {
      const { companyId, messages } = grouped[chatId];
      if (messages.length > 5) { // Só comprime se houver um contexto relevante a ser deletado
        await aiCompressionService.compressContactHistory(chatId, companyId, messages, store).catch(e => console.error(e));
      }
    }

    // 2. Agora deletamos o lote que já foi comprimido
    const idsToDelete = msgsToDelete.map(m => m.id);
    const result = await query(
      `DELETE FROM messages WHERE id = ANY($1::int[])`,
      [idsToDelete]
    );
    
    batch = result.rowCount || 0;
    totalDeleted += batch;
  } while (batch >= RETENTION_BATCH_SIZE);

  return {
    deleted: totalDeleted,
    cutoff,
    policy: `individual > ${INDIVIDUAL_MESSAGE_RETENTION_DAYS}d`,
  };
}

// ─── AI Memory — PRESERVE (never touch) ───────────────────────────────────────
// ai_memory_short, ai_memory_long, ai_context tables are intentionally
// excluded from all retention logic. The AI needs long-term context to
// provide personalized responses after restarts.

// ─── Orphan conversation cleanup (optional, conservative) ──────────────────────

async function cleanOrphanConversations() {
  // Only remove conversations that have NO messages AND were created > 7 days ago
  // AND have no lead_id (truly orphaned)
  try {
    const hasConversations = await tableExists('conversations');
    const hasMessages = await tableExists('messages');
    if (!hasConversations || !hasMessages) {
      return { skipped: true };
    }

    const hasChatId = await columnExists('messages', 'conversation_id');
    if (!hasChatId) {
      return { skipped: true, reason: 'messages.conversation_id not available' };
    }

    const result = await query(
      `DELETE FROM conversations
       WHERE id NOT IN (SELECT DISTINCT conversation_id FROM messages WHERE conversation_id IS NOT NULL)
         AND lead_id IS NULL
         AND created_at < NOW() - INTERVAL '7 days'
       RETURNING id`
    );
    return { deleted: result.rowCount || 0, policy: 'orphan conversations > 7d with no messages' };
  } catch {
    return { skipped: true, reason: 'schema does not support orphan cleanup' };
  }
}

// ─── Main entry point ─────────────────────────────────────────────────────────

async function runRetention(store) {
  if (isRunning) {
    console.log('[RETENTION] Already running — skipping');
    return { skipped: true, reason: 'already running' };
  }

  isRunning = true;
  const startedAt = new Date().toISOString();

  console.log('[RETENTION] Starting retention run...');

  const report = {
    startedAt,
    groups: null,
    individual: null,
    orphans: null,
    preservedTables: [
      'ai_memory_short',
      'ai_memory_long',
      'ai_context',
      'leads',
      'contacts',
      'analytics',
      'tags',
    ],
    completedAt: null,
    durationMs: null,
    error: null,
  };

  const t0 = Date.now();

  try {
    report.groups     = await cleanGroupMessages();
    report.individual = await cleanIndividualMessages(store);
    report.orphans    = await cleanOrphanConversations();
  } catch (err) {
    report.error = err?.message || String(err);
    console.error('[RETENTION] Fatal error:', report.error);
  } finally {
    isRunning = false;
    lastRunAt = new Date().toISOString();
    report.completedAt = lastRunAt;
    report.durationMs = Date.now() - t0;
  }

  console.log(
    `[RETENTION] Complete in ${report.durationMs}ms | groups=${report.groups?.deleted ?? 'skip'} individual=${report.individual?.deleted ?? 'skip'}`
  );

  return report;
}

function getLastRunAt() {
  return lastRunAt;
}

function isRetentionRunning() {
  return isRunning;
}

module.exports = {
  runRetention,
  getLastRunAt,
  isRetentionRunning,
  // Config exposed for tests
  GROUP_MESSAGE_RETENTION_HOURS,
  INDIVIDUAL_MESSAGE_RETENTION_DAYS,
};
