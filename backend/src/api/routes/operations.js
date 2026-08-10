const express = require('express');
const router = express.Router();
const operationsController = require('../controllers/operationsController');

router.get('/operations/metrics', operationsController.getOperationsMetrics);

module.exports = router;
