'use strict';

module.exports = {
  version: '052_create_quotes_table',
  description: 'Create quotes table to manage commercial budgets, quote creation, customer approval and conversion into orders',
  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS quotes (
        id VARCHAR(64) PRIMARY KEY,
        company_id VARCHAR(64) NOT NULL DEFAULT 'default',
        quote_number VARCHAR(32) NOT NULL,
        conversation_id VARCHAR(128),
        client_phone VARCHAR(64) NOT NULL,
        client_name VARCHAR(255),
        items JSONB DEFAULT '[]'::jsonb,
        subtotal NUMERIC(12, 2) DEFAULT 0.00,
        discount_type VARCHAR(16) DEFAULT 'fixed',
        discount_value NUMERIC(12, 2) DEFAULT 0.00,
        discount_amount NUMERIC(12, 2) DEFAULT 0.00,
        shipping_amount NUMERIC(12, 2) DEFAULT 0.00,
        total_amount NUMERIC(12, 2) DEFAULT 0.00,
        currency VARCHAR(10) DEFAULT 'BRL',
        status VARCHAR(32) DEFAULT 'draft',
        order_id VARCHAR(128),
        notes TEXT,
        valid_until TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_quotes_company_phone
      ON quotes(company_id, client_phone);

      CREATE INDEX IF NOT EXISTS idx_quotes_number
      ON quotes(company_id, quote_number);

      CREATE INDEX IF NOT EXISTS idx_quotes_conversation
      ON quotes(conversation_id);

      CREATE INDEX IF NOT EXISTS idx_quotes_status
      ON quotes(company_id, status);
    `);
  },
  async down(client) {
    await client.query(`
      DROP TABLE IF EXISTS quotes CASCADE;
    `);
  },
};
