const express = require('express');
const router = express.Router();
const quickRepliesController = require('../controllers/quickRepliesController');

router.get('/api/quick-replies', quickRepliesController.listQuickReplies);
router.get('/api/quick-replies/categories', quickRepliesController.getQuickReplyCategories);
router.put('/api/quick-replies/categories', quickRepliesController.saveQuickReplyCategory);
router.post('/api/quick-replies', quickRepliesController.createQuickReply);
router.put('/api/quick-replies/:id', quickRepliesController.updateQuickReply);
router.delete('/api/quick-replies/:id', quickRepliesController.deleteQuickReply);
router.post('/api/quick-replies/:id/execute', quickRepliesController.executeQuickReplyFlow);
router.post('/api/quick-replies/cancel-flow', quickRepliesController.cancelQuickReplyFlow);
router.get('/api/quick-replies/active-flow/:phone', quickRepliesController.getActiveQuickReplyFlow);
module.exports = router;
