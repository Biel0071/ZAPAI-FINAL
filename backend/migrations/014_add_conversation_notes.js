module.exports = {
  version: '014_add_conversation_notes',
  description: 'Add persistent CRM notes to conversations',
  up: async (client) => {
    await client.query(`
      ALTER TABLE conversations
      ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT ''
    `);
  },
};
