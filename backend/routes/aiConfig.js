const express = require('express');
const router = express.Router();
const aiConfigController = require('../controllers/aiConfigController');

router.post('/ai/improve', aiConfigController.improve);
router.get('/ai/memory', aiConfigController.getMemory);
router.post('/ai/memory', aiConfigController.saveMemory);

router.get('/config/business-hours', aiConfigController.getBusinessHours);
router.post('/config/business-hours', aiConfigController.saveBusinessHours);
router.get('/config/absence-message', aiConfigController.getAbsenceMessage);
router.post('/config/absence-message', aiConfigController.saveAbsenceMessage);
router.get('/config/advanced-ai', aiConfigController.getAdvancedAI);
router.post('/config/advanced-ai', aiConfigController.saveAdvancedAI);
router.get('/config/ai-agents', aiConfigController.getAIAgents);
router.post('/config/ai-agents', aiConfigController.createAIAgent);
router.put('/config/ai-agents/:key', aiConfigController.updateAIAgent);
router.patch('/config/ai-agents/:key/active', aiConfigController.toggleAIAgent);
router.delete('/config/ai-agents/:key', aiConfigController.deleteAIAgent);
router.post('/config/ai-agents/:key/clone', aiConfigController.cloneAIAgent);
router.get('/config/ai/evolution', aiConfigController.getAIEvolution);
router.get('/config/ai/pipeline-logs', aiConfigController.getPipelineLogs);

router.get('/config/user-providers', aiConfigController.getUserProviders);
router.post('/config/user-providers', aiConfigController.saveUserProvider);

router.get('/queue', aiConfigController.getQueue);
router.post('/queue/process', aiConfigController.processQueue);

module.exports = router;
