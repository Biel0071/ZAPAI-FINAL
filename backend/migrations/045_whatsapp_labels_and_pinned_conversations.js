'use strict';

module.exports = {
  version: '045_whatsapp_labels_and_pinned_conversations',
  description: 'Add is_pinned column to conversations and create whatsapp_labels table for real WhatsApp business label sync',
  async up(client) {
    await client.query(`
      ALTER TABLE conversations
      ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMP WITH TIME ZONE;

      CREATE INDEX IF NOT EXISTS idx_conversations_pinned
      ON conversations(company_id, is_pinned, last_message_at DESC);

      CREATE TABLE IF NOT EXISTS whatsapp_labels (
        id VARCHAR(64) NOT NULL,
        company_id VARCHAR(64) NOT NULL DEFAULT 'default',
        session_id VARCHAR(64) NOT NULL DEFAULT 'main',
        name VARCHAR(255) NOT NULL,
        color INTEGER DEFAULT 0,
        color_hex VARCHAR(32) DEFAULT '#00d26a',
        deleted BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (company_id, session_id, id)
      );

      CREATE INDEX IF NOT EXISTS idx_whatsapp_labels_session
      ON whatsapp_labels(company_id, session_id);

      -- Seed standard WhatsApp business labels
      INSERT INTO whatsapp_labels (id, company_id, session_id, name, color, color_hex, deleted)
      VALUES
        ('1', 'default', 'main', 'Novo cliente', 1, '#00d26a', false),
        ('2', 'default', 'main', 'Novo pedido', 9, '#f1c21b', false),
        ('3', 'default', 'main', 'Pagamento pendente', 0, '#ff8c00', false),
        ('4', 'default', 'main', 'Pago', 16, '#198038', false),
        ('5', 'default', 'main', 'Pedido finalizado', 5, '#8a3ffc', false)
      ON CONFLICT (company_id, session_id, id) DO NOTHING;
    `);
  },
  async down(client) {
    await client.query(`
      DROP TABLE IF EXISTS whatsapp_labels;
      DROP INDEX IF EXISTS idx_conversations_pinned;
      ALTER TABLE conversations DROP COLUMN IF EXISTS pinned_at;
      ALTER TABLE conversations DROP COLUMN IF EXISTS is_pinned;
    `);
  }
};
