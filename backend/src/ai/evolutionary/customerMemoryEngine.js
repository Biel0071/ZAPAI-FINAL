/**
 * Evolutionary AI — Layer 2: Customer Structured Memory (Memória do Cliente)
 *
 * Keeps track of customer state, quoted items, location, and negotiation status
 * across all conversations to eliminate redundant questions.
 */

const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '..', '.env') });

const connectionString = process.env.DATABASE_URL || 'postgresql://zapai:zapai_password@localhost:5432/zapai_crm';
const pool = new Pool({ connectionString });

class CustomerMemoryEngine {
  constructor(dbPool = pool) {
    this.pool = dbPool;
  }

  /**
   * Load all customer context from ai_context, ai_conversation_memory, and conversations
   */
  async loadCustomerContext({ companyId = 'default', phone = '', conversationId = null }) {
    const cleanCompany = String(companyId || 'default');
    const cleanPhone = String(phone || '').replace(/\D/g, '');

    const context = {
      phone: cleanPhone,
      conversationId,
      name: 'Cliente',
      neighborhood: null,
      city: null,
      quotedProducts: [],
      stage: 'initial',
      leadTemperature: 'warm',
      leadIntent: null,
      paymentPreference: null,
      previousObjections: [],
      lastInteractionSummary: null,
    };

    if (!cleanPhone && !conversationId) {
      return context;
    }

    try {
      // 1. Query ai_context
      const aiContextRes = await this.pool.query(
        `SELECT lead_temperature, lead_intent, next_action, tone, last_ai_reply, context_json
         FROM ai_context
         WHERE company_id = $1 AND (chat_id = $2 OR chat_id = $3)
         ORDER BY updated_at DESC LIMIT 1`,
        [cleanCompany, cleanPhone, String(conversationId || '')]
      );

      if (aiContextRes.rows.length > 0) {
        const row = aiContextRes.rows[0];
        context.leadTemperature = row.lead_temperature || context.leadTemperature;
        context.leadIntent = row.lead_intent || context.leadIntent;
        const cJson = row.context_json || {};
        if (cJson.customerName || cJson.name) context.name = cJson.customerName || cJson.name;
        if (cJson.neighborhood) context.neighborhood = cJson.neighborhood;
        if (cJson.city) context.city = cJson.city;
        if (cJson.quotedProducts || cJson.quotedItems) {
          const raw = cJson.quotedProducts || cJson.quotedItems;
          context.quotedProducts = Array.isArray(raw)
            ? raw.map(i => typeof i === 'string' ? i : (i.item || i.name || JSON.stringify(i)))
            : [String(raw)];
        }
        if (cJson.paymentPreference) context.paymentPreference = cJson.paymentPreference;
      }

      // 2. Query ai_conversation_memory
      const memRes = await this.pool.query(
        `SELECT name, intent, summary, tags, metrics, messages
         FROM ai_conversation_memory
         WHERE company_id = $1 AND (phone = $2 OR contact_id = $2 OR contact_id = $3)
         ORDER BY last_updated DESC LIMIT 1`,
        [cleanCompany, cleanPhone, String(conversationId || '')]
      );

      if (memRes.rows.length > 0) {
        const row = memRes.rows[0];
        if (row.name && row.name !== 'Cliente') context.name = row.name;
        context.leadIntent = context.leadIntent || row.intent;
        context.lastInteractionSummary = row.summary;
        if (row.metrics && row.metrics.products) {
          context.quotedProducts = [...new Set([...context.quotedProducts, ...row.metrics.products])];
        }
      }

      // 3. Query conversations table
      const convRes = await this.pool.query(
        `SELECT id, lead_temperature, funnel_stage, summary, lead_intent, memory_json
         FROM conversations
         WHERE company_id = $1 AND (session_id = $2 OR remote_jid ILIKE $3 OR id = $4)
         ORDER BY updated_at DESC LIMIT 1`,
        [cleanCompany, cleanPhone, `%${cleanPhone}%`, Number(conversationId) || -1]
      );

      if (convRes.rows.length > 0) {
        const row = convRes.rows[0];
        context.conversationId = row.id;
        context.stage = row.funnel_stage || context.stage;
        context.leadTemperature = row.lead_temperature || context.leadTemperature;
        if (row.memory_json) {
          const mem = row.memory_json;
          if (mem.neighborhood && !context.neighborhood) context.neighborhood = mem.neighborhood;
          if (mem.city && !context.city) context.city = mem.city;
          if (mem.quotedProducts) {
            context.quotedProducts = [...new Set([...context.quotedProducts, ...(Array.isArray(mem.quotedProducts) ? mem.quotedProducts : [mem.quotedProducts])])];
          }
        }
      }
    } catch (err) {
      console.error('[CustomerMemoryEngine] loadCustomerContext error:', err.message);
    }

    return context;
  }

