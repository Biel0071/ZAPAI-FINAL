/**
 * WhatsApp Sessions Router — Alias for frontend compatibility
 * The frontend expects /api/whatsapp/sessions.
 * The backend uses /api/sessions internally.
 * This router delegates to the existing sessionsController without moving any code.
 */

const express = require('express');
const router = express.Router();
const sessionsController = require('../controllers/sessionsController');

// GET /api/whatsapp/sessions — list all sessions
router.get('/sessions', sessionsController.list);

// POST /api/whatsapp/sessions — create new session
router.post('/sessions', sessionsController.create);

// POST /api/whatsapp/sessions/:id/reconnect — reconnect session
router.post('/sessions/:id/reconnect', sessionsController.reconnect);

// POST /api/whatsapp/sessions/:id/disconnect — disconnect session
router.post('/sessions/:id/disconnect', sessionsController.disconnectSystem);

// DELETE /api/whatsapp/sessions/:id — remove session
router.delete('/sessions/:id', sessionsController.remove);

// GET /api/whatsapp/sessions/:id/status — get session status
router.get('/sessions/:id/status', sessionsController.getStatus);

// GET /api/whatsapp/sessions/:id/qr — get QR code
router.get('/sessions/:id/qr', sessionsController.getQr);

module.exports = router;
