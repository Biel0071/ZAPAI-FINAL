const outboundQueueService = require('../../../services/outboundQueueService');

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
  reprocessDeadLetter,
};
