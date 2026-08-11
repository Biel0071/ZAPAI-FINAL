const { query } = require('../../infrastructure/config/database');
const contactRepository = require('./contactRepository');

// Bugfix#2: bounded TTL cache. Prior implementation used an unbounded Map
// with no expiry and returned the same array reference to every caller,
// which caused stale reads, memory growth per unique session_id, and
// downstream mutation bugs.
const CONVERSATION_CACHE_TTL_MS = Math.max(
  1_000,
  Number(process.env.CONVERSATION_CACHE_TTL_MS) || 15_000
);
const CONVERSATION_CACHE_MAX_ENTRIES = Math.max(
  32,
  Number(process.env.CONVERSATION_CACHE_MAX_ENTRIES) || 512
);
const conversationCache = new Map();

function getCompanyId(companyId) {
  return companyId || process.env.DEFAULT_COMPANY_ID || 'default';
}

function getCacheKey(companyId, limit = 50, sessionId = null) {
  return `${getCompanyId(companyId)}:${limit}:${sessionId || '*'}`;
}

function readCache(cacheKey) {
  const entry = conversationCache.get(cacheKey);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    conversationCache.delete(cacheKey);
    return null;
  }

  // Touch for simple LRU: move key to end of insertion order.
  conversationCache.delete(cacheKey);
  conversationCache.set(cacheKey, entry);

  // Return a shallow copy so callers cannot mutate the cached array.
  return entry.value.slice();
}

function writeCache(cacheKey, value) {
  conversationCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + CONVERSATION_CACHE_TTL_MS,
  });

  if (conversationCache.size > CONVERSATION_CACHE_MAX_ENTRIES) {
    // Evict the oldest key (insertion order).
    const oldestKey = conversationCache.keys().next().value;
    if (oldestKey !== undefined) {
      conversationCache.delete(oldestKey);
    }
  }
}

function invalidateConversationCache(companyId) {
  const normalizedCompanyId = getCompanyId(companyId);

  for (const key of conversationCache.keys()) {
    if (key.startsWith(`${normalizedCompanyId}:`)) {
      conversationCache.delete(key);
    }
  }
}

function mapConversation(row) {
  if (!row) {
    return null;
  }

  let resolvedPhone = row.phone;
  let rawLid = null;
  if (row.phone) {
    const cleanPhone = String(row.phone).replace(/\D/g, '');
    if (row.phone.includes('@lid') || cleanPhone.length === 15) {
      rawLid = cleanPhone;
      if (global.lidToPhoneMap && global.lidToPhoneMap.has(cleanPhone)) {
        resolvedPhone = global.lidToPhoneMap.get(cleanPhone);
      }
    }
  }

  return {
    agent_name: row.agent_name || null,
    aiEnabled: row.ai_enabled !== false,
    ai_reactivate_at: row.ai_reactivate_at || null,
    company_id: row.company_id,
    contact_id: row.lead_id,
    createdAt: row.created_at,
    funnel_stage: row.funnel_stage || 'new_lead',
    id: row.id,
    chatId: row.remote_jid,
    lastMessage: row.last_message || '',
    lastMessageType: row.last_message_type || 'text',
    lead_id: row.lead_id,
    remote_jid: row.remote_jid,
    remoteJid: row.remote_jid,
    lead_confidence: Number(row.lead_confidence) || 0,
    lead_intent: row.lead_intent || 'information',
    lead_temperature: row.lead_temperature || 'cold',
    name: row.name || 'Unknown',
    next_action: row.next_action || 'educate',
    notes: row.notes || '',
    phone: resolvedPhone,
    lid: rawLid,
    session_id: row.session_id,
    status: row.status || 'open',
    summary: row.summary || 'Conversa iniciada sem resumo disponível.',
    tags: Array.isArray(row.tags) ? row.tags : [],
    unreadCount: Number(row.unread_count) || 0,
    updatedAt: row.updated_at,
    lastMessageAt: row.updated_at,
    isBlocked: !!row.is_blocked,
  };
}

