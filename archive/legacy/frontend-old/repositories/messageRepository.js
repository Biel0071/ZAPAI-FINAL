import pool from "../backend/config/database.js";

export async function createMessage({
  conversationId,
  sender,
  type = "text",
  content = "",
  mediaUrl = null,
  mediaPath = null,
  emoji = null,
  status = "sent",
}) {
  const { rows } = await pool.query(
    `
      INSERT INTO messages (conversation_id, sender, type, content, media_url, media_path, emoji, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, conversation_id, sender, type, content, media_url, media_path, emoji, timestamp, status
    `,
    [conversationId, sender, type, content, mediaUrl, mediaPath, emoji, status],
  );

  return rows[0];
}

export async function getConversationMessages({ conversationId, limit = 50, before = null }) {
  const query = before
    ? `
      SELECT id, conversation_id, sender, type, content, media_url, media_path, emoji, timestamp, status
      FROM messages
      WHERE conversation_id = $1
        AND timestamp < $2::timestamptz
      ORDER BY timestamp DESC
      LIMIT $3
    `
    : `
      SELECT id, conversation_id, sender, type, content, media_url, media_path, emoji, timestamp, status
      FROM messages
      WHERE conversation_id = $1
      ORDER BY timestamp DESC
      LIMIT $2
    `;

  const params = before ? [conversationId, before, limit] : [conversationId, limit];
  const { rows } = await pool.query(query, params);

  return rows.reverse();
}
