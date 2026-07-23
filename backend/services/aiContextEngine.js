const { query: dbQuery } = require('../config/database');

/**
 * Constrói a janela de contexto enriquecida para a IA antes de responder a qualquer cliente
 */
async function buildFullCustomerContext(phone, companyId = 'default') {
  try {
    const normalizedPhone = String(phone || '').replace(/\D/g, '');

    // 1. Busca conversa e tags
    const convRes = await dbQuery(
      `SELECT id, name, tags, funnel_stage, lead_temperature, notes, ai_enabled
       FROM conversations 
       WHERE phone LIKE $1 OR phone = $2 LIMIT 1`,
      [`%${normalizedPhone}%`, phone]
    );

    const conversation = convRes.rows[0] || null;

    // 2. Busca últimas 15 mensagens da conversa
    let historyMessages = [];
    if (conversation?.id) {
      const msgRes = await dbQuery(
        `SELECT from_me, text, media_type, created_at
         FROM messages 
         WHERE conversation_id = $1
         ORDER BY created_at DESC LIMIT 15`,
        [conversation.id]
      );
      historyMessages = msgRes.rows.reverse();
    }

    const contextObject = {
      phone,
      customerName: conversation?.name || 'Cliente',
      funnelStage: conversation?.funnel_stage || 'Novo Lead',
      leadTemperature: conversation?.lead_temperature || 'morno',
      tags: conversation?.tags || [],
      notes: conversation?.notes || '',
      recentMessagesCount: historyMessages.length,
      historySummary: historyMessages.map((m) => `${m.from_me ? 'Atendente' : 'Cliente'}: ${m.text || '[Mídia]'}`).join('\n'),
      timestamp: new Date().toISOString(),
    };

    return contextObject;
  } catch (err) {
    console.warn('[AI_CONTEXT_ENGINE] Erro ao construir contexto do cliente:', err.message);
    return {
      phone,
      customerName: 'Cliente',
      funnelStage: 'Atendimento',
      historySummary: '',
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = {
  buildFullCustomerContext,
};
