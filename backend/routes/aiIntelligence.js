const express = require('express');

const controller = require('../controllers/aiIntelligenceController');

const router = express.Router();

router.get('/ai/intelligence/panel', controller.getPanel);
router.post('/ai/intelligence/analyze', controller.analyze);
router.get('/ai/intelligence/memory', controller.listMemory);
router.get('/ai/intelligence/memory/:contactId', controller.getMemory);
router.get('/ai/intelligence/improvements', controller.listImprovements);
router.post('/ai/intelligence/improvements/:id/approve', controller.approveImprovement);
router.post('/ai/intelligence/improvements/:id/applied', controller.markImprovementApplied);
router.post('/ai/intelligence/improvements/:id/ignore', controller.ignoreImprovement);
router.post('/ai/intelligence/docs/refresh', controller.refreshDocs);

module.exports = router;
