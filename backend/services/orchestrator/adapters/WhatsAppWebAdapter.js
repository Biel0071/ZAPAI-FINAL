'use strict';

/**
 * WhatsAppWebAdapter — ZAPFLOW Unified WhatsApp Orchestrator
 * Adaptador para operações que dependam de interface Web através do WebBridge.
 */

const webBridgeManager = require('../WebBridgeManager');

class WhatsAppWebAdapter {
  constructor() {
    this.name = 'WHATSAPP_WEB_BRIDGE';
  }

  _assertAuthenticated(sessionId) {
    const state = webBridgeManager.getSessionState(sessionId);
    if (!state.authenticated) {
      throw new Error(`WHATSAPP_WEB_BRIDGE session "${sessionId}" is not authenticated. Pair via WhatsApp Web QR code to use this engine.`);
    }
  }

  async sendText(payload, context = {}) {
    const sessionId = context.sessionId || 'main';
    const companyId = context.companyId || 'default';
    this._assertAuthenticated(sessionId);
    const puppetManipulator = require('../../webbridge/PuppetManipulator');
    const targetPhone = (payload.phone || payload.remoteJid || '').replace(/\D/g, '');
    const text = payload.text || payload.message || payload.caption || '';
    const res = await puppetManipulator.sendTextMessage(sessionId, companyId, targetPhone, text);
    return {
      success: Boolean(res?.success),
      whatsappMessageId: `wb_${Date.now()}`,
      engine: this.name,
      result: res,
    };
  }

  async sendProduct(payload, context = {}) {
    const sessionId = context.sessionId || 'main';
    const companyId = context.companyId || 'default';
    this._assertAuthenticated(sessionId);
    const puppetManipulator = require('../../webbridge/PuppetManipulator');
    const targetPhone = (payload.phone || payload.remoteJid || '').replace(/\D/g, '');
    const productData = payload.product || payload;
    const res = await puppetManipulator.sendProduct(sessionId, companyId, targetPhone, productData);
    return {
      success: Boolean(res?.success),
      whatsappMessageId: `wb_prod_${Date.now()}`,
      engine: this.name,
      result: res,
      product: productData,
    };
  }

  async sendOrder(payload, context = {}) {
    const sessionId = context.sessionId || 'main';
    this._assertAuthenticated(sessionId);
    return await webBridgeManager.executeOnPage(sessionId, async (page) => {
      return {
        success: true,
        whatsappMessageId: `wb_ord_${Date.now()}`,
        engine: this.name,
        orderData: payload.orderData,
      };
    });
  }

  async sendCatalog(payload, context = {}) {
    const sessionId = context.sessionId || 'main';
    this._assertAuthenticated(sessionId);
    return await webBridgeManager.executeOnPage(sessionId, async (page) => {
      return {
        success: true,
        whatsappMessageId: `wb_cat_${Date.now()}`,
        engine: this.name,
      };
    });
  }

  async syncCatalog(payload, context = {}) {
    const sessionId = context.sessionId || 'main';
    const companyId = context.companyId || 'default';
    const webCatalogExtractor = require('../../webbridge/WebCatalogExtractor');
    return await webCatalogExtractor.extractCatalog(sessionId, companyId);
  }

  getHealth(context = {}) {
    const state = webBridgeManager.getSessionState(context.sessionId || 'main');
    return {
      online: state.status === 'ready',
      engine: this.name,
      status: state.status,
      authenticated: state.authenticated,
      available: state.available,
    };
  }
}

module.exports = new WhatsAppWebAdapter();
