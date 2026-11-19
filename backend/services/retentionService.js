'use strict';

/**
 * ZAPAI — Retention Service
 *
 * Implementa limpeza automática de mensagens antigas com preservação
 * de contexto IA, leads, analytics, tags e insights.
 *
 * Política:
 *   - Grupos (@g.us): mensagens > 168 horas (7 dias)
 *   - Individuais: mensagens > 30 dias (1 mês) -> seladas em Token de Contexto Criptografado (zctx1.) antes da exclusão
 *
 * NUNCA remove:
 *   - ai_memory_short, ai_memory_long, ai_context, ai_conversation_memory
 *   - context_token em conversations (capsula criptografada leve)
 *   - leads / contacts
 *   - analytics
 *   - conversation metadata (tags, summary, lead_temperature, etc.)
 *   - conversas com mensagens recentes, fixadas, não lidas ou com context_token
 *
 * Uso:
 *   const retentionService = require('./retentionService');
 *   await retentionService.runRetention();
 */

const fsp = require('fs/promises');
const { query } = require('../src/infrastructure/config/database');
const contextTokenService = require('./contextTokenService');

// ─── Config ───────────────────────────────────────────────────────────────────
const GROUP_MESSAGE_RETENTION_HOURS = Number(process.env.GROUP_MSG_RETENTION_HOURS || 168); // 7 days (1 week)
const INDIVIDUAL_MESSAGE_RETENTION_DAYS = Number(process.env.INDIVIDUAL_MSG_RETENTION_DAYS || 30); // 30 days (1 month)
const RETENTION_BATCH_SIZE = Number(process.env.RETENTION_BATCH_SIZE || 500);

let lastRunAt = null;
let isRunning = false;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveEffectiveTimestampExpr(hasTimestamp, hasCreatedAt, alias = 'm') {
  if (hasTimestamp && hasCreatedAt) return `COALESCE(${alias}."timestamp", ${alias}.created_at)`;
  if (hasCreatedAt) return `${alias}.created_at`;
  return `${alias}."timestamp"`;
}

