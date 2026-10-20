const outboundQueueService = require('../../../services/outboundQueueService');
const campaignDispatchEngine = require('../../../services/campaignDispatchEngine');
const sessionManager = require('../../../services/sessionManager');
const { query } = require('../../infrastructure/config/database');
const aiFollowupEngine = require('../../../services/aiFollowupEngine');
const { normalizePhone } = require('../../../services/whatsapp/shared/identifiers');

async function getOwnedConnectedSession(companyId, sessionId) {
  const owned = await query(
    'SELECT session_id FROM sessions WHERE company_id = $1 AND session_id = $2 LIMIT 1',
    [companyId, sessionId]
  );
  if (!owned.rows.length) return { error: { status: 404, message: 'Conexão não encontrada para esta empresa.' } };
  const session = sessionManager.getSession(sessionId);
  if (!session?.sock || String(session.status || '').toLowerCase() !== 'connected' || session.systemConnected === false
    || (session.companyId && String(session.companyId) !== String(companyId))) {
    return { error: { status: 409, message: 'Conecte o WhatsApp antes de revisar as automações.' } };
  }
  return { session };
}

async function getSessionReviewItems({ companyId, sessionId, allowFollowups }) {
  const contacts = new Map();
  const getContact = (phone) => {
    const key = normalizePhone(phone);
    if (!key) return null;
    if (!contacts.has(key)) contacts.set(key, {
      id: key, contactId: key, phone: key, name: '', sources: [], campaignStates: [], attempts: 0, followupsSent: 0,
    });
    return contacts.get(key);
  };

  for (const item of outboundQueueService.listSessionPausedItems({ companyId, sessionId })) {
    const contact = getContact(item.phone);
    if (!contact) continue;
    const source = String(item.metadata?.source || item.metadata?.systemTag || (item.metadata?.campaignId ? 'Campanha' : 'Fila'));
    if (!contact.sources.includes(source)) contact.sources.push(source);
    contact.attempts += Number(item.attemptCount || 0);
    contact.name ||= String(item.metadata?.contactName || item.metadata?.name || '');
  }

  const campaigns = await campaignDispatchEngine.listSessionPausedCampaignContacts({ companyId, sessionId });
  for (const item of campaigns) {
    const contact = getContact(item.contact?.phone || item.contact?.number || item.contact?.remoteJid);
    if (!contact) continue;
    contact.name ||= String(item.contact?.name || item.contact?.contactName || '');
    if (!contact.sources.includes('Campanha')) contact.sources.push('Campanha');
    contact.campaignStates.push(`${item.campaignName || 'Campanha'} · ${item.state}`);
  }

  if (allowFollowups) {
    const followups = await aiFollowupEngine.listSessionFollowups({ companyId, sessionId });
    for (const item of followups) {
      const contact = getContact(item.phone || item.remote_jid);
      if (!contact) continue;
      contact.name ||= String(item.name || '');
      if (!contact.sources.includes('Follow-up IA')) contact.sources.push('Follow-up IA');
      contact.followupsSent = Math.max(contact.followupsSent, Number(item.followupsSent || 0));
      contact.conversationId = String(item.id);
    }
  }

  return Array.from(contacts.values()).sort((a, b) => a.phone.localeCompare(b.phone));
}

async function listSessionAutomations(req, res) {
  const companyId = String(req.authTenantId || '').trim();
  const sessionId = sessionManager.normalizeSessionName(req.params.sessionId);
  if (!companyId) return res.status(401).json({ error: 'Autenticação obrigatória.' });
  try {
    const context = await getOwnedConnectedSession(companyId, sessionId);
    if (context.error) return res.status(context.error.status).json({ error: context.error.message });
    const items = await getSessionReviewItems({ companyId, sessionId, allowFollowups: context.session.automationPaused === true });
    return res.status(200).json({ items, sessionPaused: context.session.automationPaused === true });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Falha ao carregar automações pausadas.' });
  }
}

