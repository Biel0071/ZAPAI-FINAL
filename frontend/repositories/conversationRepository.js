import pool from "../backend/config/database.js";

export async function createConversation({
  companyId,
  contactId,
  sessionId = null,
  status = "open",
  leadTemperature = "warm",
  summary = null,
  lastMessage = null,
}) {
  const { rows } = await pool.query(
    `
      INSERT INTO conversations (
        company_id, contact_id, session_id, status, lead_temperature, summary, last_message
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, company_id, contact_id, session_id, status, lead_temperature, ai_enabled, summary, last_message, unread_count, created_at, updated_at
    `,
    [companyId, contactId, sessionId, status, leadTemperature, summary, lastMessage],
  );

  return rows[0];
}

export async function getConversations({ companyId, limit = 20 }) {
  const { rows } = await pool.query(
    `
      SELECT c.id,
             c.company_id,
             c.contact_id,
             c.session_id,
             c.status,
             c.lead_temperature,
             c.ai_enabled,
             c.summary,
             c.last_message,
             c.unread_count,
             c.created_at,
             c.updated_at,
             ct.name,
             ct.phone
      FROM conversations c
      JOIN contacts ct ON ct.id = c.contact_id
      WHERE c.company_id = $1
      ORDER BY c.updated_at DESC
      LIMIT $2
    `,
    [companyId, limit],
  );

  return rows;
}

export async function updateConversationSummary({ conversationId, summary }) {
  const { rows } = await pool.query(
    `
      UPDATE conversations
      SET summary = $2,
          updated_at = now()
      WHERE id = $1
      RETURNING id, summary, updated_at
    `,
    [conversationId, summary],
  );

  return rows[0] ?? null;
}

export async function updateConversationAI({ conversationId, aiEnabled }) {
  const { rows } = await pool.query(
    `
      UPDATE conversations
      SET ai_enabled = $2,
          updated_at = now()
      WHERE id = $1
      RETURNING id, ai_enabled, updated_at
    `,
    [conversationId, aiEnabled],
  );

  return rows[0] ?? null;
}

export async function touchConversationAfterMessage({ conversationId, lastMessage, incrementUnread }) {
  const { rows } = await pool.query(
    `
      UPDATE conversations
      SET last_message = $2,
          unread_count = unread_count + $3,
          updated_at = now()
      WHERE id = $1
      RETURNING id, last_message, unread_count, updated_at
    `,
    [conversationId, lastMessage, incrementUnread],
  );

  return rows[0] ?? null;
}
