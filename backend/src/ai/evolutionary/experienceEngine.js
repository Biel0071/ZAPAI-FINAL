/**
 * Evolutionary AI — Layer 4: Experience Engine (Memória de Experiência & Feedback)
 *
 * Tracks every [Customer Utterance -> Strategy -> AI Reply -> Reaction -> Human Intervention] cycle.
 * Provides few-shot guidance from successful experiences and records operator feedback.
 */

const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '..', '.env') });

const connectionString = process.env.DATABASE_URL || 'postgresql://zapai:zapai_password@localhost:5432/zapai_crm';
const pool = new Pool({ connectionString });

class ExperienceEngine {
  constructor(dbPool = pool) {
    this.pool = dbPool;
  }

  /**
   * Asynchronously record an AI response experience event
   */
  async recordExperienceEvent({
    conversationId,
    leadId = null,
    companyId = 'default',
    customerUtterance = '',
    intentDetected = null,
    strategyApplied = null,
    playbookId = null,
    aiReply = '',
    metadata = {}
  }) {
    try {
      const res = await this.pool.query(
        `INSERT INTO ai_experience_events (
          conversation_id, lead_id, company_id, customer_utterance,
          intent_detected, strategy_applied, playbook_id, ai_reply,
          customer_replied, human_intervened, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, FALSE, $9, NOW())
        RETURNING id`,
        [
          String(conversationId || 'unknown'),
          leadId ? Number(leadId) : null,
          String(companyId || 'default'),
          String(customerUtterance || ''),
          intentDetected || null,
          strategyApplied || null,
          playbookId ? Number(playbookId) : null,
          String(aiReply || ''),
          JSON.stringify(metadata || {})
        ]
      );
      return res.rows[0]?.id || null;
    } catch (err) {
      console.error('[ExperienceEngine] recordExperienceEvent error:', err.message);
      return null;
    }
  }

  /**
   * Register that customer replied to the AI message
   */
  async registerCustomerReaction({ conversationId, companyId = 'default', responseTimeSeconds = 30 }) {
    try {
      await this.pool.query(
        `UPDATE ai_experience_events
         SET customer_replied = TRUE,
             customer_replied_seconds = $3
         WHERE id = (
           SELECT id FROM ai_experience_events
           WHERE conversation_id = $1 AND company_id = $2
           ORDER BY created_at DESC LIMIT 1
         )`,
        [String(conversationId), String(companyId || 'default'), Number(responseTimeSeconds) || 30]
      );
    } catch (err) {
      console.error('[ExperienceEngine] registerCustomerReaction error:', err.message);
    }
  }

  /**
   * Register that a human operator intervened or corrected the AI
   */
  async registerHumanIntervention({ conversationId, companyId = 'default', humanText = '', reason = 'operator_takeover' }) {
    try {
      await this.pool.query(
        `UPDATE ai_experience_events
         SET human_intervened = TRUE,
             human_correction_text = $3,
             feedback_rating = 'corrected',
             feedback_category = $4
         WHERE id = (
           SELECT id FROM ai_experience_events
           WHERE conversation_id = $1 AND company_id = $2
           ORDER BY created_at DESC LIMIT 1
         )`,
        [String(conversationId), String(companyId || 'default'), String(humanText || ''), String(reason || 'operator_takeover')]
      );
    } catch (err) {
      console.error('[ExperienceEngine] registerHumanIntervention error:', err.message);
    }
  }

  /**
   * Record operator direct feedback [like, dislike, correct, teach]
   */
  async recordFeedback({ eventId = null, conversationId = null, companyId = 'default', rating = 'positive', category = 'general', note = '' }) {
    try {
      if (eventId) {
        await this.pool.query(
          `UPDATE ai_experience_events
           SET feedback_rating = $1,
               feedback_category = $2,
               metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb
           WHERE id = $4 AND company_id = $5`,
          [rating, category, JSON.stringify({ note, feedbackAt: new Date().toISOString() }), Number(eventId), String(companyId)]
        );
        return { ok: true, eventId };
      }

      if (conversationId) {
        const res = await this.pool.query(
          `UPDATE ai_experience_events
           SET feedback_rating = $1,
               feedback_category = $2,
               metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb
           WHERE id = (
             SELECT id FROM ai_experience_events
             WHERE conversation_id = $4 AND company_id = $5
             ORDER BY created_at DESC LIMIT 1
           )
           RETURNING id`,
          [rating, category, JSON.stringify({ note, feedbackAt: new Date().toISOString() }), String(conversationId), String(companyId)]
        );
        return { ok: true, eventId: res.rows[0]?.id };
      }
    } catch (err) {
      console.error('[ExperienceEngine] recordFeedback error:', err.message);
      return { ok: false, error: err.message };
    }
  }

  /**
   * Find past experiences where the customer responded or deal advanced
   */
  async findSimilarExperiences({ companyId = 'default', message = '', intent = '', limit = 2 }) {
    try {
      const cleanCompany = String(companyId || 'default');
      const cleanMsg = String(message || '').toLowerCase();

      // Find events with positive feedback or customer reply, without human intervention
      const res = await this.pool.query(
        `SELECT customer_utterance, ai_reply, strategy_applied, feedback_rating
         FROM ai_experience_events
         WHERE company_id = $1
           AND (customer_replied = TRUE OR feedback_rating = 'positive')
           AND human_intervened = FALSE
           AND length(ai_reply) > 20
         ORDER BY id DESC
         LIMIT $2`,
        [cleanCompany, limit]
      );

      return res.rows;
    } catch (err) {
      console.error('[ExperienceEngine] findSimilarExperiences error:', err.message);
      return [];
    }
  }

  /**
   * Compiles Layer 4 prompt section
   */
  compileExperiencePrompt(experiences = []) {
    if (!experiences || experiences.length === 0) {
      return '';
    }

    let prompt = `### [CAMADA 4: EXPERIÊNCIAS ANTERIORES DE SUCESSO (Aprendizado Prático)]\n`;
    experiences.forEach((exp, idx) => {
      prompt += `Exemplo ${idx + 1}:\n`;
      prompt += `  Cliente: "${exp.customer_utterance}"\n`;
      prompt += `  Resposta Eficaz: "${exp.ai_reply}"\n`;
    });
    prompt += '\n';
    return prompt;
  }
}

module.exports = new ExperienceEngine();
module.exports.ExperienceEngine = ExperienceEngine;
