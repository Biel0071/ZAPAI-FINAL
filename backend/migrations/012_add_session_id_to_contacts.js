module.exports = {
  version: '012_add_session_id_to_contacts',
  description: 'Add session_id column to contacts table',
  up: async (client) => {
    await client.query(`
      DO $$
      BEGIN
        IF to_regclass('public.contacts') IS NOT NULL THEN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='contacts' AND column_name='session_id'
          ) THEN
            ALTER TABLE contacts ADD COLUMN session_id VARCHAR(100);
          END IF;
        END IF;
      END $$;
    `);
  },
};
