module.exports = {
  version: '036_session_whatsapp_name',
  description: 'Add whatsapp_name to sessions table to record WhatsApp profile pushName',
  up: async (client) => {
    await client.query(`
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS whatsapp_name VARCHAR(255);
    `);
  },
  down: async (client) => {
    await client.query(`
      ALTER TABLE sessions DROP COLUMN IF EXISTS whatsapp_name;
    `);
  },
};
