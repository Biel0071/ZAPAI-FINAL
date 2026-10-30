'use strict';

/**
 * CompatibilityEngine — ZAI Communication Engine
 * Mapeamento de esquemas, normalização de contratos e garantia de
 * compatibilidade retroativa entre versões do ZAPFLOW, WhatsApp Web e Meta Graph API.
 */

class CompatibilityEngine {
  /**
   * Converte payload de produto interno para o formato esperado pelo motor selecionado
   */
  normalizeProductPayload(product, engineType = 'Baileys') {
    if (!product) return {};

    const price = Number(product.price || 0);
    const priceAmount1000 = Math.round(price * 1000);
    const productId = String(product.id || product.productId || product.code || 'prod').replace(/\.[^.]+$/, '');
    const title = String(product.name || product.title || 'Produto WhatsApp').trim();

    if (engineType === 'Baileys') {
      return {
        productId,
        title,
        description: product.description || '',
        currencyCode: product.currency || 'BRL',
        priceAmount1000: String(priceAmount1000),
        retailerId: String(product.code || productId),
        images: Array.isArray(product.images) ? product.images : [product.image].filter(Boolean),
        url: product.whatsapp_url || undefined,
      };
    }

    if (engineType === 'CloudAPI') {
      return {
        retailer_id: productId,
        name: title,
        price: price.toFixed(2),
        currency: 'BRL',
      };
    }

    return product;
  }

  /**
   * Normaliza um pedido recebido via carrinho para o padrão canônico do CRM
   */
  normalizeOrderPayload(rawOrder = {}) {
    return {
      orderId: String(rawOrder.orderId || `order_${Date.now()}`),
      itemCount: Number(rawOrder.itemCount || 1),
      totalAmount: Number(rawOrder.totalAmount || 0),
      currency: rawOrder.currency || 'BRL',
      orderTitle: rawOrder.orderTitle || 'Pedido do Catálogo',
      items: Array.isArray(rawOrder.items) ? rawOrder.items : [],
      customerNotes: rawOrder.customerNotes || '',
      receivedAt: rawOrder.createdAt || new Date().toISOString(),
    };
  }
}

module.exports = new CompatibilityEngine();
