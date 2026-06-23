module.exports = {
  version: '012_add_session_id_to_contacts',
  description: 'Add session_id column to contacts table',
  up: async (client) => {
    await client.query(`
      ALTER TABLE contacts ADD COLUMN IF NOT EXISTS session_id VARCHAR(100);
    `);
  },
};