async function updateSessionContactAutomation(req, res) {
  const companyId = String(req.authTenantId || '').trim();
  const sessionId = sessionManager.normalizeSessionName(req.params.sessionId);
  const action = String(req.body?.action || '').toLowerCase();
  const contactId = normalizePhone(req.body?.contactId || '');
  if (!companyId) return res.status(401).json({ error: 'Autenticação obrigatória.' });
  if (!contactId || !['resume', 'cancel'].includes(action)) {
    return res.status(400).json({ error: 'Ação e telefone de contato válidos são obrigatórios.' });
  }
  try {
    const context = await getOwnedConnectedSession(companyId, sessionId);
    if (context.error) return res.status(context.error.status).json({ error: context.error.message });
    const items = await getSessionReviewItems({ companyId, sessionId, allowFollowups: context.session.automationPaused === true });
    if (!items.some((item) => item.id === contactId)) return res.status(404).json({ error: 'Não há automações pendentes para este contato.' });

    const details = { queueItems: 0, campaigns: 0, followups: 0 };
    if (action === 'resume') {
      details.queueItems = await outboundQueueService.resumeContactItems({ companyId, sessionId, phone: contactId });
      details.campaigns = await campaignDispatchEngine.resumeSessionContact({
        companyId, sessionId, phone: contactId, io: req.app.get('io') || global.io,
      });
      if (context.session.automationPaused === true) {
        const followups = await aiFollowupEngine.listSessionFollowups({ companyId, sessionId });
        const matching = followups.filter((item) => normalizePhone(item.phone || item.remote_jid) === contactId);
        for (const followup of matching) {
          const result = await aiFollowupEngine.executeAlgorithmicFollowupForLead({
            conversationId: followup.id,
            companyId,
            sessionId,
            attempt: Number(followup.followupsSent || 0) + 1,
            allowSessionResume: true,
          });
          if (result?.ok) details.followups++;
        }
      }
    } else {
      details.queueItems = await outboundQueueService.cancelContactItems({ companyId, sessionId, phone: contactId });
      details.campaigns = await campaignDispatchEngine.cancelSessionContact({ companyId, sessionId, phone: contactId });
      if (context.session.automationPaused === true) {
        const followups = await aiFollowupEngine.listSessionFollowups({ companyId, sessionId });
        const matching = followups.filter((item) => normalizePhone(item.phone || item.remote_jid) === contactId);
        for (const followup of matching) {
          const result = await aiFollowupEngine.deactivateFollowupForConversation(
            followup.id,
            'cancelled_from_session_review',
            { companyId, sessionId }
          );
          if (result?.ok) details.followups++;
        }
      }
    }
    return res.status(200).json({ success: true, action, contactId, details });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Falha ao atualizar as automações do contato.' });
  }
}

async function resumeSessionAutomations(req, res) {
  const companyId = String(req.authTenantId || '').trim();
  const sessionId = sessionManager.normalizeSessionName(req.params.sessionId);
  if (!companyId) return res.status(401).json({ error: 'Autenticação obrigatória.' });
  try {
    const context = await getOwnedConnectedSession(companyId, sessionId);
    if (context.error) return res.status(context.error.status).json({ error: 'Conecte uma sessão ativa pertencente à empresa antes de reativar as automações.' });
    await sessionManager.setSessionAutomationPaused(sessionId, false, companyId);
    let resumed;
    try {
      resumed = await campaignDispatchEngine.resumeSessionAutomationSet({ companyId, sessionId, io: req.app.get('io') || global.io });
    } catch (error) {
      await sessionManager.setSessionAutomationPaused(sessionId, true, companyId).catch(() => {});
      throw error;
    }
    return res.status(200).json({ resumed });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Falha ao reativar automações.' });
  }
}

async function enqueue(req, res) {
  try {
    const item = await outboundQueueService.enqueue(req.body || {});
    return res.status(201).json({ item });
  } catch (error) {
    return res.status(400).json({
      error: error.message || 'Failed to enqueue outbound message.',
    });
  }
}

function listPending(req, res) {
  const companyId = String(req.authTenantId || '').trim();
  if (!companyId) {
    return res.status(401).json({ error: 'Autenticação obrigatória.' });
  }
  const limit = Number(req.query?.limit) || 100;
  const items = outboundQueueService.listPending(limit, companyId);
  return res.status(200).json({ items });
}

function listDeadLetter(req, res) {
  const companyId = String(req.authTenantId || '').trim();
  if (!companyId) {
    return res.status(401).json({ error: 'Autenticação obrigatória.' });
  }
  const limit = Number(req.query?.limit) || 100;
  const items = outboundQueueService.listDeadLetter(limit, companyId);
  return res.status(200).json({ items });
}

async function reprocessDeadLetter(req, res) {
  try {
    const item = await outboundQueueService.reprocessDeadLetterItem(req.params.id, {
      testing: req.body?.testing,
    });

    return res.status(200).json({ item });
  } catch (error) {
    const statusCode = error?.code === 'DLQ_ITEM_NOT_FOUND' ? 404 : 400;
    return res.status(statusCode).json({
      error: error.message || 'Failed to reprocess dead letter item.',
    });
  }
}

module.exports = {
  enqueue,
  listDeadLetter,
  listPending,
  listSessionAutomations,
  updateSessionContactAutomation,
  reprocessDeadLetter,
  resumeSessionAutomations,
};
