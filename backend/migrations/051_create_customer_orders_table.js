'use strict';

module.exports = {
  version: '051_create_customer_orders_table',
  description: 'Create customer_orders table to store native WhatsApp Commerce cart orders and order confirmations',
  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS customer_orders (
        id VARCHAR(64) PRIMARY KEY,
        company_id VARCHAR(64) NOT NULL DEFAULT 'default',
        order_id VARCHAR(128) NOT NULL,
        conversation_id VARCHAR(128),
        phone VARCHAR(64) NOT NULL,
        seller_jid VARCHAR(128),
        order_title VARCHAR(255),
        item_count INTEGER DEFAULT 1,
        total_amount_1000 BIGINT DEFAULT 0,
        total_amount NUMERIC(12, 2) DEFAULT 0.00,
        currency VARCHAR(10) DEFAULT 'BRL',
        status VARCHAR(32) DEFAULT 'pending',
        token TEXT,
        items JSONB DEFAULT '[]'::jsonb,
        customer_notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_customer_orders_company_phone
      ON customer_orders(company_id, phone);

      CREATE INDEX IF NOT EXISTS idx_customer_orders_order_id
      ON customer_orders(order_id);

      CREATE INDEX IF NOT EXISTS idx_customer_orders_conversation
      ON customer_orders(conversation_id);

      CREATE INDEX IF NOT EXISTS idx_customer_orders_status
      ON customer_orders(company_id, status);
    `);
  },
  async down(client) {
    await client.query(`
      DROP TABLE IF EXISTS customer_orders CASCADE;
    `);
  },
};
