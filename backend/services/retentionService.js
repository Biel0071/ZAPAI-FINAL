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
const GROUP_MESSAGE_RETENTION_HOURS  = Number(process.env.GROUP_MSG_RETENTION_HOURS  || 168); // 7 days (1 week)
const INDIVIDUAL_MESSAGE_RETENTION_DAYS = Number(process.env.INDIVIDUAL_MSG_RETENTION_DAYS || 60); // 60 days
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

  const hasRemoteJid = await columnExists('messages', 'remote_jid');
  const hasPhone = await columnExists('messages', 'phone');
  const hasCreatedAt = await columnExists('messages', 'created_at');
  const hasTimestamp = await columnExists('messages', 'timestamp');

  if ((!hasRemoteJid && !hasPhone) || (!hasCreatedAt && !hasTimestamp)) {
    return { skipped: true, reason: 'messages table missing identifier or date column' };
  }

  const cutoff = new Date(Date.now() - GROUP_MESSAGE_RETENTION_HOURS * 60 * 60 * 1000).toISOString();

  let totalDeleted = 0;
  let batch;

  // Delete in batches to avoid long-running transactions
  do {
    const toDeleteRes = await query(
      `SELECT m.id FROM messages m
       WHERE m.created_at < $1
         AND (m.remote_jid LIKE '%@g.us' OR m.phone LIKE '%@g.us')
       LIMIT $2`,
      [cutoff, RETENTION_BATCH_SIZE]
    );

    const idsToDelete = (toDeleteRes.rows || []).map(r => r.id);
    if (idsToDelete.length === 0) break;

    const result = await query(
      `DELETE FROM messages WHERE id = ANY($1::int[])`,
      [idsToDelete]
    );
    batch = result.rowCount || 0;
    totalDeleted += batch;
  } while (batch >= RETENTION_BATCH_SIZE);

  // Also purge whatsapp_history_items for groups older than cutoff
  let historyDeleted = 0;
  if (await tableExists('whatsapp_history_items')) {
    let historyBatch;
    do {
      const toDeleteHistory = await query(
        `SELECT id FROM whatsapp_history_items
         WHERE chat_jid LIKE '%@g.us'
           AND (occurred_at < $1 OR (occurred_at IS NULL AND created_at < $1))
         LIMIT $2`,
        [cutoff, RETENTION_BATCH_SIZE]
      );
      const historyIds = (toDeleteHistory.rows || []).map(r => r.id);
      if (historyIds.length === 0) break;

      const historyRes = await query(
        `DELETE FROM whatsapp_history_items WHERE id = ANY($1::bigint[])`,
        [historyIds]
      );
      historyBatch = historyRes.rowCount || 0;
      historyDeleted += historyBatch;
    } while (historyBatch >= RETENTION_BATCH_SIZE);
  }

  return {
    deleted: totalDeleted,
    historyDeleted,
    cutoff,
    policy: `groups > ${GROUP_MESSAGE_RETENTION_HOURS}h (1 week)`,
  };
}

// ─── Individual message cleanup ────────────────────────────────────────────────

async function cleanIndividualMessages(store) {
  const hasTable = await tableExists('messages');
  if (!hasTable) {
    return { skipped: true, reason: 'messages table does not exist' };
  }

  const hasRemoteJid = await columnExists('messages', 'remote_jid');
  const hasPhone = await columnExists('messages', 'phone');
  const hasCreatedAt = await columnExists('messages', 'created_at');
  const hasTimestamp = await columnExists('messages', 'timestamp');

  if ((!hasRemoteJid && !hasPhone) || (!hasCreatedAt && !hasTimestamp)) {
    return { skipped: true, reason: 'messages table missing required columns' };
  }

  const cutoff = new Date(Date.now() - INDIVIDUAL_MESSAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  let totalDeleted = 0;
  let batch;

  do {
    // 1. Antes de deletar, buscamos os chats que estão nesse lote para compressão
    const toDeleteRes = await query(
      `SELECT m.id, COALESCE(m.remote_jid, m.phone) AS chat_id, m.content, m.from_me,
              m.created_at, m.company_id
       FROM messages m
       WHERE m.created_at < $1
         AND (m.remote_jid NOT LIKE '%@g.us' AND (m.phone IS NULL OR m.phone NOT LIKE '%@g.us'))
       LIMIT $2`,
      [cutoff, RETENTION_BATCH_SIZE]
    );

    const msgsToDelete = toDeleteRes.rows || [];
    if (msgsToDelete.length === 0) break;

    // Agrupa mensagens por chat_id para compressão de aprendizado IA
    const grouped = {};
    for (const msg of msgsToDelete) {
      if (!msg.chat_id) continue;
      if (!grouped[msg.chat_id]) grouped[msg.chat_id] = { companyId: msg.company_id, messages: [] };
      grouped[msg.chat_id].messages.push(msg);
    }

    // Chama o serviço de compressão para cada chat (em background/await)
    for (const chatId of Object.keys(grouped)) {
      const { companyId, messages } = grouped[chatId];
      // Sort within the contact group in memory
      messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
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

  // Also purge whatsapp_history_items for individual chats older than cutoff
  let historyDeleted = 0;
  if (await tableExists('whatsapp_history_items')) {
    let historyBatch;
    do {
      const toDeleteHistory = await query(
        `SELECT id FROM whatsapp_history_items
         WHERE chat_jid NOT LIKE '%@g.us'
           AND (occurred_at < $1 OR (occurred_at IS NULL AND created_at < $1))
         LIMIT $2`,
        [cutoff, RETENTION_BATCH_SIZE]
      );
      const historyIds = (toDeleteHistory.rows || []).map(r => r.id);
      if (historyIds.length === 0) break;

      const historyRes = await query(
        `DELETE FROM whatsapp_history_items WHERE id = ANY($1::bigint[])`,
        [historyIds]
      );
      historyBatch = historyRes.rowCount || 0;
      historyDeleted += historyBatch;
    } while (historyBatch >= RETENTION_BATCH_SIZE);
  }

  return {
    deleted: totalDeleted,
    historyDeleted,
    cutoff,
    policy: `individual > ${INDIVIDUAL_MESSAGE_RETENTION_DAYS}d (60 days)`,
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
      `DELETE FROM conversations c
       WHERE NOT EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id)
         AND c.lead_id IS NULL
         AND c.created_at < NOW() - INTERVAL '7 days'
       RETURNING c.id`
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
