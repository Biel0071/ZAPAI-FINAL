'use strict';

module.exports = {
  version: '044_session_automation_pause',
  description: 'Persist automatic dispatch pause per WhatsApp session after disconnect',
  async up(client) {
    await client.query(`
      ALTER TABLE sessions
      ADD COLUMN IF NOT EXISTS automation_paused BOOLEAN NOT NULL DEFAULT FALSE;
    `);
  },
  async down(client) {
    await client.query(`
      ALTER TABLE sessions DROP COLUMN IF EXISTS automation_paused;
    `);
  },
};
