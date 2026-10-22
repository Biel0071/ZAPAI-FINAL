'use strict';

module.exports = {
  version: '047_conversation_whatsapp_labels',
  description: 'Mirror real WhatsApp labels in a column separate from system/funnel tags (source=whatsapp)',
  async up(client) {
    await client.query(`
      ALTER TABLE conversations
      ADD COLUMN IF NOT EXISTS whatsapp_labels TEXT[] NOT NULL DEFAULT '{}';
    `);
  },
  async down(client) {
    await client.query('ALTER TABLE conversations DROP COLUMN IF EXISTS whatsapp_labels;');
  }
};