  /**
   * Extract new customer facts from message text and update PostgreSQL
   */
  async extractAndSaveFacts({ companyId = 'default', phone = '', conversationId = null, messageText = '' }) {
    if (!messageText) return;
    const cleanCompany = String(companyId || 'default');
    const cleanPhone = String(phone || '').replace(/\D/g, '');

    const text = messageText.toLowerCase();
    const facts = {};

    // Detect neighborhood / location
    const neighborhoodMatch = text.match(/(?:moro no|sou do|bairro|entrega no|fica no|em)\s+([a-záéíóúâêîôûãõç\s]{3,25})/i);
    if (neighborhoodMatch && neighborhoodMatch[1]) {
      const candidate = neighborhoodMatch[1].trim();
      if (!candidate.includes('obrigad') && !candidate.includes('qual') && !candidate.includes('quanto')) {
        facts.neighborhood = candidate;
      }
    }

    // Detect product interest
    if (text.includes('churrasqueira') || text.includes('trio')) {
      facts.product = 'Churrasqueira Trio';
    } else if (text.includes('tijolo') || text.includes('milheiro')) {
      facts.product = 'Tijolo 8 Furos (Milheiro)';
    } else if (text.includes('cimento')) {
      facts.product = 'Cimento CP II 50kg';
    }

    // Detect payment preference
    if (text.includes('pix')) {
      facts.paymentPreference = 'PIX';
    } else if (text.includes('cartao') || text.includes('cartão') || text.includes('parcel')) {
      facts.paymentPreference = 'Cartão de Crédito';
    }

    if (Object.keys(facts).length === 0) return;

    try {
      // Upsert into ai_context
      await this.pool.query(
        `INSERT INTO ai_context (chat_id, company_id, context_json, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (chat_id) DO UPDATE SET
           context_json = COALESCE(ai_context.context_json, '{}'::jsonb) || $3::jsonb,
           updated_at = NOW()`,
        [cleanPhone || String(conversationId), cleanCompany, JSON.stringify(facts)]
      );
    } catch (err) {
      // If no unique constraint on chat_id, update by where clause
      try {
        await this.pool.query(
          `UPDATE ai_context 
           SET context_json = COALESCE(context_json, '{}'::jsonb) || $1::jsonb, updated_at = NOW()
           WHERE company_id = $2 AND chat_id = $3`,
          [JSON.stringify(facts), cleanCompany, cleanPhone || String(conversationId)]
        );
      } catch (innerErr) {
        console.warn('[CustomerMemoryEngine] extractAndSaveFacts warning:', innerErr.message);
      }
    }
  }

  /**
   * Save explicit customer facts directly to PostgreSQL
   */
  async saveCustomerFacts({ companyId = 'default', phone = '', conversationId = null, facts = {} }) {
    const cleanCompany = String(companyId || 'default');
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    const chatId = cleanPhone || String(conversationId || 'unknown');

    try {
      await this.pool.query(
        `INSERT INTO ai_context (chat_id, company_id, context_json, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (chat_id) DO UPDATE SET
           context_json = COALESCE(ai_context.context_json, '{}'::jsonb) || $3::jsonb,
           updated_at = NOW()`,
        [chatId, cleanCompany, JSON.stringify(facts)]
      );
    } catch (err) {
      try {
        await this.pool.query(
          `UPDATE ai_context 
           SET context_json = COALESCE(context_json, '{}'::jsonb) || $1::jsonb, updated_at = NOW()
           WHERE company_id = $2 AND chat_id = $3`,
          [JSON.stringify(facts), cleanCompany, chatId]
        );
      } catch (innerErr) {
        console.warn('[CustomerMemoryEngine] saveCustomerFacts warning:', innerErr.message);
      }
    }
  }

  /**
   * Compiles the Layer 2 customer memory prompt section
   */
  compileCustomerMemoryPrompt(context = {}) {
    let prompt = `### [CAMADA 2: MEMÓRIA DO CLIENTE - CONTEXTO HISTÓRICO]
- Nome: ${context.name || 'Cliente'}
- Estágio da Negociação: ${context.stage || 'Em andamento'} (Temperatura: ${context.leadTemperature || 'Morno'})`;

    if (context.neighborhood) {
      prompt += `\n- 📍 Localização/Bairro: ${context.neighborhood} (JÁ CONHECIDO - NÃO pergunte o bairro novamente!)`;
    }
    if (context.city) {
      prompt += `\n- Cidade: ${context.city}`;
    }
    if (context.quotedProducts && context.quotedProducts.length > 0) {
      prompt += `\n- Itens cotados/interesse: ${context.quotedProducts.join(', ')}`;
    }
    if (context.paymentPreference) {
      prompt += `\n- Preferência de Pagamento: ${context.paymentPreference}`;
    }
    if (context.lastInteractionSummary) {
      prompt += `\n- Resumo de interações anteriores: ${context.lastInteractionSummary}`;
    }

    prompt += '\n\n';
    return prompt;
  }
}

module.exports = new CustomerMemoryEngine();
module.exports.CustomerMemoryEngine = CustomerMemoryEngine;
