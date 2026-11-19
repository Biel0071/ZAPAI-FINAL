'use strict';

const express = require('express');
const router = express.Router();
const commerceController = require('../controllers/commerceController');

// Public or session-guarded commerce capabilities
router.get('/capabilities', (req, res) => commerceController.getCapabilities(req, res));

// Catalog routes
router.get('/catalog', (req, res) => commerceController.getCatalog(req, res));
router.post('/sync', (req, res) => commerceController.syncCatalog(req, res));

// Send native products and catalog
router.post('/send-product', (req, res) => commerceController.sendProduct(req, res));
router.post('/send-catalog', (req, res) => commerceController.sendCatalog(req, res));

// Order management routes
router.get('/orders', (req, res) => commerceController.listOrders(req, res));
router.post('/orders/create', (req, res) => commerceController.createOrder(req, res));
router.get('/orders/:id', (req, res) => commerceController.getOrder(req, res));
router.post('/orders/:id/confirm', (req, res) => commerceController.confirmOrder(req, res));
router.post('/orders/:id/reject', (req, res) => commerceController.rejectOrder(req, res));

module.exports = router;
