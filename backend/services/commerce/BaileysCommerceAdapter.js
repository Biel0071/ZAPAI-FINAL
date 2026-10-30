'use strict';

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const WhatsAppCommerceAdapter = require('./WhatsAppCommerceAdapter');

class BaileysCommerceAdapter extends WhatsAppCommerceAdapter {
  constructor() {
    super('BaileysCommerceAdapter');
  }

  /**
   * Resolves an image into a Baileys media object with a raw Buffer.
   * Loading a Buffer directly ensures Baileys' prepareWAMessageMedia does not fail
   * with relative URL errors or network resolution timeouts.
   */
  async resolveImageBuffer(imageSource) {
    if (!imageSource) return null;
    if (Buffer.isBuffer(imageSource)) return { image: imageSource };

    if (typeof imageSource === 'object' && imageSource.image) {
      return imageSource;
    }

    if (typeof imageSource === 'string') {
      const src = imageSource.trim();

      // Remote HTTP/HTTPS URL
      if (src.startsWith('http://') || src.startsWith('https://')) {
        try {
          const resp = await axios.get(src, { responseType: 'arraybuffer', timeout: 10000 });
          if (resp.data) {
            return { image: Buffer.from(resp.data) };
          }
        } catch (e) {
          console.warn('[COMMERCE-MEDIA] Failed to download remote image:', src, e.message);
          return { image: { url: src } };
        }
      }

      // Local filesystem paths
      const candidates = [
        src,
        path.resolve(process.cwd(), src.replace(/^\/+/, '')),
        path.resolve(process.cwd(), 'assets', src.replace(/^\/?assets\/?/, '')),
        path.resolve(process.cwd(), '..', src.replace(/^\/+/, '')),
        path.join('/www/zapai', src.replace(/^\/+/, '')),
        path.join('/opt/zapai/backend', src.replace(/^\/+/, '')),
        path.join('/opt/zapai/backend/assets', src.replace(/^\/?assets\/?/, '')),
        path.join('/opt/zapai/backend/assets/catalog', src.replace(/^.*[\/\\]/, '')),
        path.join('c:/projetos/ZAPAI-FINAL', src.replace(/^\/+/, '')),
        path.join('c:/projetos/ZAPAI-FINAL/backend', src.replace(/^\/+/, '')),
      ];

      for (const candidate of candidates) {
        try {
          if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            const buf = fs.readFileSync(candidate);
            return { image: buf };
          }
        } catch (_) {}
      }
    }

