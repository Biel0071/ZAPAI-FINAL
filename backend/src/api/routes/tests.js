const express = require('express');
const router = express.Router();
const testsController = require('../controllers/testsController');

router.get('/tests/suites', testsController.listSuites);
router.post('/tests/run', testsController.runTests);
router.post('/tests/generate', testsController.generateScript);
router.get('/tests/graph', testsController.getGraph);
router.get('/tests/history', testsController.getHistory);

module.exports = router;
