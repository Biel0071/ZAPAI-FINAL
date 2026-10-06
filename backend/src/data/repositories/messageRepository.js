const db = require('../../infrastructure/config/database');
const { extractEmojis } = require('../../../services/messageEmoji');

function mapMessage(row) {
  if (!row) {
    return null;
  }

  const rawText = row.content || row.text || '';
  const metadataSplitToken = '\n[META]';
  let parsedMetadata = {};
  let cleanContent = rawText;

  if (typeof rawText === 'string' && rawText.includes(metadataSplitToken)) {
    const [baseText, metadataJson] = rawText.split(metadataSplitToken);
    cleanContent = baseText;

    try {
      parsedMetadata = JSON.parse(metadataJson || '{}');
    } catch {
      parsedMetadata = {};
    }
  }

  return {
    content: cleanContent,
    conversationId: row.conversation_id,
    createdAt: row.created_at || row.timestamp,
    direction:
      row.direction ||
      ((typeof row.from_me === 'boolean' ? row.from_me : row.fromMe) ? 'outgoing' : 'incoming'),
    emojis: extractEmojis(row.content || row.text || ''),
    from:
      row.sender ||
      ((typeof row.from_me === 'boolean' ? row.from_me : row.fromMe) ? 'agent' : 'client'),
    fromMe:
      typeof row.from_me === 'boolean'
        ? row.from_me
        : typeof row.fromMe === 'boolean'
          ? row.fromMe
          : row.sender === 'agent',
    id: row.id,
    whatsappMessageId: row.whatsapp_message_id || null,
    remoteJid: row.remote_jid || null,
    participantJid: row.participant_jid || null,
    fileName: parsedMetadata.fileName || null,
    mediaPath: row.media_path || row.media_url,
    mediaType:
      (row.media_type || row.type) && (row.media_type || row.type) !== 'text'
        ? row.media_type || row.type
        : null,
    mimeType: parsedMetadata.mimeType || null,
    hash: parsedMetadata.hash || null,
    phone: row.phone,
    sessionId: row.session_id || 'default',
    size: typeof parsedMetadata.size === 'number' ? parsedMetadata.size : null,
    status:
      row.status ||
      ((typeof row.from_me === 'boolean' ? row.from_me : row.fromMe) ? 'sent' : 'received'),
    text: cleanContent,
    timestamp: row.timestamp || row.created_at,
    type: row.media_type || row.type || 'text',
  };
}

async function createMessage(data) {
  const metadata = {
    fileName: data.fileName || null,
    mimeType: data.mimeType || null,
    size: typeof data.size === 'number' ? data.size : null,
    hash: data.hash || null,
  };
  const hasMetadata = Boolean(metadata.fileName || metadata.mimeType || metadata.size || metadata.hash);
  const safeText = data.text || '';
  const storedText = hasMetadata
    ? `${safeText}\n[META]${JSON.stringify(metadata)}`
    : safeText;

  const query = `
    INSERT INTO messages (
      company_id,
      conversation_id,
      phone,
      text,
      media_type,
      media_path,
      from_me,
      status,
      session_id,
      timestamp,
      created_at,
      sender,
      direction,
      whatsapp_message_id,
      remote_jid,
      participant_jid,
      message_origin
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
    RETURNING *
  `;

  const values = [
    data.companyId || 'default',
    data.conversationId || null,
    data.phone || null,
    storedText,
    data.mediaType || null,
    data.mediaPath || null,
    data.fromMe || false,
    data.status || (data.fromMe ? 'sent' : 'received'),
    data.sessionId || 'main',
    data.timestamp || data.createdAt || new Date(),
    data.createdAt || new Date(),
    data.sender || (data.fromMe ? 'agent' : 'client'),
    data.direction || (data.fromMe ? 'outgoing' : 'incoming'),
    data.whatsappMessageId || null,
    data.remoteJid || null,
    data.participantJid || null,
    ['human', 'ai', 'automation', 'campaign'].includes(data.origin) ? data.origin : 'unknown',
  ];

  const result = await db.query(query, values);
  const msgRow = result.rows[0];
  console.log(`[TEMP_LOG] message.created - CONVERSATION_ID: "${msgRow.conversation_id}", PHONE: "${msgRow.phone}", REMOTE_JID: "${msgRow.phone || ''}", SESSION_ID: "${msgRow.session_id}", MESSAGE_ID: "${msgRow.id}", SOURCE: "messageRepository.createMessage"`);

  return mapMessage(msgRow);
}

