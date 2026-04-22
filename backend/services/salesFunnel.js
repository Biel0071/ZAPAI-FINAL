const STAGES = {
  CLOSED: 'closed',
  INTERESTED: 'interested',
  LOST: 'lost',
  NEGOTIATION: 'negotiation',
  NEW_LEAD: 'new_lead',
  PRICE_SENT: 'price_sent',
  READY_TO_BUY: 'ready_to_buy',
};

function getNextFunnelStage(currentStage = STAGES.NEW_LEAD, leadAnalysis = {}, message = '') {
  const intent = leadAnalysis.intent || 'information';
  const temperature = leadAnalysis.lead_temperature || 'cold';
  const normalizedMessage = String(message).toLowerCase();

  if (/(fechado|pode fechar|vou levar|confirmado)/i.test(normalizedMessage)) {
    return STAGES.CLOSED;
  }

  if (/(desisti|cancelar|não quero mais|deixa pra la|deixa pra lá)/i.test(normalizedMessage)) {
    return STAGES.LOST;
  }

  if (temperature === 'ready_to_buy' || intent === 'purchase_intent') {
    return STAGES.READY_TO_BUY;
  }

  if (intent === 'objection') {
    return STAGES.NEGOTIATION;
  }

  if (intent === 'price_request') {
    return STAGES.PRICE_SENT;
  }

  if (temperature === 'warm' || intent === 'question') {
    return currentStage === STAGES.NEW_LEAD ? STAGES.INTERESTED : currentStage;
  }

  return currentStage || STAGES.NEW_LEAD;
}

function buildLeadTags(leadAnalysis = {}, funnelStage = STAGES.NEW_LEAD) {
  const tags = new Set();

  if (leadAnalysis.intent) {
    tags.add(leadAnalysis.intent);
  }

  if (leadAnalysis.lead_temperature) {
    tags.add(leadAnalysis.lead_temperature);
  }

  if (leadAnalysis.next_action) {
    tags.add(leadAnalysis.next_action);
  }

  if (funnelStage) {
    tags.add(funnelStage);
  }

  return [...tags];
}

module.exports = {
  buildLeadTags,
  FUNNEL_STAGES: STAGES,
  getNextFunnelStage,
};