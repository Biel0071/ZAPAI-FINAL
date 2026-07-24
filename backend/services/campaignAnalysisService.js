/**
 * Campaign Analysis Service
 *
 * Computes REAL post-dispatch analytics for a campaign from data already in
 * PostgreSQL — no new tables required. For each contact in the campaign's
 * selected_contacts, we look at the `messages` table to determine:
 *   - whether the lead replied after the campaign's outbound message
 *   - how long they took to reply (first inbound after the last outbound)
 *   - a lightweight sentiment/quality read of their replies
 *
 * Response rate = leads that replied / leads contacted.
 * Quality = share of replies classified positive vs negative (keyword based).
 */

const { query } = require('../config/database');

const POSITIVE_PATTERNS = [
  'obrigad', 'valeu', 'otimo', 'ótimo', 'legal', 'quero', 'sim', 'perfeito', 'top',
  'fechado', 'bom', 'boa', 'gostei', 'interess', 'show', 'massa', 'consigo', 'pode',
  'vamos', 'bacana', 'excelente', 'maravilh', 'adorei', 'combinado',
];
const NEGATIVE_PATTERNS = [
  'nao quero', 'não quero', 'nao tenho', 'não tenho', 'caro', 'ruim', 'pare', 'parar',
  'nao gost', 'não gost', 'reclam', 'pessimo', 'péssimo', 'horrivel', 'horrível',
  'cancela', 'descadastr', 'sair', 'spam', 'nunca', 'absurdo', 'demora', 'insatisf',
];

function normalize(text) {
  return String(text || '').toLowerCase().trim();
}

function classifySentiment(texts) {
  const joined = texts.map(normalize);
  let pos = 0;
  let neg = 0;
  for (const entry of joined) {
    pos += POSITIVE_PATTERNS.reduce((sum, p) => sum + (entry.includes(p) ? 1 : 0), 0);
    neg += NEGATIVE_PATTERNS.reduce((sum, p) => sum + (entry.includes(p) ? 1 : 0), 0);
  }
  if (neg > pos) return 'negative';
  if (pos > neg) return 'positive';
  return 'neutral';
}

function extractPhones(campaign) {
  const list = Array.isArray(campaign.selected_contacts)
    ? campaign.selected_contacts
    : Array.isArray(campaign.selectedContacts)
      ? campaign.selectedContacts
      : [];
  return list
    .map((c) => String((c && (c.phone || c.number || c.id)) || '').replace(/\D/g, '').trim())
    .filter(Boolean);
}

/**
 * Analyze a campaign's real engagement metrics.
 * @param {string} campaignId
 * @param {string} companyId
 */
async function analyzeCampaign(campaignId, companyId = 'default') {
  const campaignRes = await query(
    `SELECT id, name, status, selected_contacts, queue, started_at, completed_at, company_id
     FROM campaigns WHERE id = $1 AND company_id = $2 LIMIT 1`,
    [campaignId, companyId]
  );

  if (campaignRes.rows.length === 0) {
    const err = new Error('Campaign not found');
    err.statusCode = 404;
    throw err;
  }

  const campaign = campaignRes.rows[0];
  const phones = extractPhones(campaign);
  const startedAt = campaign.started_at ? new Date(campaign.started_at) : null;

  const queue = campaign.queue || {};
  const sent = Number(queue.sent ?? 0);
  const failed = Number(queue.failed ?? 0);
  const total = Number(queue.total ?? phones.length);

  const leads = [];
  let repliedCount = 0;
  let totalResponseMs = 0;
  let responseSamples = 0;
  const sentimentTally = { positive: 0, neutral: 0, negative: 0 };

  for (const phone of phones) {
    // Last outbound to this phone (the campaign message) and the first inbound after it.
    // Match by phone suffix to tolerate JID/format differences.
    const suffix = phone.slice(-8);
    let outbound = null;
    let inbound = null;

    try {
      const outRes = await query(
        `SELECT created_at FROM messages
         WHERE from_me = true AND phone LIKE $1
         ${startedAt ? 'AND created_at >= $2' : ''}
         ORDER BY created_at ASC LIMIT 1`,
        startedAt ? [`%${suffix}%`, startedAt.toISOString()] : [`%${suffix}%`]
      );
      outbound = outRes.rows[0] || null;

      if (outbound) {
        const inRes = await query(
          `SELECT created_at, COALESCE(text, content, '') AS body FROM messages
           WHERE from_me = false AND phone LIKE $1 AND created_at > $2
           ORDER BY created_at ASC LIMIT 3`,
          [`%${suffix}%`, new Date(outbound.created_at).toISOString()]
        );
        inbound = inRes.rows;
      }
    } catch {
      // tolerate per-lead query failures; treat as no-reply
    }

    const replied = Array.isArray(inbound) && inbound.length > 0;
    let responseMs = null;
    let sentiment = 'neutral';

    if (replied) {
      repliedCount += 1;
      responseMs = new Date(inbound[0].created_at).getTime() - new Date(outbound.created_at).getTime();
      if (Number.isFinite(responseMs) && responseMs >= 0) {
        totalResponseMs += responseMs;
        responseSamples += 1;
      }
      sentiment = classifySentiment(inbound.map((m) => m.body));
      sentimentTally[sentiment] += 1;
    }

    leads.push({
      phone,
      status: replied ? 'responded' : outbound ? 'sent' : 'pending',
      responseMs,
      sentiment: replied ? sentiment : null,
    });
  }

  const contacted = phones.length;
  const responseRate = contacted > 0 ? Math.round((repliedCount / contacted) * 100) : 0;
  const avgResponseMs = responseSamples > 0 ? Math.round(totalResponseMs / responseSamples) : null;

  // Quality score: positive replies weighted up, negative down, scaled 0-100.
  const totalSentiment = sentimentTally.positive + sentimentTally.neutral + sentimentTally.negative;
  const qualityScore = totalSentiment > 0
    ? Math.round(((sentimentTally.positive + sentimentTally.neutral * 0.5) / totalSentiment) * 100)
    : null;

  const elapsedMs = startedAt
    ? (campaign.completed_at ? new Date(campaign.completed_at).getTime() : Date.now()) - startedAt.getTime()
    : null;

  return {
    campaignId: campaign.id,
    name: campaign.name,
    status: campaign.status,
    metrics: {
      total,
      sent,
      failed,
      contacted,
      replied: repliedCount,
      responseRate,
      avgResponseMs,
      qualityScore,
      sentiment: sentimentTally,
      elapsedMs,
    },
    leads,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { analyzeCampaign };
