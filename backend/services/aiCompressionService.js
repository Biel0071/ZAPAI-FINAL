const { query } = require('../src/infrastructure/config/database');
const { testProviderConnection } = require('./ai.service');
const aiAgentService = require('../src/ai/agents/services/aiAgentService');

/**
 * ZAPAI — AI Compression Service
 * 
 * Este serviço roda antes da exclusão de mensagens por retenção (60+ dias).
 * Ele lê o histórico que está prestes a ser deletado e passa pela IA para extrair:
 * - Resumo do relacionamento
 * - Perfil de compra / intenção do lead
 * - Objeções passadas
 * E salva isso no `ai_memory_long` do contato, preservando o aprendizado de forma leve.
 */

async function compressContactHistory(contactId, companyId, oldMessages, store) {
  if (!oldMessages || oldMessages.length === 0) return null;

  // Busca o provider
  await aiAgentService.listAgents(companyId);
  const agentList = aiAgentService.getAgentsSync(companyId);
  const agent = agentList.length > 0 ? agentList[0] : null;

  let provider;
  try {
    const { rows } = await query(
      `SELECT * FROM provider_keys WHERE tenant_id = $1 AND enabled = TRUE LIMIT 1`,
      [companyId]
    );
    if (rows.length > 0) {
      let mappedProviderId = rows[0].provider.toLowerCase();
      if (mappedProviderId === 'anthropic') mappedProviderId = 'claude';
      if (mappedProviderId === 'google') mappedProviderId = 'gemini';
      
      const crypto = require('crypto');
      function decrypt(text) {
        if (!text) return '';
        if (!text.includes(':')) return text;
        try {
          const rawKey = process.env.ENCRYPTION_KEY || 'zapai_crm_encryption_secure_key_32bytes_2026';
          const currentKey = crypto.createHash('sha256').update(rawKey).digest();
          const parts = text.split(':');
          const iv = Buffer.from(parts.shift(), 'hex');
          const encryptedText = Buffer.from(parts.join(':'), 'hex');
          const decipher = crypto.createDecipheriv('aes-256-cbc', currentKey, iv);
          let decrypted = decipher.update(encryptedText);
          decrypted = Buffer.concat([decrypted, decipher.final()]);
          return decrypted.toString();
        } catch { return ''; }
      }

      provider = {
        id: mappedProviderId,
        apiKey: decrypt(rows[0].api_key),
        model: rows[0].model,
      };
    }
  } catch (e) {
    console.error('[AI Compression] Erro ao buscar provider:', e);
  }

  if (!provider) {
    const providers = store?.aiConfig?.advancedAISettings?.providers || [];
    const providerObj = providers.find((item) => item.active) || providers[0];
    if (providerObj) {
      provider = providerObj;
    } else {
      return null;
    }
  }

  // Prepara o chat history para o prompt
  const chatText = oldMessages.map(m => `[${m.from_me ? 'IA' : 'Cliente'}] ${m.content}`).join('\n');
  
  const systemPrompt = `Você é um motor de Memória de Longo Prazo.
Abaixo está um log de conversa antiga (com mais de 2 meses) entre a IA e um cliente.
Esta conversa crua será DELETADA para economizar espaço.
Sua missão é ler a conversa e gerar um RESUMO COMPRIMIDO com os aprendizados fundamentais que a IA precisa lembrar sobre esse cliente.
Extraia:
- Perfil do cliente (nome, interesses, tom)
- Decisões ou compras feitas
- Objeções e como foram resolvidas

Seja direto, escreva em terceira pessoa, em formato de tópicos (bullet points) curtinhos.
NÃO crie conversas ou invente coisas. APENAS extraia o aprendizado.`;

  try {
    const result = await testProviderConnection(provider, {
      model: provider.model,
      message: chatText.slice(0, 15000), // Limita tamanho por segurança
      prompt: systemPrompt,
      maxTokens: 500,
      temperature: 0.1,
      timeoutMs: 30000,
    });

    if (result.ok && result.reply) {
      const summary = result.reply;

      // Adicionar esse resumo na tabela ai_conversation_memory (campo summary)
      await query(`
        UPDATE ai_conversation_memory 
        SET summary = summary || '\n[Memória Antiga Comprimida]: ' || $1,
            updated_at = NOW()
        WHERE contact_id = $2 AND company_id = $3
      `, [summary.trim(), contactId, companyId]);

      console.log(`[AI Compression] Histórico de ${contactId} comprimido com sucesso.`);
      return summary;
    }
  } catch (error) {
    console.error('[AI Compression] Falha ao comprimir histórico:', error.message);
  }
  
  return null;
}

module.exports = { compressContactHistory };
