const automationService = require('../../../services/automationService');
const contactRepository = require('../../data/repositories/contactRepository');
const messagesController = require('./messagesController');
const sessionManager = require('../../../services/sessionManager');
const whatsappService = require('../../../services/whatsappService');
const webhookService = require('../../../services/webhookService');
const { getCompanyId } = require('../../../services/tenantContext');

function getStore(req) {
  return req.app.locals.store;
}

async function sendMessage(req, res) {
  const store = getStore(req);
  const companyId = getCompanyId(req);
  const normalizedPhone = whatsappService.normalizePhone(req.body?.phone || req.body?.chatId);
  const text = String(req.body?.text || req.body?.message || '').trim();

  if (!normalizedPhone || !text) {
    return res.status(400).json({ error: 'phone and text are required.' });
  }

  if (!sessionManager.isRuntimeActive()) {
    return res.status(409).json({ error: 'System runtime is inactive.' });
  }

  const session = sessionManager.getSession(sessionManager.DEFAULT_SESSION) || (await sessionManager.getDefaultSession());
  const sock = session?.sock || store?.sock;

  if (!sock) {
    return res.status(409).json({ error: 'No active WhatsApp session available.' });
  }

  const sendResult = await whatsappService.sendMessage(sock, normalizedPhone, text);
  const persisted = await messagesController.registerOutgoingMessage(store, {
    companyId,
    name: session?.phone || 'Integration API',
    phone: normalizedPhone,
    sessionId: session?.sessionId || sessionManager.DEFAULT_SESSION,
    text,
  });

  const outbound = persisted?.message || null;

  if (sendResult?.key?.id && outbound?.id) {
    const messageAckPipeline = require('../../../services/messageAckPipeline');
    messageAckPipeline.registerDbMapping(sendResult.key.id, outbound.id);
    const ackEntry = messageAckPipeline.transitionAck(sendResult.key.id, messageAckPipeline.ACK_STATES.SENT, {
      chatId: normalizedPhone,
      sessionId: session?.sessionId || sessionManager.DEFAULT_SESSION,
    });
    const io = store?.io || global.io;
    if (io && ackEntry) {
      messageAckPipeline.emitAckUpdate(io, ackEntry);
    }
  }

  if (!outbound?.id) {
    return res.status(500).json({
      error: 'Message ACK failed: persisted message id is missing.',
      success: false,
      tenantId: companyId,
    });
  }

  await webhookService.dispatchEvent({
    tenantId: companyId,
    event: 'message_sent',
    payload: {
      phone: normalizedPhone,
      text,
      messageId: outbound?.id || null,
      conversationId: outbound?.conversationId || null,
    },
  });

  return res.status(200).json({
    chatId: `${normalizedPhone}@s.whatsapp.net`,
    success: true,
    tenantId: companyId,
    message: outbound,
  });
}

async function createContact(req, res) {
  const companyId = getCompanyId(req);
  const phone = whatsappService.normalizePhone(req.body?.phone);
  const name = String(req.body?.name || '').trim() || phone;

  if (!phone) {
    return res.status(400).json({ error: 'phone is required.' });
  }

  const contact = await contactRepository.createContact({
    companyId,
    name,
    phone,
  });

  await webhookService.dispatchEvent({
    tenantId: companyId,
    event: 'contact_created',
    payload: contact,
  });

  return res.status(201).json({
    success: true,
    tenantId: companyId,
    contact,
  });
}

async function triggerFlow(req, res) {
  const store = getStore(req);
  const companyId = getCompanyId(req);
  const flowId = String(req.params?.id || '').trim();
  const flows = automationService.listFlows(store);
  const flow = flows.find((item) => String(item.id) === flowId);

  if (!flow) {
    return res.status(404).json({ error: 'Flow not found.' });
  }

  const execution = {
    id: `flow_exec_${Date.now()}`,
    flowId,
    tenantId: companyId,
    status: 'triggered',
    input: req.body || {},
    triggeredAt: new Date().toISOString(),
  };

  await webhookService.dispatchEvent({
    tenantId: companyId,
    event: 'flow_triggered',
    payload: execution,
  });

  return res.status(200).json({ success: true, execution });
}

async function triggerCampaign(req, res) {
  const store = getStore(req);
  const companyId = getCompanyId(req);
  const campaignId = String(req.params?.id || '').trim();
  const updated = automationService.startCampaign(store, campaignId);

  if (!updated) {
    return res.status(404).json({ error: 'Campaign not found.' });
  }

  await webhookService.dispatchEvent({
    tenantId: companyId,
    event: 'campaign_sent',
    payload: {
      campaignId: updated.id,
      status: updated.status,
      name: updated.name,
    },
  });

  return res.status(200).json({
    success: true,
    campaign: updated,
  });
}

async function listWebhooks(req, res) {
  const companyId = getCompanyId(req);
  const webhooks = await webhookService.listWebhooks(companyId);
  return res.status(200).json({ tenantId: companyId, webhooks });
}

async function upsertWebhook(req, res) {
  const companyId = getCompanyId(req);

  try {
    const webhook = await webhookService.upsertWebhook({
      tenantId: companyId,
      url: req.body?.url,
      events: req.body?.events,
      secret: req.body?.secret,
    });

    return res.status(201).json({ tenantId: companyId, webhook });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Invalid webhook payload.' });
  }
}

async function removeWebhook(req, res) {
  const companyId = getCompanyId(req);
  const webhookId = String(req.params?.id || '').trim();
  const removed = await webhookService.removeWebhook({ tenantId: companyId, webhookId });

  if (!removed) {
    return res.status(404).json({ error: 'Webhook not found.' });
  }

  return res.status(200).json({ success: true });
}

module.exports = {
  createContact,
  listWebhooks,
  removeWebhook,
  sendMessage,
  triggerCampaign,
  triggerFlow,
  upsertWebhook,
};
