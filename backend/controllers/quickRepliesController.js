const quickReplyService = require('../services/quickReplyService');

async function listQuickReplies(req, res) {
  try {
    const items = await quickReplyService.listQuickReplies({
      category: req.query?.category,
      search: req.query?.search,
    });

    return res.status(200).json(items);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to list quick replies.' });
  }
}

async function createQuickReply(req, res) {
  try {
    const created = await quickReplyService.createQuickReply(req.body || {});
    return res.status(201).json(created);
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to create quick reply.' });
  }
}

async function updateQuickReply(req, res) {
  try {
    const updated = await quickReplyService.updateQuickReply(String(req.params.id || ''), req.body || {});

    if (!updated) {
      return res.status(404).json({ error: 'Quick reply not found.' });
    }

    return res.status(200).json(updated);
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to update quick reply.' });
  }
}

async function deleteQuickReply(req, res) {
  try {
    const removed = await quickReplyService.removeQuickReply(String(req.params.id || ''));

    if (!removed) {
      return res.status(404).json({ error: 'Quick reply not found.' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to delete quick reply.' });
  }
}

async function executeQuickReplyFlow(req, res) {
  try {
    const { id } = req.params;
    const { phone, sessionId, companyId } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'phone is required.' });
    }

    const allReplies = await quickReplyService.listQuickReplies();
    const flow = allReplies.find((item) => item.id === id);

    if (!flow) {
      return res.status(404).json({ error: 'Quick reply flow not found.' });
    }

    const outboundQueueService = require('../services/outboundQueueService');

    let cumulativeDelayMs = 0;
    const now = Date.now();

    const enqueuedSteps = [];
    const steps = flow.steps || [];

    for (const step of steps) {
      cumulativeDelayMs += Number(step.delayMs || 0);
      const scheduledTime = new Date(now + cumulativeDelayMs).toISOString();

      const itemPayload = {
        phone,
        sessionId: sessionId || 'main',
        companyId: companyId || 'default',
        text: step.type === 'text' ? step.value : (step.caption || ''),
        mediaType: step.type !== 'text' ? step.type : undefined,
        mediaPath: step.type !== 'text' ? step.value : undefined,
        fileName: step.filename,
        nextAttemptAt: scheduledTime,
        metadata: {
          flowId: flow.id,
          stepId: step.id,
          isFlowStep: true,
          source: 'flow_automation',
          typingMs: step.typingMs !== undefined ? Number(step.typingMs) : 1500,
        },
        actions: step.actions,
      };

      const enqueued = await outboundQueueService.enqueue(itemPayload);
      enqueuedSteps.push(enqueued);
    }

    const flowTrackerService = require('../services/flowTrackerService');
    flowTrackerService.startFlow({
      chatId: phone,
      flowName: flow.title || flow.label || flow.cmd || 'Resposta Rápida',
      totalSteps: (steps || []).length || 1,
      companyId,
    });

    return res.status(200).json({ success: true, stepsCount: enqueuedSteps.length });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to execute flow.' });
  }
}

async function cancelQuickReplyFlow(req, res) {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'phone is required.' });
    }
    const flowTrackerService = require('../services/flowTrackerService');
    const cancelled = flowTrackerService.cancelFlow(phone);
    return res.status(200).json({ success: true, cancelled });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to cancel flow.' });
  }
}

module.exports = {
  createQuickReply,
  deleteQuickReply,
  listQuickReplies,
  updateQuickReply,
  executeQuickReplyFlow,
  cancelQuickReplyFlow,
};
