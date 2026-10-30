'use strict';

const catalogSyncEngine = require('../../../services/commerce/CatalogSyncEngine');
const nativeProductSender = require('../../../services/commerce/NativeProductSender');
const orderConfirmationEngine = require('../../../services/commerce/OrderConfirmationEngine');
const commerceCapabilityRegistry = require('../../../services/commerce/CommerceCapabilityRegistry');
const sessionManager = require('../../../services/sessionManager');
const { orchestrator } = require('../../../services/orchestrator');

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

      if (orchestrator.isEnabled) {
        if (Array.isArray(productIds) && productIds.length > 0) {
          const results = [];
          for (const prodId of productIds) {
            const result = await orchestrator.execute('SEND_PRODUCT', {
              phone,
              remoteJid,
              productId: prodId,
              caption,
            }, {
              companyId,
              conversationId,
              sessionId,
            });
            results.push(result.data || result);
            if (productIds.length > 1) {
              await new Promise(r => setTimeout(r, 600));
            }
          }
          return res.status(200).json({ success: true, results });
        }

        const result = await orchestrator.execute('SEND_PRODUCT', {
          phone,
          remoteJid,
          productId,
          product: req.body.product,
          caption,
        }, {
          companyId,
          conversationId,
          sessionId,
        });
        return res.status(200).json(result.data || result);
      }

      const session = sessionManager.getSession(sessionId)
        || (sessionManager.getConnectedSessionOrNull ? sessionManager.getConnectedSessionOrNull() : null)
        || sessionManager.getSession('main')
        || sessionManager.getSession('default');
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
   * POST /api/commerce/send-catalog
   */
  async sendCatalog(req, res) {
    try {
      const { phone, remoteJid, conversationId, sessionId = 'main', caption } = req.body;
      const companyId = req.user?.companyId || req.body?.companyId || 'default';

      if (orchestrator.isEnabled) {
        const result = await orchestrator.execute('SEND_CATALOG', {
          phone,
          remoteJid,
          caption,
        }, {
          companyId,
          conversationId,
          sessionId,
        });
        return res.status(200).json(result.data || result);
      }

      const session = sessionManager.getSession(sessionId)
        || (sessionManager.getConnectedSessionOrNull ? sessionManager.getConnectedSessionOrNull() : null)
        || sessionManager.getSession('main')
        || sessionManager.getSession('default');
      if (!session || !session.sock) {
        return res.status(409).json({ success: false, error: 'WhatsApp session is not connected.' });
      }

      const targetJid = remoteJid || (phone ? (phone.includes('@') ? phone : `${phone.replace(/\D/g, '')}@s.whatsapp.net`) : null);
      if (!targetJid) {
        return res.status(400).json({ success: false, error: 'Recipient phone or remoteJid is required.' });
      }

      const baileysCommerceAdapter = require('../../../services/commerce/BaileysCommerceAdapter');
      const result = await baileysCommerceAdapter.sendCatalog(session.sock, targetJid, {
        title: 'Catálogo de Produtos — Depósito Vista Alegre',
        description: 'Tijolos, Cimentos, Telhas, Caixas d’Água e Agregados',
      }, { sessionId, companyId, conversationId });

      return res.status(200).json(result);
    } catch (err) {
      console.error('[COMMERCE-CONTROLLER] sendCatalog failed:', err);
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
   * POST /api/commerce/orders/create
   */
  async createOrder(req, res) {
    try {
      const companyId = req.user?.companyId || req.body?.companyId || 'default';
      const {
        phone,
        remoteJid,
        conversationId,
        items,
        freight,
        discount,
        notes,
        customerName,
        sessionId = 'main',
      } = req.body || {};

      if (orchestrator.isEnabled) {
        const result = await orchestrator.commerceEngine.createOrder({
          companyId,
          conversationId,
          phone: phone || remoteJid,
          customerName,
          items,
          freight,
          discount,
          notes,
          sessionId,
        });
        return res.status(201).json(result);
      }

      const result = await orderConfirmationEngine.createOrder({
        companyId,
        conversationId,
        phone: phone || remoteJid,
        customerName,
        items,
        freight,
        discount,
        notes,
        sessionId,
      });

      return res.status(201).json(result);
    } catch (err) {
      console.error('[COMMERCE-CONTROLLER] createOrder failed:', err);
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
