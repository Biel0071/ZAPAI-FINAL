/**
 * Evolutionary AI — Layer 3 & 5: Playbook Engine (Estratégias Operacionais & Playbooks)
 *
 * Provides proven commercial interaction patterns [Situação -> Estratégia -> Resposta -> Resultado]
 * Supports Sandbox A/B testing (10% traffic) and management approvals.
 */

const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '..', '.env') });

const connectionString = process.env.DATABASE_URL || 'postgresql://zapai:zapai_password@localhost:5432/zapai_crm';
const pool = new Pool({ connectionString });

function simpleHash(str = '') {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

class PlaybookEngine {
  constructor(dbPool = pool) {
    this.pool = dbPool;
  }

  /**
   * Match an approved or testing playbook for the current conversation situation
   */
  async matchPlaybook({ companyId = 'default', message = '', intent = '', conversationId = '' }) {
    const cleanCompany = String(companyId || 'default');
    const cleanMsg = String(message || '').toLowerCase();
    const cleanIntent = String(intent || '').toLowerCase();

    try {
      // Query active and testing playbooks
      const res = await this.pool.query(
        `SELECT id, name, slug, trigger_condition, goal, steps, recommended_cta, confidence, continuity_boost_pct, status
         FROM ai_playbooks
         WHERE company_id = $1 AND status IN ('approved', 'testing')
         ORDER BY confidence DESC, continuity_boost_pct DESC`,
        [cleanCompany]
      );

      const playbooks = res.rows;
      if (!playbooks || playbooks.length === 0) return null;

      // Match against triggers
      for (const pb of playbooks) {
        const trig = pb.trigger_condition.toLowerCase();
        let matched = false;

        if (trig.includes('frete') || trig.includes('entrega')) {
          if (cleanMsg.includes('frete') || cleanMsg.includes('entrega') || cleanMsg.includes('leva') || cleanMsg.includes('onde fica') || cleanIntent.includes('freight')) {
            matched = true;
          }
        } else if (trig.includes('tijolo') || trig.includes('milheiro')) {
          if (cleanMsg.includes('tijolo') || cleanMsg.includes('milheiro') || cleanMsg.includes('bloco') || cleanIntent.includes('price')) {
            matched = true;
          }
        } else if (trig.includes('follow') || trig.includes('orcamento') || trig.includes('cotacao')) {
          if (cleanMsg.includes('orcamento') || cleanMsg.includes('cotação') || cleanMsg.includes('valor final') || cleanMsg.includes('fechar') || cleanIntent.includes('followup')) {
            matched = true;
          }
        }

        if (matched) {
          // If status is 'testing', enforce 10% A/B testing
          if (pb.status === 'testing') {
            const hashVal = simpleHash(String(conversationId || cleanMsg));
            const inSample = hashVal % 10 === 0; // 10% of traffic
            if (!inSample) {
              continue; // skip testing playbook for the remaining 90%
            }
          }
          return pb;
        }
      }

      // Default to the first approved playbook if relevant or general qualification
      const general = playbooks.find(p => p.status === 'approved');
      return general || null;
    } catch (err) {
      console.error('[PlaybookEngine] matchPlaybook error:', err.message);
      return null;
    }
  }

  /**
   * Compiles the Layer 3 playbook prompt section
   */
  compilePlaybookPrompt(playbook = null) {
    if (!playbook) {
      return `### [CAMADA 3: DIRETRIZ ESTRATÉGICA]
- Abordagem: Seja cordial, objetivo e comercialmente proativo.
- Regra: Termine sempre com uma pergunta ou direcionamento claro para avançar o atendimento.\n\n`;
    }

    const steps = Array.isArray(playbook.steps) 
      ? playbook.steps 
      : (typeof playbook.steps === 'string' ? JSON.parse(playbook.steps) : []);

    let prompt = `### [CAMADA 3: PLAYBOOK OPERACIONAL RECOMENDADO (${playbook.name})]
- Estratégia Validada: ${playbook.name} (Confiança estatística: ${Math.round(Number(playbook.confidence || 0.85) * 100)}%)
- Objetivo da Etapa: ${playbook.goal}
- Roteiro sugerido de condução:
`;

    steps.forEach((step, idx) => {
      prompt += `  ${idx + 1}. ${step}\n`;
    });

    if (playbook.recommended_cta) {
      prompt += `- Sugestão de CTA final: "${playbook.recommended_cta}"\n`;
    }

    prompt += '\n';
    return prompt;
  }

  /**
   * List all playbooks for management UI
   */
  async listPlaybooks(companyId = 'default') {
    const res = await this.pool.query(
      `SELECT id, name, slug, trigger_condition, goal, steps, recommended_cta, confidence, continuity_boost_pct, status, created_at, updated_at
       FROM ai_playbooks
       WHERE company_id = $1
       ORDER BY confidence DESC, id ASC`,
      [String(companyId || 'default')]
    );
    return res.rows;
  }
}

module.exports = new PlaybookEngine();
module.exports.PlaybookEngine = PlaybookEngine;
