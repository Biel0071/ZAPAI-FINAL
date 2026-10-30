'use strict';

/**
 * CommerceCapabilityRegistry
 * Audits and exposes capability matrix for WhatsApp Commerce across connection engines.
 */
class CommerceCapabilityRegistry {
  constructor() {
    this.matrix = {
      engine: 'Baileys',
      engineVersion: '6.7.23',
      capabilities: {
        canConsultCatalog: true,
        canConsultProducts: true,
        canConsultImages: true,
        canSendNativeProduct: true,
        canSendMultipleProducts: true,
        canConsultCart: true,
        canReceiveCartOrder: true,
        canConsultOrder: true,
        canConfirmOrder: true,
        canRejectOrder: true,
      },
      transportProtocol: 'WhatsApp Multi-Device Protocol (WAProto / Thrift IQ)',
      details: {
        productFormat: 'WAProto.Message.ProductMessage with prepareWAMessageMedia',
        orderFormat: 'WAProto.Message.OrderMessage with fb:thrift_iq getOrderDetails',
        imageResolution: 'Local image buffer resolution with auto fallback to HTTP stream',
        multiSelectSupport: 'Supported via sequential pipeline queueing',
      }
    };
  }

  getCapabilities() {
    return this.matrix;
  }

  auditEngine(engineName) {
    if (String(engineName).toLowerCase() === 'baileys') {
      return this.matrix;
    }
    return {
      engine: engineName,
      capabilities: {
        canConsultCatalog: false,
        canConsultProducts: false,
        canConsultImages: false,
        canSendNativeProduct: false,
        canSendMultipleProducts: false,
        canConsultCart: false,
        canReceiveCartOrder: false,
        canConsultOrder: false,
        canConfirmOrder: false,
        canRejectOrder: false,
      },
      warning: `Engine ${engineName} does not have native commerce adapters configured.`
    };
  }
}

module.exports = new CommerceCapabilityRegistry();
