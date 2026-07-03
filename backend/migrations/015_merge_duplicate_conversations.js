module.exports = {
  version: '015_merge_duplicate_conversations',
  description: 'Merge duplicate conversations and enforce one conversation per lead and session',
  up: async (client) => {
    await client.query(`
      UPDATE conversations
      SET session_id = 'main'
      WHERE session_id IS NULL OR BTRIM(session_id) = ''
    `);

    await client.query(`
      CREATE TEMP TABLE duplicate_conversation_map ON COMMIT DROP AS
      WITH ranked AS (
        SELECT
          id,
          FIRST_VALUE(id) OVER (
            PARTITION BY company_id, lead_id, session_id
            ORDER BY updated_at DESC NULLS LAST, id DESC
          ) AS keeper_id,
          ROW_NUMBER() OVER (
            PARTITION BY company_id, lead_id, session_id
            ORDER BY updated_at DESC NULLS LAST, id DESC
          ) AS row_number
        FROM conversations
      )
      SELECT id AS duplicate_id, keeper_id
      FROM ranked
      WHERE row_number > 1
    `);

    await client.query(`
      WITH totals AS (
        SELECT
          COALESCE(map.keeper_id, conversation.id) AS keeper_id,
          MIN(conversation.created_at) AS created_at,
          SUM(COALESCE(conversation.unread_count, 0)) AS unread_count,
          (ARRAY_AGG(NULLIF(conversation.notes, '') ORDER BY LENGTH(COALESCE(conversation.notes, '')) DESC))[1] AS notes
        FROM conversations conversation
        LEFT JOIN duplicate_conversation_map map ON map.duplicate_id = conversation.id
        GROUP BY COALESCE(map.keeper_id, conversation.id)
      )
      UPDATE conversations keeper
      SET
        created_at = totals.created_at,
        unread_count = totals.unread_count,
        notes = COALESCE(totals.notes, keeper.notes, '')
      FROM totals
      WHERE keeper.id = totals.keeper_id
    `);

    await client.query(`
      UPDATE messages message
      SET conversation_id = map.keeper_id
      FROM duplicate_conversation_map map
      WHERE message.conversation_id = map.duplicate_id
    `);

    await client.query(`
      DO $$
      BEGIN
        IF to_regclass('public.flow_executions') IS NOT NULL THEN
          UPDATE flow_executions execution
          SET conversation_id = map.keeper_id
          FROM duplicate_conversation_map map
          WHERE execution.conversation_id = map.duplicate_id;
        END IF;
      END $$;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF to_regclass('public.conversation_runtime_states') IS NOT NULL THEN
          DELETE FROM conversation_runtime_states duplicate_state
          USING duplicate_conversation_map map
          WHERE duplicate_state.conversation_id = map.duplicate_id
            AND EXISTS (
              SELECT 1
              FROM conversation_runtime_states keeper_state
              WHERE keeper_state.conversation_id = map.keeper_id
            );

          UPDATE conversation_runtime_states runtime_state
          SET conversation_id = map.keeper_id
          FROM duplicate_conversation_map map
          WHERE runtime_state.conversation_id = map.duplicate_id;
        END IF;
      END $$;
    `);

    await client.query(`
      UPDATE ai_logs log
      SET conversation_id = map.keeper_id::text
      FROM duplicate_conversation_map map
      WHERE log.conversation_id = map.duplicate_id::text
    `);

    await client.query(`
      DELETE FROM conversations duplicate
      USING duplicate_conversation_map map
      WHERE duplicate.id = map.duplicate_id
    `);

    await client.query(`
      ALTER TABLE conversations
      ALTER COLUMN session_id SET DEFAULT 'main',
      ALTER COLUMN session_id SET NOT NULL
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_conversations_company_lead_session
      ON conversations(company_id, lead_id, session_id)
    `);
  },
};
