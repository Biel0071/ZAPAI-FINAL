'use strict';

const baileysCommerceAdapter = require('./BaileysCommerceAdapter');
const productRepository = require('../../src/data/repositories/productRepository');
const messageRepository = require('../../src/data/repositories/messageRepository');
const { query: dbQuery } = require('../../src/infrastructure/config/database');

class NativeProductSender {
  /**
   * Send a native product message to a WhatsApp recipient
   */
  async send(sock, { phone, remoteJid, productId, product, companyId = 'default', conversationId, caption, options = {} }) {
    if (!sock) throw new Error('WhatsApp socket is not connected or initialized.');
    let targetJid = remoteJid;
    if (!targetJid && phone) {
      if (phone.includes('@')) targetJid = phone;
      else if (phone.length >= 14) targetJid = `${phone}@lid`;
      else targetJid = `${phone.replace(/\D/g, '')}@s.whatsapp.net`;
    }
    if (!targetJid) throw new Error('Recipient JID or phone is required.');

    let resolvedProduct = product;
    if (!resolvedProduct && productId) {
      resolvedProduct = await productRepository.findById(productId, companyId);
    }
    if (!resolvedProduct) {
      throw new Error(`Product not found with id: ${productId}`);
    }

    // Dispatch authentic Baileys ProductMessage
    const sendResult = await baileysCommerceAdapter.sendProduct(sock, targetJid, resolvedProduct, {
      ...options,
      caption: caption || options.caption,
    });

    const whatsappMessageId = sendResult?.key?.id || `wamid_${Date.now()}`;
    const primaryImage = Array.isArray(resolvedProduct.images) && resolvedProduct.images.length > 0
      ? resolvedProduct.images[0]
      : (resolvedProduct.image || null);

    // Save to CRM messages table if conversationId is provided
    let persistedMessage = null;
    try {
      if (conversationId) {
        persistedMessage = await messageRepository.createMessage({
          companyId,
          conversationId,
          phone: targetJid.split('@')[0],
          text: caption || `*${resolvedProduct.name}*\nR$ ${(Number(resolvedProduct.price) || 0).toFixed(2)}`,
          mediaType: 'product',
          mediaPath: primaryImage,
          fromMe: true,
          status: 'sent',
          sessionId: options.sessionId || 'main',
          timestamp: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          sender: 'human',
          direction: 'outgoing',
          whatsappMessageId,
          remoteJid: targetJid,
          type: 'product',
        });

        // Broadcast to Inbox via socket.io if available
        if (global.io) {
          global.io.to(`tenant:${companyId}`).emit('new_message', {
            ...persistedMessage,
            product: resolvedProduct,
          });
        }
      }
    } catch (saveErr) {
      console.warn('[NATIVE-PRODUCT-SENDER] Failed to persist product message in CRM DB:', saveErr.message);
    }

    return {
      success: true,
      whatsappMessageId,
      product: resolvedProduct,
      persistedMessage,
    };
  }

  /**
   * Send multiple products sequentially
   */
  async sendMultiple(sock, { phone, remoteJid, productIds = [], companyId = 'default', conversationId, options = {} }) {
    const results = [];
    for (const prodId of productIds) {
      const res = await this.send(sock, {
        phone,
        remoteJid,
        productId: prodId,
        companyId,
        conversationId,
        options,
      });
      results.push(res);
      // Small pause between multiple sends to prevent flooding
      await new Promise(r => setTimeout(r, 600));
    }
    return {
      success: true,
      sentCount: results.length,
      results,
    };
  }
}

module.exports = new NativeProductSender();
