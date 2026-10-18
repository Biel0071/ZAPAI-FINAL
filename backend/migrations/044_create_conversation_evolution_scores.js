'use strict';

/**
 * Migration 044 — Create Conversation Evolution Scores & Agent Metrics
 *
 * Persists real conversation XP evaluations and itemized milestone scores:
 * - Coleta Cadastral (+15 a +25 XP)
 * - Especificação de Produto (+20 XP)
 * - Geração de Ficha / Orçamento (+40 XP)
 * - Conversão / Avanço de Funil (+50 XP)
 * - Qualidade de Atendimento (+15 XP)
 */

module.exports = {
  version: '044_create_conversation_evolution_scores',
  description: 'Create conversation_evolution_scores and agent_metrics tables for transparent real XP per conversation',
  async up(client) {
    // 1. conversation_evolution_scores
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversation_evolution_scores (
        id SERIAL PRIMARY KEY,
        company_id TEXT NOT NULL DEFAULT 'default',
        conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        agent_key VARCHAR(100) DEFAULT 'camila',
        lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
        contact_name VARCHAR(255),
        contact_phone VARCHAR(50),
        algorithm_code VARCHAR(50) DEFAULT 'ALGO-01',
        algorithm_name VARCHAR(255) DEFAULT 'Fechamento Rápido',
        conversation_style VARCHAR(100) DEFAULT 'direct_objective',
        cadastral_xp INTEGER NOT NULL DEFAULT 0,
        product_xp INTEGER NOT NULL DEFAULT 0,
        sheet_xp INTEGER NOT NULL DEFAULT 0,
        conversion_xp INTEGER NOT NULL DEFAULT 0,
        quality_xp INTEGER NOT NULL DEFAULT 0,
        total_xp INTEGER NOT NULL DEFAULT 0,
        milestones JSONB NOT NULL DEFAULT '{}'::jsonb,
        breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
        evaluation_summary TEXT,
        funnel_stage VARCHAR(100),
        has_order_sheet BOOLEAN DEFAULT FALSE,
        evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_conv_evo_score UNIQUE (company_id, conversation_id)
      );

      CREATE INDEX IF NOT EXISTS idx_conv_evo_company
        ON conversation_evolution_scores(company_id, total_xp DESC);

      CREATE INDEX IF NOT EXISTS idx_conv_evo_agent
        ON conversation_evolution_scores(company_id, agent_key);

      CREATE INDEX IF NOT EXISTS idx_conv_evo_algo
        ON conversation_evolution_scores(company_id, algorithm_code);

      CREATE INDEX IF NOT EXISTS idx_conv_evo_updated
        ON conversation_evolution_scores(company_id, updated_at DESC);
    `);

    // 2. agent_metrics
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_metrics (
        id SERIAL PRIMARY KEY,
        company_id TEXT NOT NULL DEFAULT 'default',
        agent_key VARCHAR(100) NOT NULL DEFAULT 'camila',
        metric_type VARCHAR(100) NOT NULL,
        metric_value NUMERIC(12,2) DEFAULT 0,
        metadata JSONB DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_agent_metrics_key UNIQUE (company_id, agent_key, metric_type)
      );

      CREATE INDEX IF NOT EXISTS idx_agent_metrics_lookup
        ON agent_metrics(company_id, agent_key);
    `);
  },

  async down(client) {
    await client.query(`
      DROP TABLE IF EXISTS conversation_evolution_scores CASCADE;
      DROP TABLE IF EXISTS agent_metrics CASCADE;
    `);
  }
};
