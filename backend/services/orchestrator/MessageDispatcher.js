'use strict';

/**
 * MessageDispatcher — ZAPFLOW Unified WhatsApp Orchestrator
 * Centralizador de todos os envios do ZAPFLOW.
 * Encaminha as mensagens de forma transparente para o OperationRouter.
 */

const operationRouter = require('./OperationRouter');
const capabilityRegistry = require('./CapabilityRegistry');

class MessageDispatcher {
  /**
   * Dispara mensagem de texto
   */
  async sendText({ phone, remoteJid, text, conversationId, companyId = 'default', sessionId = 'main', idempotencyKey }) {
    return await operationRouter.execute(
      capabilityRegistry.OPERATIONS.SEND_TEXT,
      { phone, remoteJid, text },
      { companyId, conversationId, sessionId, idempotencyKey }
    );
  }

  /**
   * Dispara mensagem de mídia
   */
  async sendMedia({ phone, remoteJid, mediaBuffer, mediaUrl, mediaType, caption, fileName, mimetype, ptt, conversationId, companyId = 'default', sessionId = 'main', idempotencyKey }) {
    return await operationRouter.execute(
      capabilityRegistry.OPERATIONS.SEND_MEDIA,
      { phone, remoteJid, mediaBuffer, mediaUrl, mediaType, caption, fileName, mimetype, ptt },
      { companyId, conversationId, sessionId, idempotencyKey }
    );
  }

  /**
   * Dispara produto nativo comercial
   */
  async sendProduct({ phone, remoteJid, productId, product, caption, conversationId, companyId = 'default', sessionId = 'main', idempotencyKey }) {
    return await operationRouter.execute(
      capabilityRegistry.OPERATIONS.SEND_PRODUCT,
      { phone, remoteJid, productId, product, caption },
      { companyId, conversationId, sessionId, idempotencyKey }
    );
  }

  /**
   * Dispara pedido comercial com cobrança
   */
  async sendOrder({ phone, remoteJid, orderData, conversationId, companyId = 'default', sessionId = 'main', idempotencyKey }) {
    return await operationRouter.execute(
      capabilityRegistry.OPERATIONS.SEND_ORDER,
      { phone, remoteJid, orderData },
      { companyId, conversationId, sessionId, idempotencyKey }
    );
  }

  /**
   * Dispara catálogo comercial da loja
   */
  async sendCatalog({ phone, remoteJid, url, text, conversationId, companyId = 'default', sessionId = 'main', idempotencyKey }) {
    return await operationRouter.execute(
      capabilityRegistry.OPERATIONS.SEND_CATALOG,
      { phone, remoteJid, url, text },
      { companyId, conversationId, sessionId, idempotencyKey }
    );
  }
}

module.exports = new MessageDispatcher();
