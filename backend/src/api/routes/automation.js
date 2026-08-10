const express = require('express');
const router = express.Router();
const automationController = require('../controllers/automationController');

router.get('/api/campaigns', automationController.getCampaigns);
router.post('/api/campaigns', automationController.createCampaign);
router.get('/api/campaigns/:id', automationController.getCampaignById);
router.post('/api/campaigns/:id/start', automationController.startCampaign);
router.post('/api/campaigns/:id/execute', automationController.startCampaign);
router.get('/api/campaigns/:id/status', automationController.getCampaignStatus);
router.put('/api/campaigns/:id', automationController.updateCampaign);
router.delete('/api/campaigns/:id', automationController.deleteCampaign);

router.get('/api/flows', automationController.getFlows);
router.post('/api/flows', automationController.createFlow);
router.put('/api/flows/:id', automationController.updateFlow);
router.delete('/api/flows/:id', automationController.deleteFlow);

module.exports = router;