async function create({
  companyId,
  content = '',
  conversationId,
  createdAt,
  fileName = null,
  fromMe = false,
  mediaPath = null,
  mimeType = null,
  messageType = 'text',
  phone = null,
  sessionId,
  size = null,
  status = 'received',
  timestamp,
  hash = null,
  sender,
  direction,
  whatsappMessageId = null,
  remoteJid = null,
  participantJid = null,
  origin = 'unknown',
}) {
  return createMessage({
    companyId,
    conversationId,
    createdAt,
    fileName,
    fromMe,
    mediaPath,
    mediaType: messageType || 'text',
    mimeType,
    phone,
    sessionId,
    size,
    status,
    timestamp,
    text: content,
    hash,
    sender,
    direction,
    whatsappMessageId,
    remoteJid,
    participantJid,
    origin,
  });
}

async function getMessagesByConversation(conversationId, options = {}) {
  const limit = Math.max(1, Math.min(Number(options.limit) || 100, 200));
  const before = options.before ? new Date(String(options.before)) : null;
  const beforeId = /^\d+$/.test(String(options.beforeId || '')) ? Number(options.beforeId) : null;
  const companyId = options.companyId || process.env.DEFAULT_COMPANY_ID || 'default';
  const isNumeric = /^\d+$/.test(String(conversationId || ''));

  // 1. Resolve conversation metadata (lead_id, remote_jid, phone, session_id)
  let targetConv = null;
  if (isNumeric) {
    try {
      const convRes = await db.query(
        `SELECT conv.id, conv.lead_id, conv.remote_jid, conv.session_id, l.phone
         FROM conversations conv
         LEFT JOIN leads l ON l.id = conv.lead_id
         WHERE conv.id = $1 AND conv.company_id = $2
         LIMIT 1`,
        [Number(conversationId), companyId]
      );
      targetConv = convRes.rows[0] || null;
    } catch (_) {}
  }

  const { getPhoneAliases } = require('../../../services/whatsapp/shared/identifiers');

  if (!targetConv) {
    try {
      const cleanId = String(conversationId || '').replace(/^chat-/, '').trim();
      const lookupAliases = getPhoneAliases(cleanId);
      const convRes = await db.query(
        `SELECT conv.id, conv.lead_id, conv.remote_jid, conv.session_id, l.phone
         FROM conversations conv
         LEFT JOIN leads l ON l.id = conv.lead_id
         WHERE conv.company_id = $1
           AND (conv.remote_jid = $2 OR l.phone = ANY($3::text[]) OR conv.remote_jid = ANY($3::text[]))
         ORDER BY conv.updated_at DESC
         LIMIT 1`,
        [companyId, cleanId, lookupAliases]
      );
      targetConv = convRes.rows[0] || null;
    } catch (_) {}
  }

  const resolvedConvId = targetConv?.id || (isNumeric ? Number(conversationId) : null);
  const contactPhone = targetConv?.phone || (!isNumeric ? String(conversationId || '').replace(/^chat-/, '').trim() : '');
  const aliases = contactPhone ? getPhoneAliases(contactPhone) : [];
  const jidCandidates = new Set();
  if (targetConv?.remote_jid) jidCandidates.add(targetConv.remote_jid);
  for (const a of aliases) {
    jidCandidates.add(a);
    if (!a.includes('@')) {
      jidCandidates.add(`${a}@s.whatsapp.net`);
    }
  }
  if (!contactPhone && targetConv?.remote_jid) {
    const digits = targetConv.remote_jid.replace(/\D/g, '');
    if (digits.length >= 8) {
      for (const a of getPhoneAliases(digits)) {
        jidCandidates.add(a);
        if (!a.includes('@')) jidCandidates.add(`${a}@s.whatsapp.net`);
      }
    }
  }
  const jidList = Array.from(jidCandidates);

  const values = [companyId];
  const conditions = [];

  if (resolvedConvId) {
    values.push(resolvedConvId);
    conditions.push(`m.conversation_id = $${values.length}`);
  }
  if (targetConv?.lead_id) {
    values.push(targetConv.lead_id);
    conditions.push(`conv.lead_id = $${values.length}`);
  }
  if (jidList.length > 0) {
    values.push(jidList);
    conditions.push(`m.remote_jid = ANY($${values.length}::text[])`);
  }
  if (aliases.length > 0) {
    values.push(aliases);
    conditions.push(`(m.phone = ANY($${values.length}::text[]) OR l.phone = ANY($${values.length}::text[]))`);
  }

  const matchClause = conditions.length > 0 ? `(${conditions.join(' OR ')})` : (resolvedConvId ? `m.conversation_id = ${resolvedConvId}` : '1=0');

  let beforeClause = '';
  if (before && !Number.isNaN(before.getTime())) {
    values.push(before.toISOString());
    const beforeIdx = values.length;
    if (beforeId) {
      values.push(beforeId);
      const beforeIdIdx = values.length;
      beforeClause = ` AND (m.timestamp,m.id) < ($${beforeIdx}::timestamp,$${beforeIdIdx}::integer)`;
    } else {
      beforeClause = ` AND m.timestamp < ($${beforeIdx}::timestamp)`;
    }
  }

  values.push(limit);
  const limitIdx = values.length;

  const result = await db.query(
    `
      SELECT * FROM (
        SELECT m.id,
               COALESCE(m.conversation_id, ${resolvedConvId || 'conv.id'}) AS conversation_id,
               COALESCE(m.sender, CASE WHEN m.from_me THEN 'agent' ELSE 'client' END) AS sender,
               COALESCE(m.media_type, m.type, 'text') AS type,
               COALESCE(m.content, m.text, '') AS content,
               COALESCE(m.media_path, m.media_url) AS media_url,
             COALESCE(m.timestamp, m.created_at) AS timestamp,
               COALESCE(m.status, CASE WHEN m.from_me THEN 'sent' ELSE 'received' END) AS status,
               m.created_at,
               COALESCE(m.session_id, conv.session_id, ${targetConv?.session_id ? `'${targetConv.session_id}'` : 'NULL'}) AS session_id,
               COALESCE(l.phone, m.phone, ${targetConv?.phone ? `'${targetConv.phone}'` : 'NULL'}) AS phone,
               m.text,
               m.media_type,
               m.media_path,
               m.from_me,
               m.whatsapp_message_id,
               m.remote_jid,
               m.participant_jid
        FROM messages m
        LEFT JOIN conversations conv ON conv.id = m.conversation_id
        LEFT JOIN leads l ON l.id = conv.lead_id
        WHERE m.company_id = $1
          AND ${matchClause}
        ${beforeClause}
        ORDER BY m.timestamp DESC, m.id DESC
        LIMIT $${limitIdx}
      ) recent
      ORDER BY recent.timestamp ASC, recent.id ASC
    `,
    values
  );

  const seen = new Set();
  const deduplicated = [];
  for (const row of result.rows) {
    const key = row.whatsapp_message_id || `id-${row.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(row);
    }
  }

  return deduplicated.map(mapMessage);
}

async function findByConversationId(conversationId, companyId) {
  return getMessagesByConversation(conversationId, { companyId });
}

async function getMessagesByPhone(phone, companyId, sessionId) {
  const { getPhoneAliases } = require('../../../services/whatsapp/shared/identifiers');
  const cleanPhone = String(phone || '').replace(/^chat-/, '').trim();
  const aliases = getPhoneAliases(cleanPhone);
  const compId = companyId || process.env.DEFAULT_COMPANY_ID || 'default';
  const jidCandidates = new Set(aliases);
  for (const a of aliases) {
    if (!a.includes('@')) {
      jidCandidates.add(`${a}@s.whatsapp.net`);
    }
  }
  const jidList = Array.from(jidCandidates);

  const values = [compId, aliases, jidList];
  let sessionClause = '';
  if (sessionId) {
    values.push(sessionId);
    sessionClause = ` AND (m.session_id = $${values.length} OR conv.session_id = $${values.length} OR m.session_id IS NULL)`;
  }

  const result = await db.query(
    `
      SELECT m.id,
             m.conversation_id,
             COALESCE(m.sender, CASE WHEN m.from_me THEN 'agent' ELSE 'client' END) AS sender,
             COALESCE(m.media_type, m.type, 'text') AS type,
             COALESCE(m.content, m.text, '') AS content,
             COALESCE(m.media_path, m.media_url) AS media_url,
               COALESCE(m.timestamp, m.created_at) AS timestamp,
             COALESCE(m.status, CASE WHEN m.from_me THEN 'sent' ELSE 'received' END) AS status,
             m.created_at,
             COALESCE(m.session_id, conv.session_id) AS session_id,
             COALESCE(l.phone, m.phone) AS phone,
             m.text,
             m.media_type,
             m.media_path,
             m.from_me,
             m.whatsapp_message_id,
             m.remote_jid,
             m.participant_jid
      FROM messages m
      LEFT JOIN conversations conv ON conv.id = m.conversation_id
      LEFT JOIN leads l ON l.id = conv.lead_id
      WHERE m.company_id = $1
        AND (l.phone = ANY($2::text[]) OR m.phone = ANY($2::text[]) OR m.remote_jid = ANY($3::text[]))
        ${sessionClause}
      ORDER BY m.timestamp ASC, m.id ASC
    `,
    values
  );

  const seen = new Set();
  const deduplicated = [];
  for (const row of result.rows) {
    const key = row.whatsapp_message_id || `id-${row.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(row);
    }
  }

  return deduplicated.map(mapMessage);
}