function getBaseSelect() {
  return `
    SELECT
      conv.id,
      conv.company_id,
      conv.lead_id,
      conv.remote_jid,
      conv.session_id,
      conv.status,
      conv.lead_temperature,
      conv.funnel_stage,
      conv.agent_name,
      conv.tags,
      conv.summary,
      conv.last_message,
      conv.last_message_type,
      conv.ai_enabled,
      conv.lead_intent,
      conv.lead_confidence,
      conv.next_action,
      conv.notes,
      conv.ai_reactivate_at,
      conv.unread_count,
      conv.created_at,
      conv.updated_at,
      l.phone,
      COALESCE(NULLIF(l.name, ''), 'Contato') as name,
      l.is_blocked
    FROM conversations conv
    INNER JOIN leads l ON l.id = conv.lead_id
  `;
}

async function createConversation({
  aiEnabled = true,
  companyId,
  contactId,
  remote_jid,
  lastMessage = '',
  lastMessageType = 'text',
  assignedAgent = null,
  funnelStage = 'new_lead',
  leadConfidence = 0,
  leadIntent = 'information',
  leadTemperature = 'cold',
  nextAction = 'educate',
  sessionId = 'main',
  status = 'open',
  summary = 'Conversa iniciada sem resumo disponível.',
  tags = [],
  unreadCount = 0,
}) {
  let resolvedJid = remote_jid;
  if (!resolvedJid) {
    const contactResult = await query(
      'SELECT phone FROM leads WHERE id = $1 LIMIT 1',
      [contactId]
    );
    if (contactResult.rows[0]?.phone) {
      const { normalizeWhatsappJid } = require('../../../services/whatsapp/shared/identifiers');
      resolvedJid = normalizeWhatsappJid(contactResult.rows[0].phone);
    } else {
      resolvedJid = `unknown_lead_${contactId}@s.whatsapp.net`;
    }
  }

  const result = await query(
    `
      INSERT INTO conversations (
        company_id,
        lead_id,
        remote_jid,
        session_id,
        status,
        lead_temperature,
        funnel_stage,
        agent_name,
        tags,
        summary,
        last_message,
        last_message_type,
        ai_enabled,
        lead_intent,
        lead_confidence,
        next_action,
        unread_count,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
      ON CONFLICT (company_id, session_id, remote_jid)
      DO UPDATE SET updated_at = NOW()
      RETURNING id
    `,
    [
      getCompanyId(companyId),
      contactId,
      resolvedJid,
      sessionId,
      status,
      leadTemperature,
      funnelStage,
      assignedAgent,
      tags,
      summary,
      lastMessage,
      lastMessageType,
      aiEnabled,
      leadIntent,
      leadConfidence,
      nextAction,
      unreadCount,
    ]
  );

  invalidateConversationCache(companyId);

  const convId = result.rows[0].id;
  console.log(`[TEMP_LOG] conversation.created - CONVERSATION_ID: "${convId}", PHONE: "${resolvedJid}", REMOTE_JID: "${resolvedJid}", SESSION_ID: "${sessionId}", MESSAGE_ID: "N/A", SOURCE: "conversationRepository.createConversation"`);

  return getConversationById(convId);
}

async function getConversationById(id) {
  const result = await query(
    `${getBaseSelect()} WHERE conv.id = $1 LIMIT 1`,
    [id]
  );

  return mapConversation(result.rows[0]);
}

async function getConversationByContact(contactId, companyId, sessionId) {
  const values = [contactId, getCompanyId(companyId)];
  let whereClause = 'WHERE conv.lead_id = $1 AND conv.company_id = $2';

  if (sessionId) {
    values.push(sessionId);
    whereClause += ` AND conv.session_id = $${values.length}`;
  }

  const result = await query(
    `${getBaseSelect()} ${whereClause} ORDER BY conv.updated_at DESC LIMIT 1`,
    values
  );

  return mapConversation(result.rows[0]);
}

async function getConversationByPhone(phone, companyId, sessionId) {
  const { getPhoneAliases } = require('../../../services/whatsapp/shared/identifiers');
  const aliases = getPhoneAliases(phone);
  const values = [aliases, getCompanyId(companyId)];
  let whereClause = 'WHERE l.phone = ANY($1::text[]) AND conv.company_id = $2';

  if (sessionId) {
    values.push(sessionId);
    whereClause += ` AND conv.session_id = $${values.length}`;
  }

  const result = await query(
    `${getBaseSelect()} ${whereClause} ORDER BY conv.updated_at DESC LIMIT 1`,
    values
  );

  return mapConversation(result.rows[0]);
}

