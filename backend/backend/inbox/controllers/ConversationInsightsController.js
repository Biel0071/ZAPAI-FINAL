const conversationService = require('../services/ConversationService');

async function getInsights(req, res) {
  try {
    const { conversationId } = req.params;
    const insights = await conversationService.getConversationInsights(conversationId);
    return res.status(200).json(insights);
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Failed to load conversation insights.',
    });
  }
}

async function suggestReply(req, res) {
  try {
    const { conversationId } = req.params;
    const payload = await conversationService.suggestReplyForConversation({
      conversationId,
      metadata: {
        intent: req.body?.intent,
        leadScore: req.body?.leadScore,
      },
      text: req.body?.text || '',
    });

    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Failed to generate suggested reply.',
    });
  }
}

module.exports = {
  getInsights,
  suggestReply,
};
