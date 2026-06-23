module.exports = {
  version: '021_create_lid_mappings',
  description: 'Create whatsapp_lid_mappings table to store WhatsApp LID to phone JID associations',
  up: async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_lid_mappings (
        id SERIAL PRIMARY KEY,
        lid VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_whatsapp_lid_mappings_lid ON whatsapp_lid_mappings(lid);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_whatsapp_lid_mappings_phone ON whatsapp_lid_mappings(phone);
    `);
  },
};