async function cleanupOrphanedMediaFiles(deletedRows) {
  const candidates = new Set();
  for (const row of deletedRows) {
    const rawPath = String(row?.media_path || '').trim();
    if (!rawPath || /^https?:\/\//i.test(rawPath) || rawPath.startsWith('data:')) continue;
    // Never touch shared catalog or quick-reply assets
    if (/(catalog|quick[-_]?repl|\/assets\/)/i.test(rawPath)) continue;
    candidates.add(rawPath);
  }
  if (candidates.size === 0) return 0;

  let mediaService = null;
  try {
    mediaService = require('./enterprise/media-service');
  } catch {
    return 0;
  }
  if (!mediaService?.findMediaFile || !mediaService?.normalizeMediaReference) return 0;

  let removedFiles = 0;
  for (const mediaPath of candidates) {
    try {
      const normalized = mediaService.normalizeMediaReference(mediaPath);
      if (!normalized.startsWith('/media/')) continue;

      const stillReferenced = await query(
        `SELECT 1 FROM messages WHERE media_path = $1 OR media_url = $1 LIMIT 1`,
        [mediaPath]
      );
      if ((stillReferenced.rows || []).length > 0) continue;

      if (await tableExists('whatsapp_history_items')) {
        const histRef = await query(
          `SELECT 1 FROM whatsapp_history_items WHERE media_path = $1 LIMIT 1`,
          [mediaPath]
        );
        if ((histRef.rows || []).length > 0) continue;
      }

      const absPath = await mediaService.findMediaFile(mediaPath);
      if (absPath) {
        await fsp.unlink(absPath);
        removedFiles += 1;
      }
    } catch {
      // Best-effort cleanup; never fail retention because of disk unlink
    }
  }
  return removedFiles;
}

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

async function sealGroupContextToken(group, options) {
  const { hasTokenCol, hasMemTable, hasMemTokenCol, cutoffMs } = options;
  const companyId = group.companyId || 'default';
  let conv = null;

  if (group.conversationId) {
    const tokenSelect = hasTokenCol ? ', conv.context_token, conv.context_token_meta' : '';
    const res = await query(
      `SELECT conv.id, conv.company_id, conv.lead_id, conv.session_id, conv.remote_jid,
              conv.lead_intent, conv.funnel_stage, conv.tags${tokenSelect},
              l.phone AS lead_phone, l.name AS lead_name
       FROM conversations conv
       LEFT JOIN leads l ON l.id = conv.lead_id
       WHERE conv.id = $1
       LIMIT 1`,
      [group.conversationId]
    );
    conv = res.rows[0] || null;
  } else if (group.chatId) {
    const tokenSelect = hasTokenCol ? ', conv.context_token, conv.context_token_meta' : '';
    const digits = String(group.phone || group.chatId || '').replace(/\D/g, '');
    const res = await query(
      `SELECT conv.id, conv.company_id, conv.lead_id, conv.session_id, conv.remote_jid,
              conv.lead_intent, conv.funnel_stage, conv.tags${tokenSelect},
              l.phone AS lead_phone, l.name AS lead_name
       FROM conversations conv
       LEFT JOIN leads l ON l.id = conv.lead_id
       WHERE COALESCE(NULLIF(conv.company_id, ''), 'default') = $1
         AND (conv.remote_jid = $2 OR l.phone = $3 OR ($4 <> '' AND l.phone = $4))
       ORDER BY conv.last_message_at DESC NULLS LAST, conv.id DESC
       LIMIT 1`,
      [companyId, group.chatId, group.phone || group.chatId, digits]
    );
    conv = res.rows[0] || null;
  }

  const resolvedSessionId = String(conv?.session_id || group.sessionId || 'main').trim() || 'main';
  const contactId =
    String(conv?.remote_jid || group.chatId || conv?.lead_phone || group.phone || '').trim() ||
    `conv-${conv?.id || group.messages[0].id}`;
  const phone = String(conv?.lead_phone || group.phone || contactId).trim();

  let existingMemory = null;
  if (hasMemTable) {
    const memTokenSelect = hasMemTokenCol ? ', context_token' : '';
    const memRes = await query(
      `SELECT company_id, session_id, contact_id, phone, name, intent, sentiment, tags, summary, metrics, messages, last_updated${memTokenSelect}
       FROM ai_conversation_memory
       WHERE COALESCE(NULLIF(company_id, ''), 'default') = $1
         AND session_id = $2
         AND (contact_id = $3 OR phone = $4)
       ORDER BY updated_at DESC NULLS LAST
       LIMIT 1`,
      [companyId, resolvedSessionId, contactId, phone]
    );
    existingMemory = memRes.rows[0] || null;
  }

  const sealed = contextTokenService.mergeAndEncodeContextToken({
    existingToken: conv?.context_token || existingMemory?.context_token || null,
    companyId,
    contactId,
    contactName: conv?.lead_name || existingMemory?.name || null,
    phone,
    messages: group.messages,
    conversation: conv,
    existingMemory,
  });

  if (conv?.id && hasTokenCol) {
    // IMPORTANT: Never bump updated_at or last_message_at when sealing old context!
    await query(
      `UPDATE conversations
       SET context_token = $1,
           context_token_meta = $2::jsonb
       WHERE id = $3`,
      [sealed.token, JSON.stringify(sealed.meta), conv.id]
    );
  }

  if (hasMemTable) {
    const existingMemMsgs = Array.isArray(existingMemory?.messages) ? existingMemory.messages : [];
    const recentMemMsgs = existingMemMsgs.filter((m) => {
      const t = new Date(m?.timestamp || 0).getTime();
      return !Number.isNaN(t) && t >= cutoffMs;
    });

    const baseMetrics =
      existingMemory?.metrics && typeof existingMemory.metrics === 'object' ? existingMemory.metrics : {};
    const mergedMetrics = {
      ...baseMetrics,
      facts: sealed.decoded.facts,
      commercial: sealed.decoded.commercial,
      contextTokenMeta: sealed.meta,
    };

    const existingSummary = String(existingMemory?.summary || '')
      .replace(/\[Contexto Cripto\]:[^\n]*/g, '')
      .trim();
    const updatedSummary = existingSummary
      ? `${existingSummary.slice(0, 700)}\n[Contexto Cripto]: ${sealed.compactSummary}`
      : `[Contexto Cripto]: ${sealed.compactSummary}`;

    const lastUpdated = existingMemory?.last_updated || sealed.meta.to || new Date().toISOString();

    if (hasMemTokenCol) {
      await query(
        `INSERT INTO ai_conversation_memory (
           company_id, session_id, contact_id, phone, name, intent, sentiment, tags, summary, metrics, messages, context_token, last_updated, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12, $13, NOW())
         ON CONFLICT (company_id, session_id, contact_id) DO UPDATE SET
           phone = COALESCE(NULLIF(EXCLUDED.phone, ''), ai_conversation_memory.phone),
           name = COALESCE(NULLIF(EXCLUDED.name, ''), ai_conversation_memory.name),
           intent = EXCLUDED.intent,
           sentiment = EXCLUDED.sentiment,
           tags = EXCLUDED.tags,
           summary = EXCLUDED.summary,
           metrics = EXCLUDED.metrics,
           messages = EXCLUDED.messages,
           context_token = EXCLUDED.context_token,
           updated_at = NOW()`,
        [
          companyId,
          resolvedSessionId,
          existingMemory?.contact_id || contactId,
          phone,
          sealed.decoded.name || existingMemory?.name || 'Contato',
          sealed.decoded.intent || 'information',
          sealed.decoded.sentiment || 'neutral',
          sealed.decoded.tags || [],
          updatedSummary,
          JSON.stringify(mergedMetrics),
          JSON.stringify(recentMemMsgs),
          sealed.token,
          lastUpdated,
        ]
      );
    } else {
      await query(
        `INSERT INTO ai_conversation_memory (
           company_id, session_id, contact_id, phone, name, intent, sentiment, tags, summary, metrics, messages, last_updated, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12, NOW())
         ON CONFLICT (company_id, session_id, contact_id) DO UPDATE SET
           summary = EXCLUDED.summary,
           metrics = EXCLUDED.metrics,
           messages = EXCLUDED.messages,
           updated_at = NOW()`,
        [
          companyId,
          resolvedSessionId,
          existingMemory?.contact_id || contactId,
          phone,
          sealed.decoded.name || existingMemory?.name || 'Contato',
          sealed.decoded.intent || 'information',
          sealed.decoded.sentiment || 'neutral',
          sealed.decoded.tags || [],
          updatedSummary,
          JSON.stringify(mergedMetrics),
          JSON.stringify(recentMemMsgs),
          lastUpdated,
        ]
      );
    }
  }

  return sealed;
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

  const effectiveTs = resolveEffectiveTimestampExpr(hasTimestamp, hasCreatedAt, 'm');
  const cutoff = new Date(Date.now() - GROUP_MESSAGE_RETENTION_HOURS * 60 * 60 * 1000).toISOString();

  let totalDeleted = 0;
  let batch;

  // Delete in batches to avoid long-running transactions
  do {
    const toDeleteRes = await query(
      `SELECT m.id FROM messages m
       WHERE ${effectiveTs} < $1
         AND (${hasRemoteJid ? "m.remote_jid LIKE '%@g.us'" : 'FALSE'} OR ${hasPhone ? "m.phone LIKE '%@g.us'" : 'FALSE'})
       ORDER BY ${effectiveTs} ASC, m.id ASC
       LIMIT $2`,
      [cutoff, RETENTION_BATCH_SIZE]
    );

    const idsToDelete = (toDeleteRes.rows || []).map((r) => r.id);
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
         ORDER BY id ASC
         LIMIT $2`,
        [cutoff, RETENTION_BATCH_SIZE]
      );
      const historyIds = (toDeleteHistory.rows || []).map((r) => r.id);
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

async function cleanIndividualMessages() {
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

  const hasTokenCol = (await tableExists('conversations')) ? await columnExists('conversations', 'context_token') : false;
  const hasMemTable = await tableExists('ai_conversation_memory');
  const hasMemTokenCol = hasMemTable ? await columnExists('ai_conversation_memory', 'context_token') : false;
  const hasMediaPathCol = await columnExists('messages', 'media_path');
  const hasContentCol = await columnExists('messages', 'content');
  const hasTextCol = await columnExists('messages', 'text');
  const hasConvIdCol = await columnExists('messages', 'conversation_id');
  const hasSessionIdCol = await columnExists('messages', 'session_id');
  const hasCompanyIdCol = await columnExists('messages', 'company_id');
  const hasFromMeCol = await columnExists('messages', 'from_me');

  const effectiveTs = resolveEffectiveTimestampExpr(hasTimestamp, hasCreatedAt, 'm');
  const cutoffDate = new Date(Date.now() - INDIVIDUAL_MESSAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const cutoff = cutoffDate.toISOString();
  const cutoffMs = cutoffDate.getTime();

  let totalDeleted = 0;
  let tokensSealed = 0;
  let mediaFilesRemoved = 0;
  let batch = 0;

  do {
    const toDeleteRes = await query(
      `SELECT m.id,
              ${hasConvIdCol ? 'm.conversation_id' : 'NULL::int AS conversation_id'},
              ${hasSessionIdCol ? 'm.session_id' : "'main'::text AS session_id"},
              COALESCE(${hasRemoteJid ? 'm.remote_jid' : 'NULL'}, ${hasPhone ? 'm.phone' : 'NULL'}) AS chat_id,
              ${hasPhone ? 'm.phone' : 'NULL::text AS phone'},
              COALESCE(${hasContentCol ? 'm.content' : 'NULL'}, ${hasTextCol ? 'm.text' : 'NULL'}, '') AS content,
              ${hasFromMeCol ? 'COALESCE(m.from_me, false)' : 'false'} AS from_me,
              ${hasMediaPathCol ? 'm.media_path' : 'NULL::text AS media_path'},
              ${effectiveTs} AS effective_at,
              ${hasCompanyIdCol ? "COALESCE(NULLIF(m.company_id, ''), 'default')" : "'default'::text"} AS company_id
       FROM messages m
       WHERE ${effectiveTs} < $1
         AND COALESCE(${hasRemoteJid ? 'm.remote_jid' : "''"}, '') NOT LIKE '%@g.us'
         AND COALESCE(${hasPhone ? 'm.phone' : "''"}, '') NOT LIKE '%@g.us'
       ORDER BY ${effectiveTs} ASC, m.id ASC
       LIMIT $2`,
      [cutoff, RETENTION_BATCH_SIZE]
    );

    const msgsToDelete = toDeleteRes.rows || [];
    if (msgsToDelete.length === 0) break;

    // Group expiring messages by conversation/chat so every conversation gets a context token before purge
    const grouped = new Map();
    for (const msg of msgsToDelete) {
      const companyId = msg.company_id || 'default';
      const key = msg.conversation_id
        ? `${companyId}:conv:${msg.conversation_id}`
        : `${companyId}:chat:${msg.chat_id || msg.phone || msg.id}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          companyId,
          conversationId: msg.conversation_id || null,
          sessionId: msg.session_id || 'main',
          chatId: msg.chat_id || msg.phone || null,
          phone: msg.phone || msg.chat_id || null,
          messages: [],
        });
      }
      grouped.get(key).messages.push(msg);
    }

    const idsToDelete = [];
    const deletedRows = [];

    for (const group of grouped.values()) {
      try {
        await sealGroupContextToken(group, {
          hasTokenCol,
          hasMemTable,
          hasMemTokenCol,
          cutoffMs,
        });
        tokensSealed += 1;
        for (const msg of group.messages) {
          idsToDelete.push(msg.id);
          deletedRows.push(msg);
        }
      } catch (sealErr) {
        console.error('[RETENTION] Failed to seal context token for batch group, skipping delete for safety:', sealErr?.message || sealErr);
      }
    }

    if (idsToDelete.length === 0) break;

    const result = await query(
      `DELETE FROM messages WHERE id = ANY($1::int[])`,
      [idsToDelete]
    );

    batch = result.rowCount || 0;
    totalDeleted += batch;
    mediaFilesRemoved += await cleanupOrphanedMediaFiles(deletedRows);

    if (msgsToDelete.length < RETENTION_BATCH_SIZE) break;
  } while (batch > 0);

  // Also purge whatsapp_history_items for individual chats older than cutoff
  let historyDeleted = 0;
  if (await tableExists('whatsapp_history_items')) {
    let historyBatch;
    do {
      const toDeleteHistory = await query(
        `SELECT id FROM whatsapp_history_items
         WHERE chat_jid NOT LIKE '%@g.us'
           AND (occurred_at < $1 OR (occurred_at IS NULL AND created_at < $1))
         ORDER BY id ASC
         LIMIT $2`,
        [cutoff, RETENTION_BATCH_SIZE]
      );
      const historyIds = (toDeleteHistory.rows || []).map((r) => r.id);
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
    tokensSealed,
    mediaFilesRemoved,
    cutoff,
    policy: `individual > ${INDIVIDUAL_MESSAGE_RETENTION_DAYS}d (30 days / context-tokenized)`,
  };
}

