/**
 * Lead Reactivation Service
 *
 * Analyzes conversations to identify leads that should be reactivated with AI.
 * Uses real data from PostgreSQL: last message time, funnel stage, temperature,
 * AI enabled state, and tags to decide the action for each lead.
 *
 * Actions: reactivate_ai | send_followup | mark_cold | escalate | no_action
 */

const { query } = require('../src/infrastructure/config/database');

const STALE_HOURS_WARM = 24;
const STALE_HOURS_HOT = 12;
const STALE_HOURS_COLD = 72;
const MAX_LEADS_PER_ANALYSIS = 50;

function classifyAction(conv) {
  const now = Date.now();
  const lastActivity = conv.updated_at ? new Date(conv.updated_at).getTime() : 0;
  const hoursInactive = (now - lastActivity) / (1000 * 60 * 60);
  const temp = String(conv.lead_temperature || 'warm').toLowerCase();
  const funnel = String(conv.funnel_stage || '').toLowerCase();
  const aiEnabled = conv.ai_enabled !== false;
  const tags = Array.isArray(conv.tags) ? conv.tags : [];

  // Already being handled by AI — no action needed
  if (aiEnabled && hoursInactive < 2) {
    return { action: 'no_action', reason: 'IA já ativa e conversa recente' };
  }

  // Hot lead inactive > threshold — urgent reactivation
  if (temp === 'hot' && hoursInactive > STALE_HOURS_HOT) {
    return {
      action: 'reactivate_ai',
      reason: `Lead quente inativo há ${Math.round(hoursInactive)}h — reativar IA para não perder`,
      priority: 'high',
      suggestedMessage: 'Oi! Vi que ficamos sem resposta. Posso te ajudar com algo mais?',
    };
  }

  // Warm lead inactive > threshold — follow-up
  if (temp === 'warm' && hoursInactive > STALE_HOURS_WARM) {
    return {
      action: 'send_followup',
      reason: `Lead morno inativo há ${Math.round(hoursInactive)}h — follow-up para reaquecer`,
      priority: 'medium',
      suggestedMessage: 'Olá! Tudo bem? Estou à disposição caso precise de mais informações.',
    };
  }

  // Cold lead very inactive — mark as cold/archive
  if (temp === 'cold' && hoursInactive > STALE_HOURS_COLD) {
    return {
      action: 'mark_cold',
      reason: `Lead frio há ${Math.round(hoursInactive)}h — considerar arquivar`,
      priority: 'low',
    };
  }

  // Lead in negotiation but AI is off — reactivate
  if (['negotiation', 'proposal', 'interested'].includes(funnel) && !aiEnabled) {
    return {
      action: 'reactivate_ai',
      reason: `Lead em "${funnel}" com IA desligada — reativar para continuar atendimento`,
      priority: 'high',
    };
  }

  // Lead with price_request tag but no recent follow-up
  if (tags.includes('price_request') && hoursInactive > 6 && !aiEnabled) {
    return {
      action: 'send_followup',
      reason: 'Pediu preço há mais de 6h sem retorno — follow-up de conversão',
      priority: 'high',
      suggestedMessage: 'Oi! Sobre o orçamento que você pediu, posso te passar mais detalhes?',
    };
  }

  // AI off for any warm+ lead inactive > 4h — reactivate
  if (!aiEnabled && hoursInactive > 4 && temp !== 'cold') {
    return {
      action: 'reactivate_ai',
      reason: `IA desligada há ${Math.round(hoursInactive)}h em lead ${temp} — reativar`,
      priority: 'medium',
    };
  }

  return { action: 'no_action', reason: 'Sem ação necessária no momento' };
}

/**
 * Analyze all leads and return reactivation recommendations.
 */
async function analyzeLeadsForReactivation(companyId = 'default') {
  const result = await query(
    `SELECT c.id, c.phone, c.lead_temperature, c.funnel_stage, c.tags, c.ai_enabled,
            c.agent_name, c.status, c.updated_at, c.summary, c.lead_intent,
            l.name, l.phone as lead_phone
     FROM conversations c
     LEFT JOIN leads l ON l.id = c.lead_id
     WHERE c.company_id = $1
       AND c.status = 'open'
       AND c.updated_at < NOW() - INTERVAL '4 hours'
     ORDER BY c.updated_at DESC
     LIMIT $2`,
    [companyId, MAX_LEADS_PER_ANALYSIS]
  );

  const recommendations = [];
  let reactivateCount = 0;
  let followupCount = 0;
  let coldCount = 0;

  for (const conv of result.rows) {
    const analysis = classifyAction(conv);
    if (analysis.action === 'no_action') continue;

    if (analysis.action === 'reactivate_ai') reactivateCount++;
    if (analysis.action === 'send_followup') followupCount++;
    if (analysis.action === 'mark_cold') coldCount++;

    recommendations.push({
      conversationId: conv.id,
      phone: conv.phone || conv.lead_phone,
      name: conv.name || conv.phone || conv.lead_phone,
      temperature: conv.lead_temperature,
      funnelStage: conv.funnel_stage,
      lastActivity: conv.updated_at,
      aiEnabled: conv.ai_enabled !== false,
      ...analysis,
    });
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  recommendations.sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2));

  return {
    totalAnalyzed: result.rows.length,
    recommendations,
    summary: {
      toReactivate: reactivateCount,
      toFollowUp: followupCount,
      toCold: coldCount,
      noAction: result.rows.length - reactivateCount - followupCount - coldCount,
    },
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Execute reactivation for selected leads.
 * @param {Array<{conversationId, action, message?}>} actions
 */
async function executeReactivations(actions, companyId = 'default') {
  const results = [];

  for (const item of actions) {
    try {
      if (item.action === 'reactivate_ai') {
        await query(
          `UPDATE conversations SET ai_enabled = true, lead_temperature = COALESCE(
            CASE WHEN lead_temperature = 'cold' THEN 'warm' ELSE lead_temperature END,
            'warm'
          ) WHERE id = $1 AND company_id = $2`,
          [item.conversationId, companyId]
        );
        results.push({ conversationId: item.conversationId, action: 'reactivate_ai', success: true });
      }

      if (item.action === 'send_followup') {
        // Enable AI and let the automation engine handle the next interaction
        await query(
          `UPDATE conversations SET ai_enabled = true WHERE id = $1 AND company_id = $2`,
          [item.conversationId, companyId]
        );
        results.push({ conversationId: item.conversationId, action: 'send_followup', success: true });
      }

      if (item.action === 'mark_cold') {
        await query(
          `UPDATE conversations SET lead_temperature = 'cold', ai_enabled = false
           WHERE id = $1 AND company_id = $2`,
          [item.conversationId, companyId]
        );
        results.push({ conversationId: item.conversationId, action: 'mark_cold', success: true });
      }
    } catch (err) {
      results.push({ conversationId: item.conversationId, action: item.action, success: false, error: err.message });
    }
  }

  return { executed: results.length, results };
}

module.exports = { analyzeLeadsForReactivation, executeReactivations };
