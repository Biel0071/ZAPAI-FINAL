'use strict';

/**
 * ProtocolIntelligence — ZAI Communication Engine
 * Módulo especializado em análise de estruturas binárias, inspeção de pacotes
 * Protobuf, extração de metadados comerciais e taxonomia de capacidades.
 */

class ProtocolIntelligence {
  constructor() {
    this.capabilityLevels = {
      DOCUMENTED: 'CAPACIDADE DOCUMENTADA',
      IDENTIFIED: 'CAPACIDADE IDENTIFICADA',
      IMPLEMENTED: 'CAPACIDADE IMPLEMENTADA',
      TESTED: 'CAPACIDADE TESTADA',
      PRODUCTION_CONFIRMED: 'CAPACIDADE CONFIRMADA EM PRODUÇÃO',
    };
  }

  /**
   * Analisa a estrutura de uma mensagem recebida e classifica o protocolo comercial
   */
  inspectMessagePayload(rawMessage = {}) {
    const unwrap = rawMessage.ephemeralMessage?.message || rawMessage.viewOnceMessage?.message || rawMessage.viewOnceMessageV2?.message || rawMessage;

    const analysis = {
      isCommercial: false,
      protocolType: 'standard',
      hasOrder: false,
      hasProduct: false,
      hasCatalog: false,
      details: {},
    };

    if (unwrap.orderMessage) {
      analysis.isCommercial = true;
      analysis.protocolType = 'orderMessage';
      analysis.hasOrder = true;
      analysis.details = {
        orderId: unwrap.orderMessage.orderId,
        itemCount: unwrap.orderMessage.itemCount,
        totalAmount1000: unwrap.orderMessage.totalAmount1000,
        currency: unwrap.orderMessage.totalCurrencyCode || 'BRL',
      };
      return analysis;
    }

    if (unwrap.productMessage) {
      analysis.isCommercial = true;
      analysis.protocolType = 'productMessage';
      analysis.hasProduct = true;
      analysis.details = {
        productId: unwrap.productMessage.product?.productId,
        title: unwrap.productMessage.product?.title,
        priceAmount1000: unwrap.productMessage.product?.priceAmount1000,
        currency: unwrap.productMessage.product?.currencyCode || 'BRL',
      };
      return analysis;
    }

    if (unwrap.listMessage || unwrap.interactiveMessage) {
      analysis.isCommercial = Boolean(unwrap.listMessage?.sections || unwrap.interactiveMessage?.nativeFlowMessage);
      analysis.protocolType = unwrap.interactiveMessage ? 'interactiveMessage' : 'listMessage';
      return analysis;
    }

    return analysis;
  }

  /**
   * Avalia o status de prontidão e certificação de uma capacidade
   */
  evaluateCapabilityStatus(engineName, operation) {
    const matrix = {
      Baileys: {
        SEND_TEXT: this.capabilityLevels.PRODUCTION_CONFIRMED,
        SEND_MEDIA: this.capabilityLevels.PRODUCTION_CONFIRMED,
        SEND_PRODUCT: this.capabilityLevels.PRODUCTION_CONFIRMED,
        RECEIVE_ORDER: this.capabilityLevels.TESTED,
        GET_CATALOG: this.capabilityLevels.PRODUCTION_CONFIRMED,
      },
      WhatsAppWebBridge: {
        GET_CATALOG: this.capabilityLevels.PRODUCTION_CONFIRMED,
        SEND_PRODUCT: this.capabilityLevels.IMPLEMENTED,
        RECEIVE_ORDER: this.capabilityLevels.IMPLEMENTED,
      },
      CloudAPI: {
        SEND_TEXT: this.capabilityLevels.IMPLEMENTED,
        SEND_PRODUCT: this.capabilityLevels.DOCUMENTED,
      },
    };

    return matrix[engineName]?.[operation] || this.capabilityLevels.DOCUMENTED;
  }
}

module.exports = new ProtocolIntelligence();
