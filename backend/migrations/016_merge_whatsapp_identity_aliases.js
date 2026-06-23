module.exports = {
  version: '016_merge_whatsapp_identity_aliases',
  description: 'Merge WhatsApp lead aliases such as numeric and LID forms',
  up: async (client) => {
    await client.query(`
      CREATE TEMP TABLE duplicate_lead_map ON COMMIT DROP AS
      WITH normalized AS (
        SELECT
          id,
          company_id,
          CASE
            WHEN LOWER(phone) LIKE '%@g.us' THEN LOWER(phone)
            ELSE REGEXP_REPLACE(LOWER(phone), '\\D', '', 'g')
          END AS identity_key
        FROM leads
      ),
      ranked AS (
        SELECT
          id,
          identity_key,
          FIRST_VALUE(id) OVER (
            PARTITION BY company_id, identity_key
            ORDER BY
              CASE WHEN LOWER((SELECT phone FROM leads WHERE leads.id = normalized.id)) LIKE '%@lid' THEN 1 ELSE 0 END,
              id
          ) AS keeper_id,
          ROW_NUMBER() OVER (
            PARTITION BY company_id, identity_key
            ORDER BY
              CASE WHEN LOWER((SELECT phone FROM leads WHERE leads.id = normalized.id)) LIKE '%@lid' THEN 1 ELSE 0 END,
              id
          ) AS row_number
        FROM normalized
        WHERE identity_key <> ''
      )
      SELECT id AS duplicate_id, keeper_id, identity_key
      FROM ranked
      WHERE row_number > 1
    `);

    await client.query(`
      CREATE TEMP TABLE alias_conversation_map ON COMMIT DROP AS
      WITH normalized AS (
        SELECT
          conversation.id,
          conversation.company_id,
          COALESCE(lead_map.keeper_id, conversation.lead_id) AS merged_lead_id,
          conversation.session_id,
          conversation.updated_at
        FROM conversations conversation
        LEFT JOIN duplicate_lead_map lead_map ON lead_map.duplicate_id = conversation.lead_id
      ),
      ranked AS (
        SELECT
          id,
          FIRST_VALUE(id) OVER (
            PARTITION BY company_id, merged_lead_id, session_id
            ORDER BY updated_at DESC NULLS LAST, id DESC
          ) AS keeper_id,
          ROW_NUMBER() OVER (
            PARTITION BY company_id, merged_lead_id, session_id
            ORDER BY updated_at DESC NULLS LAST, id DESC
          ) AS row_number
        FROM normalized
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
        LEFT JOIN alias_conversation_map map ON map.duplicate_id = conversation.id
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
      FROM alias_conversation_map map
      WHERE message.conversation_id = map.duplicate_id
    `);

    await client.query(`
      UPDATE flow_executions execution
      SET conversation_id = map.keeper_id
      FROM alias_conversation_map map
      WHERE execution.conversation_id = map.duplicate_id
    `);

    await client.query(`
      DELETE FROM conversation_runtime_states duplicate_state
      USING alias_conversation_map map
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
      FROM alias_conversation_map map
      WHERE runtime_state.conversation_id = map.duplicate_id
    `);

    await client.query(`
      UPDATE ai_logs log
      SET conversation_id = map.keeper_id::text
      FROM alias_conversation_map map
      WHERE log.conversation_id = map.duplicate_id::text
    `);

    await client.query(`
      DELETE FROM conversations duplicate
      USING alias_conversation_map map
      WHERE duplicate.id = map.duplicate_id
    `);

    await client.query(`
      UPDATE conversations conversation
      SET lead_id = lead_map.keeper_id
      FROM duplicate_lead_map lead_map
      WHERE conversation.lead_id = lead_map.duplicate_id
    `);

    await client.query(`
      DELETE FROM leads duplicate
      USING duplicate_lead_map lead_map
      WHERE duplicate.id = lead_map.duplicate_id
    `);

    await client.query(`
      UPDATE leads keeper
      SET phone = identities.identity_key
      FROM (
        SELECT DISTINCT keeper_id, identity_key
        FROM duplicate_lead_map
      ) identities
      WHERE keeper.id = identities.keeper_id
    `);
  },
};
