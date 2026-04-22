function generateSalesStrategy(leadAnalysis = {}) {
  const intent = leadAnalysis.intent || 'information';
  const temperature = leadAnalysis.lead_temperature || 'cold';

  if (temperature === 'ready_to_buy' || intent === 'purchase_intent') {
    return {
      goal: 'close_sale',
      priority: 'high',
      tone: 'decisive',
    };
  }

  if (intent === 'price_request') {
    return {
      goal: 'send_price',
      priority: 'high',
      tone: 'consultive',
    };
  }

  if (intent === 'objection') {
    return {
      goal: 'overcome_objection',
      priority: 'high',
      tone: 'reassuring',
    };
  }

  if (temperature === 'hot') {
    return {
      goal: 'advance_negotiation',
      priority: 'medium',
      tone: 'confident',
    };
  }

  return {
    goal: 'educate',
    priority: temperature === 'warm' ? 'medium' : 'low',
    tone: 'friendly',
  };
}

module.exports = {
  generateSalesStrategy,
};