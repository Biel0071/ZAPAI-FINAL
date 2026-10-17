'use strict';

/**
 * Migration 042 — Create Conversation Sheets (Fichas de Pedido / Orçamento)
 *
 * Persists formal customer order sheets generated during conversation closing.
 */

module.exports = {
  version: '042_create_conversation_sheets',
  description: 'Create conversation_sheets table for commercial order sheets and price quotes',
  async up(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversation_sheets (
        id SERIAL PRIMARY KEY,
        company_id TEXT NOT NULL DEFAULT 'default',
        conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
        phone VARCHAR(30) NOT NULL,
        customer_name VARCHAR(255),
        delivery_address TEXT,
        delivery_neighborhood VARCHAR(255),
        delivery_city VARCHAR(255),
        delivery_cep VARCHAR(20),
        items JSONB NOT NULL DEFAULT '[]'::jsonb,
        total_price NUMERIC(12,2) DEFAULT 0.00,
        payment_method VARCHAR(50) DEFAULT 'pix',
        payment_status VARCHAR(50) DEFAULT 'pending',
        status VARCHAR(50) NOT NULL DEFAULT 'generated',
        summary_text TEXT,
        sheet_data JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_conv_sheets_company
        ON conversation_sheets(company_id, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_conv_sheets_conv
        ON conversation_sheets(company_id, conversation_id);

      CREATE INDEX IF NOT EXISTS idx_conv_sheets_phone
        ON conversation_sheets(company_id, phone);

      CREATE INDEX IF NOT EXISTS idx_conv_sheets_status
        ON conversation_sheets(company_id, status);
    `);
  },
  async down(client) {
    await client.query(`
      DROP TABLE IF EXISTS conversation_sheets CASCADE;
    `);
  }
};
