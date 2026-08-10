const EventEmitter = require('events');

class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }

  /**
   * Typed emission wrapper for EventBus.
   * @param {string} eventName - e.g. 'FLOW_STARTED', 'MESSAGE_SENT', 'MESSAGE_ACK'
   * @param {object} payload - The event payload
   */
  dispatch(eventName, payload) {
    if (!eventName) {
      console.warn('[EventBus] Attempted to dispatch an event without a name');
      return;
    }
    
    // Asynchronous dispatch so it doesn't block the caller
    setImmediate(() => {
      try {
        this.emit(eventName, payload);
      } catch (err) {
        console.error(`[EventBus] Error dispatching event ${eventName}:`, err);
      }
    });
  }

  /**
   * Listen to an event.
   */
  subscribe(eventName, listener) {
    this.on(eventName, listener);
    return () => this.unsubscribe(eventName, listener); // return unsubscribe function
  }

  /**
   * Remove listener.
   */
  unsubscribe(eventName, listener) {
    this.off(eventName, listener);
  }
}

// Singleton instance
const globalEventBus = new EventBus();

module.exports = globalEventBus;
