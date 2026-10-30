'use strict';

/**
 * CapabilityRegistry — ZAPFLOW Unified WhatsApp Orchestrator
 * Identifica quais funcionalidades cada motor realmente suporta.
 */

const ENGINES = {
  BAILEYS: 'BAILEYS',
  WHATSAPP_WEB_BRIDGE: 'WHATSAPP_WEB_BRIDGE',
  CLOUD_API: 'CLOUD_API',
};

const OPERATIONS = {
  SEND_TEXT: 'SEND_TEXT',
  SEND_MEDIA: 'SEND_MEDIA',
  SEND_PRODUCT: 'SEND_PRODUCT',
  SEND_ORDER: 'SEND_ORDER',
  SEND_CATALOG: 'SEND_CATALOG',
  RECEIVE_MESSAGE: 'RECEIVE_MESSAGE',
  RECEIVE_ORDER: 'RECEIVE_ORDER',
  GET_CATALOG: 'GET_CATALOG',
  SYNC_CATALOG: 'SYNC_CATALOG',
  CREATE_PAYMENT: 'CREATE_PAYMENT',
  CONFIRM_PAYMENT: 'CONFIRM_PAYMENT',
};

// Static capability matrix
const ENGINE_CAPABILITIES = {
  [ENGINES.BAILEYS]: {
    [OPERATIONS.SEND_TEXT]: true,
    [OPERATIONS.SEND_MEDIA]: true,
    [OPERATIONS.SEND_PRODUCT]: true, // Supported via native productMessage protobuf
    [OPERATIONS.SEND_ORDER]: true,   // Supported via native orderMessage protobuf
    [OPERATIONS.SEND_CATALOG]: true, // Supported via storefront URL and store card
    [OPERATIONS.RECEIVE_MESSAGE]: true,
    [OPERATIONS.RECEIVE_ORDER]: true, // Supported via inbound orderMessage parser
    [OPERATIONS.GET_CATALOG]: true,
    [OPERATIONS.SYNC_CATALOG]: true,
    [OPERATIONS.CREATE_PAYMENT]: false, // Delegated to PaymentEngine
    [OPERATIONS.CONFIRM_PAYMENT]: false,
  },
  [ENGINES.WHATSAPP_WEB_BRIDGE]: {
    [OPERATIONS.SEND_TEXT]: true,
    [OPERATIONS.SEND_MEDIA]: true,
    [OPERATIONS.SEND_PRODUCT]: true,
    [OPERATIONS.SEND_ORDER]: true,
    [OPERATIONS.SEND_CATALOG]: true,
    [OPERATIONS.RECEIVE_MESSAGE]: true,
    [OPERATIONS.RECEIVE_ORDER]: true,
    [OPERATIONS.GET_CATALOG]: true,
    [OPERATIONS.SYNC_CATALOG]: true,
    [OPERATIONS.CREATE_PAYMENT]: false,
    [OPERATIONS.CONFIRM_PAYMENT]: false,
  },
  [ENGINES.CLOUD_API]: {
    [OPERATIONS.SEND_TEXT]: true,
    [OPERATIONS.SEND_MEDIA]: true,
    [OPERATIONS.SEND_PRODUCT]: true,
    [OPERATIONS.SEND_ORDER]: true,
    [OPERATIONS.SEND_CATALOG]: true,
    [OPERATIONS.RECEIVE_MESSAGE]: true,
    [OPERATIONS.RECEIVE_ORDER]: true,
    [OPERATIONS.GET_CATALOG]: true,
    [OPERATIONS.SYNC_CATALOG]: true,
    [OPERATIONS.CREATE_PAYMENT]: false,
    [OPERATIONS.CONFIRM_PAYMENT]: false,
  },
};

class CapabilityRegistry {
  constructor() {
    this.ENGINES = ENGINES;
    this.OPERATIONS = OPERATIONS;
  }

  /**
   * Check if a specific engine supports an operation
   */
  canExecute(engineName, operation, context = {}) {
    const caps = ENGINE_CAPABILITIES[engineName];
    if (!caps) return false;
    const supported = Boolean(caps[operation]);

    // Extra dynamic runtime checks
    if (engineName === ENGINES.WHATSAPP_WEB_BRIDGE) {
      if (!context.webBridgeAuthenticated) {
        return false;
      }
    }

    if (engineName === ENGINES.CLOUD_API) {
      if (!context.hasCloudCredentials) {
        return false;
      }
    }

    return supported;
  }

  /**
   * Get all capabilities for an engine
   */
  getCapabilities(engineName, context = {}) {
    if (!engineName) {
      return this.getFullMatrix(context);
    }
    const base = ENGINE_CAPABILITIES[engineName] || {};
    const result = { ...base };

    if (engineName === ENGINES.WHATSAPP_WEB_BRIDGE && !context.webBridgeAuthenticated) {
      Object.keys(result).forEach(k => {
        result[k] = false;
      });
    }

    if (engineName === ENGINES.CLOUD_API && !context.hasCloudCredentials) {
      Object.keys(result).forEach(k => {
        result[k] = false;
      });
    }

    return result;
  }

  /**
   * Get full system capability matrix
   */
  getFullMatrix(context = {}) {
    return {
      engines: Object.values(ENGINES),
      operations: Object.values(OPERATIONS),
      matrix: {
        [ENGINES.BAILEYS]: this.getCapabilities(ENGINES.BAILEYS, context),
        [ENGINES.WHATSAPP_WEB_BRIDGE]: this.getCapabilities(ENGINES.WHATSAPP_WEB_BRIDGE, context),
        [ENGINES.CLOUD_API]: this.getCapabilities(ENGINES.CLOUD_API, context),
      },
    };
  }
}

module.exports = new CapabilityRegistry();
