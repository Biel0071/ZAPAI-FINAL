'use strict';

const catalogSyncEngine = require('../../../services/commerce/CatalogSyncEngine');
const nativeProductSender = require('../../../services/commerce/NativeProductSender');
const orderConfirmationEngine = require('../../../services/commerce/OrderConfirmationEngine');
const commerceCapabilityRegistry = require('../../../services/commerce/CommerceCapabilityRegistry');
const sessionManager = require('../../../services/sessionManager');

class CommerceController {
  /**
   * GET /api/commerce/capabilities
   */
  async getCapabilities(req, res) {
    try {
      const data = commerceCapabilityRegistry.getCapabilities();
      return res.status(200).json({ success: true, data });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/commerce/catalog
   */
  async getCatalog(req, res) {
    try {
      const companyId = req.user?.companyId || req.query.companyId || 'default';
      const result = await catalogSyncEngine.listProducts(companyId, req.query);
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/commerce/sync
   */
  async syncCatalog(req, res) {
    try {
      const companyId = req.user?.companyId || req.body?.companyId || 'default';
      const result = await catalogSyncEngine.syncCatalog(companyId);
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/commerce/send-product
   */
  async sendProduct(req, res) {
    try {
      const { phone, remoteJid, productId, productIds, caption, conversationId, sessionId = 'main' } = req.body;
      const companyId = req.user?.companyId || req.body?.companyId || 'default';

      const session = sessionManager.getSession(sessionId);
      if (!session || !session.sock) {
        return res.status(409).json({ success: false, error: 'WhatsApp session is not connected.' });
      }

      if (Array.isArray(productIds) && productIds.length > 0) {
        const result = await nativeProductSender.sendMultiple(session.sock, {
          phone,
          remoteJid,
          productIds,
          companyId,
          conversationId,
          options: { sessionId, caption },
        });
        return res.status(200).json(result);
      }

      if (!productId && !req.body.product) {
        return res.status(400).json({ success: false, error: 'productId or product payload is required.' });
      }

      const result = await nativeProductSender.send(session.sock, {
        phone,
        remoteJid,
        productId,
        product: req.body.product,
        companyId,
        conversationId,
        caption,
        options: { sessionId },
      });

      return res.status(200).json(result);
    } catch (err) {
      console.error('[COMMERCE-CONTROLLER] sendProduct failed:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/commerce/orders
   */
  async listOrders(req, res) {
    try {
      const companyId = req.user?.companyId || req.query.companyId || 'default';
      const result = await orderConfirmationEngine.listOrders(companyId, req.query);
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /api/commerce/orders/:id
   */
  async getOrder(req, res) {
    try {
      const companyId = req.user?.companyId || req.query.companyId || 'default';
      const order = await orderConfirmationEngine.getOrder(req.params.id, companyId);
      if (!order) {
        return res.status(404).json({ success: false, error: 'Order not found.' });
      }
      return res.status(200).json({ success: true, order });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/commerce/orders/:id/confirm
   */
  async confirmOrder(req, res) {
    try {
      const companyId = req.user?.companyId || req.body?.companyId || 'default';
      const { notes, sessionId = 'main' } = req.body || {};
      const result = await orderConfirmationEngine.confirmOrder({
        id: req.params.id,
        companyId,
        notes,
        sessionId,
      });
      return res.status(200).json(result);
    } catch (err) {
      console.error('[COMMERCE-CONTROLLER] confirmOrder failed:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /api/commerce/orders/:id/reject
   */
  async rejectOrder(req, res) {
    try {
      const companyId = req.user?.companyId || req.body?.companyId || 'default';
      const { reason, sessionId = 'main' } = req.body || {};
      const result = await orderConfirmationEngine.rejectOrder({
        id: req.params.id,
        companyId,
        reason,
        sessionId,
      });
      return res.status(200).json(result);
    } catch (err) {
      console.error('[COMMERCE-CONTROLLER] rejectOrder failed:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = new CommerceController();
