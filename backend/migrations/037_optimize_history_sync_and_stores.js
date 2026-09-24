module.exports = {
  version: '037_optimize_history_sync_and_stores',
  description: 'Add pending history index on messages, backfill history_item_id, and extend ai_stores with white-label parameters',
  async up(client) {
    // 1. Indice parcial de mensagens aguardando importação de histórico
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_history_pending 
      ON messages(company_id, session_id, id) 
      WHERE history_item_id IS NULL;
    `);

    // 2. Backfill de history_item_id para mensagens que já constam em whatsapp_history_items
    await client.query(`
      UPDATE messages m
      SET history_item_id = h.id
      FROM whatsapp_history_items h
      WHERE h.company_id = m.company_id 
        AND h.session_id = m.session_id 
        AND h.message_id = m.id
        AND m.history_item_id IS NULL;
    `);

    // 3. Índice em message_key para whatsapp_history_items
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_history_items_msg_key 
      ON whatsapp_history_items(company_id, session_id, message_key);
    `);

    // 4. Extensão da tabela ai_stores com campos white-label da loja
    await client.query(`
      ALTER TABLE ai_stores ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';
      ALTER TABLE ai_stores ADD COLUMN IF NOT EXISTS website TEXT NOT NULL DEFAULT '';
      ALTER TABLE ai_stores ADD COLUMN IF NOT EXISTS business_hours TEXT NOT NULL DEFAULT '';
      ALTER TABLE ai_stores ADD COLUMN IF NOT EXISTS policies TEXT NOT NULL DEFAULT '';
      ALTER TABLE ai_stores ADD COLUMN IF NOT EXISTS catalog_summary TEXT NOT NULL DEFAULT '';
    `);
  },
  async down(client) {
    await client.query(`
      DROP INDEX IF EXISTS idx_messages_history_pending;
      DROP INDEX IF EXISTS idx_history_items_msg_key;
    `);
  }
};
