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
    const { phone, sessionId, companyId, item: requestItem } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'phone is required.' });
    }

    const allReplies = await quickReplyService.listQuickReplies();
    let flow = allReplies.find((item) => String(item.id) === String(id));

    if (!flow && requestItem) {
      flow = requestItem;
    }

    if (!flow) {
      flow = allReplies.find((item) => String(item.label || item.cmd || item.title || '').toLowerCase() === String(id).toLowerCase()) || {
        id: id || 'custom',
        label: requestItem?.label || requestItem?.cmd || 'Resposta Rápida',
        text: requestItem?.text || id,
        mediaUrl: requestItem?.mediaUrl || requestItem?.fileUrl,
        mediaType: requestItem?.mediaType,
      };
    }

    const outboundQueueService = require('../services/outboundQueueService');
    const flowTrackerService = require('../services/flowTrackerService');

    let rawSteps = [];
    if (Array.isArray(flow.steps) && flow.steps.length > 0) {
      rawSteps = flow.steps;
    } else if (Array.isArray(flow.items) && flow.items.length > 0) {
      rawSteps = flow.items;
    } else {
      rawSteps = [
        {
          type: flow.mediaType || (flow.mediaUrl ? 'image' : 'text'),
          value: flow.mediaUrl || flow.fileUrl || flow.text || '',
          caption: flow.text || '',
          filename: flow.filename || flow.fileName,
          delayMs: 1000,
        },
      ];
    }

    const totalSteps = rawSteps.length;
    const flowName = flow.title || flow.label || flow.cmd || 'Resposta Rápida';

    flowTrackerService.startFlow({
      chatId: phone,
      flowName,
      totalSteps,
      companyId: companyId || 'default',
    });

    let cumulativeDelayMs = 0;
    const now = Date.now();
    const enqueuedSteps = [];

    for (let index = 0; index < rawSteps.length; index++) {
      const step = rawSteps[index];
      const stepDelay = Number(step.delayMs || step.delay || 1500);
      cumulativeDelayMs += stepDelay;
      const scheduledTime = new Date(now + cumulativeDelayMs).toISOString();

      const isText = step.type === 'text' || (!step.type && !step.mediaUrl && !step.fileUrl);
      const mediaPath = !isText ? (step.value || step.mediaUrl || step.fileUrl) : undefined;
      const textContent = isText ? (step.value || step.text || '') : (step.caption || step.text || '');

      const itemPayload = {
        phone,
        sessionId: sessionId || 'main',
        companyId: companyId || 'default',
        text: textContent,
        mediaType: !isText ? (step.type || 'image') : undefined,
        mediaPath: mediaPath,
        fileName: step.filename || step.fileName,
        nextAttemptAt: scheduledTime,
        metadata: {
          flowId: flow.id || 'custom',
          stepId: step.id || `step_${index + 1}`,
          currentStep: index + 1,
          totalSteps,
          isFlowStep: true,
          source: 'flow_automation',
          typingMs: Math.min(stepDelay, 2000),
        },
        actions: step.actions,
      };

      const enqueued = await outboundQueueService.enqueue(itemPayload);
      enqueuedSteps.push(enqueued);
    }

    return res.status(200).json({ success: true, stepsCount: enqueuedSteps.length });
  } catch (error) {
    console.error('[EXECUTE_QUICK_REPLY_FLOW_ERROR]', error);
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
