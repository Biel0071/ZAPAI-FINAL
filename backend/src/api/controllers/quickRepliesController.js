const { randomUUID } = require('crypto');
const quickReplyService = require('../../../services/quickReplyService');
const outboundQueueService = require('../../../services/outboundQueueService');
const flowTrackerService = require('../../../services/flowTrackerService');
const messageDedupeService = require('../../../services/messageDedupeService');
const { resolveOutboundContext } = require('./messages/shared');

function company(req, res) {
  const companyId = String(req.authTenantId || '').trim();
  if (!companyId) res.status(401).json({ success: false, error: 'Autenticação da empresa obrigatória.' });
  return companyId;
}

function fail(res, error, message) {
  console.error('[QUICK_REPLY]', error.code || error.message);
  return res.status(error.status || 503).json({ success: false, code: error.code, error: error.status ? error.message : message });
}

async function listQuickReplies(req, res) {
  const companyId = company(req, res);
  if (!companyId) return;
  try {
    return res.status(200).json(await quickReplyService.listQuickReplies({ companyId, category: req.query?.category, search: req.query?.search }));
  } catch (error) { return fail(res, error, 'Não foi possível carregar as respostas rápidas.'); }
}

async function getQuickReplyCategories(req, res) {
  const companyId = company(req, res);
  if (!companyId) return;
  try { return res.status(200).json(await quickReplyService.getQuickReplyCategories(companyId)); }
  catch (error) { return fail(res, error, 'Não foi possível carregar as categorias.'); }
}

async function saveQuickReplyCategory(req, res) {
  const companyId = company(req, res);
  if (!companyId) return;
  try {
    const body = req.body || {};
    return res.status(200).json(await quickReplyService.saveQuickReplyCategory(companyId, body.category, { emoji: body.emoji, color: body.color }));
  }
  catch (error) { return fail(res, error, 'Não foi possível salvar as categorias.'); }
}

async function createQuickReply(req, res) {
  const companyId = company(req, res);
  if (!companyId) return;
  try {
    const { id, ...payload } = req.body || {};
    return res.status(201).json(await quickReplyService.createQuickReply({ ...payload, companyId }));
  } catch (error) { return fail(res, error, 'Não foi possível salvar a resposta rápida. Tente novamente.'); }
}

async function updateQuickReply(req, res) {
  const companyId = company(req, res);
  if (!companyId) return;
  try {
    const updated = await quickReplyService.updateQuickReply(String(req.params.id || ''), req.body || {}, companyId);
    return updated ? res.status(200).json(updated) : res.status(404).json({ error: 'Resposta rápida não encontrada.' });
  } catch (error) { return fail(res, error, 'Não foi possível atualizar a resposta rápida. Tente novamente.'); }
}

async function deleteQuickReply(req, res) {
  const companyId = company(req, res);
  if (!companyId) return;
  try {
    const removed = await quickReplyService.removeQuickReply(String(req.params.id || ''), companyId);
    return removed ? res.status(200).json({ success: true }) : res.status(404).json({ error: 'Resposta rápida não encontrada.' });
  } catch (error) { return fail(res, error, 'Não foi possível excluir a resposta rápida.'); }
}

