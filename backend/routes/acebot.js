const express = require('express');
const controller = require('../controllers/acebotController');

const router = express.Router();

router.post('/workflow', controller.runWorkflow);
router.post('/module', controller.createModule);
router.post('/self-improve/start', controller.startSelfImprovingMode);
router.post('/self-improve/smart-start', controller.startSmartSelfImprovingMode);
router.post('/self-improve/stop', controller.stopSelfImprovingMode);
router.get('/self-improve/status', controller.getSelfImprovingStatus);
router.post('/self-improve/run-once', controller.runSelfImprovementCycle);

module.exports = router;
