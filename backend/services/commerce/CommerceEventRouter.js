'use strict';

/**
 * CommerceEventRouter
 * Routes native commerce events (orders, confirmations, catalog updates)
 * to Socket.IO clients, audit loggers, and conversation runtime engines.
 */
class CommerceEventRouter {
  constructor() {
    this.handlers = new Map();
  }

  /**
   * Register listener for commerce events
   */
  on(event, handler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event).push(handler);
  }

  /**
   * Dispatch commerce event
   */
  async emit(event, payload = {}) {
    const { companyId = 'default' } = payload;
    console.log(`[COMMERCE-ROUTER] Event emitted: ${event} (tenant=${companyId})`);

    // 1. Broadcast to WebSockets via Socket.IO
    if (global.io) {
      try {
        global.io.to(`tenant:${companyId}`).emit(event, payload);
        global.io.emit(event, payload);
      } catch (ioErr) {
        console.warn('[COMMERCE-ROUTER] Failed to emit via socket.io:', ioErr.message);
      }
    }

    // 2. Trigger registered internal listeners
    const listeners = this.handlers.get(event) || [];
    for (const handler of listeners) {
      try {
        await handler(payload);
      } catch (hErr) {
        console.error(`[COMMERCE-ROUTER] Error in handler for ${event}:`, hErr.message);
      }
    }
  }

  /**
   * Convenient helper for order received event
   */
  async routeOrderReceived(orderPayload) {
    await this.emit('commerce:order_received', orderPayload);
  }

  /**
   * Convenient helper for order updated/confirmed event
   */
  async routeOrderUpdated(orderPayload) {
    await this.emit('commerce:order_updated', orderPayload);
  }

  /**
   * Convenient helper for product sent event
   */
  async routeProductSent(productPayload) {
    await this.emit('commerce:product_sent', productPayload);
  }
}

module.exports = new CommerceEventRouter();
