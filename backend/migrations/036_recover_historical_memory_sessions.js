module.exports = {
  version: '036_recover_historical_memory_sessions',
  description: 'Preserve proven historical message scopes for durable memory projection',
  up: async client => {
    await client.query(`
      WITH proven_scopes AS (
        SELECT m.session_id, MIN(m.company_id) AS company_id
        FROM messages m
        JOIN conversations c ON c.id = m.conversation_id
          AND c.company_id = m.company_id AND c.session_id = m.session_id
        WHERE m.company_id IS NOT NULL AND m.session_id IS NOT NULL AND m.session_id <> ''
        GROUP BY m.session_id
        HAVING COUNT(DISTINCT m.company_id) = 1
      )
      INSERT INTO sessions (company_id, session_id, session_name, status)
      SELECT p.company_id, p.session_id, p.session_id, 'archived'
      FROM proven_scopes p
      WHERE NOT EXISTS (SELECT 1 FROM sessions s WHERE s.session_id = p.session_id)
      ON CONFLICT DO NOTHING;

      CREATE INDEX IF NOT EXISTS messages_memory_pending_order
        ON messages (company_id, session_id, timestamp, id)
        WHERE memory_projected = FALSE;
    `);
  },
};