    return null;
  }

  /**
   * Resolves business owner JID from socket user state or phone
   */
  resolveBusinessOwnerJid(sock, options = {}) {
    let rawPhone = options.businessOwnerPhone || options.bizOwnerPhone || '';
    if (!rawPhone && sock?.user?.id) {
      rawPhone = String(sock.user.id).split('@')[0].split(':')[0].replace(/\D/g, '');
    }
    if (!rawPhone && sock?.authState?.creds?.me?.id) {
      rawPhone = String(sock.authState.creds.me.id).split('@')[0].split(':')[0].replace(/\D/g, '');
    }
    if (!rawPhone) {
      rawPhone = '553193672075';
    }

    // Handle LID mappings if present
    if (rawPhone.length >= 14 && global.lidToPhoneMap && global.lidToPhoneMap.has(rawPhone)) {
      rawPhone = global.lidToPhoneMap.get(rawPhone).replace(/\D/g, '');
    }

    return {
      phone: rawPhone,
      jid: `${rawPhone}@s.whatsapp.net`,
    };
  }

  /**
   * Send authentic native product message to target WhatsApp contact
   */
  async sendProduct(sock, targetJid, product, options = {}) {
    if (!sock) throw new Error('WhatsApp socket is not connected or initialized.');
    if (!targetJid) throw new Error('Target JID is required.');
    if (!product) throw new Error('Product payload is required.');

    const { phone: bizPhone, jid: bizJid } = this.resolveBusinessOwnerJid(sock, options);

    // Pick primary image
    const rawImage =
      product.productImage ||
      (Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : null) ||
      product.image ||
      options.imagePath ||
      null;

    const mediaObj = await this.resolveImageBuffer(rawImage);
    if (!mediaObj) {
      throw new Error(`Unable to resolve product image for ${product.name || product.id}. Image is mandatory for native WhatsApp product cards.`);
    }

    const price = Number(product.price || options.price || 0);
    const priceAmount1000 = Math.round(price * 1000);
    const productId = String(product.productId || product.id || product.code || 'prod').replace(/\.[^.]+$/, '');
    const title = String(product.name || product.title || 'Produto WhatsApp').trim();
    const description = String(product.description || options.description || '').trim();

    const productPayload = {
      product: {
        productImage: mediaObj.image,
        productId,
        title,
        description,
        currencyCode: product.currency || 'BRL',
        priceAmount1000: String(priceAmount1000),
        retailerId: String(product.code || product.retailerId || productId),
        productImageCount: Array.isArray(product.images) && product.images.length > 1 ? product.images.length : 1,
        url: `https://wa.me/c/${bizPhone}`,
      },
      businessOwnerJid: bizJid,
      caption: options.caption || undefined,
    };

    console.log(`[COMMERCE-ADAPTER] Dispatching native productMessage: productId=${productId}, title="${title}", priceAmount1000=${priceAmount1000}, target=${targetJid}`);
    const result = await sock.sendMessage(targetJid, productPayload);
    return result;
  }

  /**
   * Query full cart and item details using Baileys IQ
   */
  async getOrderDetails(sock, orderId, token) {
    if (!sock) throw new Error('WhatsApp socket is not available.');
    if (!orderId || !token) throw new Error('orderId and token are required to fetch order details.');

    if (typeof sock.getOrderDetails !== 'function') {
      console.warn('[COMMERCE-ADAPTER] sock.getOrderDetails is not available on current socket instance.');
      return null;
    }

    try {
      const details = await sock.getOrderDetails(orderId, token);
      console.log(`[COMMERCE-ADAPTER] Successfully retrieved order details for order #${orderId}`);
      return details;
    } catch (err) {
      console.error(`[COMMERCE-ADAPTER] Failed to fetch order details via IQ for order #${orderId}:`, err.message);
      return null;
    }
  }

  /**
   * Send authentic native WhatsApp order created from catalog
   */
  async sendOrder(sock, targetJid, orderData, options = {}) {
    if (!sock) throw new Error('WhatsApp socket is not available.');
    if (!targetJid) throw new Error('Target JID is required.');

    const { phone: bizPhone, jid: bizJid } = this.resolveBusinessOwnerJid(sock, options);
    const { proto, generateWAMessageFromContent } = require('@whiskeysockets/baileys');

    const orderId = String(orderData.orderId || `ORD_${Date.now().toString().slice(-6)}`);
    const orderTitle = String(orderData.orderTitle || `Pedido #${orderId} - Depósito Vista Alegre`);
    const items = Array.isArray(orderData.items) ? orderData.items : [];
    const totalAmount = Number(orderData.totalAmount || 0);
    const totalAmount1000 = Math.round(totalAmount * 1000);
    const notes = orderData.notes || '';
    const subtotal = Number(orderData.subtotal || totalAmount);
    const freight = Number(orderData.freight || 0);
    const discount = Number(orderData.discount || 0);

    // 1. Dispatch native orderMessage protobuf
    let orderMsgKey = null;
    try {
      const orderContent = {
        orderMessage: {
          orderId,
          orderTitle,
          itemCount: items.length,
          status: proto?.Message?.OrderMessage?.OrderStatus?.INQUIRY || 1,
          surface: proto?.Message?.OrderMessage?.OrderSurface?.CATALOG || 1,
          message: notes || 'Pedido criado a partir do catálogo',
          totalAmount1000,
          totalCurrencyCode: 'BRL',
          sellerJid: bizJid,
          token: `tok_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        },
      };

      const msg = generateWAMessageFromContent(targetJid, orderContent, { userJid: bizJid });
      await sock.relayMessage(targetJid, msg.message, { messageId: msg.key.id });
      orderMsgKey = msg.key;
      console.log(`[COMMERCE-ADAPTER] Successfully dispatched native orderMessage: orderId=${orderId} to ${targetJid}`);
    } catch (orderErr) {
      console.warn('[COMMERCE-ADAPTER] relayMessage orderMessage fallback:', orderErr.message);
    }

    // 2. Dispatch official itemized receipt
    const itemsList = items.map((it) => {
      const p = Number(it.price || 0);
      const q = Number(it.quantity || 1);
      return `• *${it.name || it.title}* (${q}x) — R$ ${(p * q).toFixed(2)}`;
    }).join('\n');

    const receiptLines = [
      `🛒 *PEDIDO GERADO — #${orderId}*`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `Olá! Seu pedido foi montado a partir do nosso catálogo:`,
      ``,
      itemsList,
      ``,
      `💰 *Subtotal:* R$ ${subtotal.toFixed(2)}`,
      freight > 0 ? `🚚 *Frete / Entrega:* R$ ${freight.toFixed(2)}` : `🚚 *Frete:* A combinar / Grátis`,
      discount > 0 ? `🏷️ *Desconto:* -R$ ${discount.toFixed(2)}` : null,
      `💵 *TOTAL DO PEDIDO:* R$ ${totalAmount.toFixed(2)}`,
      notes ? `📝 *Observações:* ${notes}` : null,
      ``,
      `💳 *Formas de Pagamento:* PIX, Cartão ou Boleto`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `*Depósito Vista Alegre* — Agradecemos a preferência!`,
    ].filter(Boolean).join('\n');

    const receiptMsg = await sock.sendMessage(targetJid, { text: receiptLines });

    return {
      key: orderMsgKey || receiptMsg?.key,
      orderId,
      totalAmount,
    };
  }

  /**
   * Confirm order and dispatch official receipt to customer
   */
  async confirmOrder(sock, targetJid, order, options = {}) {
    if (!sock) throw new Error('WhatsApp socket is not available.');
    if (!targetJid) throw new Error('targetJid is required.');

    const orderId = order.order_id || order.id || 'N/A';
    const totalFormatted = (Number(order.total_amount || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const itemsList = Array.isArray(order.items) && order.items.length > 0
      ? order.items.map(it => `• *${it.name || it.title}* (${it.quantity || 1}x) - R$ ${(Number(it.price || 0)).toFixed(2)}`).join('\n')
      : `• ${order.order_title || 'Itens do Catálogo'}`;

    const confirmationText = [
      `✅ *PEDIDO #${orderId} CONFIRMADO!*`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `Olá! Seu pedido foi aceito com sucesso por nossa equipe.`,
      ``,
      `📦 *Resumo do Pedido:*`,
      itemsList,
      ``,
      `💰 *Total:* ${totalFormatted}`,
      options.notes ? `📝 *Observações:* ${options.notes}` : null,
      ``,
      `🚚 Já estamos separando seu pedido para entrega! Em instantes enviaremos a confirmação de rota e cobrança.`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `*Depósito Vista Alegre* — Agradecemos a preferência!`
    ].filter(Boolean).join('\n');

    return await sock.sendMessage(targetJid, { text: confirmationText });
  }

  /**
   * Reject order and dispatch notification to customer
   */
  async rejectOrder(sock, targetJid, order, reason) {
    if (!sock) throw new Error('WhatsApp socket is not available.');
    if (!targetJid) throw new Error('targetJid is required.');

    const orderId = order.order_id || order.id || 'N/A';
    const rejectText = [
      `⚠️ *ATUALIZAÇÃO DO PEDIDO #${orderId}*`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `Olá! Verificamos seu pedido em nosso sistema, mas infelizmente não poderemos atendê-lo neste momento.`,
      ``,
      reason ? `*Motivo:* ${reason}` : `*Motivo:* Item temporariamente indisponível em estoque.`,
      ``,
      `Nossa equipe de vendas está à disposição aqui no chat para sugerir alternativas semelhantes!`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `*Depósito Vista Alegre*`
    ].join('\n');

    return await sock.sendMessage(targetJid, { text: rejectText });
  }

  /**
   * Section 7 Interface compliance methods & aliases
   */
  async getCatalog(companyId = 'default', query = {}) {
    const catalogSyncEngine = require('./CatalogSyncEngine');
    return await catalogSyncEngine.listProducts(companyId, query);
  }

  async getProducts(companyId = 'default', query = {}) {
    const catalogSyncEngine = require('./CatalogSyncEngine');
    return await catalogSyncEngine.listProducts(companyId, query);
  }

  async getProductById(id, companyId = 'default') {
    const catalogSyncEngine = require('./CatalogSyncEngine');
    return await catalogSyncEngine.getProductById(id, companyId);
  }

  async sendProductList(sock, targetJid, products = [], options = {}) {
    const nativeProductSender = require('./NativeProductSender');
    const productIds = products.map(p => (typeof p === 'string' ? p : p.id || p.productId));
    return await nativeProductSender.sendMultiple(sock, {
      remoteJid: targetJid,
      productIds,
      options,
    });
  }

  async getCart(sock, orderId, token) {
    return await this.getOrderDetails(sock, orderId, token);
  }

  async receiveCart(sock, rawMessage, context = {}) {
    const cartOrderListener = require('./CartOrderListener');
    return await cartOrderListener.handleIncomingOrder(sock, rawMessage, context);
  }

  async getOrder(orderId, companyId = 'default') {
    const orderConfirmationEngine = require('./OrderConfirmationEngine');
    return await orderConfirmationEngine.getOrder(orderId, companyId);
  }

  async acceptOrder(sock, targetJid, order, options = {}) {
    return await this.confirmOrder(sock, targetJid, order, options);
  }
}

module.exports = new BaileysCommerceAdapter();
