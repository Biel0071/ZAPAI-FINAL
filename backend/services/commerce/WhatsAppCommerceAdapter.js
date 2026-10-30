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
   */
  async syncCatalog(sock, options = {}) {
    throw new Error(`${this.name}: syncCatalog() must be implemented.`);
  }

  /**
   * Fetch mirrored or direct catalog products
   */
  async getCatalog(companyId, query = {}) {
    throw new Error(`${this.name}: getCatalog() must be implemented.`);
  }

  /**
   * Fetch products list
   */
  async getProducts(companyId, query = {}) {
    throw new Error(`${this.name}: getProducts() must be implemented.`);
  }

  /**
   * Fetch single product by ID
   */
  async getProductById(id, companyId = 'default') {
    throw new Error(`${this.name}: getProductById() must be implemented.`);
  }

  /**
   * Send authentic native product message to target WhatsApp contact
   */
  async sendProduct(sock, targetJid, product, options = {}) {
    throw new Error(`${this.name}: sendProduct() must be implemented.`);
  }

  /**
   * Send multiple products sequentially
   */
  async sendProductList(sock, targetJid, products = [], options = {}) {
    throw new Error(`${this.name}: sendProductList() must be implemented.`);
  }

  /**
   * Fetch cart details
   */
  async getCart(sock, orderId, token) {
    throw new Error(`${this.name}: getCart() must be implemented.`);
  }

  /**
   * Receive and parse incoming cart order
   */
  async receiveCart(sock, rawMessage, context = {}) {
    throw new Error(`${this.name}: receiveCart() must be implemented.`);
  }

  /**
   * Fetch stored order by ID
   */
  async getOrder(orderId, companyId = 'default') {
    throw new Error(`${this.name}: getOrder() must be implemented.`);
  }

  /**
   * Accept / confirm customer order
   */
  async acceptOrder(sock, orderId, options = {}) {
    throw new Error(`${this.name}: acceptOrder() must be implemented.`);
  }

  /**
   * Reject customer order
   */
  async rejectOrder(sock, orderId, reason, options = {}) {
    throw new Error(`${this.name}: rejectOrder() must be implemented.`);
  }
}

module.exports = WhatsAppCommerceAdapter;
