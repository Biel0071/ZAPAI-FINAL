/**
 * Evolutionary AI — Cross-Conversation Memory & Anti-Robotic WhatsApp Tone Engine
 * 
 * Injects cross-conversation golden lessons learned from past human attendances
 * into every new LLM interaction, ensuring that EVERY conversation is better than the previous one,
 * while strictly enforcing a natural, conversational WhatsApp Brazilian Portuguese tone (zero robotic clichés).
 */

const { pool } = require('../../infrastructure/config/database');

class CrossConversationMemory {
  constructor(dbPool = pool) {
    this.pool = dbPool;
  }

  /**
   * Recalls the most relevant golden attendance experiences from other past conversations.
   */
  async recallCrossConversationExamples({ companyId = 'default', message = '', intent = null, limit = 2 }) {
    const cleanCompany = String(companyId || 'default');
    const cleanMsg = String(message || '').toLowerCase();

    try {
      // 1. Identify key topics from keywords in the customer utterance
      const keywords = [];
      if (cleanMsg.includes('frete') || cleanMsg.includes('entrega') || cleanMsg.includes('onde') || cleanMsg.includes('cidade') || cleanMsg.includes('bairro') || cleanMsg.includes('cep')) {
        keywords.push('frete_e_localizacao');
      }
      if (cleanMsg.includes('pagar') || cleanMsg.includes('pix') || cleanMsg.includes('cartao') || cleanMsg.includes('cartão') || cleanMsg.includes('desconto') || cleanMsg.includes('parcela') || cleanMsg.includes('link')) {
        keywords.push('pagamento_e_desconto');
      }
      if (cleanMsg.includes('medida') || cleanMsg.includes('tamanho') || cleanMsg.includes('trio') || cleanMsg.includes('fogao') || cleanMsg.includes('fogão') || cleanMsg.includes('churrasqueira') || cleanMsg.includes('dimens')) {
        keywords.push('catalogo_e_dimensoes');
      }
      if (cleanMsg.includes('rastreio') || cleanMsg.includes('quando chega') || cleanMsg.includes('prazo') || cleanMsg.includes('jadlog') || cleanMsg.includes('app') || cleanMsg.includes('comprovante')) {
        keywords.push('rastreio_e_ativacao');
      }

      let res;
      if (keywords.length > 0) {
        res = await this.pool.query(
          `SELECT customer_utterance, ai_reply, intent_detected, metadata
           FROM ai_experience_events
           WHERE company_id = $1
             AND (intent_detected = ANY($2::varchar[]) OR intent_detected = $3)
             AND (strategy_applied = 'human_operator_golden_sample' OR feedback_rating = 'positive')
             AND length(ai_reply) > 5
           ORDER BY id DESC
           LIMIT $4`,
          [cleanCompany, keywords, intent || 'general', Number(limit) || 2]
        );
      } else {
        res = await this.pool.query(
          `SELECT customer_utterance, ai_reply, intent_detected, metadata
           FROM ai_experience_events
           WHERE company_id = $1
             AND (strategy_applied = 'human_operator_golden_sample' OR feedback_rating = 'positive')
             AND length(ai_reply) > 5
           ORDER BY id DESC
           LIMIT $2`,
          [cleanCompany, Number(limit) || 2]
        );
      }

      return res.rows || [];
    } catch (err) {
      console.warn('[CrossConversationMemory] recall error:', err.message);
      return [];
    }
  }

  /**
   * Compiles the cross-conversation evolutionary learning section with strict anti-robotic rules
   */
  compileCrossConversationPrompt(examples = []) {
    let prompt = `### [APRENDIZADO EVOLUTIVO CRUZADO DE OUTRAS CONVERSAS & DIRETRIZ ANTI-ROBÔ]\n`;
    prompt += `Você possui a experiência acumulada de milhares de atendimentos reais dos melhores vendedores humanos da loja.\n`;
    prompt += `Toda resposta sua deve ser ágil, natural, empática e evolutiva (sempre superior às anteriores).\n\n`;

    if (examples && examples.length > 0) {
      prompt += `💡 Exemplos Reais de Sucesso em Atendimentos Anteriores Semelhantes:\n`;
      examples.forEach((ex, idx) => {
        prompt += `Exemplo ${idx + 1} (${ex.intent_detected || 'Atendimento Geral'}):\n`;
        prompt += `  • Cliente perguntou: "${ex.customer_utterance}"\n`;
        prompt += `  • Resposta Humana de Ouro: "${ex.ai_reply}"\n`;
      });
      prompt += `\n`;
    }

    prompt += `🚨 REGRAS DE OURO ANTI-ROBÔ (HUMANIZAÇÃO WHATSAPP OBRIGATÓRIA):\n`;
    prompt += `1. ZERO JARGÕES DE ROBÔ: NUNCA diga frases como "Sou um assistente de IA", "Como posso te ajudar hoje?", "Estou aqui para esclarecer suas dúvidas" ou "De acordo com o sistema".\n`;
    prompt += `2. TOM DE CONVERSA REAL: Fale como uma pessoa real no balcão da loja conversando no WhatsApp (amigável, simpática, prática, segura e acolhedora).\n`;
    prompt += `3. MENSAGENS CURTAS E DINÂMICAS: Limite sua resposta a 1 até 3 frases claras no máximo. Ninguém gosta de ler textões no WhatsApp!\n`;
    prompt += `4. NÃO REPITA SAUDAÇÕES: Se você ou o cliente já falaram "oi/bom dia" anteriormente na conversa, vá DIRETO ao ponto da resposta sem saudações repetidas.\n`;
    prompt += `5. CONDUÇÃO COMERCIAL (CTA): Termine sempre com uma pergunta curta e natural que avance a venda (ex: "Qual seu bairro para calcularmos a rota?", "Prefere pagamento à vista com 5% de desconto no PIX ou no cartão?", "Quer que eu separe esse modelo pra você?").\n`;

    return prompt;
  }
}

module.exports = new CrossConversationMemory();
module.exports.CrossConversationMemory = CrossConversationMemory;