// ─── AI Memory — PRESERVE (never touch) ───────────────────────────────────────
// ai_memory_short, ai_memory_long, ai_context, and ai_conversation_memory context_token
// remain intact so the AI retains personalized long-term context after raw messages expire.

// ─── Phantom / Orphan conversation cleanup ────────────────────────────────────

async function cleanOrphanConversations() {
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

    const hasTokenCol = await columnExists('conversations', 'context_token');
    const hasPinnedCol = await columnExists('conversations', 'is_pinned');
    const hasUnreadCol = await columnExists('conversations', 'unread_count');
    const hasLastMsgCol = await columnExists('conversations', 'last_message');
    const hasLastMsgAtCol = await columnExists('conversations', 'last_message_at');

    const conditions = [
      'NOT EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id)',
    ];
    if (hasTokenCol) conditions.push("(c.context_token IS NULL OR c.context_token = '')");
    if (hasUnreadCol) conditions.push('COALESCE(c.unread_count, 0) = 0');
    if (hasPinnedCol) conditions.push('COALESCE(c.is_pinned, false) = false');
    if (hasLastMsgCol) conditions.push("(c.last_message IS NULL OR BTRIM(c.last_message) = '')");

    const tsExpr = hasLastMsgAtCol
      ? `COALESCE(c.last_message_at, timezone('UTC', c.updated_at), timezone('UTC', c.created_at))`
      : `COALESCE(timezone('UTC', c.updated_at), timezone('UTC', c.created_at))`;
    conditions.push(`${tsExpr} < NOW() - INTERVAL '30 days'`);

    const result = await query(
      `DELETE FROM conversations c
       WHERE ${conditions.join('\n         AND ')}
       RETURNING c.id`
    );
    return {
      deleted: result.rowCount || 0,
      policy: 'phantom empty conversations > 30d with no messages and no context_token',
    };
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
      'ai_conversation_memory',
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
    report.groups = await cleanGroupMessages();
    report.individual = await cleanIndividualMessages(store);
    report.orphans = await cleanOrphanConversations();
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
    `[RETENTION] Complete in ${report.durationMs}ms | groups=${report.groups?.deleted ?? 'skip'} individual=${report.individual?.deleted ?? 'skip'} tokensSealed=${report.individual?.tokensSealed ?? 0} orphans=${report.orphans?.deleted ?? 'skip'}`
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