async function findByPhone(phone, companyId, sessionId) {
  return getConversationByPhone(phone, companyId, sessionId);
}

async function findOrCreateConversationByPhone({
  companyId,
  contactName,
  lastMessage = '',
  lastMessageType = 'text',
  phone,
  sessionId,
  aiEnabled = true,
}) {
  const { normalizePhone } = require('../../../services/whatsapp/shared/identifiers');
  const normalizedPhone = normalizePhone(phone);

  let conversation = await getConversationByPhone(normalizedPhone, companyId, sessionId);

  if (conversation) {
    return conversation;
  }

  let contact = await contactRepository.findContactByPhone(normalizedPhone, companyId);

  if (!contact) {
    contact = await contactRepository.createContact({
      companyId,
      name: contactName || normalizedPhone,
      phone: normalizedPhone,
    });
  }

  conversation = await createConversation({
    aiEnabled,
    companyId,
    contactId: contact.id,
    lastMessage,
    lastMessageType,
    sessionId: sessionId || 'main',
  });

  return conversation;
}

async function create({
  companyId,
  contactName,
  lastMessage = '',
  lastMessageType = 'text',
  phone,
  sessionId,
}) {
  return findOrCreateConversationByPhone({
    companyId,
    contactName,
    lastMessage,
    lastMessageType,
    phone,
    sessionId,
  });
}

async function updateConversationSummary(conversationId, summary) {
  const result = await query(
    `
      UPDATE conversations
      SET summary = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id
    `,
    [summary, conversationId]
  );

  if (!result.rows[0]) {
    return null;
  }

  const updatedConversation = await getConversationById(result.rows[0].id);
  invalidateConversationCache(updatedConversation.company_id);

  return updatedConversation;
}

async function updateLeadTemperature(conversationId, leadTemperature) {
  const result = await query(
    `
      UPDATE conversations
      SET lead_temperature = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id
    `,
    [leadTemperature, conversationId]
  );

  if (!result.rows[0]) {
    return null;
  }

  const updatedConversation = await getConversationById(result.rows[0].id);
  invalidateConversationCache(updatedConversation.company_id);

  return updatedConversation;
}

async function updateConversationState(conversationId, fields = {}) {
  const mapping = {
    aiEnabled: 'ai_enabled',
    ai_reactivate_at: 'ai_reactivate_at',
    agent_name: 'agent_name',
    funnel_stage: 'funnel_stage',
    lastMessage: 'last_message',
    lastMessageType: 'last_message_type',
    lead_confidence: 'lead_confidence',
    lead_intent: 'lead_intent',
    lead_temperature: 'lead_temperature',
    next_action: 'next_action',
    notes: 'notes',
    session_id: 'session_id',
    status: 'status',
    summary: 'summary',
    tags: 'tags',
    unreadCount: 'unread_count',
    updatedAt: 'updated_at',
  };

  const updates = [];
  const values = [];

  for (const [key, column] of Object.entries(mapping)) {
    if (typeof fields[key] === 'undefined') {
      continue;
    }

    values.push(fields[key]);
    updates.push(`${column} = $${values.length}`);
  }

  if (!updates.find((entry) => entry.startsWith('updated_at'))) {
    updates.push('updated_at = NOW()');
  }

  if (!updates.length) {
    return getConversationById(conversationId);
  }

  values.push(conversationId);

  const result = await query(
    `
      UPDATE conversations
      SET ${updates.join(', ')}
      WHERE id = $${values.length}
      RETURNING id
    `,
    values
  );

  if (!result.rows[0]) {
    return null;
  }

  const updatedConversation = await getConversationById(result.rows[0].id);
  invalidateConversationCache(updatedConversation.company_id);

  console.log(`[TEMP_LOG] conversation.updated - CONVERSATION_ID: "${updatedConversation.id}", PHONE: "${updatedConversation.phone || ''}", REMOTE_JID: "${updatedConversation.remoteJid || updatedConversation.remote_jid || ''}", SESSION_ID: "${updatedConversation.sessionId || updatedConversation.session_id || ''}", MESSAGE_ID: "N/A", SOURCE: "conversationRepository.updateConversationState"`);

  return updatedConversation;
}

