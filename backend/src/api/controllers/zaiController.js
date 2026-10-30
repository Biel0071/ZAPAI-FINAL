'use strict';

/**
 * ZAIController — Controller da API Unificada ZAI Communication Engine
 * Rotas /zai/...
 */

const zaiEngine = require('../../../services/zai');
const catalogSyncEngine = require('../../../services/commerce/CatalogSyncEngine');
const connectionService = require('../../../services/connectionService');
const { query: dbQuery } = require('../../../src/infrastructure/config/database');

class ZAIController {
  /**
   * GET /zai/capabilities
   */
  async getCapabilities(req, res) {
    try {
      const capabilities = zaiEngine.capabilities.getCapabilities();
      return res.status(200).json({ success: true, data: capabilities });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /zai/engines
   */
  async getEngines(req, res) {
    try {
      const sessionId = req.query.sessionId || 'main';
      const transports = zaiEngine.transports.getTransports(sessionId);
      return res.status(200).json({
        success: true,
        data: {
          sessionId,
          registeredEngines: Object.values(zaiEngine.capabilities.ENGINES),
          activeTransports: transports,
        }
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /zai/health
   */
  async getHealth(req, res) {
    try {
      const sessionId = req.query.sessionId || 'main';
      const status = zaiEngine.getSystemStatus(sessionId);
      return res.status(200).json({ success: true, data: status });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /zai/connections
   */
  async listConnections(req, res) {
    try {
      const tenantId = req.authTenantId || req.user?.companyId || 'default';
      const connections = await connectionService.listConnections(tenantId);
      return res.status(200).json({ success: true, data: connections });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /zai/connections/:id/status
   */
  async getConnectionStatus(req, res) {
    try {
      const sessionId = req.params.id || 'main';
      const status = await connectionService.getConnectionStatus(sessionId);
      const bridgeStatus = zaiEngine.webBridge.getSessionState(sessionId);
      return res.status(200).json({
        success: true,
        data: {
          ...status,
          webBridge: bridgeStatus,
        }
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * POST /zai/messages/send
   */
  async sendMessage(req, res) {
    try {
      const { phone, text, sessionId = 'main' } = req.body;
      const companyId = req.user?.companyId || 'default';
      if (!phone || !text) {
        return res.status(400).json({ success: false, error: 'phone e text são obrigatórios.' });
      }

      const result = await zaiEngine.sendText(phone, text, { companyId, sessionId });
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /zai/catalog
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
   * POST /zai/catalog/sync
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
   * POST /zai/catalog/products/send
   */
  async sendProduct(req, res) {
    try {
      const { phone, productId, product, sessionId = 'main', caption } = req.body;
      const companyId = req.user?.companyId || 'default';
      if (!phone) {
        return res.status(400).json({ success: false, error: 'phone é obrigatório.' });
      }

      let targetProduct = product;
      if (!targetProduct && productId) {
        const dbRes = await dbQuery('SELECT * FROM products WHERE id = $1 LIMIT 1', [productId]);
        targetProduct = dbRes.rows[0];
      }

      if (!targetProduct) {
        return res.status(404).json({ success: false, error: 'Produto não encontrado.' });
      }

      const result = await zaiEngine.sendProduct(phone, targetProduct, { companyId, sessionId, caption });
      return res.status(200).json({ success: true, data: result });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * GET /zai/orders
   */
  async getOrders(req, res) {
    try {
      const companyId = req.user?.companyId || req.query.companyId || 'default';
      const orders = await dbQuery(
        'SELECT * FROM customer_orders WHERE company_id = $1 ORDER BY created_at DESC LIMIT 50',
        [companyId]
      );
      return res.status(200).json({ success: true, data: orders.rows });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = new ZAIController();
