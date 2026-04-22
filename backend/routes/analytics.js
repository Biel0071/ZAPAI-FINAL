const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');

router.get('/api/dashboard', analyticsController.getDashboard);
router.get('/api/analytics', analyticsController.getSummary);
router.get('/api/metrics', analyticsController.getMetrics);
router.get('/metrics', analyticsController.getMetrics);

module.exports = router;
