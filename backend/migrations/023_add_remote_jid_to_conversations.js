const { normalizeWhatsappJid } = require('../services/whatsapp/shared/identifiers');

module.exports = {
  version: '023_add_remote_jid_to_conversations',
  description: 'Add remote_jid column, populate from leads, merge duplicates, and enforce uniqueness of (company_id, session_id, remote_jid)',
  up: async (client) => {
    // 1. Add remote_jid column if not exists
    await client.query(`
      ALTER TABLE conversations ADD COLUMN IF NOT EXISTS remote_jid VARCHAR(255);
    `);

    // 2. Fetch all current conversations with their lead phones to populate remote_jid
    const res = await client.query(`
      SELECT c.id, l.phone 
      FROM conversations c
      JOIN leads l ON c.lead_id = l.id
    `);

    console.log(`[MIGRATION 023] Populating remote_jid for ${res.rows.length} conversations...`);

    for (const row of res.rows) {
      if (row.phone) {
        try {
          const jid = normalizeWhatsappJid(row.phone);
          await client.query(
            `UPDATE conversations SET remote_jid = $1 WHERE id = $2`,
            [jid, row.id]
          );
        } catch (err) {
          console.error(`[MIGRATION 023] Error normalizing phone ${row.phone} for conv ${row.id}:`, err.message);
        }
      }
    }

    // 3. Fallback for any conversations with NULL remote_jid
    await client.query(`
      UPDATE conversations 
      SET remote_jid = 'unknown_lead_' || lead_id || '@s.whatsapp.net' 
      WHERE remote_jid IS NULL;
    `);

    // 4. Find and merge duplicates of (company_id, session_id, remote_jid)
    console.log('[MIGRATION 023] Finding duplicate conversations by (company_id, session_id, remote_jid)...');
    
    await client.query(`
      CREATE TEMP TABLE duplicate_conversation_map ON COMMIT DROP AS
      WITH ranked AS (
        SELECT
          id,
          FIRST_VALUE(id) OVER (
            PARTITION BY company_id, session_id, remote_jid
            ORDER BY updated_at DESC NULLS LAST, id DESC
          ) AS keeper_id,
          ROW_NUMBER() OVER (
            PARTITION BY company_id, session_id, remote_jid
            ORDER BY updated_at DESC NULLS LAST, id DESC
          ) AS row_number
        FROM conversations
      )
      SELECT id AS duplicate_id, keeper_id
      FROM ranked
      WHERE row_number > 1
    `);

    const dupCountRes = await client.query(`SELECT COUNT(*) as count FROM duplicate_conversation_map`);
    console.log(`[MIGRATION 023] Merging ${dupCountRes.rows[0].count} duplicate conversations...`);

    // 5. Update messages
    await client.query(`
      UPDATE messages message
      SET conversation_id = map.keeper_id
      FROM duplicate_conversation_map map
      WHERE message.conversation_id = map.duplicate_id
    `);

    // 6. Update flow executions
    await client.query(`
      UPDATE flow_executions execution
      SET conversation_id = map.keeper_id
      FROM duplicate_conversation_map map
      WHERE execution.conversation_id = map.duplicate_id
    `);

    // 7. Update conversation runtime states (delete duplicates if keeper has one)
    await client.query(`
      DELETE FROM conversation_runtime_states duplicate_state
      USING duplicate_conversation_map map
      WHERE duplicate_state.conversation_id = map.duplicate_id
        AND EXISTS (
          SELECT 1
          FROM conversation_runtime_states keeper_state
          WHERE keeper_state.conversation_id = map.keeper_id
        )
    `);

    await client.query(`
      UPDATE conversation_runtime_states runtime_state
      SET conversation_id = map.keeper_id
      FROM duplicate_conversation_map map
      WHERE runtime_state.conversation_id = map.duplicate_id
    `);

    // 8. Update AI logs
    await client.query(`
      UPDATE ai_logs log
      SET conversation_id = map.keeper_id::text
      FROM duplicate_conversation_map map
      WHERE log.conversation_id = map.duplicate_id::text
    `);

    // 9. Delete duplicate conversations
    await client.query(`
      DELETE FROM conversations duplicate
      USING duplicate_conversation_map map
      WHERE duplicate.id = map.duplicate_id
    `);

    // 10. Drop old constraint/index if exist
    await client.query(`
      ALTER TABLE conversations DROP CONSTRAINT IF EXISTS uq_conversations_company_lead_session;
    `);
    await client.query(`
      DROP INDEX IF EXISTS uq_conversations_company_lead_session;
    `);

    // 11. Make remote_jid NOT NULL
    await client.query(`
      ALTER TABLE conversations ALTER COLUMN remote_jid SET NOT NULL;
    `);

    // 12. Create unique constraint on (company_id, session_id, remote_jid)
    await client.query(`
      ALTER TABLE conversations ADD CONSTRAINT uq_conversations_company_session_remote_jid UNIQUE (company_id, session_id, remote_jid);
    `);

    console.log('[MIGRATION 023] Completed successfully');
  },
};
