module.exports = {
  version: '034_whatsapp_history_bootstrap',
  description: 'Durable tenant-scoped WhatsApp history and reviewed attendant drafts',
  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_history_sync (
        company_id TEXT NOT NULL, session_id TEXT NOT NULL,
        learning_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        target_agent_key TEXT, last_received_at TIMESTAMPTZ,
        last_request_at TIMESTAMPTZ, last_error TEXT,
        PRIMARY KEY (company_id, session_id)
      );
      CREATE TABLE IF NOT EXISTS whatsapp_history_items (
        id BIGSERIAL PRIMARY KEY, company_id TEXT NOT NULL, session_id TEXT NOT NULL,
        chat_jid TEXT NOT NULL, message_key TEXT NOT NULL, raw_message TEXT NOT NULL,
        from_me BOOLEAN NOT NULL, occurred_at TIMESTAMPTZ,
        chat_name TEXT, archived BOOLEAN NOT NULL DEFAULT FALSE,
        import_state TEXT NOT NULL DEFAULT 'pending', import_attempts INTEGER NOT NULL DEFAULT 0,
        media_state TEXT NOT NULL DEFAULT 'pending', media_attempts INTEGER NOT NULL DEFAULT 0,
        message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
        text TEXT, media_type TEXT, media_path TEXT, media_text TEXT,
        origin TEXT NOT NULL DEFAULT 'unknown', last_error TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (company_id, session_id, chat_jid, message_key),
        FOREIGN KEY (company_id, session_id) REFERENCES whatsapp_history_sync(company_id, session_id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS whatsapp_history_chats (
        company_id TEXT NOT NULL, session_id TEXT NOT NULL, chat_jid TEXT NOT NULL,
        name TEXT, archived BOOLEAN NOT NULL DEFAULT FALSE, imported BOOLEAN NOT NULL DEFAULT FALSE,
        PRIMARY KEY(company_id,session_id,chat_jid),
        FOREIGN KEY(company_id,session_id) REFERENCES whatsapp_history_sync(company_id,session_id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_history_import ON whatsapp_history_items(company_id, session_id, import_state, id);
      CREATE INDEX IF NOT EXISTS idx_history_media ON whatsapp_history_items(company_id, session_id, media_state, id);
      CREATE INDEX IF NOT EXISTS idx_history_chat ON whatsapp_history_items(company_id, session_id, chat_jid, occurred_at, id);
      CREATE INDEX IF NOT EXISTS idx_history_message ON whatsapp_history_items(company_id,session_id,message_id);
      CREATE TABLE IF NOT EXISTS whatsapp_history_requests (
        company_id TEXT NOT NULL, session_id TEXT NOT NULL, chat_jid TEXT NOT NULL,
        oldest_key TEXT NOT NULL, requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        status TEXT NOT NULL DEFAULT 'waiting',
        PRIMARY KEY(company_id,session_id,chat_jid),
        FOREIGN KEY(company_id,session_id) REFERENCES whatsapp_history_sync(company_id,session_id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS ai_history_drafts (
        id BIGSERIAL PRIMARY KEY, company_id TEXT NOT NULL, session_id TEXT NOT NULL,
        target_agent_key TEXT, status TEXT NOT NULL DEFAULT 'analyzing',
        watermark BIGINT NOT NULL, source_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        cursor_id BIGINT NOT NULL DEFAULT 0, cursor_offset INTEGER NOT NULL DEFAULT 0, candidate JSONB NOT NULL DEFAULT '{}',
        previous_agent JSONB, reviewed_by TEXT, published_agent_key TEXT,
        last_error TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        FOREIGN KEY (company_id, session_id) REFERENCES whatsapp_history_sync(company_id, session_id) ON DELETE CASCADE
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_history_one_analysis ON ai_history_drafts(company_id, session_id) WHERE status = 'analyzing';
      CREATE TABLE IF NOT EXISTS ai_history_analyses (
        id BIGSERIAL PRIMARY KEY, company_id TEXT NOT NULL, session_id TEXT NOT NULL,
        draft_id BIGINT NOT NULL REFERENCES ai_history_drafts(id) ON DELETE CASCADE,
        end_id BIGINT NOT NULL, end_offset INTEGER NOT NULL DEFAULT 0, report JSONB NOT NULL,
        UNIQUE (draft_id, end_id, end_offset)
      );
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS history_item_id BIGINT;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_origin TEXT NOT NULL DEFAULT 'unknown';
      CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_history_item ON messages(history_item_id) WHERE history_item_id IS NOT NULL;
    `);
  },
};
