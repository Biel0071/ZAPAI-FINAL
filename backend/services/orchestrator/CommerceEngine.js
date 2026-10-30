'use strict';

/**
 * CommerceEngine — ZAPFLOW Unified WhatsApp Orchestrator
 * Núcleo de coordenação comercial integrado ao CRM.
 * Gerencia catálogo oficial, produtos, carrinho e ciclo de vida de pedidos.
 */

const catalogSyncEngine = require('../commerce/CatalogSyncEngine');
const orderConfirmationEngine = require('../commerce/OrderConfirmationEngine');
const productRepository = require('../../src/data/repositories/productRepository');
const eventNormalizer = require('./EventNormalizer');

class CommerceEngine {
  /**
   * List catalog products from single source of truth
   */
  async listProducts(companyId = 'default', query = {}) {
    return await catalogSyncEngine.listProducts(companyId, query);
  }

  /**
   * Sync official catalog from connected store
   */
  async syncCatalog(companyId = 'default', options = {}) {
    return await catalogSyncEngine.syncFromWhatsApp(companyId, options);
  }

  /**
   * Create an authentic order from catalog items
   */
  async createOrder({ companyId = 'default', conversationId, phone, items = [], freight = 0, discount = 0, notes = '', sessionId = 'main' }) {
    if (!items || items.length === 0) {
      throw new Error('At least one item is required to create an order.');
    }
    if (!phone) {
      throw new Error('Customer phone is required to create an order.');
    }

    const orderRecord = await orderConfirmationEngine.createOrder({
      companyId,
      conversationId,
      phone,
      items,
      freight,
      discount,
      notes,
      sessionId,
    });

    // Normalize and emit event
    eventNormalizer.normalizeOrderCreated('COMMERCE_ENGINE', orderRecord, { companyId, conversationId });

    return orderRecord;
  }

  /**
   * Confirm an order
   */
  async confirmOrder(orderId, companyId = 'default', options = {}) {
    return await orderConfirmationEngine.confirmOrder(orderId, companyId, options);
  }

  /**
   * Reject an order
   */
  async rejectOrder(orderId, companyId = 'default', reason = '', options = {}) {
    return await orderConfirmationEngine.rejectOrder(orderId, companyId, reason, options);
  }

  /**
   * List orders with filtering
   */
  async listOrders(companyId = 'default', filter = {}) {
    return await orderConfirmationEngine.listOrders(companyId, filter);
  }

  /**
   * Get single order by ID
   */
  async getOrder(orderId, companyId = 'default') {
    return await orderConfirmationEngine.getOrder(orderId, companyId);
  }
}

module.exports = new CommerceEngine();
