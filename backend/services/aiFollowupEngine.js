/**
 * AI Follow-up & Lead Recovery Engine Service
 * Automatically plans and schedules non-robotic, multi-touch follow-ups for stalled conversations.
 */

const { query } = require('../src/infrastructure/config/database');

/**
 * Generates an automated multi-step follow-up plan for a given lead/conversation
 */
async function generateFollowupPlan({ conversationId, phone, companyId = 'default' }) {
  let conversation = null;
  try {
    const res = await query(
      `SELECT id, phone, lead_name, summary, lead_temperature, lead_intent, funnel_stage, tags, updated_at
       FROM conversations WHERE id = $1 OR phone = $2 LIMIT 1`,
      [conversationId, phone]
    );
    conversation = res.rows[0] || null;
  } catch (err) {
    console.warn('[AIFollowupEngine] DB Query error:', err.message);
  }

  const name = conversation?.lead_name || 'Cliente';
  const temperature = conversation?.lead_temperature || 'warm';

  // Multi-step follow-up sequence schedule
  const steps = [
    {
      delay: '4 horas',
      delayMinutes: 240,
      timingLabel: 'Hoje (Após 4 horas)',
      message: `Olá ${name}, tudo bem? Fiquei pensando sobre o orçamento que conversamos mais cedo. Ficou alguma dúvida sobre os modelos ou prazos de entrega que eu possa esclarecer?`,
      type: 'duvida_orcamento',
      goal: 'Sanar dúvidas e retomar diálogo imediato',
    },
    {
      delay: '2 dias',
      delayMinutes: 2880,
      timingLabel: 'Em 2 dias',
      message: `Oi ${name}! Preparei nosso catálogo atualizado com as especificações técnicas completas dos itens que você viu. Segue o link para você conferir quando tiver um tempinho!`,
      type: 'envio_catalogo',
      goal: 'Agregar valor técnico sem pressionar',
    },
    {
      delay: '5 dias',
      delayMinutes: 7200,
      timingLabel: 'Em 5 dias',
      message: `${name}, conseguimos uma condição promocional especial com faturamento direto nesta semana! Posso recalcular seu orçamento com esse desconto adicional?`,
      type: 'oferta_condicao',
      goal: 'Ativar gatilho de benefício financeiro',
    },
    {
      delay: '10 dias',
      delayMinutes: 14400,
      timingLabel: 'Em 10 dias',
      message: `Olá ${name}! Estamos postando vários projetos concluídos e dicas de instalação no nosso Instagram oficial. Dá uma olhada em como fica o resultado final!`,
      type: 'engajamento_social',
      goal: 'Conectar em canal secundário (Instagram/Social)',
    },
    {
      delay: '15 dias',
      delayMinutes: 21600,
      timingLabel: 'Em 15 dias',
      message: `Oi ${name}, chegaram novos lotes com tabela atualizada de fábrica. Gostaria de receber os destaques da semana?`,
      type: 'novidades_estoque',
      goal: 'Reabrir oportunidade com novidades',
    },
    {
      delay: '30 dias',
      delayMinutes: 43200,
      timingLabel: 'Em 30 dias',
      message: `Olá ${name}! Passando para saber como está o andamento do seu projeto. Caso precise de qualquer suporte ou novas cotações, estamos à disposição por aqui!`,
      type: 'reativacao_base',
      goal: 'Reativação de relacionamento de longo prazo',
    },
  ];

  return {
    success: true,
    data: {
      conversationId: conversationId || conversation?.id,
      phone: phone || conversation?.phone,
      leadName: name,
      temperature,
      totalSteps: steps.length,
      steps,
      createdAt: new Date().toISOString(),
    },
  };
}

/**
 * Triggers an AI recovery approach for a lead stalled for X days/hours
 */
async function generateRecoveryApproach({ conversationId, phone, lastTopic = '' }) {
  const topics = lastTopic ? `relacionado a "${lastTopic}"` : 'em aberto';

  const recoverySuggestions = [
    `Conseguimos liberar uma condição diferenciada de pagamento no boleto ou PIX para pedidos fechados este mês.`,
    `A fábrica atualizou a tabela de valores, mas consegui manter a proposta anterior garantida para você por mais 48 horas.`,
    `Chegou uma nova remessa com pronta entrega e frete compartilhado para a sua região.`,
  ];

  const suggestion = recoverySuggestions[Math.floor(Math.random() * recoverySuggestions.length)];

  return {
    success: true,
    data: {
      conversationId,
      phone,
      approachType: 'reativacao_inteligente',
      suggestedMessage: `Olá! Passando para te avisar que ${suggestion} Gostaria que eu reenviasse o resumo atualizado?`,
      conversionHook: 'Condição Especial por Tempo Limitado',
      recommendedChannel: 'WhatsApp Direct',
    },
  };
}

module.exports = {
  generateFollowupPlan,
  generateRecoveryApproach,
};
