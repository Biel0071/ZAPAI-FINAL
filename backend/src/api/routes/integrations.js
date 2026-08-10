const express = require('express');
const controller = require('../controllers/integrationsController');

const router = express.Router();

router.post('/api/integrations/messages/send', controller.sendMessage);
router.post('/api/integrations/contacts', controller.createContact);
router.post('/api/integrations/flows/:id/trigger', controller.triggerFlow);
router.post('/api/integrations/campaigns/:id/trigger', controller.triggerCampaign);

router.get('/api/integrations/webhooks', controller.listWebhooks);
router.post('/api/integrations/webhooks', controller.upsertWebhook);
router.delete('/api/integrations/webhooks/:id', controller.removeWebhook);

module.exports = router;
