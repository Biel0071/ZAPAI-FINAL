module.exports = {
  version: '027_add_whatsapp_message_keys',
  description: 'Persist WhatsApp message keys for delivery tracking and revoke synchronization',
  up: async (client) => {
    await client.query(`
      ALTER TABLE messages
        ADD COLUMN IF NOT EXISTS whatsapp_message_id VARCHAR(255),
        ADD COLUMN IF NOT EXISTS remote_jid VARCHAR(255),
        ADD COLUMN IF NOT EXISTS participant_jid VARCHAR(255);

      CREATE INDEX IF NOT EXISTS idx_messages_whatsapp_message_id
        ON messages (whatsapp_message_id)
        WHERE whatsapp_message_id IS NOT NULL;
    `);
  },
};