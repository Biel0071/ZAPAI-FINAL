'use strict';

/**
 * WhatsAppCommerceAdapter
 * Abstract base contract for WhatsApp Commerce integration.
 * Defines standard operations for catalog synchronization, native product dispatch,
 * incoming cart/order handling, and order lifecycle management.
 */
class WhatsAppCommerceAdapter {
  constructor(name = 'BaseWhatsAppCommerceAdapter') {
    this.name = name;
  }

  /**
   * Sync catalog products from WhatsApp Business account
   * @param {Object} sock - Connection socket
   * @param {Object} options - Sync options (companyId, sessionId, limit)
   * @returns {Promise<{ products: Array, total: number }>}
   */
  async syncCatalog(sock, options = {}) {
    throw new Error(`${this.name}: syncCatalog() must be implemented.`);
  }

  /**
   * Fetch mirrored or direct catalog products
   * @param {string} companyId
   * @param {Object} query - Search and filtering parameters
   * @returns {Promise<{ products: Array, total: number }>}
   */
  async getCatalog(companyId, query = {}) {
    throw new Error(`${this.name}: getCatalog() must be implemented.`);
  }

  /**
   * Send authentic native product message to target WhatsApp contact
   * @param {Object} sock - Connection socket
   * @param {string} targetJid - Recipient JID (e.g. 5511999999999@s.whatsapp.net)
   * @param {Object} product - Product data (productId, title, description, price, image, etc.)
   * @param {Object} options - Additional options (businessOwnerJid, caption, etc.)
   * @returns {Promise<Object>} WhatsApp message result
   */
  async sendProduct(sock, targetJid, product, options = {}) {
    throw new Error(`${this.name}: sendProduct() must be implemented.`);
  }

  /**
   * Parse incoming order/cart message from customer
   * @param {Object} sock - Connection socket
   * @param {Object} rawMessage - Raw WhatsApp upsert message
   * @param {Object} context - Metadata (companyId, sessionId)
   * @returns {Promise<Object|null>} Normalized order object
   */
  async handleIncomingOrder(sock, rawMessage, context = {}) {
    throw new Error(`${this.name}: handleIncomingOrder() must be implemented.`);
  }

  /**
   * Fetch itemized details for an order
   * @param {Object} sock - Connection socket
   * @param {string} orderId - Meta Order ID
   * @param {string} token - Meta Order Token
   * @returns {Promise<Object>} Order details with item list
   */
  async getOrderDetails(sock, orderId, token) {
    throw new Error(`${this.name}: getOrderDetails() must be implemented.`);
  }

  /**
   * Confirm customer order and send status message
   * @param {Object} sock - Connection socket
   * @param {string} orderId - Order identifier
   * @param {Object} options - Confirmation parameters
   * @returns {Promise<Object>}
   */
  async confirmOrder(sock, orderId, options = {}) {
    throw new Error(`${this.name}: confirmOrder() must be implemented.`);
  }

  /**
   * Reject customer order
   * @param {Object} sock - Connection socket
   * @param {string} orderId - Order identifier
   * @param {string} reason - Rejection reason
   * @returns {Promise<Object>}
   */
  async rejectOrder(sock, orderId, reason) {
    throw new Error(`${this.name}: rejectOrder() must be implemented.`);
  }
}

module.exports = WhatsAppCommerceAdapter;
