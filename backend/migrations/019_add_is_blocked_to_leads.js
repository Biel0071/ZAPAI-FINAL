module.exports = {
  version: '019_add_is_blocked_to_leads',
  description: 'Add is_blocked column to leads table',
  up: async (client) => {
    await client.query(`
      ALTER TABLE leads 
      ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;
    `);
  },
};
