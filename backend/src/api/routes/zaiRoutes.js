'use strict';

/**
 * ZAI Communication Engine — Master API Routes (/zai/...)
 */

const express = require('express');
const router = express.Router();
const zaiController = require('../controllers/zaiController');

// Capabilities & Health
router.get('/capabilities', (req, res) => zaiController.getCapabilities(req, res));
router.get('/engines', (req, res) => zaiController.getEngines(req, res));
router.get('/health', (req, res) => zaiController.getHealth(req, res));

// Connections
router.get('/connections', (req, res) => zaiController.listConnections(req, res));
router.get('/connections/:id/status', (req, res) => zaiController.getConnectionStatus(req, res));

// Messages
router.post('/messages/send', (req, res) => zaiController.sendMessage(req, res));

// Commerce & Catalog
router.get('/catalog', (req, res) => zaiController.getCatalog(req, res));
router.post('/catalog/sync', (req, res) => zaiController.syncCatalog(req, res));
router.post('/catalog/products/send', (req, res) => zaiController.sendProduct(req, res));

// Orders & Carts
router.get('/orders', (req, res) => zaiController.getOrders(req, res));

module.exports = router;
