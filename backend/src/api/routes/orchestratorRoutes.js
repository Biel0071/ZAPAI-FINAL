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

// Payment Engine integration
router.post('/payments/create', (req, res) => orchestratorController.createPayment(req, res));
router.post('/payments/webhook', (req, res) => orchestratorController.handlePaymentWebhook(req, res));
router.get('/payments/:id', (req, res) => orchestratorController.getPayment(req, res));

module.exports = router;
