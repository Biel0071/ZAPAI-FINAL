const express = require('express');
const router = express.Router();
const aiConfigController = require('../controllers/aiConfigController');

router.post('/ai/improve', aiConfigController.improve);
router.get('/ai/memory', aiConfigController.getMemory);
router.post('/ai/memory', aiConfigController.saveMemory);
router.get('/ai/memory/analytics', aiConfigController.getMemoryAnalytics);
router.get('/ai/analytics', aiConfigController.getMemoryAnalytics); // alias used by Memory.tsx
router.get('/ai/memory/search', aiConfigController.searchMemory);
router.post('/ai/memory/flush', aiConfigController.flushMemory);

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

router.post('/config/ai/restart', async (req, res) => {
  try {
    const aiService = require('../services/ai.service');
    const aiAgentService = require('../ai-agents/services/aiAgentService');

    if (typeof aiService.clearResponseCache === 'function') {
      aiService.clearResponseCache();
    }

    if (typeof aiAgentService.resetCache === 'function') {
      aiAgentService.resetCache(req.tenantId || req.companyId || process.env.DEFAULT_COMPANY_ID || 'default');
    }

    return res.status(200).json({ success: true, message: 'AI restarted successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/config/ai/deploy-vps', async (req, res) => {
  try {
    const { exec } = require('child_process');
    const path = require('path');
    const rootDir = path.join(__dirname, '..', '..');

    console.log('[AI DEPLOY] Triggered self-deployment on server.');
    
    // Execute auto-deploy.sh locally on the server
    const deployScript = path.join(rootDir, 'deploy', 'auto-deploy.sh');
    
    // Run asynchronously to allow connection to return status first (PM2 restart kills the connection)
    exec(`bash "${deployScript}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`[AI DEPLOY] Failed: ${error.message}`);
        return;
      }
      console.log('[AI DEPLOY] Completed successfully.');
    });

    return res.status(200).json({ success: true, message: 'Deployment triggered successfully on VPS.' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/queue', aiConfigController.getQueue);
router.post('/queue/process', aiConfigController.processQueue);

module.exports = router;
