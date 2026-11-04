'use strict';

const express = require('express');
const router = express.Router();
const webBridgeController = require('../controllers/webBridgeController');

router.get('/status', (req, res) => webBridgeController.getStatus(req, res));
router.get('/qr', (req, res) => webBridgeController.getQR(req, res));
router.post('/connect', (req, res) => webBridgeController.connect(req, res));
router.post('/disconnect', (req, res) => webBridgeController.disconnect(req, res));
router.post('/sync-catalog', (req, res) => webBridgeController.syncCatalog(req, res));
router.post('/sync', (req, res) => webBridgeController.syncCatalog(req, res));
router.post('/test-connection', (req, res) => webBridgeController.testConnection(req, res));
router.post('/puppet/send-text', (req, res) => webBridgeController.puppetSendText(req, res));
router.post('/puppet/send-product', (req, res) => webBridgeController.puppetSendProduct(req, res));
router.post('/puppet/open-chat', (req, res) => webBridgeController.puppetOpenChat(req, res));

module.exports = router;
