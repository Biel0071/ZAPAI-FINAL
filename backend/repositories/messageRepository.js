const db = require('../config/database');
const { extractEmojis } = require('../services/messageEmoji');

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
    fileName: parsedMetadata.fileName || null,
    mediaPath: row.media_path || row.media_url,
    mediaType:
      (row.media_type || row.type) && (row.media_type || row.type) !== 'text'
        ? row.media_type || row.type
        : null,
    mimeType: parsedMetadata.mimeType || null,
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
  };
  const hasMetadata = Boolean(metadata.fileName || metadata.mimeType || metadata.size);
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
      created_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
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
  ];

  const result = await db.query(query, values);

  return mapMessage(result.rows[0]);
}

async function create({
  companyId,
  content = '',
  conversationId,
  createdAt,
  fromMe = false,
  mediaPath = null,
  messageType = 'text',
  phone = null,
  sessionId,
  status = 'received',
  timestamp,
}) {
  return createMessage({
    companyId,
    conversationId,
    createdAt,
    fromMe,
    mediaPath,
    mediaType: messageType || 'text',
    phone,
    sessionId,
    status,
    timestamp,
    text: content,
  });
}

async function getMessagesByConversation(conversationId) {
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
             m.from_me
      FROM messages m
      INNER JOIN conversations conv ON conv.id = m.conversation_id
      INNER JOIN leads l ON l.id = conv.lead_id
      WHERE m.conversation_id = $1
      ORDER BY m.timestamp ASC, m.id ASC
    `,
    [conversationId]
  );

  return result.rows.map(mapMessage);
}

async function findByConversationId(conversationId) {
  return getMessagesByConversation(conversationId);
}

async function getMessagesByPhone(phone, companyId, sessionId) {
  const values = [phone, companyId || process.env.DEFAULT_COMPANY_ID || 'default'];
  let whereClause = 'WHERE l.phone = $1 AND conv.company_id = $2';

  if (sessionId) {
    values.push(sessionId);
    whereClause += ` AND conv.session_id = $${values.length}`;
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
             l.phone,
             m.text,
             m.media_type,
             m.media_path,
             m.from_me
      FROM messages m
      INNER JOIN conversations conv ON conv.id = m.conversation_id
      INNER JOIN leads l ON l.id = conv.lead_id
      ${whereClause}
      ORDER BY m.timestamp ASC, m.id ASC
    `,
    values
  );

  return result.rows.map(mapMessage);
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
        m.from_me
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
        m.from_me
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

module.exports = {
  create,
  createMessage,
  findByConversationId,
  getLastMessage,
  getMessagesByConversation,
  getMessagesByPhone,
  listRecentMessages,
};