async function updateConversationAIEnabled(phone, aiEnabled, companyId) {
  const result = await query(
    `
      UPDATE conversations conv
      SET ai_enabled = $1, updated_at = NOW()
      FROM leads l
      WHERE conv.lead_id = l.id
        AND l.phone = $2
        AND conv.company_id = $3
      RETURNING conv.id
    `,
    [aiEnabled, phone, getCompanyId(companyId)]
  );

  if (!result.rows[0]) {
    return null;
  }

  const updatedConversation = await getConversationById(result.rows[0].id);
  invalidateConversationCache(updatedConversation.company_id);

  return updatedConversation;
}

async function updateConversationAfterMessage(conversationId, content, type = 'text') {
  const result = await query(
    `
      UPDATE conversations
      SET last_message = $1,
          last_message_type = $2,
          updated_at = NOW()
      WHERE id = $3
      RETURNING id
    `,
    [content || '', type || 'text', conversationId]
  );

  if (!result.rows[0]) {
    return null;
  }

  const updatedConversation = await getConversationById(result.rows[0].id);

  if (updatedConversation) {
    invalidateConversationCache(updatedConversation.company_id);
  }

  return updatedConversation;
}

async function listConversations(companyId, limit = 50, options = {}) {
  const requestedSessionId = options?.sessionId ? String(options.sessionId).trim() : '';
  const requireMessages = options?.requireMessages === true;
  const cacheKey = `${getCacheKey(companyId, limit, requestedSessionId || null)}:${requireMessages ? 'with-messages' : 'all'}`;

  if (options.useCache !== false) {
    const cached = readCache(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const values = [getCompanyId(companyId)];
  let whereClause = 'WHERE conv.company_id = $1';

  if (requestedSessionId) {
    values.push(requestedSessionId);
    whereClause += ` AND conv.session_id = $${values.length}`;
  }


  if (requireMessages) {
    whereClause += ' AND EXISTS (SELECT 1 FROM messages msg WHERE msg.conversation_id = conv.id)';
  }
  values.push(limit);

  const result = await query(
    `
      SELECT *
      FROM (
        SELECT DISTINCT ON (conv.company_id, conv.lead_id, COALESCE(NULLIF(conv.session_id, ''), 'main'))
          conv.id,
          conv.company_id,
          conv.lead_id,
          conv.session_id,
          conv.remote_jid,
          conv.status,
          conv.lead_temperature,
          conv.funnel_stage,
          conv.agent_name,
          conv.tags,
          conv.summary,
          conv.last_message,
          conv.last_message_type,
          conv.ai_enabled,
          conv.lead_intent,
          conv.lead_confidence,
          conv.next_action,
          conv.notes,
          conv.unread_count,
          conv.created_at,
          conv.updated_at,
          l.phone,
          COALESCE(NULLIF(l.name, ''), 'Contato') as name,
          l.is_blocked
        FROM conversations conv
        INNER JOIN leads l ON l.id = conv.lead_id
        ${whereClause}
        ORDER BY
          conv.company_id,
          conv.lead_id,
          COALESCE(NULLIF(conv.session_id, ''), 'main'),
          conv.updated_at DESC,
          conv.id DESC
      ) deduplicated
      ORDER BY updated_at DESC
      LIMIT $${values.length}
    `,
    values
  );

  const conversations = result.rows.map(mapConversation);
  writeCache(cacheKey, conversations);

  // Return a copy so later mutations by the caller don't pollute the cache.
  return conversations.slice();
}

async function deleteConversation(conversationId) {
  const result = await query('DELETE FROM conversations WHERE id = $1 RETURNING company_id', [conversationId]);
  await query('DELETE FROM messages WHERE conversation_id = $1', [conversationId]);

  if (result.rows[0]) {
    invalidateConversationCache(result.rows[0].company_id);
    return true;
  }
  return false;
}

module.exports = {
  create,
  createConversation,
  deleteConversation,
  findByPhone,
  findOrCreateConversationByPhone,
  getConversationByContact,
  getConversationById,
  getConversationByPhone,
  invalidateConversationCache,
  listConversations,
  updateConversationAfterMessage,
  updateConversationAIEnabled,
  updateConversationState,
  updateConversationSummary,
  updateLeadTemperature,
};
