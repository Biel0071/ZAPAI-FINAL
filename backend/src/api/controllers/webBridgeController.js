'use strict';

const webBridgeSessionManager = require('../../../services/webbridge/WebBridgeSessionManager');
const webCatalogExtractor = require('../../../services/webbridge/WebCatalogExtractor');
const productRepository = require('../../../src/data/repositories/productRepository');

class WebBridgeController {
  async getStatus(req, res) {
    try {
      const companyId = req.user?.companyId || req.query?.companyId || 'default';
      const sessionId = req.query?.sessionId || 'main';
      const state = webBridgeSessionManager.getSessionState(sessionId, companyId);
      const products = await productRepository.listProducts({ companyId });
      state.productCount = products.length;

      return res.status(200).json({ success: true, ...state });
    } catch (err) {
      console.error('[WEB-BRIDGE-CONTROLLER] Erro ao obter status:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  async getQR(req, res) {
    try {
      const companyId = req.user?.companyId || req.query?.companyId || 'default';
      const sessionId = req.query?.sessionId || 'main';
      const qrData = await webBridgeSessionManager.getOrCaptureQR(sessionId, companyId);
      return res.status(200).json({ success: true, ...qrData });
    } catch (err) {
      console.error('[WEB-BRIDGE-CONTROLLER] Erro ao obter QR Code:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  async connect(req, res) {
    try {
      const companyId = req.user?.companyId || req.body?.companyId || 'default';
      const sessionId = req.body?.sessionId || 'main';
      const session = await webBridgeSessionManager.launchSession(sessionId, companyId);
      const state = webBridgeSessionManager.getSessionState(sessionId, companyId);
      return res.status(200).json({ success: true, message: 'Navegador iniciado com sucesso.', ...state });
    } catch (err) {
      console.error('[WEB-BRIDGE-CONTROLLER] Erro ao conectar WebBridge:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  async disconnect(req, res) {
    try {
      const sessionId = req.body?.sessionId || 'main';
      await webBridgeSessionManager.closeSession(sessionId);
      return res.status(200).json({ success: true, message: 'Sessão WebBridge encerrada com sucesso.' });
    } catch (err) {
      console.error('[WEB-BRIDGE-CONTROLLER] Erro ao desconectar WebBridge:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  async syncCatalog(req, res) {
    try {
      const companyId = req.user?.companyId || req.body?.companyId || 'default';
      const sessionId = req.body?.sessionId || 'main';
      console.log(`[WEB-BRIDGE-CONTROLLER] Disparando extração de catálogo para ${companyId}/${sessionId}`);
      const result = await webCatalogExtractor.extractCatalog(sessionId, companyId);
      return res.status(200).json(result);
    } catch (err) {
      console.error('[WEB-BRIDGE-CONTROLLER] Erro ao sincronizar catálogo:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  async testConnection(req, res) {
    try {
      const companyId = req.user?.companyId || req.body?.companyId || 'default';
      const sessionId = req.body?.sessionId || 'main';
      const start = Date.now();

      const state = webBridgeSessionManager.getSessionState(sessionId, companyId);
      const responseTimeMs = Date.now() - start;

      return res.status(200).json({
        success: true,
        responseTimeMs,
        state,
        playwrightAvailable: webBridgeSessionManager.isPlaywrightAvailable,
        chromiumPath: webBridgeSessionManager._resolveChromiumPath() || 'system_default',
      });
    } catch (err) {
      console.error('[WEB-BRIDGE-CONTROLLER] Erro no teste de conexão:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  async puppetSendText(req, res) {
    try {
      const companyId = req.user?.companyId || req.body?.companyId || 'default';
      const sessionId = req.body?.sessionId || 'main';
      const { jid, text } = req.body;
      const puppetManipulator = require('../../../services/webbridge/PuppetManipulator');
      const result = await puppetManipulator.sendTextMessage(sessionId, companyId, jid, text);
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      console.error('[WEB-BRIDGE-CONTROLLER] Erro no puppetSendText:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  async puppetSendProduct(req, res) {
    try {
      const companyId = req.user?.companyId || req.body?.companyId || 'default';
      const sessionId = req.body?.sessionId || 'main';
      const { jid, product } = req.body;
      const puppetManipulator = require('../../../services/webbridge/PuppetManipulator');
      const result = await puppetManipulator.sendProduct(sessionId, companyId, jid, product);
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      console.error('[WEB-BRIDGE-CONTROLLER] Erro no puppetSendProduct:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  async puppetOpenChat(req, res) {
    try {
      const companyId = req.user?.companyId || req.body?.companyId || 'default';
      const sessionId = req.body?.sessionId || 'main';
      const { jid } = req.body;
      const puppetManipulator = require('../../../services/webbridge/PuppetManipulator');
      const result = await puppetManipulator.openChat(sessionId, companyId, jid);
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      console.error('[WEB-BRIDGE-CONTROLLER] Erro no puppetOpenChat:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = new WebBridgeController();