async function executeQuickReplyFlow(req, res) {
  let intentKey;
  try {
    const context = await resolveOutboundContext(req);
    const flow = (await quickReplyService.listQuickReplies({ companyId: context.companyId })).find(item => String(item.id) === String(req.params.id));
    if (!flow) return res.status(404).json({ success: false, error: 'Resposta rápida não encontrada nesta empresa.' });
    const rawSteps = Array.isArray(req.body?.steps) && req.body.steps.length
      ? req.body.steps
      : (Array.isArray(flow.steps) && flow.steps.length
          ? flow.steps
          : Array.isArray(flow.items) && flow.items.length
            ? flow.items
            : [{ type: flow.mediaType || (flow.mediaUrl ? 'image' : 'text'), value: flow.mediaUrl || flow.content || flow.text || '', caption: flow.content || flow.text || '', filename: flow.filename }]);
    if (!rawSteps.length || rawSteps.length > 100) return res.status(400).json({ success: false, error: 'O fluxo deve conter entre 1 e 100 etapas.' });
    const sendId = String(req.body?.sendId || '').trim() || randomUUID();
    const scope = { companyId: context.companyId, sessionId: context.targetSessionName, conversationId: context.conversationId, phone: context.normalizedPhone };
    const overrideDelay = req.body?.overrideDelayMs;
    if (overrideDelay !== undefined && (!Number.isFinite(Number(overrideDelay)) || Number(overrideDelay) < 0 || Number(overrideDelay) > 60000)) {
      return res.status(400).json({ success: false, error: 'Intervalo inválido. Use de 0 a 60.000 ms.' });
    }
    let cumulativeDelay = 0;
    const now = Date.now();
    const formatTags = (tmpl) => {
      const phone = String(context.normalizedPhone || context.phone || '');
      const name = String(context.contactName || context.name || '').trim();
      const firstName = name ? name.split(/\s+/)[0] : 'cliente';
      const hour = new Date().getHours();
      const periodoDia = hour >= 5 && hour < 12 ? 'dia' : hour >= 12 && hour < 18 ? 'tarde' : 'noite';
      const saudacao = hour >= 5 && hour < 12 ? 'Bom dia' : hour >= 12 && hour < 18 ? 'Boa tarde' : 'Boa noite';
      return String(tmpl || '')
        .replace(/(?:\{\{\s*nome\s*\}\}|#nome\b)/gi, name || 'cliente')
        .replace(/(?:\{\{\s*primeironome\s*\}\}|#primeironome\b)/gi, firstName)
        .replace(/(?:\{\{\s*(?:numero|telefone)\s*\}\}|#(?:numero|telefone)\b)/gi, phone)
        .replace(/(?:\{\{\s*periodo[-_]dia\s*\}\}|#periodo[-_]dia\b)/gi, periodoDia)
        .replace(/(?:\{\{\s*sauda[çc][ãa]o\s*\}\}|#sauda[çc][ãa]o\b)/gi, saudacao)
        .replace(/(?:\{\{\s*mencionar[-_]todos\s*\}\}|#mencionar[-_]todos\b)/gi, '@todos')
        .replace(/(?:\{\{\s*empresa\s*\}\}|#empresa\b)/gi, context.company || '')
        .replace(/(?:\{\{\s*origem\s*\}\}|#origem\b)/gi, 'WhatsApp');
    };
    const payloads = rawSteps.map((step, index) => {
      const type = String(step.type || 'text').toLowerCase();
      const isText = type === 'text';
      const rawValue = String(step.value || (isText ? step.text : step.mediaUrl || step.fileUrl) || '').trim();
      const value = isText ? formatTags(rawValue) : rawValue;
      if (!value || !['text', 'image', 'audio', 'video', 'document', 'file', 'sticker'].includes(type)) {
        throw Object.assign(new Error('Etapa ' + (index + 1) + ' inválida. Revise a resposta rápida salva.'), { status: 400 });
      }
      const stepDelay = overrideDelay !== undefined
        ? Number(overrideDelay)
        : Number(step.delayMs ?? (step.delaySeconds !== undefined ? step.delaySeconds * 1000 : (step.delay ?? 2000)));
      if (!Number.isFinite(stepDelay) || stepDelay < 0 || stepDelay > 60000) throw Object.assign(new Error('Intervalo da etapa ' + (index + 1) + ' inválido.'), { status: 400 });
      cumulativeDelay += stepDelay;

      const stepTypingMs = Number(step.typingMs ?? (step.typingSeconds !== undefined ? step.typingSeconds * 1000 : 3000));
      const stepCaption = step.caption ? formatTags(step.caption) : (step.text ? formatTags(step.text) : '');

      return {
        phone: context.targetJidOrPhone,
        sessionId: context.targetSessionName,
        companyId: context.companyId,
        text: isText ? value : stepCaption,
        correlationId: sendId + ':' + (index + 1),
        mediaType: isText ? undefined : type === 'file' ? 'document' : type,
        mediaPath: isText ? undefined : value,
        fileName: step.filename || step.fileName,
        viewOnce: Boolean(step.viewOnce),
        nextAttemptAt: new Date(now + cumulativeDelay).toISOString(),
        metadata: {
          flowId: flow.id,
          flowRunId: sendId,
          flowName: flow.title || 'Resposta rápida',
          stepId: step.id || 'step_' + (index + 1),
          currentStep: index + 1,
          totalSteps: rawSteps.length,
          isFlowStep: true,
          source: 'flow_automation',
          conversationId: context.conversationId,
          contactId: context.contactId,
          typingMs: Math.min(stepTypingMs, 30000),
          viewOnce: Boolean(step.viewOnce),
        },
        actions: step.actions,
      };
    });
    intentKey = JSON.stringify([scope.companyId, scope.sessionId, scope.conversationId || scope.phone, sendId]);
    if (!messageDedupeService.markSeen('quick_reply_intent', intentKey, 5 * 60000)) {
      const existing = outboundQueueService.findByCorrelation(sendId + ':1', scope.companyId, scope);
      if (existing) return res.status(200).json({ success: true, stepsCount: 0, duplicate: true, flowRunId: sendId });
      return res.status(409).json({ success: false, error: 'Este fluxo ainda está sendo preparado.' });
    }
    const enqueued = await outboundQueueService.enqueueBatch(payloads);
    flowTrackerService.startFlow({ chatId: context.normalizedPhone, ...scope, flowRunId: sendId, flowName: flow.title || 'Resposta rápida', totalSteps: enqueued.length });
    return res.status(200).json({ success: true, stepsCount: enqueued.length, flowRunId: sendId });
  } catch (error) {
    if (intentKey) messageDedupeService.forget('quick_reply_intent', intentKey);
    return fail(res, error, 'Não foi possível colocar o fluxo na fila. Tente novamente.');
  }
}

async function cancelQuickReplyFlow(req, res) {
  try {
    const context = await resolveOutboundContext(req, { requireConnected: false });
    const scope = { companyId: context.companyId, sessionId: context.targetSessionName, conversationId: context.conversationId, phone: context.normalizedPhone };
    const cancelled = await outboundQueueService.cancelFlowItems(scope);
    flowTrackerService.cancelFlow(context.normalizedPhone, scope);
    return res.status(200).json({ success: true, cancelled });
  } catch (error) { return fail(res, error, 'Não foi possível cancelar o fluxo.'); }
}

async function getActiveQuickReplyFlow(req, res) {
  try {
    const context = await resolveOutboundContext(req, { requireConnected: false });
    const scope = { companyId: context.companyId, sessionId: context.targetSessionName, conversationId: context.conversationId, phone: context.normalizedPhone };
    const flow = flowTrackerService.getRunningFlow(context.normalizedPhone, scope) || outboundQueueService.getActiveFlow?.(scope);
    return res.status(200).json({ flow: flow || null });
  } catch (error) { return fail(res, error, 'Não foi possível carregar o fluxo ativo.'); }
}

module.exports = { createQuickReply, deleteQuickReply, listQuickReplies, updateQuickReply, executeQuickReplyFlow, cancelQuickReplyFlow, getActiveQuickReplyFlow, getQuickReplyCategories, saveQuickReplyCategory };
