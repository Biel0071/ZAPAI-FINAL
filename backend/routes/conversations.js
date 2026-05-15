const express = require('express');
const router = express.Router();
const conversationsController = require('../controllers/conversationsController');

router.post('/conversations', conversationsController.createConversation);
router.get('/conversations', conversationsController.getConversations);
router.get('/inbox', conversationsController.getConversations);
router.get('/crm', conversationsController.getConversations);
router.get('/conversations/:conversationId/messages', conversationsController.getConversationMessages);
router.get('/conversations/:conversationId/insights', conversationsController.getConversationInsights);
router.get('/conversations/:conversationId/runtime', conversationsController.getConversationRuntime);
router.get('/conversations/:conversationId/draft', conversationsController.getConversationDraft);
router.post('/conversations/:conversationId/draft', conversationsController.saveConversationDraft);
router.delete('/conversations/:conversationId/draft', conversationsController.clearConversationDraft);
router.post('/conversations/:conversationId/read', conversationsController.markConversationRead);
router.post('/conversations/:conversationId/suggest-reply', conversationsController.suggestConversationReply);
router.post('/conversations/:conversationId/typing', conversationsController.updateTypingState);
router.post('/conversations/:conversationId/handoff', conversationsController.setConversationHandoff);
router.post('/conversations/:conversationId/profile-card', conversationsController.generateProfileCard);
router.post('/conversations/:conversationId/billing', conversationsController.generateBilling);
router.get('/conversations/:conversationId/billing/:billingId', conversationsController.getBillingDetails);
router.patch('/conversations/:phone/ai', conversationsController.updateConversationAI);
router.patch('/conversations/:conversationId', conversationsController.updateConversationMeta);
router.get('/public-url', conversationsController.getPublicUrl);

module.exports = router;
