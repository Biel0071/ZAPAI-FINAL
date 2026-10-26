const { query } = require('../src/infrastructure/config/database');
const sessionManager = require('./sessionManager');

/**
 * Calculates WhatsApp chip maturation stage and recommended daily quota.
 * Progression table:
 * - Stage 1 (Days 1-2): 30 msgs/day - Safe Mode (Human)
 * - Stage 2 (Days 3-4): 60 msgs/day - Safe Mode (Human)
 * - Stage 3 (Days 5-7): 120 msgs/day - Balanced Mode
 * - Stage 4 (Week 2): 250 msgs/day - Balanced Mode
 * - Stage 5 (15+ days): 500 msgs/day - Commercial Scale
 */
async function getChipMaturationStats(companyId = 'default', targetSessionId = null) {
  // Resolve session: use targetSessionId if provided, otherwise find connected session or fallback to 'main'
  let sessionId = targetSessionId && targetSessionId !== 'all' ? targetSessionId : null;
  if (!sessionId) {
    const sessions = sessionManager.listSessions ? sessionManager.listSessions() : [];
    const connectedSession = sessions.find(s => s.status === 'connected') || sessions[0];
    sessionId = connectedSession?.sessionId || connectedSession?.id || 'main';
  }

  // 1. Calculate age of operation for this specific session
  const ageRes = await query(
    `SELECT MIN(created_at) as first_message_at, COUNT(*) as total_lifetime_messages
     FROM messages
     WHERE company_id = $1
       AND (session_id = $2 OR ($2 = 'main' AND (session_id IS NULL OR session_id = '')))` ,
    [companyId, sessionId]
  );

  const rawFirstMsg = ageRes.rows[0]?.first_message_at;
  const totalLifetimeMessages = Number(ageRes.rows[0]?.total_lifetime_messages || 0);

  let daysActive = 1;
  let firstMsgDate = new Date();
  if (rawFirstMsg && totalLifetimeMessages > 0) {
    firstMsgDate = new Date(rawFirstMsg);
    const msActive = Math.max(0, Date.now() - firstMsgDate.getTime());
    daysActive = Math.max(1, Math.floor(msActive / (1000 * 60 * 60 * 24)) + 1);
  }

  // 2. Count messages sent today for this specific session
  const todayRes = await query(
    `SELECT COUNT(*) as sent_today
     FROM messages
     WHERE company_id = $1 AND from_me = TRUE
       AND (session_id = $2 OR ($2 = 'main' AND (session_id IS NULL OR session_id = '')))
       AND created_at >= CURRENT_DATE`,
    [companyId, sessionId]
  );
  const sentToday = Number(todayRes.rows[0]?.sent_today || 0);

  // 3. Count campaign messages sent today for this specific session
  let campaignSentToday = 0;
  try {
    const campTodayRes = await query(
      `SELECT COALESCE(SUM((queue->>'sent')::int), 0) as campaign_sent_today
       FROM campaigns
       WHERE company_id = $1
         AND (settings->>'sessionId' = $2 OR ($2 = 'main' AND (settings->>'sessionId' IS NULL OR settings->>'sessionId' = '')))
         AND updated_at >= CURRENT_DATE`,
      [companyId, sessionId]
    );
    campaignSentToday = Number(campTodayRes.rows[0]?.campaign_sent_today || 0);
  } catch {
    campaignSentToday = 0;
  }

  // 4. Calculate Stage & Quota
  let stage = 1;
  let stageName = 'Aquecimento Inicial';
  let recommendedDailyLimit = 30;
  let safeSpeedRecommendation = 'safe';
  let riskLevel = 'baixo';

  if (daysActive <= 2) {
    stage = 1;
    stageName = 'Aquecimento Inicial (Dias 1-2)';
    recommendedDailyLimit = 30;
    safeSpeedRecommendation = 'safe';
    riskLevel = 'baixo';
  } else if (daysActive <= 4) {
    stage = 2;
    stageName = 'Rampa de Confiança (Dias 3-4)';
    recommendedDailyLimit = 60;
    safeSpeedRecommendation = 'safe';
    riskLevel = 'baixo';
  } else if (daysActive <= 7) {
    stage = 3;
    stageName = 'Maturação Intermediária (Dias 5-7)';
    recommendedDailyLimit = 120;
    safeSpeedRecommendation = 'balanced';
    riskLevel = 'moderado';
  } else if (daysActive <= 14) {
    stage = 4;
    stageName = 'Maturação Avançada (Semana 2)';
    recommendedDailyLimit = 250;
    safeSpeedRecommendation = 'balanced';
    riskLevel = 'seguro';
  } else {
    stage = 5;
    stageName = 'Chip Maduro & Consolidado';
    recommendedDailyLimit = 500;
    safeSpeedRecommendation = 'balanced';
    riskLevel = 'seguro';
  }

  const progressPercent = Math.min(100, Math.round((sentToday / recommendedDailyLimit) * 100));
  const remainingQuota = Math.max(0, recommendedDailyLimit - sentToday);

  return {
    sessionId,
    daysActive,
    totalLifetimeMessages,
    firstMessageAt: firstMsgDate.toISOString(),
    stage,
    stageName,
    recommendedDailyLimit,
    sentToday,
    campaignSentToday,
    remainingQuota,
    progressPercent,
    safeSpeedRecommendation,
    riskLevel,
    progressionTable: [
      { stage: 1, phase: 'Fase 1 (Dias 1-2)', limit: 30, speed: 'Modo Seguro (Humano)', status: daysActive <= 2 ? 'atual' : 'concluido' },
      { stage: 2, phase: 'Fase 2 (Dias 3-4)', limit: 60, speed: 'Modo Seguro (Humano)', status: daysActive >= 3 && daysActive <= 4 ? 'atual' : daysActive > 4 ? 'concluido' : 'proximo' },
      { stage: 3, phase: 'Fase 3 (Dias 5-7)', limit: 120, speed: 'Modo Equilibrado', status: daysActive >= 5 && daysActive <= 7 ? 'atual' : daysActive > 7 ? 'concluido' : 'proximo' },
      { stage: 4, phase: 'Fase 4 (Semana 2)', limit: 250, speed: 'Modo Equilibrado', status: daysActive >= 8 && daysActive <= 14 ? 'atual' : daysActive > 14 ? 'concluido' : 'proximo' },
      { stage: 5, phase: 'Fase 5 (Maduro 15d+)', limit: 500, speed: 'Escala Comercial', status: daysActive >= 15 ? 'atual' : 'proximo' },
    ]
  };
}

module.exports = {
  getChipMaturationStats,
};
