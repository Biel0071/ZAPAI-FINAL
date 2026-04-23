const express = require('express');
const router = express.Router();
const sessionsController = require('../controllers/sessionsController');

// Single-session endpoints (all target the 'main' session)
router.post('/session/start', sessionsController.start);
router.post('/session/create', sessionsController.create);
router.post('/session/logout', sessionsController.logout);
router.post('/session/restart', sessionsController.restart);
router.post('/session/disconnect-system', sessionsController.disconnectSystem);
router.post('/session/connect-system', sessionsController.connectSystem);
router.post('/sessions/start', sessionsController.start);
router.post('/sessions/create', sessionsController.create);
router.get('/sessions', sessionsController.list);
router.get('/connections', sessionsController.list);
router.get('/sessions/status', sessionsController.getStatus);
router.get('/sessions/:id/status', sessionsController.getStatus);
router.get('/sessions/qr', sessionsController.getQr);
router.get('/sessions/:id/qr', sessionsController.getQr);
router.post('/sessions/logout', sessionsController.logout);
router.post('/sessions/restart', sessionsController.restart);
router.post('/sessions/:id/reconnect', sessionsController.reconnect);
router.post('/session/:sessionId/reconnect', sessionsController.reconnect);
router.post('/sessions/disconnect-system', sessionsController.disconnectSystem);
router.post('/sessions/connect-system', sessionsController.connectSystem);
router.post('/session/:sessionId/disconnect-system', sessionsController.disconnectSystem);
router.post('/session/:sessionId/connect-system', sessionsController.connectSystem);
router.delete('/session/:sessionId', sessionsController.remove);
router.delete('/sessions/:id', sessionsController.remove);

module.exports = router;
