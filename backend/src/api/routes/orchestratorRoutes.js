'use strict';

const express = require('express');
const router = express.Router();
const orchestratorController = require('../controllers/orchestratorController');

// Capability and State inspection
router.get('/capabilities', (req, res) => orchestratorController.getCapabilities(req, res));
router.get('/state/:sessionId?', (req, res) => orchestratorController.getConnectionState(req, res));
router.get('/health', (req, res) => orchestratorController.getHealth(req, res));

// Direct Orchestrator Execution
router.post('/execute', (req, res) => orchestratorController.executeOperation(req, res));

// WhatsApp Web Bridge management & QR code scanning
router.get('/bridge/status/:sessionId?', (req, res) => orchestratorController.getBridgeStatus(req, res));
router.get('/bridge/qr/:sessionId?', (req, res) => orchestratorController.getBridgeQR(req, res));
router.get('/bridge/view/:sessionId?', (req, res) => orchestratorController.renderBridgeView(req, res));
router.post('/bridge/disconnect/:sessionId?', (req, res) => orchestratorController.disconnectBridge(req, res));

// Payment Engine integration
router.post('/payments/create', (req, res) => orchestratorController.createPayment(req, res));
router.post('/payments/webhook', (req, res) => orchestratorController.handlePaymentWebhook(req, res));
router.get('/payments/:id', (req, res) => orchestratorController.getPayment(req, res));

module.exports = router;
