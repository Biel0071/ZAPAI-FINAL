const cron = require('node-cron');
const { query } = require('../src/infrastructure/config/database');
const { getAgentsSync } = require('../src/ai/agents/services/aiAgentService');
const { executeAlgorithmicFollowupForLead } = require('./aiFollowupEngine');
const sessionManager = require('./sessionManager');

let activeCron = null;
let cronStatus = {
  active: false,
  schedule: '*/15 * * * *',
  lastRunAt: null,
  lastEvaluatedCount: 0,
  lastDispatchedCount: 0,
  lastSkippedPurchasedCount: 0,
  totalDispatched: 0,
};

async function runFollowupScan({ ignoreBusinessHours = false, maxBatch = 3 } = {}) {
  cronStatus.lastRunAt = new Date().toISOString();
  try {
    let conversations;
    try {
      const res = await query(
        `SELECT c.id, c.remote_jid, COALESCE(l.phone, c.remote_jid) AS phone,
                COALESCE(NULLIF(l.name, ''), 'Cliente') AS lead_name,
                c.agent_name, c.company_id, c.updated_at, c.session_id,
                c.funnel_stage, c.lead_temperature, c.tags, c.ai_enabled, c.last_message,
                c.ai_last_followup_at
         FROM conversations c
         LEFT JOIN leads l ON l.id = c.lead_id
         WHERE c.status = 'open'
           AND c.session_id IS NOT NULL
           AND c.ai_enabled = true
           AND COALESCE(c.funnel_stage, '') NOT IN ('closed', 'fechamento', 'agendado', 'cancelado', 'suporte', 'aguardando_pix', 'finalizado', 'pago', 'concluido', 'pedido_confirmado', 'won')
           AND NOT ('followup_esgotado' = ANY(COALESCE(c.tags, '{}')))
           AND NOT ('followup_desativado' = ANY(COALESCE(c.tags, '{}')))
           AND c.updated_at < NOW() - INTERVAL '2 hours'
           AND c.updated_at > NOW() - INTERVAL '14 days'
           AND c.remote_jid NOT LIKE '%@g.us%'
           AND c.remote_jid NOT LIKE '%@broadcast%'
           AND c.remote_jid NOT LIKE '%status%'
         ORDER BY
           CASE WHEN 'campanha_50_leads_ia' = ANY(COALESCE(c.tags, '{}')) THEN 0 ELSE 1 END ASC,
           c.updated_at DESC
         LIMIT 15`
      );
      conversations = res.rows;
    } catch (queryErr) {
      if (queryErr.message && queryErr.message.includes('ai_last_followup_at')) {
        const res = await query(
          `SELECT c.id, c.remote_jid, COALESCE(l.phone, c.remote_jid) AS phone,
                  COALESCE(NULLIF(l.name, ''), 'Cliente') AS lead_name,
                  c.agent_name, c.company_id, c.updated_at, c.session_id,
                  c.funnel_stage, c.lead_temperature, c.tags, c.ai_enabled, c.last_message,
                  NULL::timestamp with time zone AS ai_last_followup_at
           FROM conversations c
           LEFT JOIN leads l ON l.id = c.lead_id
           WHERE c.status = 'open'
             AND c.session_id IS NOT NULL
             AND c.ai_enabled = true
             AND COALESCE(c.funnel_stage, '') NOT IN ('closed', 'fechamento', 'agendado', 'cancelado', 'suporte', 'aguardando_pix', 'finalizado', 'pago', 'concluido', 'pedido_confirmado', 'won')
             AND NOT ('followup_esgotado' = ANY(COALESCE(c.tags, '{}')))
             AND NOT ('followup_desativado' = ANY(COALESCE(c.tags, '{}')))
             AND c.updated_at < NOW() - INTERVAL '2 hours'
             AND c.updated_at > NOW() - INTERVAL '14 days'
             AND c.remote_jid NOT LIKE '%@g.us%'
             AND c.remote_jid NOT LIKE '%@broadcast%'
             AND c.remote_jid NOT LIKE '%status%'
           ORDER BY
             CASE WHEN 'campanha_50_leads_ia' = ANY(COALESCE(c.tags, '{}')) THEN 0 ELSE 1 END ASC,
             c.updated_at DESC
           LIMIT 15`
        );
        conversations = res.rows;
      } else {
        throw queryErr;
      }
    }

    cronStatus.lastEvaluatedCount = conversations.length;
    if (!conversations.length) {
      return { ok: true, evaluated: 0, dispatched: 0, skippedPurchased: 0 };
    }

    let dispatched = 0;
    let skippedPurchased = 0;

    for (const conv of conversations) {
      if (dispatched >= maxBatch) break;

      const companyId = conv.company_id || 'default';
      const session = sessionManager.getSession(conv.session_id);
      if (!session?.sock || String(session.status || '').toLowerCase() !== 'connected'
        || session.systemConnected === false || session.automationPaused === true
        || (session.companyId && String(session.companyId) !== String(companyId))) continue;
      const agents = getAgentsSync(companyId) || [];
      const agent =
        agents.find(
          (a) =>
            String(a.key || '').toLowerCase() === String(conv.agent_name || '').toLowerCase() ||
            String(a.name || '').toLowerCase() === String(conv.agent_name || '').toLowerCase()
        ) || agents.find((a) => a.active) || agents[0];

      if (agent && agent.followUp && agent.followUp.active === false) {
        continue;
      }

      if (!ignoreBusinessHours && agent?.followUp?.respectBusinessHours !== false) {
        const brHour = Number(
          new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Sao_Paulo',
            hour: 'numeric',
            hour12: false,
          }).format(new Date())
        );
        if (brHour < 8 || brHour >= 20) {
          continue;
        }
      }

      // Check how many consecutive agent messages were already sent to respect maxAttempts
      const maxAttempts = Number(agent?.followUp?.maxAttempts) || 3;
      const recentMsgsRes = await query(
        `SELECT sender, content, timestamp
         FROM messages
         WHERE conversation_id = $1
         ORDER BY timestamp DESC
         LIMIT 10`,
        [conv.id]
      );
      const recentMsgs = recentMsgsRes.rows || [];
      if (recentMsgs.length === 0) continue;

      let consecutiveAgentMsgs = 0;
      let lastAgentMsgTime = null;
      let lastCustomerMsgTime = null;

      for (const m of recentMsgs) {
        const isAgent = m.sender === 'agent' || m.sender === 'bot' || m.sender === 'system' || m.sender === 'ai';
        if (isAgent) {
          if (lastCustomerMsgTime === null) {
            consecutiveAgentMsgs++;
            if (!lastAgentMsgTime && m.timestamp) {
              lastAgentMsgTime = new Date(m.timestamp).getTime();
            }
          }
        } else {
          if (!lastCustomerMsgTime && m.timestamp) {
            lastCustomerMsgTime = new Date(m.timestamp).getTime();
          }
        }
      }

      // Check if customer replied after the last follow-up was dispatched
      if (lastCustomerMsgTime && conv.ai_last_followup_at) {
        const lastFollowupTime = new Date(conv.ai_last_followup_at).getTime();
        if (lastCustomerMsgTime > lastFollowupTime) {
          const { resetFollowupOnCustomerResponse } = require('./aiFollowupEngine');
          await resetFollowupOnCustomerResponse(conv.id);
          conv.tags = (conv.tags || []).filter((t) => !t.startsWith('followup_'));
        }
      }

      const convTags = Array.isArray(conv.tags) ? conv.tags : [];
      let followupsSent = 0;
      if (convTags.includes('followup_toque_3')) {
        followupsSent = 3;
      } else if (convTags.includes('followup_toque_2')) {
        followupsSent = 2;
      } else if (convTags.includes('followup_toque_1')) {
        followupsSent = 1;
      } else {
        const hasAnyCustomerMsg = recentMsgs.some(
          (m) => !['agent', 'bot', 'system', 'assistant', 'operator', 'ai'].includes(m.sender)
        );
        if (!hasAnyCustomerMsg) {
          followupsSent = consecutiveAgentMsgs;
        } else {
          followupsSent = 0;
        }
      }

      // Cap at 3 attempts: auto-deactivate follow-up after 3 attempts without response
      if (followupsSent >= maxAttempts) {
        const { deactivateFollowupForConversation } = require('./aiFollowupEngine');
        await deactivateFollowupForConversation(conv.id, `max_attempts_exceeded_${maxAttempts}`);
        continue;
      }

      const now = Date.now();
      const currentAttempt = followupsSent + 1; // 1, 2, or 3

      // Progressive Human Cadence:
      // Attempt 1: Minimum 4 to 6 hours after last customer message/interaction (never < 2 hours)
      // Attempt 2: Minimum 24 hours after Attempt 1
      // Attempt 3: Minimum 48 hours after Attempt 2
      if (currentAttempt === 1) {
        const interactionRefTime = Math.max(lastCustomerMsgTime || 0, lastAgentMsgTime || 0) || new Date(conv.updated_at).getTime();
        const minutesSinceInteraction = (now - interactionRefTime) / (1000 * 60);
        const minFirstAttemptMinutes = Math.max(120, Number(agent?.followUp?.intervalHours || 4) * 60);
        if (minutesSinceInteraction < minFirstAttemptMinutes) {
          continue;
        }
      } else if (currentAttempt === 2) {
        const agentRefTime = conv.ai_last_followup_at ? new Date(conv.ai_last_followup_at).getTime() : (lastAgentMsgTime || new Date(conv.updated_at).getTime());
        const minutesSinceAttempt1 = (now - agentRefTime) / (1000 * 60);
        // Minimum 24 hours = 1440 minutes
        if (minutesSinceAttempt1 < 1440) {
          continue;
        }
      } else if (currentAttempt === 3) {
        const agentRefTime = conv.ai_last_followup_at ? new Date(conv.ai_last_followup_at).getTime() : (lastAgentMsgTime || new Date(conv.updated_at).getTime());
        const minutesSinceAttempt2 = (now - agentRefTime) / (1000 * 60);
        // Minimum 48 hours = 2880 minutes
        if (minutesSinceAttempt2 < 2880) {
          continue;
        }
      }

      const result = await executeAlgorithmicFollowupForLead({
        conversationId: conv.id,
        companyId,
        sessionId: conv.session_id,
        attempt: currentAttempt,
      });

      if (result.skipped && (result.reason === 'already_purchased' || result.reason === 'max_attempts_exceeded')) {
        skippedPurchased++;
        continue;
      }

      if (result.ok) {
        dispatched++;
        cronStatus.totalDispatched++;
        console.log(
          `[FollowUpCron] Follow-up algorítmico (Toque ${currentAttempt}/3) enfileirado para ${conv.lead_name} (${conv.remote_jid}) [${result.leadAlgorithm?.algorithmCode}]`
        );
      }
    }

    cronStatus.lastDispatchedCount = dispatched;
    cronStatus.lastSkippedPurchasedCount = skippedPurchased;
    return { ok: true, evaluated: conversations.length, dispatched, skippedPurchased };
  } catch (error) {
    console.error('[FollowUpCron] Erro na varredura:', error.message);
    return { ok: false, error: error.message };
  }
}

function startCron() {
  if (activeCron) {
    activeCron.stop();
  }

  activeCron = cron.schedule('*/15 * * * *', () => {
    void runFollowupScan();
  });

  cronStatus.active = true;
  console.log('[FollowUpCron] Motor de Follow-up Automático IA ativado (a cada 15 min, com Algoritmo do Lead & Proteção de Compra).');
}

function stopCron() {
  if (activeCron) {
    activeCron.stop();
    activeCron = null;
  }
  cronStatus.active = false;
}

function getFollowupCronStatus() {
  return { ...cronStatus };
}

module.exports = {
  startCron,
  stopCron,
  runFollowupScan,
  getFollowupCronStatus,
};