async function getLastMessage(conversationId) {
  const result = await db.query(
    `
      SELECT m.id,
        m.conversation_id,
        COALESCE(m.sender, CASE WHEN m.from_me THEN 'agent' ELSE 'client' END) AS sender,
        COALESCE(m.media_type, m.type, 'text') AS type,
        COALESCE(m.content, m.text, '') AS content,
        COALESCE(m.media_path, m.media_url) AS media_url,
        COALESCE(m.timestamp, m.created_at) AS timestamp,
        COALESCE(m.status, CASE WHEN m.from_me THEN 'sent' ELSE 'received' END) AS status,
        m.created_at,
        COALESCE(m.session_id, conv.session_id) AS session_id,
        l.phone,
        m.text,
        m.media_type,
        m.media_path,
        m.from_me,
        m.whatsapp_message_id,
        m.remote_jid,
        m.participant_jid
      FROM messages m
      INNER JOIN conversations conv ON conv.id = m.conversation_id
      INNER JOIN leads l ON l.id = conv.lead_id
      WHERE m.conversation_id = $1
      ORDER BY m.timestamp DESC, m.id DESC
      LIMIT 1
    `,
    [conversationId]
  );

  return mapMessage(result.rows[0]);
}

async function listRecentMessages(limit = 2000, companyId) {
  const result = await db.query(
    `
      SELECT m.id,
        m.conversation_id,
        COALESCE(m.sender, CASE WHEN m.from_me THEN 'agent' ELSE 'client' END) AS sender,
        COALESCE(m.media_type, m.type, 'text') AS type,
        COALESCE(m.content, m.text, '') AS content,
        COALESCE(m.media_path, m.media_url) AS media_url,
        COALESCE(m.timestamp, m.created_at) AS timestamp,
        COALESCE(m.status, CASE WHEN m.from_me THEN 'sent' ELSE 'received' END) AS status,
        m.created_at,
        COALESCE(m.session_id, conv.session_id) AS session_id,
        l.phone,
        m.text,
        m.media_type,
        m.media_path,
        m.from_me,
        m.whatsapp_message_id,
        m.remote_jid,
        m.participant_jid
      FROM messages m
      INNER JOIN conversations conv ON conv.id = m.conversation_id
      INNER JOIN leads l ON l.id = conv.lead_id
      WHERE conv.company_id = $1
      ORDER BY m.timestamp DESC, m.id DESC
      LIMIT $2
    `,
    [companyId || process.env.DEFAULT_COMPANY_ID || 'default', limit]
  );

  return result.rows.reverse().map(mapMessage);
}

