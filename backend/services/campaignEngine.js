function evaluateCampaign(conversation = {}) {
  const temperature = conversation.lead_temperature || 'cold';
  const stage = conversation.funnel_stage || 'new_lead';

  if (stage === 'closed' || stage === 'lost') {
    return null;
  }

  if (temperature === 'cold') {
    return {
      campaign: 'cold_leads',
      message: 'Lead frio identificado para campanha de reativação.',
      target: 'cold leads',
    };
  }

  if (temperature === 'warm') {
    return {
      campaign: 'warm_leads',
      message: 'Lead morno identificado para campanha de avanço comercial.',
      target: 'warm leads',
    };
  }

  if (temperature === 'hot' || temperature === 'ready_to_buy') {
    return {
      campaign: 'hot_leads',
      message: 'Lead quente identificado para campanha de fechamento.',
      target: 'hot leads',
    };
  }

  return null;
}

module.exports = {
  evaluateCampaign,
};