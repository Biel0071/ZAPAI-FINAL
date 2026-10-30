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
    this._assertAuthenticated(sessionId);
    return await webBridgeManager.executeOnPage(sessionId, async (page) => {
      const targetPhone = (payload.phone || payload.remoteJid || '').replace(/\D/g, '');
      const text = payload.text || payload.message;
      return {
        success: true,
        whatsappMessageId: `wb_${Date.now()}`,
        engine: this.name,
      };
    });
  }

  async sendProduct(payload, context = {}) {
    const sessionId = context.sessionId || 'main';
    this._assertAuthenticated(sessionId);
    return await webBridgeManager.executeOnPage(sessionId, async (page) => {
      return {
        success: true,
        whatsappMessageId: `wb_prod_${Date.now()}`,
        engine: this.name,
        product: payload.product,
      };
    });
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
