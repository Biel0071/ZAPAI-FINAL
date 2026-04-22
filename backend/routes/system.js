const express = require('express');
const router = express.Router();
const systemController = require('../controllers/systemController');

// Activation endpoints
router.post('/activate', systemController.activate);
router.get('/activation-logs', systemController.getActivationLogs);

// Runtime management endpoints
router.get('/runtime/status', systemController.getRuntimeStatus);
router.get('/runtime/debug', systemController.getRuntimeDebug);
router.post('/runtime/restart-ngrok', systemController.restartNgrok);
router.get('/runtime/logs', systemController.getRuntimeLogs);
router.delete('/runtime/logs', systemController.clearRuntimeLogs);

// Existing system endpoints
router.get('/ai-diagnostics', systemController.getAIDiagnostics);
router.get('/error-log', systemController.errorLog);
router.post('/start', systemController.start);
router.post('/stop', systemController.stop);
router.get('/status', systemController.status);

module.exports = router;
