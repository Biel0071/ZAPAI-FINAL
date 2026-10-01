module.exports = {
  version: '039_create_quick_replies',
  description: 'Durable tenant-owned quick replies used by the existing Inbox service',
  up: async client => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS quick_replies (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT 'general',
        tags TEXT[] NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS quick_replies_company_updated
        ON quick_replies(company_id, updated_at DESC);
    `);
  },
};