async function findById(messageId, companyId) {
  const result = await db.query(
    `
      SELECT m.id,
        m.conversation_id,
        COALESCE(m.sender, CASE WHEN m.from_me THEN 'agent' ELSE 'client' END) AS sender,
        COALESCE(m.media_type, m.type, 'text') AS type,
        COALESCE(m.content, m.text, '') AS content,
        COALESCE(m.media_path, m.media_url) AS media_url,
        COALESCE(m.timestamp, m.created_at) AS timestamp,
        COALESCE(m.status, CASE WHEN m.from_me THEN 'sent' ELSE 'received' END) AS status,
        m.created_at,
        COALESCE(m.session_id, conv.session_id) AS session_id,
        l.phone,
        m.text,
        m.media_type,
        m.media_path,
        m.from_me,
        m.whatsapp_message_id,
        m.remote_jid,
        m.participant_jid
      FROM messages m
      INNER JOIN conversations conv ON conv.id = m.conversation_id
      INNER JOIN leads l ON l.id = conv.lead_id
      WHERE m.id = $1${companyId ? ' AND m.company_id = $2 AND conv.company_id = $2' : ''}
      LIMIT 1
    `,
    companyId ? [messageId, companyId] : [messageId]
  );

  return mapMessage(result.rows[0]);
}

async function findByWhatsappMessageId(whatsappMessageId) {
  if (!whatsappMessageId) return null;
  const result = await db.query(
    `SELECT * FROM messages WHERE whatsapp_message_id = $1 ORDER BY id DESC LIMIT 1`,
    [whatsappMessageId]
  );
  return mapMessage(result.rows[0]);
}

async function deleteById(messageId, companyId) {
  const result = await db.query(
    `
      DELETE FROM messages
      WHERE id = $1${companyId ? ' AND company_id = $2' : ''}
      RETURNING id
    `,
    companyId ? [messageId, companyId] : [messageId]
  );

  return Boolean(result.rows[0]);
}

module.exports = {
  create,
  createMessage,
  deleteById,
  findByConversationId,
  findById,
  findByWhatsappMessageId,
  getLastMessage,
  getMessagesByConversation,
  getMessagesByPhone,
  listRecentMessages,
};
