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

module.exports = {
  createQuickReply,
  deleteQuickReply,
  listQuickReplies,
  updateQuickReply,
};
