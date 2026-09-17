/**
 * Evolutionary AI — Layer 1: Official Store Knowledge (Verdade Oficial da Loja)
 *
 * Immutable by AI. Highest authority in prompt synthesis.
 * Queries PostgreSQL company_official_knowledge table with tsvector & tag search.
 */

const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '..', '.env') });

const connectionString = process.env.DATABASE_URL || 'postgresql://zapai:zapai_password@localhost:5432/zapai_crm';
const pool = new Pool({ connectionString });

class KnowledgeEngine {
  constructor(dbPool = pool) {
    this.pool = dbPool;
  }

  /**
   * Search official knowledge using text matching and full-text search
   */
  async searchOfficialKnowledge(companyId = 'default', queryText = '', category = null, limit = 5) {
    try {
      const cleanCompany = String(companyId || 'default');
      const cleanQuery = String(queryText || '').trim();

      if (!cleanQuery) {
        // Return default high-priority knowledge (pricing, shipping, policies)
        const res = await this.pool.query(
          `SELECT id, category, key, title, content, raw_text, tags
           FROM company_official_knowledge
           WHERE company_id = $1 AND is_active = TRUE
           ORDER BY CASE category 
             WHEN 'shipping' THEN 1 
             WHEN 'policies' THEN 2 
             WHEN 'products' THEN 3 
             ELSE 4 END
           LIMIT $2`,
          [cleanCompany, limit]
        );
        return res.rows;
      }

      // Keyword search in tags, title and full-text search
      const res = await this.pool.query(
        `SELECT id, category, key, title, content, raw_text, tags,
                ts_rank_cd(to_tsvector('portuguese', COALESCE(title, '') || ' ' || COALESCE(raw_text, '')), plainto_tsquery('portuguese', $2)) AS rank
         FROM company_official_knowledge
         WHERE company_id = $1 
           AND is_active = TRUE
           AND (
             category = $3 OR $3 IS NULL
           )
           AND (
             to_tsvector('portuguese', COALESCE(title, '') || ' ' || COALESCE(raw_text, '')) @@ plainto_tsquery('portuguese', $2)
             OR title ILIKE '%' || $2 || '%'
             OR raw_text ILIKE '%' || $2 || '%'
             OR tags && string_to_array(lower($2), ' ')
           )
         ORDER BY rank DESC, id ASC
         LIMIT $4`,
        [cleanCompany, cleanQuery, category || null, limit]
      );

      if (res.rows.length > 0) {
        return res.rows;
      }

      // Fallback: match by tags array overlap
      const words = cleanQuery.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      if (words.length > 0) {
        const tagRes = await this.pool.query(
          `SELECT id, category, key, title, content, raw_text, tags
           FROM company_official_knowledge
           WHERE company_id = $1 AND is_active = TRUE AND tags && $2
           LIMIT $3`,
          [cleanCompany, words, limit]
        );
        return tagRes.rows;
      }

      return [];
    } catch (err) {
      console.error('[KnowledgeEngine] searchOfficialKnowledge error:', err.message);
      return [];
    }
  }

  /**
   * Get all official catalog products
   */
  async getOfficialCatalog(companyId = 'default') {
    try {
      const res = await this.pool.query(
        `SELECT key, title, content, raw_text, tags
         FROM company_official_knowledge
         WHERE company_id = $1 AND (category = 'products' OR category = 'catalog') AND is_active = TRUE
         ORDER BY title ASC`,
        [String(companyId || 'default')]
      );
      return res.rows;
    } catch (err) {
      console.error('[KnowledgeEngine] getOfficialCatalog error:', err.message);
      return [];
    }
  }

  /**
   * Validate price or critical rules in generated text against official tables
   */
  async validateAgainstOfficialRules(companyId = 'default', text = '') {
    const issues = [];
    const products = await this.getOfficialCatalog(companyId);

    // Simple rule checks: ensure prices mentioned don't wildly contradict official pricing
    for (const prod of products) {
      const content = prod.content || {};
      const prodName = String(content.name || prod.title || '').toLowerCase();

      // Check if message mentions product name or key
      if (prodName && (text.toLowerCase().includes(prodName) || text.toLowerCase().includes(prod.key.toLowerCase().replace(/_/g, ' ')))) {
        const officialPrice = Number(content.price || 0);
        const pixPrice = Number(content.pix_price || content.pix_discount_price || 0);

        if (officialPrice > 0) {
          // Check if text has "R$ XXX"
          const matches = text.match(/R\$\s?([\d.,]+)/g);
          if (matches) {
            for (const m of matches) {
              const num = parseFloat(m.replace(/[^\d,]/g, '').replace(',', '.'));
              const diffOfficial = Math.abs(num - officialPrice);
              const diffPix = pixPrice > 0 ? Math.abs(num - pixPrice) : 999;

              if (num > 0 && diffOfficial > 50 && diffPix > 50) {
                issues.push({
                  product: prod.title,
                  mentionedPrice: num,
                  officialPrice,
                  pixPrice,
                  message: `Preço mencionado (R$ ${num}) diverge do preço oficial (R$ ${officialPrice})`
                });
              }
            }
          }
        }
      }
    }

    return {
      isValid: issues.length === 0,
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Compiles the Layer 1 authoritative prompt section
   */
  async compileOfficialKnowledgePrompt(companyId = 'default', queryText = '') {
    const knowledgeItems = await this.searchOfficialKnowledge(companyId, queryText, null, 4);

    if (!knowledgeItems || knowledgeItems.length === 0) {
      // Return baseline knowledge
      return `### [CAMADA 1: VERDADE OFICIAL DA LOJA - AUTORIDADE MÁXIMA]
- Política Geral: Atendimento profissional de materiais de construção.
- Pagamento: 5% de desconto no PIX ou até 10x sem juros no cartão de crédito.
- Frete: Grátis acima de R$ 500,00 até 15km; demais regiões calculadas por bairro e quantidade.
- REGRA DE OURO: NUNCA invente preços nem altere regras fiscais ou de entrega.\n`;
    }

    let prompt = `### [CAMADA 1: VERDADE OFICIAL DA LOJA - AUTORIDADE MÁXIMA]
⚠️ INEGOCIÁVEL: As informações abaixo são as regras canônicas e oficiais da empresa. NUNCA altere ou invente valores, prazos ou condições diferentes das listadas aqui:\n`;

    for (const item of knowledgeItems) {
      prompt += `\n* **${item.title}** (${item.category.toUpperCase()}):
  ${item.raw_text}`;
    }

    prompt += '\n\n';
    return prompt;
  }
}

module.exports = new KnowledgeEngine();
module.exports.KnowledgeEngine = KnowledgeEngine;
